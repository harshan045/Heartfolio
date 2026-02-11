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
    saveDiaryElement,
    saveDiaryElements
} from "../utils/storage";

const { width, height } = Dimensions.get("window");

const FONTS = ["PatrickHand_400Regular", "IndieFlower_400Regular", "System"];

export default function DiaryPageScreen() {
    const { id, title } = useLocalSearchParams<{ id: string, title: string }>();
    const router = useRouter();
    const [elements, setElements] = useState<DiaryElement[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingElementId, setDeletingElementId] = useState<string | null>(null);
    const [imageMenuElementId, setImageMenuElementId] = useState<string | null>(null);
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
    const [redoStack, setRedoStack] = useState<{ elements: DiaryElement[], paths: DiaryElement[] }[]>([]);
    const [history, setHistory] = useState<{ elements: DiaryElement[], paths: DiaryElement[] }[]>([]);

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

    const pushToHistory = (newElements: DiaryElement[], newPaths: DiaryElement[]) => {
        setHistory(prev => [...prev.slice(-19), { elements: [...elements], paths: [...paths] }]);
        setRedoStack([]);
    };

    const addImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                quality: 1,
                allowsEditing: false, // Don't force editing to preserve original aspect ratio
            });

            if (!result.canceled && id) {
                const asset = result.assets[0];

                // Calculate scaled dimensions while preserving aspect ratio
                const maxSize = 300;
                const aspectRatio = asset.width / asset.height;
                let scaledWidth = asset.width;
                let scaledHeight = asset.height;

                if (asset.width > maxSize || asset.height > maxSize) {
                    if (aspectRatio > 1) {
                        // Landscape
                        scaledWidth = maxSize;
                        scaledHeight = maxSize / aspectRatio;
                    } else {
                        // Portrait or square
                        scaledHeight = maxSize;
                        scaledWidth = maxSize * aspectRatio;
                    }
                }

                const newEl: DiaryElement = {
                    id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    entryId: id,
                    type: 'image',
                    content: asset.uri,
                    x: 50,
                    y: 150,
                    rotation: Math.random() * 10 - 5,
                    scale: 1,
                    width: scaledWidth,
                    height: scaledHeight,
                };
                pushToHistory(elements, paths);
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

            pushToHistory(elements, paths);
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
            pushToHistory(elements, paths);
            setPaths(prev => [...prev, newPath]);
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
        if (history.length === 0) return;
        const previousState = history[history.length - 1];

        // Save current to redo
        setRedoStack(prev => [...prev, { elements: [...elements], paths: [...paths] }]);

        // Restore previous
        setElements(previousState.elements);
        setPaths(previousState.paths);
        setHistory(prev => prev.slice(0, -1));

        // Persist to storage
        await saveDiaryElements([...previousState.elements, ...previousState.paths], id);
    };

    const handleRedo = async () => {
        if (redoStack.length === 0) return;
        const nextState = redoStack[redoStack.length - 1];

        // Save current to history
        setHistory(prev => [...prev, { elements: [...elements], paths: [...paths] }]);

        // Restore next
        setElements(nextState.elements);
        setPaths(nextState.paths);
        setRedoStack(prev => prev.slice(0, -1));

        // Persist to storage
        await saveDiaryElements([...nextState.elements, ...nextState.paths], id);
    };

    const updateElement = async (el: DiaryElement, updates: Partial<DiaryElement>, skipHistory = true) => {
        const updated = { ...el, ...updates };
        if (!skipHistory) pushToHistory(elements, paths);
        await saveDiaryElement(updated);
        setElements(prev => prev.map(item => item.id === el.id ? updated : item));
    };

    const handleToggleShadow = async (elementId: string) => {
        const element = elements.find(e => e.id === elementId);
        if (element) {
            await updateElement(element, { hasShadow: !element.hasShadow });
        }
        setImageMenuElementId(null);
    };

    const handleBringToFront = async (elementId: string) => {
        const maxZ = Math.max(...elements.map(e => e.zIndex || 0), 0);
        const element = elements.find(e => e.id === elementId);
        if (element) {
            await updateElement(element, { zIndex: maxZ + 1 });
        }
        setImageMenuElementId(null);
    };

    const handleDelete = async (elementId: string) => {
        pushToHistory(elements, paths);
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
                <View style={styles.headerButtons}>
                    <Pressable onPress={handleUndo} style={styles.headerButton}>
                        <IconSymbol name="arrow.uturn.backward" size={22} color="#333" />
                    </Pressable>
                    <Pressable onPress={handleRedo} style={styles.headerButton}>
                        <IconSymbol name="arrow.uturn.forward" size={22} color="#333" />
                    </Pressable>
                </View>
            </View>

            <GestureDetector gesture={Gesture.Tap().onEnd(() => {
                runOnJS(setDeletingElementId)(null);
                runOnJS(setImageMenuElementId)(null);
            })}>
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
                            showImageMenu={imageMenuElementId === el.id}
                            onSetImageMenu={(id) => setImageMenuElementId(id)}
                            onToggleShadow={() => handleToggleShadow(el.id)}
                            onBringToFront={() => handleBringToFront(el.id)}
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

                    <View style={styles.toolbarSeparator} />

                    <Pressable
                        style={[styles.toolButton, { backgroundColor: '#FF8FAB' }]}
                        onPress={() => setIsDrawMode(false)}
                    >
                        <IconSymbol name="xmark" size={24} color="#ffffff" />
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
    onSetDeleting,
    showImageMenu = false,
    onSetImageMenu,
    onToggleShadow,
    onBringToFront,
}: {
    element: DiaryElement,
    onUpdate: (el: DiaryElement, updates: Partial<DiaryElement>) => void,
    onDelete: () => void,
    disabled?: boolean,
    isDeleting?: boolean,
    onSetDeleting: (id: string | null) => void,
    showImageMenu?: boolean,
    onSetImageMenu?: (id: string | null) => void,
    onToggleShadow?: () => void,
    onBringToFront?: () => void,
}) => {
    const isPressed = useSharedValue(false);
    const offset = useSharedValue({ x: element.x, y: element.y });
    const start = useSharedValue({ x: element.x, y: element.y });
    const scale = useSharedValue(element.scale);
    const startScale = useSharedValue(element.scale);
    const rotation = useSharedValue(element.rotation);
    const startRotation = useSharedValue(element.rotation);
    const width = useSharedValue(element.width || 180);
    const height = useSharedValue(element.height || 180);
    const startSize = useSharedValue({ width: element.width || 180, height: element.height || 180 });

    // Sync shared values when props change
    useEffect(() => {
        offset.value = { x: element.x, y: element.y };
        start.value = { x: element.x, y: element.y };
        scale.value = element.scale;
        rotation.value = element.rotation;
        width.value = element.width || 180;
        height.value = element.height || 180;
    }, [element.x, element.y, element.scale, element.rotation, element.width, element.height]);

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
            runOnJS(onUpdate)(element, { x: offset.value.x, y: offset.value.y, rotation: rotation.value, scale: scale.value });
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
            runOnJS(onUpdate)(element, { x: offset.value.x, y: offset.value.y, rotation: rotation.value, scale: scale.value });
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
            runOnJS(onUpdate)(element, { x: offset.value.x, y: offset.value.y, rotation: rotation.value, scale: scale.value });
        }), [element, onUpdate, disabled]);

    const resizePan = React.useMemo(() => Gesture.Pan()
        .enabled(!disabled && element.type === 'image')
        .onBegin(() => {
            isPressed.value = true;
            startSize.value = { width: width.value, height: height.value };
        })
        .onUpdate((e) => {
            // Resize preserving aspect ratio
            const ratio = startSize.value.width / startSize.value.height;
            const newWidth = Math.max(50, startSize.value.width + e.translationX);
            width.value = newWidth;
            height.value = newWidth / ratio;
        })
        .onEnd(() => {
            runOnJS(onUpdate)(element, { width: width.value, height: height.value });
        })
        .onFinalize(() => {
            isPressed.value = false;
        }), [element, onUpdate, disabled]);

    const longPress = React.useMemo(() => Gesture.LongPress()
        .enabled(!disabled)
        .onEnd((_e, success) => {
            if (success) {
                runOnJS(onSetDeleting)(element.id); // Always show red badge on long press
                if (element.type === 'image' && onSetImageMenu) {
                    runOnJS(onSetImageMenu)(element.id);
                }
            }
        }), [element.id, element.type, disabled, onSetDeleting, onSetImageMenu]);

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
            zIndex: isPressed.value ? 1000 : (element.zIndex || 1),
            width: width.value,
            height: height.value,
        };
    });

    const controlStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { scale: 1 / scale.value }
            ],
        };
    });

    const cycleFont = () => {
        if (element.type !== 'text') return;
        const currentIndex = FONTS.indexOf(element.fontFamily || "PatrickHand_400Regular");
        const nextIndex = (currentIndex + 1) % FONTS.length;
        onUpdate(element, { fontFamily: FONTS[nextIndex] });
    };

    return (
        <Animated.View style={animatedStyle}>
            <GestureDetector gesture={gesture}>
                <View>
                    {element.type === 'image' ? (
                        <View style={[
                            styles.pastedImageContainer,
                            element.hasShadow && {
                                backgroundColor: '#fff', // Required for Android elevation shadow
                                shadowColor: '#000',
                                shadowOffset: { width: 4, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 10,
                            }
                        ]}>
                            <Image
                                source={{ uri: element.content }}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: 2,
                                }}
                                resizeMode="contain"
                            />
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
                </View>
            </GestureDetector>

            {/* Image Context Menu - Moved outside GestureDetector but inside Animated.View */}
            {showImageMenu && element.type === 'image' && (
                <Animated.View style={[styles.imageMenuContainer, controlStyle]}>

                    <Pressable
                        onPress={() => {
                            console.log('Shadow pressed');
                            onToggleShadow?.();
                        }}
                        style={styles.imageMenuButton}
                    >
                        <IconSymbol name={element.hasShadow ? "sun.max.fill" : "shadow"} size={20} color="#FF8FAB" />
                        <Text style={styles.imageMenuText}>{element.hasShadow ? 'Remove Shadow' : 'Add Shadow'}</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => {
                            console.log('Front pressed');
                            onBringToFront?.();
                        }}
                        style={styles.imageMenuButton}
                    >
                        <IconSymbol name="square.3.layers.3d.top.filled" size={20} color="#FF8FAB" />
                        <Text style={styles.imageMenuText}>Bring to Front</Text>
                    </Pressable>
                </Animated.View>
            )}

            {/* Resize Handle */}
            {showImageMenu && element.type === 'image' && (
                <GestureDetector gesture={resizePan}>
                    <Animated.View style={[styles.resizeHandle, controlStyle]}>
                        <View style={styles.resizeHandleCircle} />
                    </Animated.View>
                </GestureDetector>
            )}

            {/* Delete button - Moved outside GestureDetector */}
            {isDeleting && (
                <Animated.View style={[styles.badgeContainer, controlStyle]}>
                    <Pressable onPress={onDelete} style={styles.deleteBadge}>
                        <Text style={styles.deleteBadgeText}>×</Text>
                    </Pressable>
                    {element.type === 'text' && (
                        <Pressable onPress={cycleFont} style={[styles.deleteBadge, { backgroundColor: '#448AFF', right: -40 }]}>
                            <Text style={styles.deleteBadgeText}>F</Text>
                        </Pressable>
                    )}
                </Animated.View>
            )}
        </Animated.View>
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
        paddingBottom: 15,
        paddingHorizontal: 20,
        zIndex: 100,
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    headerButton: {
        padding: 5,
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
        width: '100%',
        height: '100%',
        overflow: 'visible',
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
    deleteButtonText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        lineHeight: 24,
    },
    imageMenuContainer: {
        position: 'absolute',
        top: -80,
        left: -20,
        backgroundColor: '#FFF0F5',
        borderRadius: 12,
        padding: 8,
        gap: 8,
        minWidth: 160,
        shadowColor: '#FF8FAB',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 10,
        borderWidth: 1,
        borderColor: '#FF8FAB',
        zIndex: 2000,
    },
    imageMenuButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#fff',
    },
    imageMenuText: {
        color: '#FF8FAB',
        fontSize: 14,
        fontFamily: 'PatrickHand_400Regular',
    },
    resizeHandle: {
        position: 'absolute',
        bottom: -15,
        right: -15,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1001,
    },
    resizeHandleCircle: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#FF8FAB',
        borderWidth: 2,
        borderColor: '#fff',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
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
