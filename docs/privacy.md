# Privacy threat model — mesh-retro

## What other peers in the same room can see

- **Published cards** (`Y.Array<Card>`): `{ id, column, text, ts }`. No author
  field. See [ADR 0003](adr/0003-anonymity-via-no-from-field.md).
- **Pending notes** (`Y.Map<peerId, Publisher>`): `{ tagId, pendingNote,
  pendingColumn }` keyed by a stable per-device UUID. Correlatable to that
  UUID, but only until the note is published — then `pendingNote` is set to
  `null` in the same transaction that publishes the `Card`.
- **Votes** (`Y.Map<cardId, Y.Map<peerId, true>>`): who voted for what.
  Intentional, used to cap each voter at 3 dots.
- **Session state** (`{ phase, columnSet }`): which retro phase is active and
  the column-label scheme.

## What stays local

- Your room ID, tag ID, mode, column-set preference, and wall-display flag
  live in `localStorage`.
- Your peer UUID (`mesh-retro:peerId`) is generated on first load and
  persists. It's not tied to your identity outside this app and you can wipe
  it by clearing site data.
- Your typed-but-not-yet-published note is in `localStorage` (key
  `mesh-retro:pending-note`) so a reload doesn't lose it.
- The wall camera frame is processed locally; only the detected marker ID is
  written into Yjs. Pixels never leave the device.

## What the signaling server sees

`signaling-server` sees the room name (`mesh-retro:<roomId>`), encrypted SDP
exchanges, and the connecting peer's IP. It does not see cards, votes, or
camera frames.

## What the TURN server sees

`coturn-hetzner` relays encrypted WebRTC bytes when peers can't connect
directly. It sees IPs and encrypted payloads it cannot decrypt.

## Permissions asked

- **Camera (`getUserMedia`)** — only on the wall display, only in ArUco
  mode, only after you tap the arm button. Released on tab close or mode
  switch.

## What's NOT in the threat model

- **Anonymity of votes.** Vote correlation is deliberate (3-dots-per-peer
  enforcement). If your team needs vote anonymity, vote on someone else's
  phone or run the retro in tap mode and trust the wall not to log.
- **Bystanders.** Anyone walking past the wall can read the cards on the
  projector. Same as a physical sticky-note retro.
