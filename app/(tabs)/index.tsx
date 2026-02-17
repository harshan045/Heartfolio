import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../components/ThemeContext";
import { auth } from "../../firebaseConfig";
import {
  clearUserWorkspace,
  getScopedKey,
  getStorageData,
} from "../../utils/storage";

const { width } = Dimensions.get("window");

// Local image assets
const CAT_CLOSED = require("../../assets/images/cat_closed.jpeg");
const CAT_OPEN = require("../../assets/images/cat_open.jpeg");

const STICKER_COLORS = [
  { name: "Pink", code: "#FFD1DC" },
  { name: "Blue", code: "#B2EBF2" },
  { name: "Green", code: "#C8E6C9" },
  { name: "Yellow", code: "#FFF9C4" },
  { name: "Purple", code: "#D1C4E9" },
  { name: "White", code: "#FFFFFF" },
];

interface StickerData {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  isCircle?: boolean;
  type?: "text" | "sticker";
}

// Sub-component for individual stickers to manage their own gestures
const DraggableSticker = ({
  sticker,
  popValue,
  floatingValue,
  onUpdate,
  onLongPress,
}: {
  sticker: StickerData;
  popValue: SharedValue<number>;
  floatingValue: SharedValue<number>;
  onUpdate: (id: string, updates: Partial<StickerData>) => void;
  onLongPress: (sticker: StickerData) => void;
}) => {
  const x = useSharedValue(sticker.x);
  const y = useSharedValue(sticker.y);
  const scale = useSharedValue(sticker.scale || 1);
  const rotation = useSharedValue(sticker.rotation || 0);

  // Sync with props when load from AsyncStorage completes or edits happen
  useEffect(() => {
    x.value = sticker.x;
    y.value = sticker.y;
    scale.value = sticker.scale || 1;
    rotation.value = sticker.rotation || 0;
  }, [sticker.x, sticker.y, sticker.scale, sticker.rotation]);

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRotation = useSharedValue(0);
  const isActive = useSharedValue(0);

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
      isActive.value = withTiming(1);
    })
    .onUpdate((e) => {
      x.value = startX.value + e.translationX;
      y.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      runOnJS(onUpdate)(sticker.id, { x: x.value, y: y.value });
    })
    .onFinalize(() => {
      isActive.value = withTiming(0);
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
      isActive.value = withTiming(1);
    })
    .onUpdate((e) => {
      scale.value = startScale.value * e.scale;
    })
    .onEnd(() => {
      runOnJS(onUpdate)(sticker.id, { scale: scale.value });
    })
    .onFinalize(() => {
      isActive.value = withTiming(0);
    });

  const rotate = Gesture.Rotation()
    .onBegin(() => {
      startRotation.value = rotation.value;
      isActive.value = withTiming(1);
    })
    .onUpdate((e) => {
      rotation.value = startRotation.value + e.rotation;
    })
    .onEnd(() => {
      runOnJS(onUpdate)(sticker.id, { rotation: rotation.value });
    })
    .onFinalize(() => {
      isActive.value = withTiming(0);
    });

  const longPress = Gesture.LongPress()
    .onStart(() => {
      isActive.value = withTiming(1);
    })
    .onEnd(() => runOnJS(onLongPress)(sticker))
    .onFinalize(() => {
      isActive.value = withTiming(0);
    });

  const resizePan = Gesture.Pan()
    .onBegin(() => {
      isActive.value = withTiming(1);
    })
    .onUpdate((e) => {
      const newScale = Math.max(0.5, scale.value + e.translationX / 100);
      scale.value = newScale;
    })
    .onEnd(() => {
      runOnJS(onUpdate)(sticker.id, { scale: scale.value });
    })
    .onFinalize(() => {
      isActive.value = withTiming(0);
    });

  const composed = Gesture.Simultaneous(pan, pinch, rotate, longPress);

  const style = useAnimatedStyle(() => {
    const sway = interpolate(floatingValue.value, [0, 1], [-5, 5]);
    const popScale = interpolate(popValue.value, [0, 1], [1, 1.45]);
    return {
      transform: [
        { translateX: x.value },
        { translateY: y.value + sway - popValue.value * 15 },
        { scale: scale.value * popScale },
        { rotate: `${rotation.value}rad` },
      ],
      shadowRadius: interpolate(popValue.value, [0, 1], [5, 20]),
      shadowOpacity: interpolate(popValue.value, [0, 1], [0.1, 0.4]),
    };
  });

  const resizeDotStyle = useAnimatedStyle(() => ({
    opacity: isActive.value,
  }));

  return (
    <Animated.View style={[styles.stickerWrapper, style]}>
      <GestureDetector gesture={composed}>
        {sticker.type === "sticker" ? (
          <Text style={{ fontSize: 80 }}>{sticker.text}</Text>
        ) : (
          <View
            style={[
              styles.stickerInner,
              { backgroundColor: sticker.color },
              sticker.isCircle && {
                borderRadius: 100,
                aspectRatio: 1,
                minWidth: 60,
                justifyContent: "center",
              },
            ]}
          >
            <Text
              style={[
                styles.stickerText,
                sticker.isCircle && { textAlign: "center" },
              ]}
            >
              {sticker.text}
            </Text>
          </View>
        )}
      </GestureDetector>

      {/* Resize Dot */}
      {!sticker.isCircle && (
        <GestureDetector gesture={resizePan}>
          <Animated.View style={[styles.resizeDot, resizeDotStyle]}>
            <View style={styles.dotInner} />
          </Animated.View>
        </GestureDetector>
      )}
    </Animated.View>
  );
};

