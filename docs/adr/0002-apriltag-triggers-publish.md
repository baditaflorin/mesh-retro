---
status: accepted
date: 2026-05-12
---

# 0002 — ArUco triggers publish, not ArUco encodes content

## Context

The "hold up a paper card to publish" UX has two natural implementations:

1. **Tag + OCR.** Each card has both an ArUco tag and the user's handwritten
   text. The camera detects the tag for positioning, then runs OCR on the
   surrounding region to extract the text.
2. **Tag triggers publish of a typed note.** Each peer types their note on
   their phone first (kept local). The tag, when seen by the wall camera,
   tells the wall "this peer's pending note becomes a card now."

## Decision

Use approach #2 — **ArUco tags are publish triggers, not content carriers**.

Each peer types the note on their own phone first; the note lives in a
`Y.Map<peerId, { tagId, pendingNote, pendingColumn }>` keyed by their stable
local UUID. When the wall camera detects a tag, the wall looks up the
peer with that `tagId` and moves their `pendingNote` to the anonymous
`Y.Array<Card>` (clearing the pending field).

## Consequences

- **Bundle stays under 200 KB.** Tesseract.js is ~4 MB of WASM; we shipped
  ~40 KB of js-aruco2 instead.
- **Works on handwriting.** Tesseract has notoriously poor accuracy on
  cursive or casual handwriting. The trigger-only model never reads the
  paper, so handwriting style is irrelevant.
- **The "in-person feel" is preserved.** Members still pick up a paper card,
  hold it up to the camera, see the wall light up with their note. The
  fact that the text was already typed on their phone is invisible.
- **Pending notes are correlatable.** While a note is pending, the publishers
  map maps `peerId -> pendingNote`. Anyone in the room can read the Yjs doc
  and link a note to a peer ID. But once published, the `Card` entry
  carries no identity (see ADR 0003).

## Alternatives considered

- **In-browser OCR (Tesseract.js).** Rejected for bundle size and accuracy.
- **Server-side OCR.** Out of scope — `mesh-retro` is Mode A, no backend.
- **Audio dictation.** Possible future direction but requires mic permission
  and falls afoul of multiple-people-talking-at-once.
