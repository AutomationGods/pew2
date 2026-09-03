import {
  Appearance,
  useColorScheme,
} from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_APPEARANCE,
  type AccentName,
  type AppearanceMode,
  type AppearancePreference,
} from "./appearancePreference";
import { loadAppearancePreference, saveAppearancePreference } from "./preferences";
import { createTheme, type AppTheme, type ResolvedAppearanceMode } from "./theme";

interface AppearanceContextValue {
  preference: AppearancePreference;
  resolvedMode: ResolvedAppearanceMode;
  theme: AppTheme;
  ready: boolean;
  setMode: (mode: AppearanceMode) => void;
  setAccent: (accent: AccentName) => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const systemMode: ResolvedAppearanceMode = useColorScheme() === "light" ? "light" : "dark";
  const [preference, setPreference] = useState(DEFAULT_APPEARANCE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadAppearancePreference().then((stored) => {
      if (!alive) return;
      setPreference(stored);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const resolvedMode = preference.mode === "system" ? systemMode : preference.mode;

  useEffect(() => {
    Appearance.setColorScheme(preference.mode === "system" ? null : preference.mode);
  }, [preference.mode]);

  const update = useCallback((next: AppearancePreference) => {
    setPreference(next);
    void saveAppearancePreference(next);
  }, []);

  const setMode = useCallback(
    (mode: AppearanceMode) => update({ ...preference, mode }),
    [preference, update],
  );
  const setAccent = useCallback(
    (accent: AccentName) => update({ ...preference, accent }),
    [preference, update],
  );
  const theme = useMemo(
    () => createTheme(resolvedMode, preference.accent),
    [preference.accent, resolvedMode],
  );
  const value = useMemo(
    () => ({ preference, resolvedMode, theme, ready, setMode, setAccent }),
    [preference, resolvedMode, theme, ready, setMode, setAccent],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppTheme(): AppearanceContextValue {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppTheme must be used within AppearanceProvider");
  return value;
}

export function useThemeStyles<T>(factory: (theme: AppTheme) => T): T {
  const { theme } = useAppTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
