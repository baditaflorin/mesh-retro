import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { createRoomSync } from "../sync/yjsRoom";
import { maybeFetchTurnCredentials } from "../sync/iceConfig";
import {
  startScanner,
  drawPreview,
  type MarkerEvent,
  type ScannerHandle,
} from "../markers/scanner";

export type Mode = "tap" | "apriltag";
export type ColumnSet = "msg" | "ssc";
export type Phase = "compose" | "vote" | "action";

type Column = "mad" | "sad" | "glad";

type Card = {
  id: string;
  column: Column;
  text: string;
  ts: number;
};

type Publisher = {
  tagId: number | null;
  pendingNote: string | null;
  pendingColumn: Column;
};

type SessionState = {
  phase: Phase;
  columnSet: ColumnSet;
};

const COLUMN_LABELS: Record<ColumnSet, Record<Column, string>> = {
  msg: { mad: "Mad", sad: "Sad", glad: "Glad" },
  ssc: { mad: "Stop", sad: "Continue", glad: "Start" },
};

type Props = {
  roomId: string;
  myTagId: number | null;
  myPeerId: string;
  mode: Mode;
  columnSet: ColumnSet;
  isWall: boolean;
  onOpenSettings: () => void;
};

export function Retro({
  roomId,
  myTagId,
  myPeerId,
  mode,
  columnSet,
  isWall,
  onOpenSettings,
}: Props) {
  const [armed, setArmed] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [votes, setVotes] = useState<Record<string, Set<string>>>({});
  const [state, setState] = useState<SessionState>({ phase: "compose", columnSet });
  const [pendingNote, setPendingNote] = useState<string>(
    () => localStorage.getItem("mesh-retro:pending-note") ?? "",
  );
  const [pendingColumn, setPendingColumn] = useState<Column>("glad");
  const [peers, setPeers] = useState(0);
  const [lastMarker, setLastMarker] = useState<number | null>(null);

  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const scannerRef = useRef<ScannerHandle | null>(null);
  const peerSamples = useRef(new Set<number>());

  const meshHandle = useMemo(() => {
    if (!armed) return null;
    const room = createRoomSync(roomId);
    return { room };
  }, [armed, roomId]);

  useEffect(() => {
    if (!armed) return;
    void maybeFetchTurnCredentials();
  }, [armed]);

  useEffect(() => {
    return () => {
      meshHandle?.room.provider?.destroy();
      scannerRef.current?.stop();
      scannerRef.current = null;
    };
  }, [meshHandle]);

  // Bind Yjs and update local state.
  useEffect(() => {
    if (!meshHandle) return;
    const doc = meshHandle.room.doc;
    const yCards = doc.getArray<Card>("cards");
    const yVotes = doc.getMap<Y.Map<boolean>>("votes");
    const yPublishers = doc.getMap<Publisher>("publishers");
    const yState = doc.getMap("state");

    const readCards = () => setCards(yCards.toArray());
    const readVotes = () => {
      const next: Record<string, Set<string>> = {};
      yVotes.forEach((peerMap, cardId) => {
        const s = new Set<string>();
        peerMap.forEach((_, peerId) => s.add(peerId));
        next[cardId] = s;
      });
      setVotes(next);
    };
    const readState = () => {
      setState({
        phase: (yState.get("phase") as Phase | undefined) ?? "compose",
        columnSet: (yState.get("columnSet") as ColumnSet | undefined) ?? columnSet,
      });
    };

    if (!yState.has("phase")) yState.set("phase", "compose");
    if (!yState.has("columnSet")) yState.set("columnSet", columnSet);

    readCards();
    readVotes();
    readState();

    yCards.observe(readCards);
    yVotes.observeDeep(readVotes);
    yState.observe(readState);

    // Publish our publisher state (tagId + pendingNote).
    yPublishers.set(myPeerId, {
      tagId: myTagId,
      pendingNote: pendingNote || null,
      pendingColumn,
    });

    // Awareness for peer count.
    const awareness = (
      meshHandle.room.provider as unknown as {
        awareness?: {
          on: (e: string, cb: () => void) => void;
          off: (e: string, cb: () => void) => void;
          getStates: () => Map<number, unknown>;
        };
      } | null
    )?.awareness;
    const updatePeers = () => {
      if (!awareness) return;
      const m = awareness.getStates();
      peerSamples.current = new Set(m.keys());
      setPeers(Math.max(0, m.size - 1));
    };
    awareness?.on("change", updatePeers);
    updatePeers();

    return () => {
      yCards.unobserve(readCards);
      yVotes.unobserveDeep(readVotes);
      yState.unobserve(readState);
      awareness?.off("change", updatePeers);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meshHandle]);

  // Persist pending note locally + push to Yjs.
  useEffect(() => {
    localStorage.setItem("mesh-retro:pending-note", pendingNote);
    if (!meshHandle) return;
    const yPublishers = meshHandle.room.doc.getMap<Publisher>("publishers");
    yPublishers.set(myPeerId, {
      tagId: myTagId,
      pendingNote: pendingNote || null,
      pendingColumn,
    });
  }, [pendingNote, pendingColumn, meshHandle, myPeerId, myTagId]);

  // Scanner only on wall + apriltag mode.
  useEffect(() => {
    if (!armed || !isWall || mode !== "apriltag") {
      scannerRef.current?.stop();
      scannerRef.current = null;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const h = await startScanner({
          width: 480,
          height: 360,
          onMarker: (m) => onScannedMarker(m, meshHandle?.room.doc ?? null),
          onFrame: (markers) => {
            if (previewRef.current && scannerRef.current) {
              drawPreview(previewRef.current, scannerRef.current.canvas, markers);
            }
          },
        });
        if (cancelled) {
          h.stop();
          return;
        }
        scannerRef.current = h;
      } catch (err) {
        console.warn("[scanner] failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, isWall, mode, meshHandle]);

  function onScannedMarker(m: MarkerEvent, doc: Y.Doc | null) {
    if (!doc) return;
    setLastMarker(m.id);
    const yPublishers = doc.getMap<Publisher>("publishers");
    const yCards = doc.getArray<Card>("cards");
    // Find the publisher whose tagId matches.
    let foundPeerId: string | null = null;
    let foundEntry: Publisher | null = null;
    yPublishers.forEach((entry, peerId) => {
      if (entry?.tagId === m.id) {
        foundPeerId = peerId;
        foundEntry = entry;
      }
    });
    if (!foundPeerId || !foundEntry) return;
    const entry: Publisher = foundEntry;
    if (!entry.pendingNote || !entry.pendingNote.trim()) return;
    const card: Card = {
      id: crypto.randomUUID(),
      column: entry.pendingColumn,
      text: entry.pendingNote.trim(),
      ts: Date.now(),
    };
    doc.transact(() => {
      yCards.push([card]);
      // Clear that peer's pending note via the publishers map.
      yPublishers.set(foundPeerId as unknown as string, { ...entry, pendingNote: null });
    });
  }

  const publishLocalNote = () => {
    if (!meshHandle) return;
    if (!pendingNote.trim()) return;
    const doc = meshHandle.room.doc;
    const yCards = doc.getArray<Card>("cards");
    const yPublishers = doc.getMap<Publisher>("publishers");
    const card: Card = {
      id: crypto.randomUUID(),
      column: pendingColumn,
      text: pendingNote.trim(),
      ts: Date.now(),
    };
    doc.transact(() => {
      yCards.push([card]);
      yPublishers.set(myPeerId, { tagId: myTagId, pendingNote: null, pendingColumn });
    });
    setPendingNote("");
  };

  const toggleVote = (cardId: string) => {
    if (!meshHandle) return;
    const doc = meshHandle.room.doc;
    const yVotes = doc.getMap<Y.Map<boolean>>("votes");
    let cardVotes = yVotes.get(cardId);
    if (!cardVotes) {
      cardVotes = new Y.Map<boolean>();
      yVotes.set(cardId, cardVotes);
    }
    if (cardVotes.has(myPeerId)) {
      cardVotes.delete(myPeerId);
    } else {
      // Cap at 3 dots total across all cards.
      let used = 0;
      yVotes.forEach((m) => {
        if (m.has(myPeerId)) used += 1;
      });
      if (used >= 3) return;
      cardVotes.set(myPeerId, true);
    }
  };

  const myUsedDots = Object.values(votes).filter((s) => s.has(myPeerId)).length;
  const dotsLeft = 3 - myUsedDots;

  const setPhase = (next: Phase) => {
    if (!meshHandle) return;
    meshHandle.room.doc.getMap("state").set("phase", next);
  };

  const exportMarkdown = () => {
    const labels = COLUMN_LABELS[state.columnSet];
    const sorted = [...cards].sort((a, b) => {
      const va = votes[a.id]?.size ?? 0;
      const vb = votes[b.id]?.size ?? 0;
      return vb - va;
    });
    const lines: string[] = ["# Retro action items\n"];
    for (const c of sorted.slice(0, 3)) {
      lines.push(`- **[${labels[c.column]}]** ${c.text}  _(${votes[c.id]?.size ?? 0} votes)_`);
    }
    lines.push("\n---\n\n## All cards\n");
    for (const col of ["glad", "sad", "mad"] as const) {
      lines.push(`\n### ${labels[col]}\n`);
      for (const c of cards.filter((c) => c.column === col)) {
        lines.push(`- ${c.text}  _(${votes[c.id]?.size ?? 0})_`);
      }
    }
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `retro-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const arm = () => setArmed(true);

  if (!armed) {
    return (
      <div className="retro-arm">
        <h1>mesh-retro</h1>
        <p>
          Anonymous retro board. Type a card on your phone, send it to the wall. Dot-vote at the
          end.
          {mode === "apriltag"
            ? " ArUco mode: write notes on paper next to a printed tag; the wall camera publishes when it sees your tag."
            : null}
        </p>
        <p className="retro-arm-info">
          Tag <code>{myTagId ?? "(none)"}</code> · role{" "}
          <code>{isWall ? "wall display" : "peer"}</code>
        </p>
        <button type="button" className="retro-arm-button" onClick={arm}>
          {isWall ? "Open the wall display" : "Join the retro"}
        </button>
        <button type="button" className="retro-arm-secondary" onClick={onOpenSettings}>
          Open settings
        </button>
        <p className="retro-hint">
          Room <code>{roomId}</code> · {COLUMN_LABELS[columnSet].mad}/{COLUMN_LABELS[columnSet].sad}
          /{COLUMN_LABELS[columnSet].glad}
        </p>
      </div>
    );
  }

  const labels = COLUMN_LABELS[state.columnSet];

  return (
    <div className="retro-stage">
      <div className="retro-hud">
        <span>{peers + 1} phones</span>
        <span aria-hidden="true">·</span>
        <span>phase: {state.phase}</span>
        {lastMarker !== null ? (
          <>
            <span aria-hidden="true">·</span>
            <span>last #{lastMarker}</span>
          </>
        ) : null}
      </div>

      {isWall && mode === "apriltag" && (
        <canvas
          ref={previewRef}
          className="retro-preview"
          width={240}
          height={180}
          aria-label="ArUco scanner preview"
        />
      )}

      <div className="retro-phase-bar">
        <button
          type="button"
          className={"retro-phase-btn" + (state.phase === "compose" ? " retro-phase-active" : "")}
          onClick={() => setPhase("compose")}
        >
          Compose
        </button>
        <button
          type="button"
          className={"retro-phase-btn" + (state.phase === "vote" ? " retro-phase-active" : "")}
          onClick={() => setPhase("vote")}
        >
          Vote
        </button>
        <button
          type="button"
          className={"retro-phase-btn" + (state.phase === "action" ? " retro-phase-active" : "")}
          onClick={() => setPhase("action")}
        >
          Action
        </button>
      </div>

      {state.phase === "compose" && !isWall && (
        <div className="retro-compose">
          <textarea
            className="retro-textarea"
            placeholder="Write your card…"
            value={pendingNote}
            onChange={(e) => setPendingNote(e.target.value)}
            rows={3}
          />
          <div className="retro-compose-row">
            <select
              value={pendingColumn}
              onChange={(e) => setPendingColumn(e.target.value as Column)}
            >
              <option value="mad">{labels.mad}</option>
              <option value="sad">{labels.sad}</option>
              <option value="glad">{labels.glad}</option>
            </select>
            {mode === "tap" ? (
              <button type="button" onClick={publishLocalNote} disabled={!pendingNote.trim()}>
                Send to wall
              </button>
            ) : (
              <span className="retro-compose-hint">
                Hold tag #{myTagId ?? "?"} to the wall camera to publish.
              </span>
            )}
          </div>
        </div>
      )}

      <div className="retro-board">
        {(["mad", "sad", "glad"] as const).map((col) => (
          <div className="retro-col" key={col}>
            <div className="retro-col-head">{labels[col]}</div>
            <div className="retro-col-body">
              {cards
                .filter((c) => c.column === col)
                .map((c) => {
                  const voteCount = votes[c.id]?.size ?? 0;
                  const iVoted = votes[c.id]?.has(myPeerId) ?? false;
                  const isTop3 =
                    state.phase === "action" &&
                    [...cards]
                      .sort((a, b) => (votes[b.id]?.size ?? 0) - (votes[a.id]?.size ?? 0))
                      .slice(0, 3)
                      .some((t) => t.id === c.id);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      className={
                        "retro-card" +
                        (state.phase === "vote" ? " retro-card-clickable" : "") +
                        (iVoted ? " retro-card-mine" : "") +
                        (isTop3 ? " retro-card-top" : "")
                      }
                      onClick={() => state.phase === "vote" && toggleVote(c.id)}
                    >
                      <span className="retro-card-text">{c.text}</span>
                      {voteCount > 0 ? <span className="retro-card-dots">●{voteCount}</span> : null}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {state.phase === "vote" && (
        <div className="retro-vote-hud">
          {dotsLeft} dot{dotsLeft === 1 ? "" : "s"} left
        </div>
      )}

      {state.phase === "action" && (
        <div className="retro-actions">
          <button type="button" onClick={exportMarkdown}>
            Export action items (markdown)
          </button>
        </div>
      )}
    </div>
  );
}
