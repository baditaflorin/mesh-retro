import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

/**
 * Load-bearing cross-peer assertion for the advertised core action:
 * "anonymous Mad/Sad/Glad board with dot voting."
 *
 * The ArUco camera path cannot be driven headless, but the board+voting core
 * (the "tap" publish mode and dot voting) is pure shared Yjs state. We drive
 * BOTH advertised actions on peer A and assert the result on the OPPOSITE peer:
 *
 *   1. Peer A composes a card and taps "Send to wall" → peer B sees the card.
 *   2. Peer A switches to the vote phase and casts a dot vote → peer B sees the
 *      same phase change AND the updated vote tally (●1) on the shared card.
 *   3. Peer B votes too → peer A sees ●2 (both peers' votes merge in one tally).
 *   4. Peer A switches to the action phase → peer B sees the phase change AND
 *      the top-voted card highlighted as an action item.
 *
 * This fails on any regression that routes cards/votes through React useState
 * instead of the Yjs doc (yCards / yVotes / yState), or that forgets the
 * room.doc.transact, because peer B reads its own independent doc replica.
 */
test("peer A's card and dot vote propagate to peer B over the mesh", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // Both peers join the retro (the "arm" gate that opens the Yjs room).
    await a.getByRole("button", { name: /join the retro/i }).click();
    await b.getByRole("button", { name: /join the retro/i }).click();

    // Peer A is in the default compose phase + tap mode. Write a card and send.
    const cardText = `mesh-card-${Math.random().toString(36).slice(2, 8)}`;
    await a.locator("textarea.retro-textarea").fill(cardText);
    await a.getByRole("button", { name: /send to wall/i }).click();

    // CROSS-PEER ASSERTION 1: peer B sees the card peer A published.
    await expect(b.getByText(cardText)).toBeVisible();
    // And peer A still sees it locally.
    await expect(a.getByText(cardText)).toBeVisible();

    // Peer A advances the shared phase to "vote" (yState mutation).
    await a.locator(".retro-phase-btn", { hasText: "Vote" }).click();

    // CROSS-PEER ASSERTION 2: peer B's phase changes to "vote" too.
    await expect(b.locator(".retro-hud")).toContainText("phase: vote");

    // Peer A casts a dot vote on the card (yVotes mutation).
    await a.locator(".retro-card", { hasText: cardText }).click();

    // CROSS-PEER ASSERTION 3: peer B sees the updated vote tally (●1) on the
    // SAME card — proving the vote crossed the mesh, not just local state.
    await expect(
      b.locator(".retro-card", { hasText: cardText }).locator(".retro-card-dots"),
    ).toHaveText("●1");

    // Peer B also votes on the same card (a vote from the OPPOSITE peer).
    await b.locator(".retro-card", { hasText: cardText }).click();

    // CROSS-PEER ASSERTION 4: peer A now sees ●2 — both peers' votes are
    // merged into the same Y.Map<peerId> tally, not double-counted or lost.
    await expect(
      a.locator(".retro-card", { hasText: cardText }).locator(".retro-card-dots"),
    ).toHaveText("●2");

    // Peer A advances the shared phase to "action" (the third advertised phase).
    await a.locator(".retro-phase-btn", { hasText: "Action" }).click();

    // CROSS-PEER ASSERTION 5: the action phase + top-3 highlight propagate.
    // Peer B sees the phase flip AND the most-voted card highlighted as a
    // top action item — proving the action view is shared, not per-peer.
    await expect(b.locator(".retro-hud")).toContainText("phase: action");
    await expect(b.locator(".retro-card", { hasText: cardText })).toHaveClass(/retro-card-top/);
  } finally {
    await cleanup();
  }
});
