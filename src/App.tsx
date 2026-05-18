import { useEffect, useState } from "react";
import { Retro, type Mode, type ColumnSet } from "./features/retro/Retro";
import { SettingsDrawer } from "./features/settings/SettingsDrawer";
import { appConfig } from "./shared/config";
import { InviteShareButton } from "@baditaflorin/mesh-common";

const STORAGE = {
  room: `${appConfig.storagePrefix}:room`,
  tagId: `${appConfig.storagePrefix}:tagId`,
  peerId: `${appConfig.storagePrefix}:peerId`,
  mode: `${appConfig.storagePrefix}:mode`,
  columnSet: `${appConfig.storagePrefix}:columnSet`,
  isWall: `${appConfig.storagePrefix}:isWall`,
};

function readString(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback;
}
function readMaybeNumber(key: string): number | null {
  const raw = localStorage.getItem(key);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
function readBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : raw === "1";
}

function getOrCreatePeerId(): string {
  const existing = localStorage.getItem(STORAGE.peerId);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE.peerId, id);
  return id;
}

export function App() {
  const [roomId, setRoomId] = useState(() => readString(STORAGE.room, "default"));
  const [tagId, setTagId] = useState<number | null>(() => readMaybeNumber(STORAGE.tagId));
  const [mode, setMode] = useState<Mode>(() => (readString(STORAGE.mode, "tap") as Mode) || "tap");
  const [columnSet, setColumnSet] = useState<ColumnSet>(
    () => (readString(STORAGE.columnSet, "msg") as ColumnSet) || "msg",
  );
  const [isWall, setIsWall] = useState<boolean>(() => readBool(STORAGE.isWall, false));
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [peerId] = useState(() => getOrCreatePeerId());

  useEffect(() => {
    localStorage.setItem(STORAGE.room, roomId);
  }, [roomId]);
  useEffect(() => {
    if (tagId === null) localStorage.removeItem(STORAGE.tagId);
    else localStorage.setItem(STORAGE.tagId, String(tagId));
  }, [tagId]);
  useEffect(() => {
    localStorage.setItem(STORAGE.mode, mode);
  }, [mode]);
  useEffect(() => {
    localStorage.setItem(STORAGE.columnSet, columnSet);
  }, [columnSet]);
  useEffect(() => {
    localStorage.setItem(STORAGE.isWall, isWall ? "1" : "0");
  }, [isWall]);

  return (
    <div className="app-root">
      <Retro
        roomId={roomId}
        myTagId={tagId}
        myPeerId={peerId}
        mode={mode}
        columnSet={columnSet}
        isWall={isWall}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <InviteShareButton appName={appConfig.appName} roomId={roomId} />
      <button
        type="button"
        className="settings-fab"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
      >
        ⚙
      </button>

      <div className="self-ref">
        <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
          source
        </a>
        <span aria-hidden="true">·</span>
        <a href={appConfig.paypalUrl} target="_blank" rel="noreferrer">
          tip ♥
        </a>
        <span aria-hidden="true">·</span>
        <span>
          v{appConfig.version} · {appConfig.commit}
        </span>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomId={roomId}
        onRoomChange={setRoomId}
        tagId={tagId}
        onTagIdChange={setTagId}
        mode={mode}
        onModeChange={setMode}
        columnSet={columnSet}
        onColumnSetChange={setColumnSet}
        isWall={isWall}
        onIsWallChange={setIsWall}
      />
    </div>
  );
}
