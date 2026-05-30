import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Alert, Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { GestureHandlerRootView, PanGestureHandler, State } from "react-native-gesture-handler";
import Magnet from "../components/Magnet";
import { useTheme } from "../components/ThemeContext";
import {
    getAlbums,
    MAGNET_COLORS,
    MAGNET_ICONS,
    MagnetData,
    Polaroid,
    saveMemory
} from "../utils/storage";

export default function PolaroidScreen() {
  const { theme, colors } = useTheme();
  const router = useRouter();
  const [image, setImage] = useState<string | null>(null);
  const [memory, setMemory] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeMagnet, setActiveMagnet] = useState<MagnetData | null>(null);
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');

  // Album selection state
  const [isSelectingAlbum, setIsSelectingAlbum] = useState(false);
  const [albums, setAlbums] = useState<string[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [newAlbumName, setNewAlbumName] = useState("");

  // Gesture refs
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Magnet gesture refs
  const magnetTranslateX = useRef(new Animated.Value(0)).current;
  const magnetTranslateY = useRef(new Animated.Value(0)).current;
  const lastMagnetOffset = useRef({ x: 0, y: 0 }).current;

  // Pick from gallery
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 1,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  // Take photo
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission denied", "Camera permission is required to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const handleSavePress = async () => {
    if (!image) return;
    const existingAlbums = await getAlbums();
    setAlbums(existingAlbums);
    setIsSelectingAlbum(true);
  };

  const confirmSave = async () => {
    if (!image) return;
    const finalAlbum = selectedAlbum === "new" ? newAlbumName.trim() : selectedAlbum;

    if (!finalAlbum) {
      Alert.alert("Error", "Please select or name an album.");
      return;
    }

    try {
      setSaving(true);
      const rotation = Math.floor(Math.random() * 12 - 6);
      const x = Math.floor(Math.random() * 40 - 20);
      const y = Math.floor(Math.random() * 20 - 10);

      // Get image dimensions for aspect ratio detection
      let imageWidth: number | undefined;
      let imageHeight: number | undefined;
      try {
        const { width: w, height: h } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          Image.getSize(image, (width, height) => {
            resolve({ width, height });
          }, reject);
        });
        imageWidth = w;
        imageHeight = h;
      } catch (e) {
        console.warn("Could not get image dimensions:", e);
      }

      const newPolaroid: Polaroid = {
        id: Date.now().toString(),
        uri: image,
        memory: memory,
        date: new Date().toLocaleDateString(),
        rotation,
        x,
        y,
        album: finalAlbum,
        width: imageWidth,
        height: imageHeight,
        orientation: orientation,
        magnet: activeMagnet
          ? (() => {
              // Use different base dimensions based on orientation
              const baseW = orientation === 'horizontal' ? 320 : 280;
              const baseH = orientation === 'horizontal' ? 180 : 320;
              return {
                ...activeMagnet,
                x: (lastMagnetOffset.x / baseW) * 100,
                y: (lastMagnetOffset.y / baseH) * 100,
              };
            })()
          : undefined,
      };

      await saveMemory(newPolaroid);
      setIsSelectingAlbum(false);
      Alert.alert("Success", `Memory saved to "${finalAlbum}"!`, [
        { text: "OK", onPress: () => router.push("/gallery") }
      ]);
      setImage(null);
      setMemory("");
      setActiveMagnet(null);
      magnetTranslateX.setValue(0);
      magnetTranslateY.setValue(0);
      lastMagnetOffset.x = 0;
      lastMagnetOffset.y = 0;
      setSelectedAlbum(null);
      setNewAlbumName("");
    } catch (error) {
      Alert.alert("Error", "Failed to save memory.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    // Replaced by handleSavePress to show album selector first
    handleSavePress();
  };

  // Pinch gesture
  const onPinch = Animated.event([{ nativeEvent: { scale: scale } }], { useNativeDriver: true });

  // Pan gesture
  const onPan = Animated.event(
    [
      {
        nativeEvent: {
          translationX: translateX,
          translationY: translateY,
        },
      },
    ],
    { useNativeDriver: true }
  );

  const onMagnetGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: magnetTranslateX, translationY: magnetTranslateY } }],
    { useNativeDriver: false } // layout animation
  );

  const onMagnetHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      lastMagnetOffset.x += event.nativeEvent.translationX;
      lastMagnetOffset.y += event.nativeEvent.translationY;
      magnetTranslateX.setOffset(lastMagnetOffset.x);
      magnetTranslateY.setOffset(lastMagnetOffset.y);
      magnetTranslateX.setValue(0);
      magnetTranslateY.setValue(0);
    }
  };

  const addMagnet = (icon: string, color: string) => {
    setActiveMagnet({
      id: Date.now().toString(),
      icon,
      color,
      x: 0,
      y: 0,
      rotation: Math.random() * 30 - 15
    });
    // Reset position
    magnetTranslateX.setOffset(0);
    magnetTranslateY.setOffset(0);
    magnetTranslateX.setValue(0);
    magnetTranslateY.setValue(0);
    lastMagnetOffset.x = 0;
    lastMagnetOffset.y = 0;
  };

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!image ? (
          <View style={styles.actionButtons}>
            <Pressable style={[styles.button, { backgroundColor: theme === 'dark' ? '#000000' : '#FF8FAB' }]} onPress={pickImage}>
              <Text style={styles.buttonText}>Pick from Gallery</Text>
            </Pressable>

            <Pressable style={[styles.button, { backgroundColor: theme === 'dark' ? '#000000' : '#FF8FAB' }]} onPress={takePhoto}>
              <Text style={styles.buttonText}>Take Photo</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.previewContainer}>
            {/* Preview polaroid adapts to selected orientation */}
            {orientation === 'horizontal' ? (
              <View style={[styles.polaroidHorizontal, { transform: [{ rotate: "-2deg" }] }]}>
                <View style={styles.horizontalImageWrap}>
                  <Animated.Image
                    source={{ uri: image }}
                    style={styles.imageHorizontal}
                  />
                </View>

                <View style={styles.horizontalTextWrap}>
                  <Text style={styles.memoryTextHorizontal}>{memory || "Your memory here..."}</Text>
                  <Text style={styles.dateTextHorizontal}>{new Date().toLocaleDateString()}</Text>
                </View>

                {activeMagnet && (
                  <PanGestureHandler
                    onGestureEvent={onMagnetGestureEvent}
                    onHandlerStateChange={onMagnetHandlerStateChange}
                  >
                    <Animated.View
                      style={[
                        styles.magnetOverlay,
                        {
                          transform: [
                            { translateX: magnetTranslateX },
                            { translateY: magnetTranslateY },
                            { rotate: `${activeMagnet.rotation}deg` },
                          ],
                        },
                      ]}
                    >
                      <Magnet data={activeMagnet} size={90} />
                    </Animated.View>
                  </PanGestureHandler>
                )}
              </View>
            ) : (
              <View style={[styles.polaroid, { transform: [{ rotate: "-2deg" }] }]}>
                <Animated.Image
                  source={{ uri: image }}
                  style={styles.image}
                />
                <Text style={styles.memoryText}>{memory || "Your memory here..."}</Text>
                <Text style={styles.dateText}>{new Date().toLocaleDateString()}</Text>

                {activeMagnet && (
                  <PanGestureHandler
                    onGestureEvent={onMagnetGestureEvent}
                    onHandlerStateChange={onMagnetHandlerStateChange}
                  >
                    <Animated.View
                      style={{
                        position: "absolute",
                        zIndex: 100,
                        transform: [
                          { translateX: magnetTranslateX },
                          { translateY: magnetTranslateY },
                          { rotate: `${activeMagnet.rotation}deg` }
                        ],
                        top: 0,
                        left: 0,
                      }}
                    >
                      <Magnet data={activeMagnet} size={90} />
                    </Animated.View>
                  </PanGestureHandler>
                )}
              </View>
            )}

            {/* Magnet Selector */}
            <View style={styles.magnetSelector}>
              <Text style={styles.sectionTitle}>Add a Magnet:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.magnetScroll}>
                {MAGNET_ICONS.map((icon, index) => (
                  <Pressable
                    key={index}
                    style={styles.magnetOption}
                    onPress={() => addMagnet(icon, MAGNET_COLORS[index % MAGNET_COLORS.length])}
                  >
                    <Text style={{ fontSize: 32 }}>{icon}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.sectionTitle}>Add a Note:</Text>
            </View>
      
            <TextInput
              style={styles.input}
              placeholder="Write your memory..."
              value={memory}
              onChangeText={setMemory}
              multiline
            />

            {/* Orientation Selector */}
            <View style={styles.orientationContainer}>
              <Text style={styles.sectionTitle}>Polaroid Orientation:</Text>
              <View style={styles.orientationButtonsRow}>
                <Pressable
                  style={[
                    styles.orientationButton,
                    orientation === 'vertical' && styles.orientationButtonActive,
                  ]}
                  onPress={() => setOrientation('vertical')}
                >
                  <Text style={styles.orientationButtonText}>Vertical</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.orientationButton,
                    orientation === 'horizontal' && styles.orientationButtonActive,
                  ]}
                  onPress={() => setOrientation('horizontal')}
                >
                  <Text style={styles.orientationButtonText}>Horizontal</Text>
                </Pressable>
              </View> 
            </View>

            <View style={styles.actionButtonsRow}>
              <Pressable style={[styles.button, styles.secondaryButton]} onPress={() => setImage(null)}>
                <Text style={styles.secondaryButtonText}>Retake</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.saveButton]} onPress={handleSave} disabled={saving}>
                <Text style={styles.buttonText}>{saving ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Album Selection Modal */}
      <Modal
        visible={isSelectingAlbum}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSelectingAlbum(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.albumSelectorModal, { backgroundColor: colors.card }]}>
            <Text style={styles.modalTitle}>Save to Album</Text>

            <ScrollView style={styles.albumList} contentContainerStyle={{ gap: 10 }}>
              {albums.map((album) => (
                <Pressable
                  key={album}
                  style={[
                    styles.albumOption,
                    selectedAlbum === album && styles.selectedAlbumOption
                  ]}
                  onPress={() => {
                    setSelectedAlbum(album);
                    setNewAlbumName("");
                  }}
                >
                  <Text style={[
                    styles.albumOptionText,
                    selectedAlbum === album && styles.selectedAlbumOptionText
                  ]}>
                    {album}
                  </Text>
                </Pressable>
              ))}

              <Pressable
                style={[
                  styles.albumOption,
                  selectedAlbum === "new" && styles.selectedAlbumOption
                ]}
                onPress={() => setSelectedAlbum("new")}
              >
                <Text style={[
                  styles.albumOptionText,
                  selectedAlbum === "new" && styles.selectedAlbumOptionText
                ]}>
                  + New Album
                </Text>
              </Pressable>
            </ScrollView>

            {selectedAlbum === "new" && (
              <TextInput
                style={styles.newAlbumInput}
                placeholder="Enter album name..."
                value={newAlbumName}
                onChangeText={setNewAlbumName}
                autoFocus
              />
            )}

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setIsSelectingAlbum(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.confirmModalButton]}
                onPress={confirmSave}
                disabled={saving}
              >
                <Text style={styles.modalButtonText}>
                  {saving ? "Saving..." : "Confirm"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDF6F0", // Consistent background
  },
  scrollContent: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100%",
  },
  actionButtons: {
    width: "100%",
    alignItems: "center",
    gap: 15,
  },
  previewContainer: {
    width: "100%",
    alignItems: "center",
  },
  button: {
    backgroundColor: "#FF8FAB",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: "80%",
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#FF8FAB",
    width: "40%",
  },
  saveButton: {
    width: "40%",
  },
  actionButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "90%",
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButtonText: {
    color: "#FF8FAB",
    fontSize: 16,
    fontWeight: "600",
  },
  polaroid: {
    width: 280,
    backgroundColor: "#fff",
    padding: 15,
    paddingBottom: 40,
    borderRadius: 2, // Sharper corners for authentic polaroid look
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 20,
  },
  image: {
    width: 250,
    height: 250,
    marginBottom: 10,
    backgroundColor: "#eee",
  },
  memoryText: {
    marginTop: 10,
    fontSize: 18,
    fontFamily: "PatrickHand_400Regular",
    color: "#333",
    textAlign: "center",
    minHeight: 24,
  },
  dateText: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
    alignSelf: "flex-end",
    marginRight: 10,
  },
  input: {
    width: "90%",
    padding: 15,
    borderColor: "#FF8FAB",
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: "#fff",
    fontSize: 16,
    textAlignVertical: "top", // For multiline
    minHeight: 60,
  },
  magnetSelector: {
    width: "100%",
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "PatrickHand_400Regular",
    marginBottom: 10,
    color: "#555",
  },
  magnetScroll: {
    flexDirection: "row",
  },
  magnetOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumSelectorModal: {
    width: '85%',
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: "PatrickHand_400Regular",
    marginBottom: 20,
    color: "#333",
    textAlign: "center",
  },
  albumList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  albumOption: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#eee',
  },
  selectedAlbumOption: {
    backgroundColor: '#FF8FAB',
    borderColor: '#FF8FAB',
  },
  albumOptionText: {
    fontSize: 18,
    fontFamily: "PatrickHand_400Regular",
    color: '#555',
  },
  selectedAlbumOptionText: {
    color: '#fff',
  },
  newAlbumInput: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF8FAB',
    fontSize: 20,
    fontFamily: "PatrickHand_400Regular",
    paddingVertical: 8,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelModalButton: {
    backgroundColor: '#E0E0E0',
  },
  confirmModalButton: {
    backgroundColor: '#FF8FAB',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  /* Horizontal preview styles */
  polaroidHorizontal: {
    width: '95%',
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 6,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  horizontalImageWrap: {
    width: '100%',
    height: 190,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  imageHorizontal: {
    width: '100%',
    height: '100%',
  },
  horizontalTextWrap: {
    flex: 0.35,
    justifyContent: 'center',
  },
  memoryTextHorizontal: {
    fontSize: 18,
    fontFamily: 'PatrickHand_400Regular',
    color: '#333',
    marginBottom: 8,
  },
  dateTextHorizontal: {
    fontSize: 12,
    color: '#999',
  },
  orientationButtonActive: {
    backgroundColor: '#FF8FAB',
    borderColor: '#FF8FAB',
  },
  magnetOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 999,
    elevation: 20,
  },
  orientationContainer: {
    width: '90%',
    marginTop: 16,
  },
  orientationButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  orientationButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  orientationButtonText: {
    color: '#333',
    fontFamily: 'PatrickHand_400Regular',
  },
});

