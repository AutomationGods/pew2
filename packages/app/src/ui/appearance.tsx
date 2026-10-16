/**
 * Runtime appearance: light/dark mode and accent, persisted and applied live.
 *
 * Components read colours from `usePalette()`. Outside the provider (harnesses,
 * anything not yet converted to the hook) the palette is Ken's dark Stage look,
 * which is also what the static `theme.color` import still renders.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, useColorScheme } from "react-native";
import { DEFAULT_APPEARANCE, type AppearancePreference } from "../appearancePreference";
import { DARK_PALETTE, resolvePalette, resolveScheme, type Palette } from "../palette";
import { loadAppearancePreference, saveAppearancePreference } from "../preferences";

interface AppearanceValue {
  palette: Palette;
  preference: AppearancePreference;
  setPreference: (next: AppearancePreference) => void;
}

const AppearanceContext = createContext<AppearanceValue>({
  palette: DARK_PALETTE,
  preference: DEFAULT_APPEARANCE,
  setPreference: () => {},
});

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setState] = useState<AppearancePreference>(DEFAULT_APPEARANCE);

  useEffect(() => {
    let alive = true;
    void loadAppearancePreference().then((stored) => {
      if (alive) setState(stored);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setPreference = useCallback((next: AppearancePreference) => {
    setState(next);
    void saveAppearancePreference(next);
  }, []);

  // Native chrome (alerts, keyboard, pickers) follows the in-app choice; "system"
  // hands control back to the OS so useColorScheme reports the real setting.
  useEffect(() => {
    Appearance.setColorScheme(preference.mode === "system" ? null : preference.mode);
  }, [preference.mode]);

  const palette = useMemo(
    () => resolvePalette(resolveScheme(preference.mode, system), preference.accent),
    [preference.mode, preference.accent, system],
  );

  const value = useMemo(() => ({ palette, preference, setPreference }), [palette, preference, setPreference]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function usePalette(): Palette {
  return useContext(AppearanceContext).palette;
}

export function useAppearance(): AppearanceValue {
  return useContext(AppearanceContext);
}
