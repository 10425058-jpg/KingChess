import { create } from 'zustand';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../storage/persistence';
import type {
  AppSettings,
  BoardThemeId,
  MotionPreference,
  PieceThemeId,
} from '../types/chess';

interface SettingsState extends AppSettings {
  corruptSettingsRecovered: boolean;
  setBoardTheme: (theme: BoardThemeId) => void;
  setPieceTheme: (theme: PieceThemeId) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setShowCoordinates: (show: boolean) => void;
  setMotionPreference: (pref: MotionPreference) => void;
  setShowEvalBar: (show: boolean) => void;
  setAllowHints: (allow: boolean) => void;
  resetSettings: () => void;
  dismissCorruptNotice: () => void;
}

const initialLoad = loadSettings();

function persistNext(state: SettingsState, patch: Partial<AppSettings>): AppSettings {
  const next: AppSettings = {
    version: 1,
    boardTheme: patch.boardTheme ?? state.boardTheme,
    pieceTheme: patch.pieceTheme ?? state.pieceTheme,
    soundEnabled: patch.soundEnabled ?? state.soundEnabled,
    showCoordinates: patch.showCoordinates ?? state.showCoordinates,
    motionPreference: patch.motionPreference ?? state.motionPreference,
    showEvalBar: patch.showEvalBar ?? state.showEvalBar,
    allowHints: patch.allowHints ?? state.allowHints,
  };
  saveSettings(next);
  return next;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...initialLoad.settings,
  corruptSettingsRecovered: initialLoad.recoveredFromCorrupt,

  setBoardTheme: (boardTheme) =>
    set((state) => persistNext(state, { boardTheme })),
  setPieceTheme: (pieceTheme) =>
    set((state) => persistNext(state, { pieceTheme })),
  setSoundEnabled: (soundEnabled) =>
    set((state) => persistNext(state, { soundEnabled })),
  setShowCoordinates: (showCoordinates) =>
    set((state) => persistNext(state, { showCoordinates })),
  setMotionPreference: (motionPreference) =>
    set((state) => persistNext(state, { motionPreference })),
  setShowEvalBar: (showEvalBar) =>
    set((state) => persistNext(state, { showEvalBar })),
  setAllowHints: (allowHints) =>
    set((state) => persistNext(state, { allowHints })),
  resetSettings: () =>
    set(() => {
      saveSettings(DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS, corruptSettingsRecovered: false };
    }),
  dismissCorruptNotice: () => set({ corruptSettingsRecovered: false }),
}));
