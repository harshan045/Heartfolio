import { IconSymbol } from "@/components/ui/icon-symbol";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
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
    GestureHandlerRootView
} from "react-native-gesture-handler";
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import {
    deleteDiaryElement,
    DiaryElement,
    getDiaryElements,
    PAPER_COLORS,
    saveDiaryElement
} from "../utils/storage";

const { width, height } = Dimensions.get("window");

const FONTS = ["PatrickHand_400Regular", "IndieFlower_400Regular", "System"];

export default function DiaryPageScreen() {
    const { id, title } = useLocalSearchParams<{ id: string, title: string }>();
    const router = useRouter();
    const [elements, setElements] = useState<DiaryElement[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingElementId, setDeletingElementId] = useState<string | null>(null);
    const [isAddingText, setIsAddingText] = useState(false);
    const [modalMode, setModalMode] = useState<'text' | 'sticky' | 'sticker'>('text');
    const [newText, setNewText] = useState("");
    const [selectedFont, setSelectedFont] = useState(FONTS[0]);
    const [selectedColor, setSelectedColor] = useState(PAPER_COLORS[0]);

    // Drawing state
    const [isDrawMode, setIsDrawMode] = useState(false);
    const [activeTool, setActiveTool] = useState<'pencil' | 'pen' | 'eraser'>('pen');
    const [currentPathPoints, setCurrentPathPoints] = useState<{ x: number, y: number }[] | null>(null);
    const [paths, setPaths] = useState<DiaryElement[]>([]);
    const [redoStack, setRedoStack] = useState<DiaryElement[]>([]);

    // Shared value to accumulate points efficiently during drawing
    const activePointsSV = useSharedValue<{ x: number, y: number }[]>([]);

    const loadElements = async () => {
        if (!id) return;
        setLoading(true);
        const stored = await getDiaryElements(id);
        setElements(stored.filter(e => e.type !== 'path'));
        setPaths(stored.filter(e => e.type === 'path'));
        setLoading(false);
    };

    useEffect(() => {
        loadElements();
    }, [id]);

    const addImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                quality: 1,
            });

            if (!result.canceled && id) {
                const newEl: DiaryElement = {
                    id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    entryId: id,
                    type: 'image',
                    content: result.assets[0].uri,
                    x: 50,
                    y: 150,
                    rotation: Math.random() * 10 - 5,
                    scale: 1,
                };
                await saveDiaryElement(newEl);
                setElements([...elements, newEl]);
            }
        } catch (error) {
            console.error('Error adding image:', error);
        }
    };

    const addText = async () => {
        try {
            if (!newText.trim() || !id) {
                setIsAddingText(false);
                return;
            }

            const newEl: DiaryElement = {
                id: `${modalMode}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                entryId: id,
                type: modalMode,
                content: newText.trim(),
                x: modalMode === 'sticker' ? width / 2 - 50 : 50,
                y: modalMode === 'sticker' ? height / 2 - 50 : 100,
                rotation: modalMode === 'sticker' ? 0 : Math.random() * 6 - 3,
                scale: modalMode === 'sticker' ? 2 : 1,
                fontFamily: selectedFont,
                color: modalMode === 'sticky' ? selectedColor : undefined,
            };

            await saveDiaryElement(newEl);
            setElements([...elements, newEl]);
            setNewText("");
            setIsAddingText(false);
        } catch (error) {
            console.error('Error adding text:', error);
        }
    };

    const finalizePath = async (pointsToSave: { x: number, y: number }[]) => {
        if (!id || pointsToSave.length < 2) {
            setCurrentPathPoints(null);
            return;
        }

        const newPath: DiaryElement = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            entryId: id,
            type: 'path',
            content: '',
            strokeWidth: activeTool === 'pen' ? 4 : (activeTool === 'pencil' ? 2 : 15),
            color: activeTool === 'eraser' ? '#FDF6F0' : (activeTool === 'pencil' ? '#888' : '#333'),
            points: pointsToSave,
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1,
        };

        try {
            await saveDiaryElement(newPath);
            setPaths(prev => [...prev, newPath]);
            setRedoStack([]); // New drawing action clears redo history
            setCurrentPathPoints(null);
        } catch (error) {
            console.error('Error saving path:', error);
            setCurrentPathPoints(null);
        }
    };

    const drawPan = React.useMemo(() => Gesture.Pan()
        .enabled(isDrawMode)
        .onStart((e) => {
            activePointsSV.value = [{ x: e.x, y: e.y }];
            runOnJS(setCurrentPathPoints)([{ x: e.x, y: e.y }]);
        })
        .onUpdate((e) => {
            const nextPoints = [...activePointsSV.value, { x: e.x, y: e.y }];
            activePointsSV.value = nextPoints;
            runOnJS(setCurrentPathPoints)(nextPoints);
        })
        .onEnd(() => {
            const pointsToSave = activePointsSV.value;
            runOnJS(finalizePath)(pointsToSave);
            activePointsSV.value = [];
        }), [isDrawMode, activeTool, id]);

    const handleUndo = async () => {
        if (paths.length === 0) return;
        const lastPath = paths[paths.length - 1];
        try {
            await deleteDiaryElement(lastPath.id);
            setPaths(prev => prev.slice(0, -1));
            setRedoStack(prev => [...prev, lastPath]);
        } catch (error) {
            console.error('Error undoing:', error);
        }
    };

    const handleRedo = async () => {
        if (redoStack.length === 0) return;
        const pathToRestore = redoStack[redoStack.length - 1];
        try {
            await saveDiaryElement(pathToRestore);
            setPaths(prev => [...prev, pathToRestore]);
            setRedoStack(prev => prev.slice(0, -1));
        } catch (error) {
            console.error('Error redoing:', error);
        }
    };

    const updateElement = async (el: DiaryElement, x: number, y: number, rotation: number, scale: number, fontFamily?: string) => {
        const updated = { ...el, x, y, rotation, scale, fontFamily: fontFamily || el.fontFamily };
        await saveDiaryElement(updated);
        setElements(prev => prev.map(item => item.id === el.id ? updated : item));
    };

    const handleDelete = async (elementId: string) => {
        await deleteDiaryElement(elementId);
        setElements(prev => prev.filter(e => e.id !== elementId));
        setPaths(prev => prev.filter(e => e.id !== elementId));
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#FF8FAB" />
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={styles.container}>
            <View style={styles.ruledBackground}>
                {Array.from({ length: 50 }).map((_, i) => (
                    <View key={i} style={styles.line} />
                ))}
            </View>

            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <IconSymbol name="chevron.left" size={28} color="#333" />
                </Pressable>
                <Text style={styles.title}>{title || "My Page"}</Text>
                <View style={{ flex: 1 }} />
            </View>

            <GestureDetector gesture={Gesture.Tap().onEnd(() => runOnJS(setDeletingElementId)(null))}>
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                    {/* Visual Elements */}
                    {elements.map(el => (
                        <DraggableElement
                            key={el.id}
                            element={el}
                            onUpdate={updateElement}
                            onDelete={() => handleDelete(el.id)}
                            disabled={isDrawMode}
                            isDeleting={deletingElementId === el.id}
                            onSetDeleting={(id) => setDeletingElementId(id)}
                        />
                    ))}

                    {/* Drawing Layer */}
                    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                        {paths.map(path => (
                            <Path
                                key={path.id}
                                d={`M ${path.points?.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                                stroke={path.color}
                                strokeWidth={path.strokeWidth}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        ))}
                        {currentPathPoints && (
                            <Path
                                d={`M ${currentPathPoints.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                                stroke={activeTool === 'eraser' ? '#FDF6F0' : (activeTool === 'pencil' ? '#888' : '#333')}
                                strokeWidth={activeTool === 'pen' ? 4 : (activeTool === 'pencil' ? 2 : 15)}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}
                    </Svg>

                    {isDrawMode && (
                        <GestureDetector gesture={drawPan}>
                            <View style={StyleSheet.absoluteFill} />
                        </GestureDetector>
                    )}
                </View>
            </GestureDetector>


            {isDrawMode ? (
                <View style={styles.drawingToolbar}>
                    <Pressable
                        style={[styles.toolButton, paths.length === 0 && { opacity: 0.5 }]}
                        onPress={handleUndo}
                        disabled={paths.length === 0}
                    >
                        <IconSymbol name="arrow.uturn.backward" size={24} color="#333" />
                    </Pressable>
                    <Pressable
                        style={[styles.toolButton, redoStack.length === 0 && { opacity: 0.5 }]}
                        onPress={handleRedo}
                        disabled={redoStack.length === 0}
                    >
                        <IconSymbol name="arrow.uturn.forward" size={24} color="#333" />
                    </Pressable>

                    <View style={styles.toolbarSeparator} />

                    <Pressable
                        style={[styles.toolButton, activeTool === 'pencil' && styles.activeTool]}
                        onPress={() => setActiveTool('pencil')}
                    >
                        <IconSymbol name="pencil.tip" size={24} color={activeTool === 'pencil' ? "#fff" : "#333"} />
                    </Pressable>
                    <Pressable
                        style={[styles.toolButton, activeTool === 'pen' && styles.activeTool]}
                        onPress={() => setActiveTool('pen')}
                    >
                        <IconSymbol name="pencil.tip" size={24} color={activeTool === 'pen' ? "#fff" : "#333"} />
                        <View style={{ position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: activeTool === 'pen' ? '#fff' : '#333' }} />
                    </Pressable>
                    <Pressable
                        style={[styles.toolButton, activeTool === 'eraser' && styles.activeTool]}
                        onPress={() => setActiveTool('eraser')}
                    >
                        <IconSymbol name="eraser" size={24} color={activeTool === 'eraser' ? "#fff" : "#333"} />
                    </Pressable>
                </View>
            ) : (
                <View style={styles.fabContainer}>
                    <Pressable
                        onPress={() => setIsDrawMode(!isDrawMode)}
                        style={[styles.fab, { backgroundColor: '#B2CEFE' }]}
                    >
                        <IconSymbol name="hand.draw" size={24} color="#fff" />
                    </Pressable>
                    <Pressable style={styles.fab} onPress={() => { setModalMode('text'); setIsAddingText(true); }}>
                        <IconSymbol name="text.justify.left" size={24} color="#fff" />
                    </Pressable>
                    <Pressable style={[styles.fab, { backgroundColor: '#FFCCF9' }]} onPress={() => { setModalMode('sticky'); setIsAddingText(true); }}>
                        <IconSymbol name="note.text" size={24} color="#fff" />
                    </Pressable>
                    <Pressable style={[styles.fab, { backgroundColor: '#C1E1C1' }]} onPress={() => { setModalMode('sticker'); setIsAddingText(true); }}>
                        <IconSymbol name="face.smiling" size={24} color="#fff" />
                    </Pressable>
                    <Pressable style={[styles.fab, { backgroundColor: '#FFB7B2' }]} onPress={addImage}>
                        <IconSymbol name="photo.on.rectangle" size={24} color="#fff" />
                    </Pressable>
                </View>
            )}

            <Modal
                animationType="slide"
                transparent={true}
                visible={isAddingText}
                onRequestClose={() => setIsAddingText(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.modalTitle}>
                            {modalMode === 'sticky' ? "Stick a Note" : (modalMode === 'sticker' ? "Choose Emoji" : "Write something...")}
                        </Text>
                        <TextInput
                            style={[
                                styles.textInput,
                                modalMode === 'sticky' && { backgroundColor: selectedColor, borderWidth: 0 },
                                modalMode === 'sticker' && { fontSize: 50, textAlign: 'center', minHeight: 100 }
                            ]}
                            value={newText}
                            onChangeText={setNewText}
                            placeholder={modalMode === 'sticker' ? "😊" : "Type here..."}
                            multiline={modalMode !== 'sticker'}
                            autoFocus
                        />

                        {modalMode !== 'sticker' && (
                            <View style={styles.pickerSection}>
                                <Text style={styles.pickerLabel}>Font:</Text>
                                <View style={styles.fontContainer}>
                                    {FONTS.map(font => (
                                        <Pressable
                                            key={font}
                                            style={[styles.fontOption, selectedFont === font && styles.selectedOption]}
                                            onPress={() => setSelectedFont(font)}
                                        >
                                            <Text style={[styles.fontOptionText, { fontFamily: font }]}>A</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        )}

                        {modalMode === 'sticky' && (
                            <View style={styles.pickerSection}>
                                <Text style={styles.pickerLabel}>Color:</Text>
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
                            </View>
                        )}

                        <View style={styles.modalButtons}>
                            <Pressable style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsAddingText(false)}>
                                <Text style={styles.buttonText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={[styles.modalButton, styles.saveButton]} onPress={addText}>
                                <Text style={styles.buttonText}>Add to Page</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </GestureHandlerRootView>
    );
}

const DraggableElement = ({
    element,
    onUpdate,
    onDelete,
    disabled = false,
    isDeleting = false,
    onSetDeleting
}: {
    element: DiaryElement,
    onUpdate: (el: DiaryElement, x: number, y: number, rotation: number, scale: number, fontFamily?: string) => void,
    onDelete: () => void,
    disabled?: boolean,
    isDeleting?: boolean,
    onSetDeleting: (id: string | null) => void
}) => {
    const isPressed = useSharedValue(false);
    const offset = useSharedValue({ x: element.x, y: element.y });
    const start = useSharedValue({ x: element.x, y: element.y });
    const scale = useSharedValue(element.scale);
    const startScale = useSharedValue(element.scale);
    const rotation = useSharedValue(element.rotation);
    const startRotation = useSharedValue(element.rotation);

    // Sync shared values when props change
    useEffect(() => {
        offset.value = { x: element.x, y: element.y };
        start.value = { x: element.x, y: element.y };
        scale.value = element.scale;
        rotation.value = element.rotation;
    }, [element.x, element.y, element.scale, element.rotation]);

    const pan = React.useMemo(() => Gesture.Pan()
        .enabled(!disabled)
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
            start.value = { x: offset.value.x, y: offset.value.y };
            runOnJS(onUpdate)(element, offset.value.x, offset.value.y, rotation.value, scale.value, element.fontFamily);
        })
        .onFinalize(() => {
            isPressed.value = false;
        }), [element, onUpdate, disabled]);

    const pinch = React.useMemo(() => Gesture.Pinch()
        .enabled(!disabled)
        .onBegin(() => {
            isPressed.value = true;
            startScale.value = scale.value;
        })
        .onUpdate((e) => {
            scale.value = startScale.value * e.scale;
        })
        .onEnd(() => {
            runOnJS(onUpdate)(element, offset.value.x, offset.value.y, rotation.value, scale.value, element.fontFamily);
        }), [element, onUpdate, disabled]);

    const rotate = React.useMemo(() => Gesture.Rotation()
        .enabled(!disabled)
        .onBegin(() => {
            isPressed.value = true;
            startRotation.value = rotation.value;
        })
        .onUpdate((e) => {
            rotation.value = startRotation.value + (e.rotation * 180 / Math.PI);
        })
        .onEnd(() => {
            runOnJS(onUpdate)(element, offset.value.x, offset.value.y, rotation.value, scale.value, element.fontFamily);
        }), [element, onUpdate, disabled]);

    const longPress = React.useMemo(() => Gesture.LongPress()
        .enabled(!disabled)
        .onEnd((_e, success) => {
            if (success) {
                runOnJS(onSetDeleting)(element.id);
            }
        }), [element.id, disabled, onSetDeleting]);

    const gesture = React.useMemo(() => Gesture.Simultaneous(
        Gesture.Exclusive(longPress, pan),
        Gesture.Simultaneous(pinch, rotate)
    ), [longPress, pan, pinch, rotate]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: offset.value.x },
                { translateY: offset.value.y },
                { rotate: `${rotation.value}deg` },
                { scale: scale.value * (isPressed.value ? 1.05 : 1) }
            ],
            position: 'absolute',
            zIndex: isPressed.value ? 1000 : 1,
        };
    });

    const cycleFont = () => {
        if (element.type !== 'text') return;
        const currentIndex = FONTS.indexOf(element.fontFamily || "PatrickHand_400Regular");
        const nextIndex = (currentIndex + 1) % FONTS.length;
        // Pass current shared values to avoid direct .value access during a potential render cycle
        onUpdate(element, offset.value.x, offset.value.y, rotation.value, scale.value, FONTS[nextIndex]);
    };

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={animatedStyle}>
                {element.type === 'image' ? (
                    <View style={styles.pastedImageContainer}>
                        <Image source={{ uri: element.content }} style={styles.diaryImage} resizeMode="cover" />
                    </View>
                ) : element.type === 'sticker' ? (
                    <View style={styles.stickerContainer}>
                        <Text style={styles.stickerText}>{element.content}</Text>
                    </View>
                ) : (
                    <View style={[
                        styles.textContainer,
                        element.type === 'sticky' && {
                            backgroundColor: element.color || '#FFFF99',
                            borderRadius: 2,
                            shadowColor: "#000",
                            shadowOffset: { width: 4, height: 4 },
                            shadowOpacity: 0.15,
                            shadowRadius: 6,
                            elevation: 5,
                            minHeight: 120,
                            minWidth: 120,
                            justifyContent: 'center',
                        }
                    ]}>
                        <Text style={[
                            styles.diaryText,
                            { fontFamily: element.fontFamily || "PatrickHand_400Regular" },
                            element.type === 'sticky' && { textAlign: 'center' }
                        ]}>
                            {element.content}
                        </Text>
                    </View>
                )}
                {/* Delete button */}
                {isDeleting && (
                    <View style={styles.badgeContainer}>
                        <Pressable onPress={onDelete} style={styles.deleteBadge}>
                            <Text style={styles.deleteBadgeText}>×</Text>
                        </Pressable>
                        {element.type === 'text' && (
                            <Pressable onPress={cycleFont} style={[styles.deleteBadge, { backgroundColor: '#448AFF', right: -40 }]}>
                                <Text style={styles.deleteBadgeText}>F</Text>
                            </Pressable>
                        )}
                    </View>
                )}
            </Animated.View>
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FDF6F0",
    },
    ruledBackground: {
        ...StyleSheet.absoluteFillObject,
        paddingTop: 100,
    },
    line: {
        height: 1,
        backgroundColor: '#E5E5E5',
        marginBottom: 30,
        width: '100%',
    },
    center: {
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
        zIndex: 10,
    },
    backButton: {
        marginRight: 15,
    },
    title: {
        fontSize: 28,
        fontFamily: "PatrickHand_400Regular",
        color: "#333",
    },
    pastedImageContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    diaryImage: {
        width: 180,
        height: 180,
        borderRadius: 2,
    },
    textContainer: {
        padding: 15,
        maxWidth: 250,
    },
    diaryText: {
        fontSize: 22,
        fontFamily: "PatrickHand_400Regular",
        color: "#333",
        lineHeight: 28,
    },
    pickerSection: {
        marginBottom: 15,
    },
    pickerLabel: {
        fontFamily: "PatrickHand_400Regular",
        fontSize: 18,
        marginBottom: 8,
        color: '#666',
    },
    fontContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    fontOption: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f5f5f5',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    selectedOption: {
        borderColor: '#FF8FAB',
        borderWidth: 2,
        backgroundColor: '#FFF0F5',
    },
    fontOptionText: {
        fontSize: 20,
    },
    colorContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    colorCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderColor: '#333',
    },
    fabContainer: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        gap: 15,
    },
    fab: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FF8FAB',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
    },
    fabText: {
        color: '#fff',
        fontSize: 18,
        fontFamily: "PatrickHand_400Regular",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    inputContainer: {
        width: '85%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
    },
    modalTitle: {
        fontSize: 24,
        fontFamily: "PatrickHand_400Regular",
        marginBottom: 15,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 10,
        padding: 15,
        minHeight: 150,
        textAlignVertical: 'top',
        fontSize: 20,
        fontFamily: "PatrickHand_400Regular",
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    modalButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
    },
    cancelButton: {
        backgroundColor: '#f5f5f5',
    },
    saveButton: {
        backgroundColor: '#FF8FAB',
    },
    buttonText: {
        color: '#333',
        fontWeight: 'bold',
    },
    deleteBadge: {
        position: 'absolute',
        top: -10,
        right: -10,
        backgroundColor: '#FF5252',
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    deleteBadgeText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    badgeContainer: {
        position: 'absolute',
        top: -10,
        right: -10,
        flexDirection: 'row',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modeToggle: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    activeMode: {
        backgroundColor: '#FF8FAB',
    },
    drawingToolbar: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    toolButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    activeTool: {
        backgroundColor: '#FF8FAB',
    },
    toolbarSeparator: {
        width: 1,
        height: 30,
        backgroundColor: '#eee',
        alignSelf: 'center',
    },
    stickerContainer: {
        padding: 10,
    },
    stickerText: {
        fontSize: 50,
    },
    emptyText: {
        fontSize: 22,
        fontFamily: "PatrickHand_400Regular",
        color: '#999',
    },
});
