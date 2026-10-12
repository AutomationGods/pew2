import { useState, type ReactNode } from "react";
import { Platform, Pressable, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import type { ConfigMenuSection } from "./configMenu";
import { ConfigSelectorList } from "./ConfigSelectorList";
import { haptics } from "./haptics";
import { NativeMenu } from "./NativeMenu";
import { Sheet, SHEET_CARD_HEIGHT } from "./Sheet";

interface ConfigSelectorProps {
  sections: readonly ConfigMenuSection[];
  onSelect: (id: string) => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** Android uses scrollable single-choice lists; iOS retains its native menu. */
export function ConfigSelector(props: ConfigSelectorProps): React.JSX.Element {
  if (Platform.OS !== "android") return <NativeMenu {...props} />;
  return <AndroidConfigSelector {...props} />;
}

function AndroidConfigSelector({
  sections, onSelect, accessibilityLabel, accessibilityHint, style, children,
}: ConfigSelectorProps): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  const [sectionId, setSectionId] = useState<string>();
  const { height } = useWindowDimensions();
  const section = sections.find((entry) => entry.id === sectionId);
  const close = () => setVisible(false);

  return (
    <>
      <Pressable
        style={style}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ expanded: visible }}
        onPress={() => {
          setSectionId(undefined);
          setVisible(true);
        }}
      >
        {children}
      </Pressable>
      <Sheet
        visible={visible}
        title={section?.title ?? "Model and thinking"}
        onClose={close}
        {...(section ? { onBack: () => setSectionId(undefined) } : {})}
      >
        <ConfigSelectorList
          sections={sections}
          sectionId={sectionId}
          maxHeight={Math.min(SHEET_CARD_HEIGHT, height * 0.5)}
          onSection={setSectionId}
          onSelect={(id) => {
            haptics.select();
            onSelect(id);
            close();
          }}
        />
      </Sheet>
    </>
  );
}
