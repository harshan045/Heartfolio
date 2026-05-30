import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert, BackHandler, Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  ScrollView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import HeartIcon from "../../components/HeartIcon";
import Magnet from "../../components/Magnet";
import PaperBitComponent from "../../components/PaperBit";
import { useTheme } from "../../components/ThemeContext";
import { auth } from "../../firebaseConfig";
import {
  deleteAlbum,
  deleteMemory,
  deletePaperBit,
  getAlbums,
  getMemories,
  getPaperBits,
  PAPER_COLORS,
  PaperBit,
  Polaroid,
  renameAlbum,
  saveMemory,
  savePaperBit,
  updateAlbumOrder,
} from "../../utils/storage";

const { width, height } = Dimensions.get("window");
// Approx half screen width minus padding
const COLUMN_WIDTH = (width - 40) / 2;

function PolaroidGalleryContent() {
  const { theme, colors } = useTheme();
  const [polaroids, setPolaroids] = useState<Polaroid[]>([]);
  const [loading, setLoading] = useState(true);
  const [paperBits, setPaperBits] = useState<PaperBit[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Polaroid | null>(null);
  const [pendingPreviewPolaroids, setPendingPreviewPolaroids] = useState<Polaroid[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Paper Bit State
  const [isAddingBit, setIsAddingBit] = useState(false);
  const [newBitText, setNewBitText] = useState("");
  const [selectedColor, setSelectedColor] = useState(PAPER_COLORS[0]);
  const [editingBitId, setEditingBitId] = useState<string | null>(null);
  const [isAddingSticker, setIsAddingSticker] = useState(false);

  // Album selection state
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [isEditingAlbumName, setIsEditingAlbumName] = useState(false);
  const [editingAlbumName, setEditingAlbumName] = useState("");
  const [draggingAlbumIndex, setDraggingAlbumIndex] = useState<number | null>(null);
  const [albumOrder, setAlbumOrder] = useState<string[]>([]);
  const [previewCurrentIndex, setPreviewCurrentIndex] = useState(0);
  const [newAlbumNameModal, setNewAlbumNameModal] = useState(false);
  const [newAlbumNameInput, setNewAlbumNameInput] = useState("");

  const loadMemories = async (isInitial = false) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      console.log("[GALLERY] No UID, resetting state");
      setPolaroids([]);
      setPaperBits([]);
      setAlbumOrder([]);
      if (isInitial) setLoading(false);
      return;
    }

    if (isInitial) setLoading(true);
    const storedMemories = await getMemories();
    const storedBits = await getPaperBits();
    
    // Load album order
    const albums = await getAlbums();
    
    setPolaroids(storedMemories);
    setPaperBits(storedBits);
    setAlbumOrder(albums);
    if (isInitial) setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadMemories(true);
    }, [auth.currentUser?.uid]),
  );

  const router = useRouter();

  // Intercept Android hardware back button: if an album is open, close it; otherwise go Home
  useEffect(() => {
    const handler = () => {
      if (selectedAlbum) {
        setSelectedAlbum(null);
        setIsEditingAlbumName(false);
        return true;
      }
      // navigate to Home tab
      router.push("/");
      return true;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", handler);
    return () => subscription.remove();
  }, [selectedAlbum, router]);

  const handleDelete = (memory: Polaroid) => {
    Alert.alert(
      "Delete Memory",
      "Are you sure you want to delete this memory?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteMemory(memory.id);
            if (selectedMemory?.id === memory.id) setSelectedMemory(null); // Close modal if open
            loadMemories(); // Refresh list
          },
        },
      ],
    );
  };

  // Helper wrapper to delete by id (used by DraggablePolaroid)
  const handleDeleteById = (id: string) => {
    const mem = polaroids.find((p) => p.id === id);
    if (mem) handleDelete(mem);
  };

  const saveBit = async () => {
    if (!newBitText.trim()) {
      setIsAddingBit(false);
      return;
    }

    const bit: PaperBit = {
      id: editingBitId || Date.now().toString(),
      text: newBitText,
      x: width / 2 - 75, // Center initially
      y: 100, // Top area
      rotation: Math.random() * 10 - 5,
      color: selectedColor,
      width: Math.max(Math.min(newBitText.length * 12, 300), 150), // Dynamic width: 12px per char, max 300px, min 150px
      album: selectedAlbum || "Uncategorized",
    };

    await savePaperBit(bit);
    setNewBitText("");
    setSelectedColor(
      PAPER_COLORS[Math.floor(Math.random() * PAPER_COLORS.length)],
    ); // Reset to random or default
    setIsAddingBit(false);
    setEditingBitId(null);
    loadMemories();
  };

  const updateBitPosition = async (
    bit: PaperBit,
    x: number,
    y: number,
    width?: number,
    rotation?: number,
    height?: number,
  ) => {
    const updatedBit: PaperBit = { ...bit, x, y } as PaperBit;
    if (width !== undefined) updatedBit.width = width;
    if (height !== undefined) updatedBit.height = height;
    if (rotation !== undefined) updatedBit.rotation = rotation;
    await savePaperBit(updatedBit);

    setPaperBits((prev) => prev.map((b) => (b.id === bit.id ? updatedBit : b)));
  };

  const handleDeleteBit = async (id: string) => {
    await deletePaperBit(id);
    loadMemories(); // Refresh list
  };

  const updatePolaroidPosition = async (
    polaroid: Polaroid,
    x: number,
    y: number,
    rotation: number,
  ) => {
    const updatedPolaroid: Polaroid = { ...polaroid, x, y, rotation };
    await saveMemory(updatedPolaroid);
    setPolaroids((prev) =>
      prev.map((p) => (p.id === polaroid.id ? updatedPolaroid : p)),
    );
  };

  const saveSticker = async () => {
    if (!newBitText.trim() || !selectedAlbum) {
      setIsAddingSticker(false);
      return;
    }

    const sticker: PaperBit = {
      id: Date.now().toString(),
      text: newBitText,
      x: width / 2 - 50,
      y: 150,
      rotation: 0,
      color: "transparent",
      width: 100,
      album: selectedAlbum,
      isSticker: true,
    };

    await savePaperBit(sticker);
    setNewBitText("");
    setIsAddingSticker(false);
    loadMemories();
  };

  const handleRenameAlbum = async () => {
    if (!selectedAlbum) return;
    const newName = editingAlbumName.trim();
    if (!newName || newName === selectedAlbum) {
      setIsEditingAlbumName(false);
      return;
    }

    try {
      await renameAlbum(selectedAlbum, newName);
      setSelectedAlbum(newName);
      setIsEditingAlbumName(false);
      loadMemories();
    } catch (error) {
      Alert.alert("Error", "Failed to rename album.");
    }
  };

  const handleDeleteAlbum = (albumName: string) => {
    Alert.alert(
      "Delete Album",
      `Are you sure you want to delete "${albumName}" and all its memories?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAlbum(albumName);
              if (selectedAlbum === albumName) {
                setSelectedAlbum(null);
              }
              loadMemories();
            } catch (error) {
              Alert.alert("Error", "Failed to delete album.");
            }
          },
        },
      ],
    );
  };

  const handleReorderAlbums = async (newOrder: string[]) => {
    try {
      await updateAlbumOrder(newOrder);
      setAlbumOrder(newOrder);
    } catch (error) {
      console.error("Error updating album order:", error);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color="#FF8FAB" />
      </View>
    );
  }

  function PolaroidItem({ item, index }: { item: Polaroid; index: number }) {
    const isHorizontal = item.orientation === 'horizontal';

    return (
      <View
        key={item.id}
        style={[styles.polaroidContainer, isHorizontal && styles.polaroidContainerHorizontal]}
      >
        <DraggablePolaroid
          polaroid={item}
          onUpdate={updatePolaroidPosition}
          onDelete={handleDeleteById}
          onPress={(p) => setSelectedMemory(p)}
          isHorizontal={isHorizontal}
        />
      </View>
    );
  }

  const albums = albumOrder.length > 0 ? albumOrder : Array.from(new Set(polaroids.map((p) => p.album))).sort();

  const getAlbumCover = (albumName: string) => {
    return polaroids.find((p) => p.album === albumName)?.uri;
  };

  // Allow selecting multiple images and save them as Polaroid memories
  const ensureAlbumInOrder = async (albumName: string) => {
    const normalizedName = albumName.trim();
    if (!normalizedName) return null;
    if (!albumOrder.includes(normalizedName)) {
      const newOrder = [...albumOrder, normalizedName];
      await updateAlbumOrder(newOrder);
      setAlbumOrder(newOrder);
    }
    return normalizedName;
  };
  const handleImageSticker = async () => {
    if (!selectedAlbum) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const bit: PaperBit = {
          id: `img_${Date.now()}`,
          text: "", // Used for alt text if needed, or empty
          x: width / 2 - 75,
          y: 150,
          rotation: Math.random() * 10 - 5,
          color: "transparent",
          width: 150, // Default width
          height: 150 * (asset.height / asset.width),
          album: selectedAlbum,
          isSticker: true,
          imageUri: asset.uri,
        };
        await savePaperBit(bit);
        loadMemories();
      }
    } catch (e) {
      console.error("Error picking image sticker:", e);
    }
  };
  const handleCreateEmptyAlbum = async (albumName: string) => {
    const normalizedName = albumName.trim();
    if (!normalizedName) {
      Alert.alert("Album name required", "Please enter a name for the new album.");
      return;
    }

    if (albums.includes(normalizedName)) {
      Alert.alert("Album exists", "An album with that name already exists.");
      return;
    }

    const newOrder = [...albumOrder, normalizedName];
    try {
      await updateAlbumOrder(newOrder);
      setAlbumOrder(newOrder);
      setSelectedAlbum(normalizedName);
    } catch (error) {
      Alert.alert("Error", "Failed to create new album.");
    }
  };

  const openAlbumActionModal = () => {
    if (!selectedAlbum) {
      // No album selected - show create album modal
      setNewAlbumNameInput("");
      setNewAlbumNameModal(true);
    } else {
      // Album selected - directly add images
      handleImageSticker();
    }
  };

  const filteredMemories = selectedAlbum
    ? polaroids.filter((p) => p.album === selectedAlbum)
    : [];

  const changePreviewOrientation = (id: string, orientation: "horizontal" | "vertical") => {
    setPendingPreviewPolaroids((prev) =>
      prev.map((p) => (p.id === id ? { ...p, orientation } : p)),
    );
  };

  return (
      <GestureHandlerRootView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, minHeight: height }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.listContent}>
          {/* Header */}
          <View style={styles.galleryHeader}>
            {selectedAlbum && isEditingAlbumName ? (
              <View style={styles.editTitleContainer}>
                <TextInput
                  style={styles.editTitleInput}
                  value={editingAlbumName}
                  onChangeText={setEditingAlbumName}
                  autoFocus
                  onSubmitEditing={handleRenameAlbum}
                />
                <View style={styles.editTitleButtons}>
                  <Pressable
                    onPress={handleRenameAlbum}
                    style={styles.editTitleButton}
                  >
                    <Text style={styles.editTitleButtonText}>Save</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setIsEditingAlbumName(false)}
                    style={styles.editTitleButton}
                  >
                    <Text style={styles.editTitleButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  if (selectedAlbum) {
                    setEditingAlbumName(selectedAlbum);
                    setIsEditingAlbumName(true);
                  }
                }}
              >
                <Text style={[styles.galleryTitle, { color: colors.text }]}>
                  {selectedAlbum ? selectedAlbum : "My Memories 💌"}
                </Text>
                {/* {selectedAlbum && (
                  <Text style={styles.editHint}>Tap to rename</Text>
                )} */}
              </Pressable>
            )}
          </View>

          {!selectedAlbum ? (
            /* Album Grid */
            <View style={styles.albumGrid}>
              {albums.map((album, index) => (
                <AlbumCard
                  key={album}
                  album={album}
                  index={index}
                  isDragging={draggingAlbumIndex === index}
                  onPress={() => setSelectedAlbum(album)}
                  onLongPress={() => setDraggingAlbumIndex(draggingAlbumIndex === index ? null : index)}
                  onDelete={() => handleDeleteAlbum(album)}
                  onReorder={(fromIndex, toIndex) => {
                    if (fromIndex === toIndex) return;
                    const newOrder = [...albums];
                    const [movedAlbum] = newOrder.splice(fromIndex, 1);
                    newOrder.splice(toIndex, 0, movedAlbum);
                    handleReorderAlbums(newOrder);
                  }}
                  totalAlbums={albums.length}
                  colors={colors}
                />
              ))}
              {albums.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No albums yet!</Text>
                </View>
              )}
            </View>
          ) : (
            /* Polaroid Grid inside Album */
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                ...styles.columnWrapper,
              }}
            >
              {filteredMemories.map((item, index) => (
                <PolaroidItem key={item.id} item={item} index={index} />
              ))}
              {filteredMemories.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>This album is empty! 📸</Text>
                </View>
              )}
            </View>
          )}
        </View>
        

        {/* Paper Bits Overlay - Only show in Album view */}
        {selectedAlbum &&
          paperBits
            .filter((bit) => bit.album === selectedAlbum)
            .map((bit) => (
              <DraggableBit
                key={bit.id}
                bit={bit}
                onUpdate={updateBitPosition}
                onDelete={() => handleDeleteBit(bit.id)}
              />
            ))}
      </ScrollView>

      

      {selectedAlbum && (
        <View style={styles.fabContainer}>
          <Pressable
            style={[
              styles.fab,
              {
                backgroundColor:
                  theme === "dark" ? "#000000" : colors.secondary,
              },
            ]}
            onPress={() => handleImageSticker()}
          >
            <Text style={styles.fabText}>📷</Text>
          </Pressable>
          <Pressable
            style={[
              styles.fab,
              { backgroundColor: theme === "dark" ? "#000000" : colors.card },
            ]}
            onPress={() => {
              setIsAddingSticker(true);
              setNewBitText("");
            }}
          >
            <Text style={styles.fabText}>❤️</Text>
          </Pressable>
          <Pressable
            style={[
              styles.fab,
              {
                backgroundColor: theme === "dark" ? "#000000" : colors.primary,
              },
            ]}
            onPress={() => {
              setIsAddingBit(true);
              setSelectedColor(
                PAPER_COLORS[Math.floor(Math.random() * PAPER_COLORS.length)],
              );
            }}
          >
            <Text style={styles.fabText}>📝</Text>
          </Pressable>
        </View>
      )}

      {/* Create Album Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={newAlbumNameModal}
        onRequestClose={() => setNewAlbumNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setNewAlbumNameModal(false)}
          />
          <View style={styles.albumActionModal}>
            <Text style={styles.modalTitle}>Create New Album</Text>
            <TextInput
              style={styles.albumActionInput}
              value={newAlbumNameInput}
              onChangeText={setNewAlbumNameInput}
              placeholder="Album name"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.inputButton, styles.cancelButton]}
                onPress={() => setNewAlbumNameModal(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.inputButton, styles.saveButton]}
                onPress={async () => {
                  await handleCreateEmptyAlbum(newAlbumNameInput);
                  setNewAlbumNameModal(false);
                }}
              >
                <Text style={styles.buttonText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Expansion Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={!!selectedMemory}
        onRequestClose={() => setSelectedMemory(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSelectedMemory(null)}
          />

          {selectedMemory && (
            selectedMemory.orientation === 'horizontal' ? (
              <View style={styles.expandedPolaroidHorizontal}>
                <Image
                  source={{ uri: selectedMemory.uri }}
                  style={styles.expandedImageHorizontal}
                />
                <View style={{ width: '100%', paddingTop: 8 }}>
                  <Text style={styles.expandedDateText}>{selectedMemory.date}</Text>
                  <Text style={styles.expandedMemoryText} numberOfLines={3}>
                    {selectedMemory.memory}
                  </Text>
                </View>

                {selectedMemory.magnet && (
                  <View
                    style={{
                      position: "absolute",
                      left: `${selectedMemory.magnet.x}%`,
                      top: `${selectedMemory.magnet.y}%`,
                      zIndex: 20,
                      transform: [{ scale: 1.2 }],
                    }}
                  >
                    <Magnet data={selectedMemory.magnet} size={90} />
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.expandedPolaroid}>
                <Image
                  source={{ uri: selectedMemory.uri }}
                  style={styles.expandedImage}
                />
                <Text style={styles.expandedDateText}>{selectedMemory.date}</Text>
                <Text style={styles.expandedMemoryText}>
                  {selectedMemory.memory}
                </Text>

                {selectedMemory.magnet && (
                  <View
                    style={{
                      position: "absolute",
                      left: `${selectedMemory.magnet.x}%`,
                      top: `${selectedMemory.magnet.y}%`,
                      zIndex: 20,
                      transform: [{ scale: 1.2 }], // Slightly larger in detail view
                    }}
                  >
                    <Magnet data={selectedMemory.magnet} size={90} />
                  </View>
                )}

                {/* Delete button removed */}
              </View>
            )
          )}
        </View>
      </Modal>
      <Modal
        animationType="slide"
        transparent={true}
        visible={isAddingBit}
        onRequestClose={() => setIsAddingBit(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Write something...</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: selectedColor,
                  minHeight: 150,
                  maxHeight: 300,
                  textAlignVertical: "top",
                },
              ]}
              value={newBitText}
              onChangeText={setNewBitText}
              multiline
              autoFocus
            />
            {/* Color Selection */}
            <View style={styles.colorContainer}>
              {PAPER_COLORS.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.colorCircle,
                    {
                      backgroundColor: color,
                      borderWidth: selectedColor === color ? 2 : 0,
                    },
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>
            <View style={styles.inputButtons}>
              <Pressable
                style={[styles.inputButton, styles.cancelButton]}
                onPress={() => setIsAddingBit(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.inputButton, styles.saveButton]}
                onPress={saveBit}
              >
                <Text style={styles.buttonText}>Stick It!</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sticker Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isAddingSticker}
        onRequestClose={() => setIsAddingSticker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Choose an Emoji</Text>
            <TextInput
              style={[
                styles.textInput,
                { fontSize: 50, textAlign: "center", height: 100 },
              ]}
              value={newBitText}
              onChangeText={setNewBitText}
              placeholder="😊"
              maxLength={2}
              autoFocus
            />
            <View style={styles.inputButtons}>
              <Pressable
                style={[styles.inputButton, styles.cancelButton]}
                onPress={() => setIsAddingSticker(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.inputButton, styles.saveButton]}
                onPress={saveSticker}
              >
                <Text style={styles.buttonText}>Add Sticker</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </GestureHandlerRootView>
  );
}

export default function PolaroidGallery() {
  return <PolaroidGalleryContent />;
}

const DraggableBit = ({
  bit,
  onUpdate,
  onDelete,
}: {
  bit: PaperBit;
  onUpdate: (
    bit: PaperBit,
    x: number,
    y: number,
    width?: number,
    rotation?: number,
    height?: number,
  ) => void;
  onDelete: () => void;
}) => {
  const { colors } = useTheme();
  const isPressed = useSharedValue(false);
  const offset = useSharedValue({ x: bit.x, y: bit.y });
  const start = useSharedValue({ x: bit.x, y: bit.y });
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const [showDelete, setShowDelete] = useState(false);
  const resizeStartSize = useSharedValue({
    width: bit.width || 150,
    height: bit.height || 150,
  });
  const rotation = useSharedValue(bit.rotation || 0);
  const savedRotation = useSharedValue(bit.rotation || 0);

  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    rotation.value = bit.rotation || 0;
    savedRotation.value = bit.rotation || 0;
  }, [bit.width, bit.rotation]);

  const handleSave = () => {
    let newWidth = bit.width || 150;
    if (scale.value && !isNaN(scale.value) && isFinite(scale.value)) {
      newWidth = Math.max(50, (bit.width || 150) * scale.value);
    }

    runOnJS(onUpdate)(bit, offset.value.x, offset.value.y, newWidth);
  };

  const pan = Gesture.Pan()
    // Removed activateAfterLongPress for better responsiveness
    .onBegin(() => {
      isPressed.value = true;
    })
    .onUpdate((e) => {
      offset.value = {
        x: start.value.x + e.translationX,
        y: start.value.y + e.translationY,
      };
    })
    .onEnd(() => {
      start.value = {
        x: offset.value.x,
        y: offset.value.y,
      };
      const newWidth = bit.width
        ? Math.max(50, (bit.width || 150) * scale.value)
        : undefined;
      const newHeight =
        bit.height && newWidth
          ? Math.round((bit.height! / (bit.width || 150)) * newWidth)
          : undefined;
      runOnJS(onUpdate)(
        bit,
        offset.value.x,
        offset.value.y,
        newWidth,
        rotation.value,
        newHeight,
      );
    })
    .onFinalize(() => {
      isPressed.value = false;
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      isPressed.value = true;
    })
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      const newWidth = bit.width
        ? Math.max(50, (bit.width || 150) * scale.value)
        : undefined;
      const newHeight =
        bit.height && newWidth
          ? Math.round((bit.height! / (bit.width || 150)) * newWidth)
          : undefined;
      runOnJS(onUpdate)(
        bit,
        offset.value.x,
        offset.value.y,
        newWidth,
        rotation.value,
        newHeight,
      );
    })
    .onFinalize(() => {
      isPressed.value = false;
    });

  const tap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd((_e, success) => {
      if (success) {
        runOnJS(setShowDelete)(false);
      }
    });

  const longPress = Gesture.LongPress().onEnd((_e, success) => {
    if (success) {
      runOnJS(setShowDelete)(true);
    }
  });

  const resizePan = Gesture.Pan()
    .onBegin(() => {
      resizeStartSize.value = {
        width: bit.width || 150,
        height: bit.height || bit.width || 150,
      };
    })
    .onUpdate((e) => {
      // Adjust width based on drag
      const newWidth = Math.max(
        50,
        resizeStartSize.value.width + e.translationX,
      );
      // If image, maintain aspect ratio
      const newHeight =
        bit.height && bit.width
          ? Math.round((bit.height! / (bit.width || 150)) * newWidth)
          : undefined;

      // update live while dragging (persisted by onUpdate)
      runOnJS(onUpdate)(
        bit,
        offset.value.x,
        offset.value.y,
        newWidth,
        rotation.value,
        newHeight,
      );
    })
    .onEnd(() => {
      // Final save handled by runOnJS in update for smooth UI, but maybe throttle saving
    });

  const rotate = Gesture.Rotation()
    .onBegin(() => {
      savedRotation.value = rotation.value;
    })
    .onUpdate((e) => {
      rotation.value = savedRotation.value + (e.rotation * 180) / Math.PI;
    })
    .onEnd(() => {
      savedRotation.value = rotation.value;
      // persist rotation (and current scaled size if any)
      const widthToSave = bit.width
        ? Math.max(50, (bit.width || 150) * (savedScale.value || 1))
        : undefined;
      const heightToSave =
        bit.height && bit.width
          ? Math.round(
              (bit.height! / (bit.width || 150)) *
                (widthToSave || bit.width || 150),
            )
          : undefined;
      runOnJS(onUpdate)(
        bit,
        offset.value.x,
        offset.value.y,
        widthToSave,
        rotation.value,
        heightToSave,
      );
    });

  const gesture = Gesture.Exclusive(
    longPress,
    tap,
    Gesture.Simultaneous(pan, pinch, rotate),
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: offset.value.x },
        { translateY: offset.value.y },
        { scale: (scale.value || 1) * (isPressed.value ? 1.05 : 1) },
        { rotate: `${rotation.value}deg` },
      ],
      position: "absolute",
      zIndex: isPressed.value ? 1000 : 100,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyle}>
        <PaperBitComponent data={bit} />

        {/* Resize Handle only on long press (when showDelete/showSelection is true) */}
        {showDelete && (
          <GestureDetector gesture={resizePan}>
            <View style={styles.resizeHandle} />
          </GestureDetector>
        )}

        {/* Remove Button */}
        {showDelete && (
          <Pressable
            onPress={onDelete}
            style={{
              position: "absolute",
              top: -10,
              right: -10,
              backgroundColor: colors.delete || "#FF5252",
              width: 24,
              height: 24,
              borderRadius: 12,
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
              borderWidth: 1,
              borderColor: "#fff",
            }}
          >
            <Text style={{ color: "white", fontSize: 14, fontWeight: "bold" }}>
              ×
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const DraggablePolaroid = ({
  polaroid,
  onUpdate,
  onDelete,
  onPress,
  isHorizontal,
}: {
  polaroid: Polaroid;
  onUpdate: (polaroid: Polaroid, x: number, y: number, rotation: number) => void;
  onDelete: (id: string) => void;
  onPress: (polaroid: Polaroid) => void;
  isHorizontal: boolean;
}) => {
  const { colors } = useTheme();
  const isPressed = useSharedValue(false);
  const offset = useSharedValue({ x: polaroid.x ?? 0, y: polaroid.y ?? 0 });
  const start = useSharedValue({ x: polaroid.x ?? 0, y: polaroid.y ?? 0 });
  const rotation = useSharedValue(polaroid.rotation ?? 0);
  const savedRotation = useSharedValue(polaroid.rotation ?? 0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    offset.value = { x: polaroid.x ?? 0, y: polaroid.y ?? 0 };
    start.value = { x: polaroid.x ?? 0, y: polaroid.y ?? 0 };
    rotation.value = polaroid.rotation ?? 0;
    savedRotation.value = polaroid.rotation ?? 0;
  }, [polaroid.x, polaroid.y, polaroid.rotation]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      start.value = { x: offset.value.x, y: offset.value.y };
      isPressed.value = true; // pickup animation
    })
    .onUpdate((e) => {
      offset.value = {
        x: start.value.x + e.translationX,
        y: start.value.y + e.translationY,
      };
    })
    .onEnd(() => {
      runOnJS(onUpdate)(polaroid, offset.value.x, offset.value.y, rotation.value);
    })
    .onFinalize(() => {
      isPressed.value = false; // release animation
    });

  const rotate = Gesture.Rotation()
    .onBegin(() => {
      savedRotation.value = rotation.value;
      isPressed.value = true;
    })
    .onUpdate((e) => {
      rotation.value = savedRotation.value + (e.rotation * 180) / Math.PI;
    })
    .onEnd(() => {
      isPressed.value = false;
      runOnJS(onUpdate)(polaroid, offset.value.x, offset.value.y, rotation.value);
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.5, Math.min(3, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const tap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd((_e, success) => {
      if (success) {
        runOnJS(onPress)(polaroid);
        runOnJS(setShowDelete)(false);
      }
    });

  const longPress = Gesture.LongPress().onEnd((_e, success) => {
    if (success) {
      runOnJS(setShowDelete)(!showDelete);
    }
  });

  const gesture = Gesture.Exclusive(
    longPress,
    tap,
    Gesture.Simultaneous(pan, rotate, pinch),
  );

const animatedStyle = useAnimatedStyle(() => ({
  transform: [
    { translateX: offset.value.x },
    { translateY: offset.value.y },
    { scale: (isPressed.value ? 1.05 : 1) * (scale.value || 1) },
    { rotate: `${rotation.value}deg` },
  ],
  position: "absolute",
  zIndex: isPressed.value ? 2000 : 100,
  elevation: isPressed.value ? 12 : 4,
  shadowOpacity: isPressed.value ? 0.35 : 0.15,
}));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
  style={[
    animatedStyle,
    showDelete && {
      zIndex: 1000,
      elevation: 20,
    },
  ]}
>
        <View
          style={[
            styles.polaroid,
            isHorizontal && styles.polaroidHorizontal,
            {
              opacity: 1,
            },
          ]}
        >
          {/* Grab handle appears on long-press to indicate draggable state */}
          {showDelete && (
            <View style={styles.grabHandleContainer} pointerEvents="none">
              <View style={styles.grabHandle} />
            </View>
          )}

          <Image
            source={{ uri: polaroid.uri }}
            style={[styles.image, isHorizontal && styles.imageHorizontal]}
          />
          <Text style={styles.memoryText} numberOfLines={2}>
            {polaroid.memory}
          </Text>

          {polaroid.magnet && (
            <View
              style={{
                position: "absolute",
                left: `${polaroid.magnet.x}%`,
                top: `${polaroid.magnet.y}%`,
                zIndex: 10,
                transform: [{ scale: 0.6 }],
              }}
            >
              <Magnet data={polaroid.magnet} size={50} />
            </View>
          )}
        </View>

        {showDelete && (
          <Pressable
            onPress={() => onDelete(polaroid.id)}
            style={{
              position: "absolute",
              top: -10,
              right: -10,
              backgroundColor: colors.delete || "#FF5252",
              width: 24,
              height: 24,
              borderRadius: 12,
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
              borderWidth: 1,
              borderColor: "#fff",
            }}
          >
            <Text style={{ color: "white", fontSize: 14, fontWeight: "bold" }}>
              ×
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const AlbumCard = ({
  album,
  index,
  isDragging,
  onPress,
  onLongPress,
  onDelete,
  onReorder,
  totalAlbums,
  colors,
}: {
  album: string;
  index: number;
  isDragging: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onDelete: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  totalAlbums: number;
  colors: any;
}) => {
  const localDragging = useSharedValue(false);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const pan = Gesture.Pan()
    .onBegin(() => {
      if (!isDragging) return;
      localDragging.value = true;
      startX.value = offsetX.value;
      startY.value = offsetY.value;
    })
    .onUpdate((e) => {
      if (!isDragging) return;
      offsetX.value = startX.value + e.translationX;
      offsetY.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      const cardHeight = COLUMN_WIDTH * 1.1 + 20; // approximate card height with margin
      let newIndex = index;

      if (offsetY.value > cardHeight / 2) {
        newIndex = Math.min(index + 2, totalAlbums - 1);
      } else if (offsetY.value < -cardHeight / 2) {
        newIndex = Math.max(index - 2, 0);
      } else if (offsetX.value > COLUMN_WIDTH / 2 && index % 2 === 0) {
        newIndex = Math.min(index + 1, totalAlbums - 1);
      } else if (offsetX.value < -COLUMN_WIDTH / 2 && index % 2 === 1) {
        newIndex = Math.max(index - 1, 0);
      }

      if (newIndex !== index) {
        runOnJS(onReorder)(index, newIndex);
      }

      localDragging.value = false;
      offsetX.value = 0;
      offsetY.value = 0;
    })
    .enabled(isDragging);

  const tap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (!isDragging) {
        runOnJS(onPress)();
      }
    });

  const longPress = Gesture.LongPress()
    .minDuration(500)
    .onEnd(() => {
      runOnJS(onLongPress)();
    });

  const gesture = Gesture.Exclusive(
    tap,
    Gesture.Simultaneous(longPress, pan),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: localDragging.value ? 1.05 : 1 },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyle}>
        <View style={[styles.albumCard, isDragging && styles.albumCardDragging]}>
          <View style={styles.albumCoverContainer}>
            <View style={styles.albumCoverBg}>
              <HeartIcon size={80} color="#FF8FAB" />
            </View>
            <View style={styles.albumOverlay}>
              <Text style={[styles.albumName, { color: colors.text }]}>
                {album}
              </Text>
            </View>
          </View>

          {isDragging && (
            <>
              {/* Delete button */}
              <Pressable
  onPress={onDelete}
  style={{
    position: "absolute",
    top: -14,
    right: -14,
    backgroundColor: colors.delete || "#FF5252",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    elevation: 20,
    borderWidth: 2,
    borderColor: "#fff",
  }}
>
  <Text
    style={{
      color: "white",
      fontSize: 18,
      fontWeight: "bold",
      lineHeight: 20,
    }}
  >
    ×
  </Text>
</Pressable>

              {/* Drag indicator */}
              <View style={styles.dragIndicator} pointerEvents="none">
                <View style={styles.grabHandle} />
              </View>
            </>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor handled by theme provider or inline
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 10,
    paddingBottom: 100,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 20, // Space between rows
  },
  polaroidContainer: {
    width: COLUMN_WIDTH - 10,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
    height: COLUMN_WIDTH + 60,
  },
  polaroidContainerHorizontal: {
    width: (COLUMN_WIDTH - 10) * 1.5, // Wider container for horizontal
    height: COLUMN_WIDTH + 40, // Slightly shorter but wider
  },
  polaroid: {
    width: "100%",
    backgroundColor: "#fff",
    padding: 8,
    paddingBottom: 15,
    borderRadius: 0,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    marginBottom: 8,
    backgroundColor: "#eee",
    borderRadius: 0,
  },
  imageHorizontal: {
    width: "100%",
    height: undefined,
    aspectRatio: 1.75,
    borderRadius: 0,
    marginBottom: 12,
  },
  polaroidHorizontal: {
    width: width * 0.75,
    maxWidth: 400,
    padding: 14,
    borderRadius: 0,
    backgroundColor: "#fff",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8},
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 8,
  },
  memoryText: {
    marginTop: 5,
    fontSize: 14,
    fontFamily: "PatrickHand_400Regular",
    color: "#333",
    textAlign: "center",
    minHeight: 10,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  expandedPolaroid: {
    width: width * 0.85,
    backgroundColor: "#fff",
    padding: 20,
    paddingBottom: 20,
    alignItems: "center",
    borderRadius: 4,
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 100,
    elevation: 50,
    transform: [{ rotate: "1deg" }], // Slight tilt for expanded view too
  },
  expandedPolaroidHorizontal: {
    width: width * 0.92,
    backgroundColor: "#fff",
    padding: 16,
    paddingBottom:  1,
    alignItems: "center",
    borderRadius: 6,
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 100,
    elevation: 50,
    transform: [{ rotate: "3deg" }],
  },
  expandedImage: {
    width: width * 0.75,
    height: width * 0.75,
    backgroundColor: "#eee",
    marginBottom: 8, // Reduced spacing
  },
  expandedImageHorizontal: {
    width: width * 0.86,
    height: Math.round((width * 0.86) / 1.6),
    backgroundColor: "#eee",
    marginBottom: 6,
    borderRadius: 4,
  },
  expandedMemoryText: {
    fontSize: 24,
    fontFamily: "PatrickHand_400Regular",
    color: "#333",
    textAlign: "center",
    marginBottom: 10,
  },
  expandedDateText: {
    fontSize: 10,
    color: "#999",
    textAlign: "center", // Center instead of flex-end
    marginBottom: 10,
    marginTop: 0,
  },
  deleteButton: {
    marginTop: 10,
    padding: 10,
  },
  deleteButtonText: {
    color: "#FF5252",
    fontSize: 16,
    fontWeight: "bold",
  },
  galleryHeader: {
    marginBottom: 20,
    marginTop: 40,
    paddingHorizontal: 10,
  },
  galleryTitle: {
    fontSize: 32,
    fontFamily: "PatrickHand_400Regular",
    color: "#333",
    textAlign: "center",
  },
  backButton: {
    marginTop: 10,
    alignSelf: "center",
  },
  backButtonText: {
    color: "#FF8FAB",
    fontFamily: "PatrickHand_400Regular",
    fontSize: 18,
  },
  albumGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  albumCard: {
    width: COLUMN_WIDTH,
    marginBottom: 20,
    borderRadius: 10,
    overflow: "visible",
    backgroundColor: "#fff",
    elevation: 9,
    shadowColor: "#000",
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  albumCardDragging: {
    borderWidth: 3,
    borderColor: "#FF8FAB",
    elevation: 8,
    shadowOpacity: 0.3,
  },
  albumCoverContainer: {
    width: "100%",
    aspectRatio: 0.9,
    backgroundColor: "#FFF0F3",
  },
  albumCoverBg: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF0F3",
  },
  albumOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,143,171, 0.05)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 20,
  },
  albumName: {
    color: "#333",
    fontSize: 22,
    fontFamily: "PatrickHand_400Regular",
    textAlign: "center",
    marginBottom: 5,
  },
emptyContainer: {
  flex: 1,
  width: "100%",
  minHeight: height * 0.65, // adjust if needed
  justifyContent: "center",
  alignItems: "center",
},
  emptyText: {
    fontSize: 22,
    fontFamily: "PatrickHand_400Regular",
    color: "#888",
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 16,
    color: "#888",
  },
  fabContainer: {
    position: "absolute",
    bottom: 110,
    right: 30,
    alignItems: "center",
    gap: 10,
  },
  resizeHandle: {
    position: "absolute",
    bottom: -10,
    right: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FF8FAB",
    borderWidth: 2,
    borderColor: "#FFF",
    elevation: 5,
    zIndex: 200,
  },

  addFab: {
    position: "absolute",
    bottom: 30,
    right: 30,
    zIndex: 20,
  },
  fab: {
    backgroundColor: "#FF8FAB",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  fabText: {
    fontSize: 28,
    color: "white",
  },
  albumActionModal: {
    width: "85%",
    backgroundColor: "white",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "PatrickHand_400Regular",
    marginBottom: 12,
    color: "#333",
  },
  modalLabel: {
    width: "100%",
    fontFamily: "PatrickHand_400Regular",
    color: "#333",
    marginBottom: 8,
    textAlign: "left",
  },
  albumActionInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  modalSectionTitle: {
    width: "100%",
    fontFamily: "PatrickHand_400Regular",
    color: "#666",
    marginBottom: 8,
    textAlign: "left",
  },
  albumChips: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  albumChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  albumChipSelected: {
    backgroundColor: "#FF8FAB",
    borderColor: "#FF8FAB",
  },
  albumChipText: {
    color: "#333",
    fontFamily: "PatrickHand_400Regular",
  },
  albumChipTextSelected: {
    color: "white",
  },
  noAlbumsText: {
    color: "#666",
    fontFamily: "PatrickHand_400Regular",
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 10,
  },
  fullWidthButton: {
    width: "100%",
    marginTop: 10,
  },
  inputContainer: {
    width: "80%",
    backgroundColor: "white",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    elevation: 5,
  },
  inputLabel: {
    fontFamily: "PatrickHand_400Regular",
    fontSize: 24,
    marginBottom: 15,
  },
  textInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 10,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 15,
    fontFamily: "PatrickHand_400Regular",
    fontSize: 20,
  },
  inputButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 15,
  },
  inputButton: {
    padding: 10,
    borderRadius: 8,
    width: "45%",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#ccc",
  },
  saveButton: {
    backgroundColor: "#FF8FAB",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  colorContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 15,
  },
  colorCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderColor: "#333",
  },
  grabHandleContainer: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 500,
  },
  grabHandle: {
    width: 40,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF8FAB',
    opacity: 0.95,
  },
  dragIndicator: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 500,
  },
  editTitleInput: {
    fontSize: 28,
    fontFamily: "PatrickHand_400Regular",
    color: "#333",
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#FF8FAB",
    width: "80%",
    paddingVertical: 5,
  },
  editTitleContainer: {
    alignItems: "center",
    width: "100%",
  },
  editTitleButtons: {
    flexDirection: "row",
    marginTop: 10,
    gap: 15,
  },
  editTitleButton: {
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 15,
    backgroundColor: "#FF8FAB",
  },
  editTitleButtonText: {
    color: "#fff",
    fontFamily: "PatrickHand_400Regular",
    fontSize: 16,
  },
  previewContainer: {
    width: "90%",
    maxHeight: "90%",
    backgroundColor: "white",
    padding: 18,
    borderRadius: 18,
    elevation: 6,
    flexDirection: "column",
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 22,
    fontFamily: "PatrickHand_400Regular",
    color: "#333",
    textAlign: "center",
    flex: 1,
  },
  previewCounter: {
    fontSize: 14,
    fontFamily: "PatrickHand_400Regular",
    color: "#FF8FAB",
    fontWeight: "bold",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#ffe0e9",
    borderRadius: 8,
  },
  previewSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
    textAlign: "center",
  },
  carouselImageContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
    flex: 1,
    minHeight: 300,
  },
  previewScroll: {
    paddingBottom: 12,
  },
  previewButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 12,
    gap: 10,
  },
  previewCard: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    overflow: "hidden",
    backgroundColor: "#fafafa",
  },
  previewImage: {
    width: "100%",
    height: 180,
    backgroundColor: "#ddd",
  },
  previewImageHorizontal: {
    width: "100%",
    height: 120,
    backgroundColor: "#ddd",
  },
  orientationButtonsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginVertical: 12,
  },
  orientationButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
  },
  orientationButtonSelected: {
    backgroundColor: "#FF8FAB",
    borderColor: "#FF8FAB",
  },
  orientationButtonText: {
    color: "#333",
    fontFamily: "PatrickHand_400Regular",
  },
  memoryInputContainer: {
    marginVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  memoryInput: {
    fontSize: 14,
    color: "#333",
    fontFamily: "PatrickHand_400Regular",
    minHeight: 70,
    textAlignVertical: "top",
  },
  carouselNavigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginVertical: 12,
  },
  navButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#FF8FAB",
    alignItems: "center",
  },
  navButtonDisabled: {
    backgroundColor: "#e0e0e0",
    opacity: 0.6,
  },
  navButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontFamily: "PatrickHand_400Regular",
    fontSize: 14,
  },
  editHint: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    fontFamily: "PatrickHand_400Regular",
    marginTop: -5,
  },
});
