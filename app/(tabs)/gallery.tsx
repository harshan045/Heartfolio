import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
  ScrollView
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue
} from "react-native-reanimated";
import HeartIcon from "../../components/HeartIcon";
import Magnet from "../../components/Magnet";
import PaperBitComponent from "../../components/PaperBit";
import { useTheme } from "../../components/ThemeContext";
import { auth } from "../../firebaseConfig";
import {
  deleteMemory,
  deletePaperBit,
  getMemories,
  getPaperBits,
  PAPER_COLORS,
  PaperBit,
  Polaroid,
  renameAlbum,
  savePaperBit
} from "../../utils/storage";

const { width, height } = Dimensions.get("window");
// Approx half screen width minus padding
const COLUMN_WIDTH = (width - 40) / 2;

export default function PolaroidGallery() {
  const { theme, colors } = useTheme();
  const [polaroids, setPolaroids] = useState<Polaroid[]>([]);
  const [loading, setLoading] = useState(true);
  const [paperBits, setPaperBits] = useState<PaperBit[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Polaroid | null>(null);

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

  const loadMemories = async (isInitial = false) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      console.log('[GALLERY] No UID, resetting state');
      setPolaroids([]);
      setPaperBits([]);
      if (isInitial) setLoading(false);
      return;
    }

    if (isInitial) setLoading(true);
    const storedMemories = await getMemories();
    const storedBits = await getPaperBits();
    setPolaroids(storedMemories);
    setPaperBits(storedBits);
    if (isInitial) setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadMemories(true);
    }, [auth.currentUser?.uid])
  );

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
      ]
    );
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
      album: selectedAlbum || 'Uncategorized'
    };

    await savePaperBit(bit);
    setNewBitText("");
    setSelectedColor(PAPER_COLORS[Math.floor(Math.random() * PAPER_COLORS.length)]); // Reset to random or default
    setIsAddingBit(false);
    setEditingBitId(null);
    loadMemories();
  };

  const updateBitPosition = async (bit: PaperBit, x: number, y: number, width?: number) => {
    const updatedBit = { ...bit, x, y };
    if (width) updatedBit.width = width;
    await savePaperBit(updatedBit);

    setPaperBits(prev => prev.map(b => b.id === bit.id ? updatedBit : b));
  };

  const handleDeleteBit = async (id: string) => {
    await deletePaperBit(id);
    loadMemories(); // Refresh list
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
      color: 'transparent',
      width: 100,
      album: selectedAlbum,
      isSticker: true
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



  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#FF8FAB" />
      </View>
    );
  }

  function PolaroidItem({ item, index }: { item: Polaroid, index: number }) {
    // Fix for legacy data
    const rotation = item.rotation ?? 0;
    const x = (item.x ?? 0) / 4;
    const y = (item.y ?? 0) / 4;

    return (
      <Pressable
        onPress={() => setSelectedMemory(item)}
        onLongPress={() => handleDelete(item)}
        style={({ pressed }) => [
          styles.polaroidContainer,
          { opacity: pressed ? 0.9 : 1 }
        ]}
      >
        <View style={[
          styles.polaroid,
          {
            transform: [
              { rotate: `${rotation}deg` },
              { translateX: x },
              { translateY: y }
            ]
          }
        ]}>
          <Image source={{ uri: item.uri }} style={styles.image} />
          <Text style={styles.memoryText} numberOfLines={2}>{item.memory}</Text>
          {/* Date is hidden in grid view */}

          {item.magnet && (
            <View style={{
              position: 'absolute',
              left: `${item.magnet.x}%`,
              top: `${item.magnet.y}%`,
              zIndex: 10,
              // Adjust for different frame size in grid
              transform: [{ scale: 0.6 }]
            }}>
              <Magnet data={item.magnet} size={50} />
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  const albums = Array.from(new Set(polaroids.map(p => p.album))).sort();

  const getAlbumCover = (albumName: string) => {
    return polaroids.find(p => p.album === albumName)?.uri;
  };

  const handleImageSticker = async () => {
    if (!selectedAlbum) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const bit: PaperBit = {
          id: `img_${Date.now()}`,
          text: '', // Used for alt text if needed, or empty
          x: width / 2 - 75,
          y: 150,
          rotation: Math.random() * 10 - 5,
          color: 'transparent',
          width: 150, // Default width
          height: 150 * (asset.height / asset.width),
          album: selectedAlbum,
          isSticker: true,
          imageUri: asset.uri
        };
        await savePaperBit(bit);
        loadMemories();
      }
    } catch (e) {
      console.error("Error picking image sticker:", e);
    }
  };

  const filteredMemories = selectedAlbum
    ? polaroids.filter(p => p.album === selectedAlbum)
    : [];

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
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
                  <Pressable onPress={handleRenameAlbum} style={styles.editTitleButton}>
                    <Text style={styles.editTitleButtonText}>Save</Text>
                  </Pressable>
                  <Pressable onPress={() => setIsEditingAlbumName(false)} style={styles.editTitleButton}>
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
            {selectedAlbum && (
              <Pressable onPress={() => {
                setSelectedAlbum(null);
                setIsEditingAlbumName(false);
              }} style={styles.backButton}>
                <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back to Albums</Text>
              </Pressable>
            )}
          </View>

          {!selectedAlbum ? (
            /* Album Grid */
            <View style={styles.albumGrid}>
              {albums.map((album) => (
                <Pressable
                  key={album}
                  style={styles.albumCard}
                  onPress={() => setSelectedAlbum(album)}
                >
                  <View style={styles.albumCoverContainer}>
                    <View style={styles.albumCoverBg}>
                      <HeartIcon size={80} color="#FF8FAB" />
                    </View>
                    <View style={styles.albumOverlay}>
                      <Text style={[styles.albumName, { color: colors.text }]}>{album}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
              {albums.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No albums yet! 📸</Text>
                  <Text style={styles.emptySubText}>Add some memories to start your scrapbook.</Text>
                </View>
              )}
            </View>
          ) : (
            /* Polaroid Grid inside Album */
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', ...styles.columnWrapper }}>
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
        {selectedAlbum && paperBits
          .filter(bit => bit.album === selectedAlbum)
          .map(bit => (
            <DraggableBit
              key={bit.id}
              bit={bit}
              onUpdate={updateBitPosition}
              onDelete={() => handleDeleteBit(bit.id)}
            />
          ))}
      </ScrollView>

      {/* Add Bit Buttons - Fixed Position outside ScrollView */}
      {
        selectedAlbum && (
          <View style={styles.fabContainer}>
            <Pressable style={[styles.fab, { backgroundColor: theme === 'dark' ? '#000000' : colors.secondary }]} onPress={handleImageSticker}>
              <Text style={styles.fabText}>📷</Text>
            </Pressable>
            <Pressable style={[styles.fab, { backgroundColor: theme === 'dark' ? '#000000' : colors.card }]} onPress={() => {
              setIsAddingSticker(true);
              setNewBitText("");
            }}>
              <Text style={styles.fabText}>❤️</Text>
            </Pressable>
            <Pressable style={[styles.fab, { backgroundColor: theme === 'dark' ? '#000000' : colors.primary }]} onPress={() => {
              setIsAddingBit(true);
              setSelectedColor(PAPER_COLORS[Math.floor(Math.random() * PAPER_COLORS.length)]);
            }}>
              <Text style={styles.fabText}>📝</Text>
            </Pressable>
          </View>
        )
      }

      {/* Expansion Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={!!selectedMemory}
        onRequestClose={() => setSelectedMemory(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedMemory(null)} />

          {selectedMemory && (
            <View style={styles.expandedPolaroid}>
              <Image source={{ uri: selectedMemory.uri }} style={styles.expandedImage} />
              <Text style={styles.expandedDateText}>{selectedMemory.date}</Text>
              <Text style={styles.expandedMemoryText}>{selectedMemory.memory}</Text>

              {selectedMemory.magnet && (
                <View style={{
                  position: 'absolute',
                  left: `${selectedMemory.magnet.x}%`,
                  top: `${selectedMemory.magnet.y}%`,
                  zIndex: 20,
                  transform: [{ scale: 1.2 }] // Slightly larger in detail view
                }}>
                  <Magnet data={selectedMemory.magnet} size={90} />
                </View>
              )}

              {/* Delete button removed */}
            </View>
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
              style={[styles.textInput, { backgroundColor: selectedColor, minHeight: 150, maxHeight: 300, textAlignVertical: 'top' }]}
              value={newBitText}
              onChangeText={setNewBitText}
              multiline
              autoFocus
            />
            {/* Color Selection */}
            <View style={styles.colorContainer}>
              {PAPER_COLORS.map(color => (
                <Pressable
                  key={color}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color, borderWidth: selectedColor === color ? 2 : 0 }
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>
            <View style={styles.inputButtons}>
              <Pressable style={[styles.inputButton, styles.cancelButton]} onPress={() => setIsAddingBit(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.inputButton, styles.saveButton]} onPress={saveBit}>
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
            <Text style={styles.inputLabel}>Pick an Emoji 🎭</Text>
            <TextInput
              style={[styles.textInput, { fontSize: 50, textAlign: 'center', height: 100 }]}
              value={newBitText}
              onChangeText={setNewBitText}
              placeholder="😊"
              maxLength={2}
              autoFocus
            />
            <View style={styles.inputButtons}>
              <Pressable style={[styles.inputButton, styles.cancelButton]} onPress={() => setIsAddingSticker(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.inputButton, styles.saveButton]} onPress={saveSticker}>
                <Text style={styles.buttonText}>Add Sticker</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </GestureHandlerRootView >
  );
}

const DraggableBit = ({
  bit,
  onUpdate,
  onDelete
}: {
  bit: PaperBit,
  onUpdate: (bit: PaperBit, x: number, y: number, width?: number) => void,
  onDelete: () => void
}) => {
  const { colors } = useTheme();
  const isPressed = useSharedValue(false);
  const offset = useSharedValue({ x: bit.x, y: bit.y });
  const start = useSharedValue({ x: bit.x, y: bit.y });
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const [showDelete, setShowDelete] = useState(false);
  const resizeStartSize = useSharedValue({ width: bit.width || 150, height: bit.height || 150 });
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
      runOnJS(onUpdate)(bit, offset.value.x, offset.value.y, bit.width ? (bit.width || 150) * scale.value : undefined);
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
      runOnJS(onUpdate)(bit, offset.value.x, offset.value.y, bit.width ? (bit.width || 150) * scale.value : undefined);
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

  const longPress = Gesture.LongPress()
    .onEnd((_e, success) => {
      if (success) {
        runOnJS(setShowDelete)(true);
      }
    });

  const resizePan = Gesture.Pan()
    .onBegin(() => {
      resizeStartSize.value = { width: bit.width || 150, height: bit.height || (bit.width || 150) };
    })
    .onUpdate((e) => {
      // Adjust width based on drag
      const newWidth = Math.max(50, resizeStartSize.value.width + e.translationX);
      // If image, maintain aspect ratio
      const ratio = (bit.height || 150) / (bit.width || 150);
      const newHeight = newWidth * ratio; // Wait, ratio might be undefined if not image

      if (bit.isSticker && bit.imageUri) {
        runOnJS(onUpdate)(bit, offset.value.x, offset.value.y, newWidth);
      } else {
        // For text, just update width
        runOnJS(onUpdate)(bit, offset.value.x, offset.value.y, newWidth);
      }
    })
    .onEnd(() => {
      // Final save handled by runOnJS in update for smooth UI, but maybe throttle saving
    });

  const rotate = Gesture.Rotation()
    .onBegin(() => {
      savedRotation.value = rotation.value;
    })
    .onUpdate((e) => {
      rotation.value = savedRotation.value + (e.rotation * 180 / Math.PI);
    })
    .onEnd(() => {
      savedRotation.value = rotation.value;
      // We ideally should save rotation to state, but PaperBit type implies it has rotation property. 
      // Currently onUpdate signature is (bit, x, y, width). 
      // We might need to extend onUpdate to accept rotation.
      // For now, visual rotation works via shared value.
    });

  const gesture = Gesture.Exclusive(longPress, tap, Gesture.Simultaneous(pan, pinch, rotate));

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: offset.value.x },
        { translateY: offset.value.y },
        { scale: (scale.value || 1) * (isPressed.value ? 1.05 : 1) },
        { rotate: `${rotation.value}deg` }
      ],
      position: 'absolute',
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
              position: 'absolute',
              top: -10,
              right: -10,
              backgroundColor: colors.delete || '#FF5252',
              width: 24,
              height: 24,
              borderRadius: 12,
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              borderWidth: 1,
              borderColor: '#fff',
            }}
          >
            <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>×</Text>
          </Pressable>
        )}
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
    justifyContent: 'space-between',
    marginBottom: 20, // Space between rows
  },
  polaroidContainer: {
    width: COLUMN_WIDTH - 10,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
    height: COLUMN_WIDTH + 60,
  },
  polaroid: {
    width: '100%',
    backgroundColor: "#fff",
    padding: 8,
    paddingBottom: 15, // Less padding bottom since date is hidden
    borderRadius: 2,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: 8,
    backgroundColor: "#eee",
  },
  memoryText: {
    marginTop: 5,
    fontSize: 14,
    fontFamily: "PatrickHand_400Regular",
    color: "#333",
    textAlign: "center",
    minHeight: 20,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  expandedPolaroid: {
    width: width * 0.85,
    backgroundColor: "#fff",
    padding: 20,
    paddingBottom: 30,
    alignItems: "center",
    borderRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    transform: [{ rotate: "1deg" }] // Slight tilt for expanded view too
  },
  expandedImage: {
    width: width * 0.75,
    height: width * 0.75,
    backgroundColor: "#eee",
    marginBottom: 8, // Reduced spacing
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
    marginTop: 20,
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
    alignSelf: 'center',
  },
  backButtonText: {
    color: '#FF8FAB',
    fontFamily: "PatrickHand_400Regular",
    fontSize: 18,
  },
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  albumCard: {
    width: COLUMN_WIDTH,
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  albumCoverContainer: {
    width: '100%',
    aspectRatio: 0.9,
    backgroundColor: '#FFF0F3',
  },
  albumCoverBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF0F3',
  },
  albumOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,143,171, 0.05)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  albumName: {
    color: '#333',
    fontSize: 22,
    fontFamily: "PatrickHand_400Regular",
    textAlign: 'center',
    marginBottom: 5,
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: "center",
    width: width - 40,
  },
  emptyText: {
    fontSize: 24,
    color: "#555",
    fontWeight: "bold",
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 16,
    color: "#888",
  },
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    alignItems: 'center',
    gap: 10,
  },
  resizeHandle: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF8FAB',
    borderWidth: 2,
    borderColor: '#FFF',
    elevation: 5,
    zIndex: 200,
  },

  fab: {
    backgroundColor: '#FF8FAB',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  fabText: {
    fontSize: 28,
    color: 'white',
  },
  inputContainer: {
    width: '80%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 5,
  },
  inputLabel: {
    fontFamily: "PatrickHand_400Regular",
    fontSize: 24,
    marginBottom: 15,
  },
  textInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 15,
    fontFamily: "PatrickHand_400Regular",
    fontSize: 20,
  },
  inputButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 15,
  },
  inputButton: {
    padding: 10,
    borderRadius: 8,
    width: '45%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  saveButton: {
    backgroundColor: '#FF8FAB',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  colorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 15,
  },
  colorCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderColor: '#333',
  },
  editTitleContainer: {
    alignItems: 'center',
    width: '100%',
  },
  editTitleInput: {
    fontSize: 28,
    fontFamily: "PatrickHand_400Regular",
    color: "#333",
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: '#FF8FAB',
    width: '80%',
    paddingVertical: 5,
  },
  editTitleButtons: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 15,
  },
  editTitleButton: {
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 15,
    backgroundColor: '#FF8FAB',
  },
  editTitleButtonText: {
    color: '#fff',
    fontFamily: "PatrickHand_400Regular",
    fontSize: 16,
  },
  editHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontFamily: "PatrickHand_400Regular",
    marginTop: -5,
  }
});

