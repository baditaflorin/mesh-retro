import { useEffect, useState } from "react";
import {
  loadSignalingUrl,
  loadTurnTokenUrl,
  resetIceServers,
  saveSignalingUrl,
  saveTurnTokenUrl,
} from "../sync/iceConfig";
import { appConfig } from "../../shared/config";
import type { Mode, ColumnSet } from "../retro/Retro";

type Props = {
  open: boolean;
  onClose: () => void;
  roomId: string;
  onRoomChange: (next: string) => void;
  tagId: number | null;
  onTagIdChange: (next: number | null) => void;
  mode: Mode;
  onModeChange: (next: Mode) => void;
  columnSet: ColumnSet;
  onColumnSetChange: (next: ColumnSet) => void;
  isWall: boolean;
  onIsWallChange: (next: boolean) => void;
};

export function SettingsDrawer({
  open,
  onClose,
  roomId,
  onRoomChange,
  tagId,
  onTagIdChange,
  mode,
  onModeChange,
  columnSet,
  onColumnSetChange,
  isWall,
  onIsWallChange,
}: Props) {
  const [signaling, setSignaling] = useState(loadSignalingUrl());
  const [tokenUrl, setTokenUrl] = useState(loadTurnTokenUrl());

  useEffect(() => {
    if (open) {
      setSignaling(loadSignalingUrl());
      setTokenUrl(loadTurnTokenUrl());
    }
  }, [open]);

  if (!open) return null;

  const baseUrl = import.meta.env.BASE_URL;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <label>
          <span>Room ID</span>
          <input value={roomId} onChange={(e) => onRoomChange(e.target.value)} />
        </label>

        <label>
          <span>Your tag ID (printed marker number)</span>
          <input
            type="number"
            min={1}
            max={249}
            value={tagId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") onTagIdChange(null);
              else onTagIdChange(Number(v));
            }}
            placeholder="e.g. 1"
          />
        </label>

        <label>
          <span>Column set</span>
          <select
            value={columnSet}
            onChange={(e) => onColumnSetChange(e.target.value as ColumnSet)}
          >
            <option value="msg">Mad / Sad / Glad</option>
            <option value="ssc">Start / Stop / Continue</option>
          </select>
        </label>

        <label>
          <span>Publish mode</span>
          <select value={mode} onChange={(e) => onModeChange(e.target.value as Mode)}>
            <option value="tap">Tap (send to wall button)</option>
            <option value="apriltag">ArUco (wall camera scans tags)</option>
          </select>
        </label>

        <label className="retro-check">
          <input
            type="checkbox"
            checked={isWall}
            onChange={(e) => onIsWallChange(e.target.checked)}
          />
          <span>This phone is the wall display (runs the camera in ArUco mode)</span>
        </label>

        <a
          className="retro-pdf-link"
          href={`${baseUrl}marker-sheet.pdf`}
          target="_blank"
          rel="noreferrer"
        >
          Download printable marker sheet (PDF)
        </a>

        <p className="settings-help">
          In ArUco mode, type your note on this phone first, then hold a paper card with your
          printed tag in front of the wall's camera. Your typed note is published anonymously to the
          wall.
        </p>

        <hr />

        <h3>Self-hosted infra (advanced)</h3>
        <p className="settings-help">
          Override the default signaling and TURN endpoints. Leave blank to use the built-in
          defaults (<code>{appConfig.signalingUrl}</code> and <code>{appConfig.turnTokenUrl}</code>
          ).
        </p>

        <label>
          <span>Signaling URL</span>
          <input
            value={signaling}
            onChange={(e) => setSignaling(e.target.value)}
            placeholder={appConfig.signalingUrl}
          />
        </label>

        <label>
          <span>TURN credentials URL</span>
          <input
            value={tokenUrl}
            onChange={(e) => setTokenUrl(e.target.value)}
            placeholder={appConfig.turnTokenUrl}
          />
        </label>

        <div className="settings-actions">
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl(signaling);
              saveTurnTokenUrl(tokenUrl);
              onClose();
              location.reload();
            }}
          >
            Save and reload
          </button>
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl("");
              saveTurnTokenUrl("");
              resetIceServers();
              onClose();
              location.reload();
            }}
          >
            Reset to defaults
          </button>
        </div>

        <hr />

        <footer className="settings-footer">
          <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
            source on github
          </a>
          <span>
            v{appConfig.version} · {appConfig.commit}
          </span>
        </footer>
      </div>
    </div>
  );
}
