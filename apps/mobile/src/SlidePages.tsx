import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useReducedMotion } from "./SessionPager";

export function SlidePages({
  detail,
  rtl,
  main,
  children,
  detailKey,
}: {
  detail: boolean;
  rtl: boolean;
  main: ReactNode;
  children: ReactNode;
  detailKey: string;
}) {
  const progress = useRef(new Animated.Value(detail ? 1 : 0)).current;
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [sizes, setSizes] = useState([224, 224]);
  const { height } = useWindowDimensions();
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: detail ? 1 : 0,
      duration: reduced ? 0 : 280,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [detail, progress, reduced]);
  const direction = rtl ? -1 : 1;
  return (
    <View
      style={{
        height: Math.min(sizes[detail ? 1 : 0]!, height * 0.42),
        flexShrink: 1,
        overflow: "hidden",
        marginTop: 28,
      }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      testID="about-pages"
    >
      {[main, children].map((content, index) => {
        const active = detail === (index === 1);
        return (
          <Animated.View
            key={index}
            style={[
              StyleSheet.absoluteFill,
              {
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange:
                        index === 0
                          ? [0, -direction * width]
                          : [direction * width, 0],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents={active ? "auto" : "none"}
            accessibilityElementsHidden={!active}
            importantForAccessibility={active ? "auto" : "no-hide-descendants"}
          >
            <ScrollView
              key={index === 1 ? detailKey : "menu"}
              contentContainerStyle={{ flexGrow: 1 }}
              onContentSizeChange={(_width, contentHeight) =>
                setSizes((old) =>
                  old[index] === contentHeight
                    ? old
                    : old.map((value, i) =>
                        i === index ? contentHeight : value,
                      ),
                )
              }
            >
              {content}
            </ScrollView>
          </Animated.View>
        );
      })}
    </View>
  );
}
