---
status: accepted
date: 2026-05-12
---

# 0003 — Anonymity via "no from-field"

## Context

A retro board's whole value depends on participants being honest about
frustrations, and that depends on cards being **anonymous**. We need a data
shape where you cannot link a published card to the peer who wrote it, even
with full read access to the Yjs document.

## Decision

The published cards live in a flat `Y.Array<Card>`:

```ts
type Card = { id: string; column: "mad" | "sad" | "glad"; text: string; ts: number };
```

No `peerId`, no `clientID`, no `tagId`. There is no field in the Card record
that ties it back to its author.

A separate `Y.Map<peerId, Publisher>` carries the **pending** note for each
peer, indexed by their stable local UUID. This map is transient: when the
note is published (either by tap or by ArUco trigger), the publisher's
`pendingNote` is set to `null` in the same Yjs transaction that pushes the
`Card`. The pending map is correlatable, but pending notes only exist before
publication; the moment they're on the wall, the link is gone.

Dot votes are stored in `Y.Map<cardId, Y.Map<peerId, true>>`. Vote
correlation is intentional — we want to enforce "3 dots per peer." The
voting peer-id is the same stable UUID; if you don't want voting
correlatable, vote on someone else's phone.

## Consequences

- **Real anonymity for cards.** A debugger user inspecting the Yjs doc post-
  publication finds `{ id, column, text, ts }` and nothing else.
- **Vote uncoupling, but tied to peer-id for fairness.** This is a
  deliberate trade-off; if anonymity of votes is required, future work could
  use a commit-reveal pattern (see `anon-conf-poll` for the Semaphore
  approach).
- **The ts (timestamp) leaks ordering.** Anyone watching the room live can
  correlate "the card with `ts: 17152123` arrived right after I saw Alex tap
  Send." This is unavoidable at this layer; you could batch-shuffle on
  phase change to defeat this, but the retro flow doesn't really need that.

## Alternatives considered

- **End-to-end encrypted cards with one-time keys.** Overkill — the room is
  trusted to be the room. Cards aren't secret from peers, just unlinked.
- **Strip ts at publish.** Considered, but the wall display sorts by arrival
  and that's useful UX. Net leak is small.
