/**
 * The app's one icon component.
 *
 * On iOS it draws Apple's SF Symbols, the glyphs every other app on the phone
 * uses, so menus, chevrons and toolbar buttons look native rather than
 * borrowed. Elsewhere (Android, web, a harness on `expo start --web`) it draws
 * the Ionicons glyph it always did.
 *
 * Call sites keep naming icons the way they always have, by Ionicons name, so
 * swapping a screen over is an import change and nothing else. A name with no
 * entry in `SF_SYMBOLS` keeps its Ionicons glyph on iOS too, and so does any
 * symbol the running iOS version lacks, through `fallback`.
 *
 * Mapping follows Expo's own IconSymbol example
 * (expo/examples, with-react-navigation/src/components/ui/IconSymbol.tsx),
 * inverted: there the SF name is the key, here the existing name is, so no
 * call site has to learn a second vocabulary.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { SymbolView, type SymbolViewProps, type SymbolWeight } from "expo-symbols";
import { Platform, type ColorValue, type StyleProp, type ViewStyle } from "react-native";

export type IconName = keyof typeof Ionicons.glyphMap;
type SFSymbol = SymbolViewProps["name"];

/** Ionicons name to the SF Symbol iOS users already know for that meaning. */
const SF_SYMBOLS = {
  add: "plus",
  "add-circle-outline": "plus.circle",
  "alert-circle-outline": "exclamationmark.circle",
  "arrow-down": "arrow.down",
  "arrow-forward-outline": "arrow.right",
  "arrow-up": "arrow.up",
  "arrow-up-outline": "arrow.up",
  "bulb-outline": "lightbulb",
  "camera-outline": "camera",
  checkmark: "checkmark",
  "checkmark-circle-outline": "checkmark.circle",
  "chevron-back": "chevron.left",
  "chevron-down": "chevron.down",
  "chevron-expand": "chevron.up.chevron.down",
  "chevron-forward": "chevron.right",
  "chevron-up": "chevron.up",
  close: "xmark",
  "cloud-download-outline": "icloud.and.arrow.down",
  "cloud-offline-outline": "icloud.slash",
  "color-palette-outline": "paintpalette",
  "copy-outline": "doc.on.doc",
  "create-outline": "square.and.pencil",
  "document-outline": "doc",
  "document-text-outline": "doc.text",
  "download-outline": "square.and.arrow.down",
  "ellipsis-horizontal": "ellipsis",
  flashlight: "flashlight.on.fill",
  "flashlight-outline": "flashlight.off.fill",
  "folder-open-outline": "folder",
  "folder-outline": "folder",
  "git-branch-outline": "arrow.triangle.branch",
  "image-outline": "photo",
  "images-outline": "photo.on.rectangle",
  menu: "line.3.horizontal",
  mic: "mic.fill",
  "mic-outline": "mic",
  moon: "moon.fill",
  "musical-notes-outline": "music.note",
  "options-outline": "slider.horizontal.3",
  "phone-portrait": "iphone",
  "qr-code-outline": "qrcode.viewfinder",
  refresh: "arrow.clockwise",
  "search-outline": "magnifyingglass",
  "settings-outline": "gearshape",
  "share-outline": "square.and.arrow.up",
  square: "stop.fill",
  sunny: "sun.max.fill",
  "terminal-outline": "terminal",
  "time-outline": "clock",
  "trash-outline": "trash",
  "videocam-outline": "video",
} as const satisfies Partial<Record<IconName, SFSymbol>>;

interface IconProps {
  name: IconName;
  size: number;
  color: ColorValue;
  /** Layout only (margins, alignment): a symbol is a view, not text. */
  style?: StyleProp<ViewStyle>;
  /** Stroke weight on iOS. Ionicons has one weight, so this is iOS-only. */
  weight?: SymbolWeight;
}

function symbolFor(name: IconName): SFSymbol | undefined {
  return (SF_SYMBOLS as Partial<Record<IconName, SFSymbol>>)[name];
}

export function Icon({ name, size, color, style, weight = "regular" }: IconProps): React.JSX.Element {
  const fallback = <Ionicons name={name} size={size} color={color} style={style} />;
  const symbol = Platform.OS === "ios" ? symbolFor(name) : undefined;
  if (!symbol) return fallback;

  return (
    <SymbolView
      name={symbol}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      fallback={fallback}
      style={[{ width: size, height: size }, style]}
    />
  );
}
