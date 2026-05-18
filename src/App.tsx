import { useEffect, useState } from "react";
import { MeshShell } from "@baditaflorin/mesh-common";
import { Retro, type Mode, type ColumnSet } from "./features/retro/Retro";
import { SettingsExtras } from "./features/settings/SettingsExtras";
import { appConfig } from "./shared/config";

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
    <MeshShell
      config={appConfig}
      roomId={roomId}
      onRoomChange={setRoomId}
      settingsExtras={
        <SettingsExtras
          tagId={tagId}
          onTagIdChange={setTagId}
          mode={mode}
          onModeChange={setMode}
          columnSet={columnSet}
          onColumnSetChange={setColumnSet}
          isWall={isWall}
          onIsWallChange={setIsWall}
        />
      }
    >
      <Retro
        roomId={roomId}
        myTagId={tagId}
        myPeerId={peerId}
        mode={mode}
        columnSet={columnSet}
        isWall={isWall}
        // Settings live in MeshShell's drawer (top-right ⚙ FAB).
        onOpenSettings={() => {}}
      />
    </MeshShell>
  );
}
