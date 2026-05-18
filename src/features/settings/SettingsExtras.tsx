import type { Mode, ColumnSet } from "../retro/Retro";

type Props = {
  tagId: number | null;
  onTagIdChange: (next: number | null) => void;
  mode: Mode;
  onModeChange: (next: Mode) => void;
  columnSet: ColumnSet;
  onColumnSetChange: (next: ColumnSet) => void;
  isWall: boolean;
  onIsWallChange: (next: boolean) => void;
};

export function SettingsExtras({
  tagId,
  onTagIdChange,
  mode,
  onModeChange,
  columnSet,
  onColumnSetChange,
  isWall,
  onIsWallChange,
}: Props) {
  const baseUrl = import.meta.env.BASE_URL;

  return (
    <>
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
        <select value={columnSet} onChange={(e) => onColumnSetChange(e.target.value as ColumnSet)}>
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

      <p className="mesh-settings-help">
        In ArUco mode, type your note on this phone first, then hold a paper card with your printed
        tag in front of the wall's camera. Your typed note is published anonymously to the wall.
      </p>
    </>
  );
}