// Component for non-editable items like Cat and Heart
const DraggableDeco = ({
  id,
  source,
  initialX,
  initialY,
  initialScale,
  initialRotation,
  popValue,
  floatingValue,
  isCat,
  isHeart,
  onUpdate,
}: {
  id: string;
  source?: any;
  initialX: number;
  initialY: number;
  initialScale: number;
  initialRotation: number;
  popValue: SharedValue<number>;
  floatingValue: SharedValue<number>;
  isCat?: boolean;
  isHeart?: boolean;
  onUpdate: (id: string, updates: Partial<StickerData>) => void;
}) => {
  const x = useSharedValue(initialX);
  const y = useSharedValue(initialY);
  const scale = useSharedValue(initialScale || 1);
  const rotation = useSharedValue(initialRotation || 0);

  useEffect(() => {
    x.value = initialX;
    y.value = initialY;
    scale.value = initialScale || 1;
    rotation.value = initialRotation || 0;
  }, [initialX, initialY, initialScale, initialRotation]);

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRotation = useSharedValue(0);
  const isActive = useSharedValue(0);

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
      isActive.value = withTiming(1);
    })
    .onUpdate((e) => {
      x.value = startX.value + e.translationX;
      y.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      runOnJS(onUpdate)(id, { x: x.value, y: y.value });
    })
    .onFinalize(() => {
      isActive.value = withTiming(0);
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
      isActive.value = withTiming(1);
    })
    .onUpdate((e) => {
      scale.value = startScale.value * e.scale;
    })
    .onEnd(() => {
      runOnJS(onUpdate)(id, { scale: scale.value });
    })
    .onFinalize(() => {
      isActive.value = withTiming(0);
    });

  const rotate = Gesture.Rotation()
    .onBegin(() => {
      startRotation.value = rotation.value;
      isActive.value = withTiming(1);
    })
    .onUpdate((e) => {
      rotation.value = startRotation.value + e.rotation;
    })
    .onEnd(() => {
      runOnJS(onUpdate)(id, { rotation: rotation.value });
    })
    .onFinalize(() => {
      isActive.value = withTiming(0);
    });

  const resizePan = Gesture.Pan()
    .onBegin(() => {
      isActive.value = withTiming(1);
    })
    .onUpdate((e) => {
      const newScale = Math.max(0.5, scale.value + e.translationX / 100);
      scale.value = newScale;
    })
    .onEnd(() => {
      runOnJS(onUpdate)(id, { scale: scale.value });
    })
    .onFinalize(() => {
      isActive.value = withTiming(0);
    });

  const composed = Gesture.Simultaneous(pan, pinch, rotate);

  const style = useAnimatedStyle(() => {
    const sway = interpolate(floatingValue.value, [0, 1], [-10, 10]);
    const popScale = interpolate(popValue.value, [0, 1], [1, 1.45]);
    return {
      transform: [
        { translateX: x.value },
        { translateY: y.value + sway - popValue.value * 15 },
        { scale: scale.value * popScale },
        { rotate: `${rotation.value}rad` },
      ],
      shadowRadius: interpolate(popValue.value, [0, 1], [10, 30]),
      shadowOpacity: interpolate(popValue.value, [0, 1], [0.1, 0.5]),
    };
  });

  return (
    <Animated.View
      style={[isCat ? styles.catWrapper : styles.heartWrapper, style]}
    >
      <GestureDetector gesture={composed}>
        <View style={styles.decoBorder}>
          {isHeart ? (
            <Ionicons name="heart" size={32} color="#FFB7CE" />
          ) : (
            <Image source={source} style={styles.catImage} />
          )}
        </View>
      </GestureDetector>

      {/* Resize Dot */}
      <GestureDetector gesture={resizePan}>
        <Animated.View
          style={[
            styles.resizeDot,
            useAnimatedStyle(() => ({ opacity: isActive.value })),
          ]}
        >
          <View style={styles.dotInner} />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState("Hello");
  const [bio, setBio] = useState("Capturing life's little moments 🌸");
  const [banner, setBanner] = useState(
    "https://images.unsplash.com/photo-1490750967868-88aa4486c946?q=80&w=2070&auto=format&fit=crop",
  );
  const [stickers, setStickers] = useState<StickerData[]>([]);
  const [decoPos, setDecoPos] = useState({
    cat: { x: -40, y: 160, scale: 1, rotation: 0 },
    heart: { x: 100, y: 130, scale: 1, rotation: 0 },
  });

  const [isSettings, setIsSettings] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [isStk, setIsStk] = useState(false);

  const [stkId, setStkId] = useState<string | null>(null);
  const [stkText, setStkText] = useState("");
  const [stkColor, setStkColor] = useState("#FEF08A");

  const [isMouth, setIsMouth] = useState(false);
  const [tempNick, setTempNick] = useState("");
  const [tempBio, setTempBio] = useState("");
  const [isCircle, setIsCircle] = useState(false);
  const [menuStickerId, setMenuStickerId] = useState<string | null>(null);

  const [showSelection, setShowSelection] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [addMode, setAddMode] = useState<"text" | "sticker">("text");

  const { theme, colors, toggleTheme } = useTheme();

  const pop = useSharedValue(0);
  const flow = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    load();
    flow.value = withRepeat(withTiming(1, { duration: 3000 }), -1, true);
  }, [auth.currentUser?.uid]);

  const load = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      console.log("[HOME] No UID, resetting to defaults");
      setName("Sweetie");
      setBio("Welcome to my Heartfolio! 🌸");
      setBanner(
        "https://images.unsplash.com/photo-1542332213-31f87348057f?q=80&w=2670&auto=format&fit=crop",
      );
      setStickers([]);
      setDecoPos({
        cat: { x: -40, y: 160, scale: 1, rotation: 0 },
        heart: { x: 100, y: 130, scale: 1, rotation: 0 },
      });
      return;
    }

    try {
      console.log("Loading Home Data for UID:", uid);
      const [n, b, s, d, bi] = await Promise.all([
        getStorageData("userNickname"),
        getStorageData("userBanner"),
        getStorageData("dynamicStickers"),
        getStorageData("decoPositions"),
        getStorageData("userBio"),
      ]);

      if (n) setName(n);
      if (bi) setBio(bi);
      if (b) setBanner(b);
      if (s) setStickers(JSON.parse(s));
      if (d) setDecoPos(JSON.parse(d));
    } catch (e) {
      console.error("[HOME] Load error:", e);
    }
  };

  const syncS = (newS: StickerData[]) => {
    setStickers(newS);
    AsyncStorage.setItem(getScopedKey("dynamicStickers"), JSON.stringify(newS));
  };

  const updateS = (id: string, up: Partial<StickerData>) => {
    setStickers((prev) => {
      const resp = prev.map((item) =>
        item.id === id ? { ...item, ...up } : item,
      );
      AsyncStorage.setItem(
        getScopedKey("dynamicStickers"),
        JSON.stringify(resp),
      );
      return resp;
    });
  };

  const updateD = (id: string, up: any) => {
    setDecoPos((prev) => {
      const resp = { ...prev, [id]: { ...(prev as any)[id], ...up } };
      AsyncStorage.setItem(getScopedKey("decoPositions"), JSON.stringify(resp));
      return resp;
    });
  };

  const handleSave = () => {
    if (!stkText.trim()) return;
    if (stkId) {
      updateS(stkId, {
        text: stkText,
        color: stkColor,
        isCircle,
        type: addMode,
      });
    } else {
      syncS([
        ...stickers,
        {
          id: Date.now().toString(),
          text: stkText,
          color: stkColor,
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          isCircle,
          type: addMode,
        },
      ]);
    }
    setIsStk(false);
  };

  const pickBanner = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!res.canceled) {
      setBanner(res.assets[0].uri);
      AsyncStorage.setItem(getScopedKey("userBanner"), res.assets[0].uri);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        style={[
          styles.safe,
          { backgroundColor: theme === "dark" ? "#000000" : colors.background },
        ]}
      >
        <Pressable
          style={styles.flex}
          onPressIn={() => {
            setIsMouth(true);
            scale.value = withSpring(0.97);
            pop.value = withSpring(1);
          }}
          onPressOut={() => {
            setIsMouth(false);
            scale.value = withSpring(1);
            pop.value = withSpring(0);
          }}
        >
          <View style={styles.center}>
            <Animated.View
              style={[styles.cluster, { transform: [{ scale: scale.value }] }]}
            >
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={[styles.tape, styles.tl]} />
                <View style={[styles.tape, styles.tr]} />
                <View style={styles.bc}>
                  <Image source={{ uri: banner }} style={styles.bi} />
                  <Pressable style={styles.eb} onPress={pickBanner}>
                    <Ionicons name="camera" size={16} color="#FFF" />
                  </Pressable>
                  <Pressable
                    style={styles.sb}
                    onPress={() => setIsSettings(true)}
                  >
                    <Ionicons name="settings-outline" size={24} color="#FFF" />
                  </Pressable>
                  <Pressable
                    style={[styles.sb, { right: undefined, left: 12 }]}
                    onPress={toggleTheme}
                  >
                    <Ionicons
                      name={theme === "dark" ? "moon" : "sunny"}
                      size={24}
                      color="#FFF"
                    />
                  </Pressable>
                </View>
                <View style={styles.content}>
                  <Text style={[styles.un, { color: colors.text }]}>
                    {name}
                  </Text>
                  <Text style={styles.bio}>{bio}</Text>
                  <View style={styles.row}>
                    <Pressable
                      style={[
                        styles.ab,
                        theme === "dark" && { backgroundColor: "#000000" },
                      ]}
                      onPress={() => router.push("/polaroid")}
                    >
                      <Text style={styles.at}>Add Memory ✨</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {stickers.map((s) => (
                <DraggableSticker
                  key={s.id}
                  sticker={s}
                  popValue={pop}
                  floatingValue={flow}
                  onUpdate={updateS}
                  onLongPress={(item) => {
                    setMenuStickerId(item.id);
                  }}
                />
              ))}
              <DraggableDeco
                key="heart"
                id="heart"
                isHeart
                initialX={decoPos.heart.x}
                initialY={decoPos.heart.y}
                initialScale={decoPos.heart.scale}
                initialRotation={decoPos.heart.rotation}
                popValue={pop}
                floatingValue={flow}
                onUpdate={updateD}
              />
              <DraggableDeco
                key="cat"
                id="cat"
                isCat
                source={isMouth ? CAT_OPEN : CAT_CLOSED}
                initialX={decoPos.cat.x}
                initialY={decoPos.cat.y}
                initialScale={decoPos.cat.scale}
                initialRotation={decoPos.cat.rotation}
                popValue={pop}
                floatingValue={flow}
                onUpdate={updateD}
              />
            </Animated.View>
          </View>
        </Pressable>

        {/* Floating Add Plus Button */}
        {/* Floating Add Plus Button - Moved to Left */}
        <Pressable
          style={[
            styles.floatingAdd,
            theme === "dark" && { backgroundColor: "#555555ff" },
          ]}
          onPress={() => setShowSelection(true)}
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </Pressable>

        {/* Selection Modal: Text or Sticker */}
        <Modal visible={showSelection} transparent animationType="fade">
          <Pressable style={styles.ovl} onPress={() => setShowSelection(false)}>
            <View style={[styles.box, { backgroundColor: colors.card }]}>
              <Text style={[styles.title, { color: colors.text }]}>
                Add to Scrapbook ✨
              </Text>
              <View style={styles.btns}>
                <Pressable
                  style={[styles.btn, styles.sve]}
                  onPress={() => {
                    setShowSelection(false);
                    setAddMode("text");
                    setStkId(null);
                    setStkText("");
                    setIsCircle(false); // Default to rectangle for text
                    setIsStk(true);
                  }}
                >
                  <Text style={{ color: "#faf9f9ff", fontWeight: "900" }}>
                    📝 Text
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.btn,
                    styles.sve,
                    { backgroundColor: "#C1E1C1" },
                  ]}
                  onPress={() => {
                    setShowSelection(false);
                    setAddMode("sticker");
                    setStkId(null);
                    setStkText("");
                    setIsCircle(false); // Stickers usually don't need frame? Or maybe they do. Let's keep it off by default.
                    setIsStk(true);
                  }}
                >
                  <Text style={{ color: "#FFF", fontWeight: "900" }}>
                    😊 Sticker
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* Custom Cute Help Modal */}
        <Modal visible={showHelp} transparent animationType="fade">
          <View style={styles.ovl}>
            <View
              style={[
                styles.box,
                {
                  backgroundColor: "#FFF0F5",
                  borderColor: "#838182ff",
                  borderWidth: 2,
                },
              ]}
            >
              <Text style={[styles.title, { color: "#FF8FAB" }]}>Alert!</Text>
              <Text
                style={{
                  fontSize: 18,
                  textAlign: "center",
                  color: "#666",
                  fontFamily: "PatrickHand_400Regular",
                  marginBottom: 20,
                }}
              >
                AskChatGPT not me!
              </Text>
              <Pressable
                style={[styles.btn, styles.sve, { flex: 0, width: "100%" }]}
                onPress={() => setShowHelp(false)}
              >
                <Text style={styles.sveText}>Got it!</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={isStk} transparent animationType="slide">
          <View style={styles.ovl}>
            <View style={[styles.box, { backgroundColor: colors.card }]}>
              <Text style={[styles.title, { color: colors.text }]}>
                {stkId
                  ? "Edit Item"
                  : addMode === "sticker"
                    ? "New Sticker"
                    : "New Note"}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.secondary, color: colors.text },
                  addMode === "sticker" && {
                    fontSize: 40,
                    textAlign: "center",
                  },
                ]}
                value={stkText}
                onChangeText={setStkText}
                placeholder={
                  addMode === "sticker"
                    ? "Emojis here..."
                    : "What's on your mind?"
                }
                placeholderTextColor={colors.icon}
                autoFocus
              />

              <Text style={styles.label}>Sticker Shape:</Text>
              <Pressable
                style={[styles.toggleBtn, isCircle && styles.activeToggle]}
                onPress={() => setIsCircle(!isCircle)}
              >
                <Text style={{ color: isCircle ? "#FFF" : "#64748B" }}>
                  {isCircle ? "Circle Frame: ON" : "Circle Frame: OFF"}
                </Text>
              </Pressable>

              <Text style={styles.label}>Choose Color:</Text>
              <View style={styles.colors}>
                {STICKER_COLORS.map((c) => (
                  <Pressable
                    key={c.code}
                    style={[
                      styles.dot,
                      { backgroundColor: c.code },
                      stkColor === c.code && styles.active,
                    ]}
                    onPress={() => setStkColor(c.code)}
                  />
                ))}
              </View>
              <View style={styles.btns}>
                {stkId && (
                  <Pressable
                    style={[styles.btn, styles.del]}
                    onPress={() => {
                      syncS(stickers.filter((s) => s.id !== stkId));
                      setIsStk(false);
                    }}
                  >
                    <Ionicons name="trash" size={20} color="#FF5252" />
                  </Pressable>
                )}
                <Pressable
                  style={[styles.btn, styles.can]}
                  onPress={() => setIsStk(false)}
                >
                  <Text>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.sve]}
                  onPress={handleSave}
                >
                  <Text style={{ color: "#FFF", fontWeight: "900" }}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={isSettings} transparent animationType="fade">
          <Pressable style={styles.flex} onPress={() => setIsSettings(false)}>
            <View style={[styles.menu, { backgroundColor: colors.card }]}>
              <Pressable
                style={styles.mi}
                onPress={() => {
                  setIsSettings(false);
                  setIsEdit(true);
                  setTempNick(name);
                  setTempBio(bio);
                }}
              >
                <Text style={{ color: colors.text }}>Edit Profile</Text>
              </Pressable>
              <Pressable
                style={styles.mi}
                onPress={() => {
                  setIsSettings(false);
                  setShowHelp(true);
                }}
              >
                <Text style={{ color: colors.text }}>Help</Text>
              </Pressable>
              <Pressable
                style={styles.mi}
                onPress={() => {
                  setIsSettings(false);
                  Alert.alert(
                    "Clear Workspace",
                    "Are you sure you want to delete all data for THIS account only? This cannot be undone.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Clear Account Data",
                        style: "destructive",
                        onPress: async () => {
                          await clearUserWorkspace();
                          load(); // Reload to show empty state
                          Alert.alert("Success", "Account data cleared.");
                        },
                      },
                    ],
                  );
                }}
              >
                <Text style={{ color: "#FF8FAB" }}>Clear My Account Data</Text>
              </Pressable>
              <Pressable
                style={styles.mi}
                onPress={() => {
                  setIsSettings(false);
                  signOut(auth);
                }}
              >
                <Text style={{ color: "red" }}>Logout</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        <Modal visible={isEdit} transparent animationType="slide">
          <View style={styles.ovl}>
            <View style={[styles.box, { backgroundColor: colors.card }]}>
              <Text style={[styles.title, { color: colors.text }]}>
                Edit Profile
              </Text>
              <Text style={styles.label}>Nickname</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.secondary, color: colors.text },
                ]}
                value={tempNick}
                onChangeText={setTempNick}
              />
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.secondary, color: colors.text },
                ]}
                value={tempBio}
                onChangeText={setTempBio}
                multiline
              />
              <View style={styles.btns}>
                <Pressable
                  style={[styles.btn, styles.can]}
                  onPress={() => setIsEdit(false)}
                >
                  <Text>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.sve]}
                  onPress={() => {
                    setName(tempNick);
                    setBio(tempBio);
                    AsyncStorage.setItem(
                      getScopedKey("userNickname"),
                      tempNick,
                    );
                    AsyncStorage.setItem(getScopedKey("userBio"), tempBio);
                    setIsEdit(false);
                  }}
                >
                  <Text style={{ color: "#FFF" }}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Sticker Menu Modal */}
        <Modal visible={!!menuStickerId} transparent animationType="fade">
          <Pressable style={styles.ovl} onPress={() => setMenuStickerId(null)}>
            <View style={[styles.box, { backgroundColor: colors.card }]}>
              <Text style={[styles.title, { color: colors.text }]}>
                Sticker Options ✨
              </Text>

              <Pressable
                onPress={() => {
                  const item = stickers.find((s) => s.id === menuStickerId);
                  if (item) {
                    setStkId(item.id);
                    setStkText(item.text);
                    setStkColor(item.color);
                    setIsCircle(!!item.isCircle);
                    setAddMode(item.type || "text");
                    setIsStk(true);
                  }
                  setMenuStickerId(null);
                }}
              ></Pressable>

              <Text style={styles.label}>Resize:</Text>
              <View style={[styles.btns, { marginBottom: 15 }]}>
                <Pressable
                  style={[styles.btn, styles.can]}
                  onPress={() => {
                    if (menuStickerId)
                      updateS(menuStickerId, {
                        scale:
                          (stickers.find((s) => s.id === menuStickerId)
                            ?.scale || 1) - 0.2,
                      });
                  }}
                >
                  <Ionicons name="remove" size={24} color="#64748B" />
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.can]}
                  onPress={() => {
                    if (menuStickerId)
                      updateS(menuStickerId, {
                        scale:
                          (stickers.find((s) => s.id === menuStickerId)
                            ?.scale || 1) + 0.2,
                      });
                  }}
                >
                  <Ionicons name="add" size={24} color="#64748B" />
                </Pressable>
              </View>

              <View style={styles.btns}>
                <Pressable
                  style={[styles.btn, styles.del]}
                  onPress={() => {
                    if (menuStickerId)
                      syncS(stickers.filter((s) => s.id !== menuStickerId));
                    setMenuStickerId(null);
                  }}
                >
                  <Text style={{ color: "#EF4444", fontWeight: "900" }}>
                    ❌
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.can]}
                  onPress={() => setMenuStickerId(null)}
                >
                  <Text>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, // Background handled by theme provider
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  cluster: {
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    borderRadius: 24,
    padding: 12,
    elevation: 10,
    zIndex: 10,
  }, // backgroundColor applied inline with theme
  bc: { height: 180, borderRadius: 16, overflow: "hidden" },
  bi: { width: "100%", height: "100%" },
  eb: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 8,
    borderRadius: 20,
  },
  sb: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.1)",
    padding: 8,
    borderRadius: 20,
  },
  content: { padding: 20, alignItems: "center" },
  un: { fontSize: 24, fontWeight: "900", color: "#1E293B" },
  bio: { fontSize: 13, color: "#64748B", marginTop: 4 },
  row: { flexDirection: "row", marginTop: 20, alignItems: "center", gap: 15 },
  ab: {
    backgroundColor: "#FFB7CE",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    elevation: 5,
  },
  at: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  pb: {
    backgroundColor: "#FFB7CE",
    width: 45,
    height: 45,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  tape: {
    position: "absolute",
    height: 35,
    width: 90,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    zIndex: 100,
  },
  tl: { top: -10, left: -20, transform: [{ rotate: "-45deg" }] },
  tr: {
    top: -10,
    right: -20,
    transform: [{ rotate: "45deg" }],
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  stickerWrapper: { position: "absolute", zIndex: 100 },
  stickerInner: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#FFF",
    elevation: 5,
  },
  stickerText: { fontWeight: "900", fontSize: 14, color: "#1E293B" },
  catWrapper: { position: "absolute", zIndex: 1000 },
  heartWrapper: { position: "absolute", zIndex: 50 },
  catImage: { width: 110, height: 110, borderRadius: 55 },
  decoBorder: {
    backgroundColor: "#FFF",
    padding: 5,
    borderRadius: 80,
    elevation: 15,
  },
  ovl: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  box: { backgroundColor: "#FFF", borderRadius: 24, padding: 25, width: "85%" },
  title: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 15,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 10,
  },
  colors: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent",
  },
  active: { borderColor: "#FFB7CE" },
  btns: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0c0c0cff",
  },
  can: { backgroundColor: "#F1F5F9" },
  sve: { backgroundColor: "#fc8fb1ff" },
  sveText: { color: "#ffffff", fontWeight: "900" },
  del: { flex: 0.3, backgroundColor: "#FEF2F2" },
  menu: {
    position: "absolute",
    top: 70,
    right: 30,
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 10,
    elevation: 20,
  },
  mi: { padding: 15 },
  resizeDot: {
    position: "absolute",
    bottom: -5,
    right: -5,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,183,206,0.3)",
    justifyContent: "center",
    alignItems: "center",
    elevation: 15,
    zIndex: 2000,
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFB7CE",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  floatingAdd: {
    position: "absolute",
    bottom: 40,
    left: 30,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFB7CE",
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  toggleBtn: {
    padding: 12,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    marginBottom: 15,
    alignItems: "center",
  },
  activeToggle: { backgroundColor: "#FFB7CE" },
});
