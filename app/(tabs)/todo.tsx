import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
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
import {
    deleteTodo,
    getTodos,
    PAPER_COLORS,
    saveTodo,
    TodoItem
} from "../../utils/storage";

const { width, height } = Dimensions.get("window");

export default function TodoScreen() {
    const [todos, setTodos] = useState<TodoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddingTodo, setIsAddingTodo] = useState(false);
    const [newTodoText, setNewTodoText] = useState("");
    const [selectedColor, setSelectedColor] = useState(PAPER_COLORS[0]);

    const loadTodos = async () => {
        setLoading(true);
        const storedTodos = await getTodos();
        setTodos(storedTodos);
        setLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadTodos();
        }, [])
    );

    const handleAddTodo = async () => {
        if (!newTodoText.trim()) {
            setIsAddingTodo(false);
            return;
        }

        const newTodo: TodoItem = {
            id: Date.now().toString(),
            text: newTodoText.trim(),
            completed: false,
            x: width / 2 - 75,
            y: height / 2 - 100,
            color: selectedColor,
            rotation: Math.random() * 10 - 5,
        };

        await saveTodo(newTodo);
        setTodos([newTodo, ...todos]);
        setNewTodoText("");
        setIsAddingTodo(false);
    };

    const updateTodoPosition = async (todo: TodoItem, x: number, y: number, rotation: number) => {
        const updated = { ...todo, x, y, rotation };
        await saveTodo(updated);
        setTodos(prev => prev.map(t => t.id === todo.id ? updated : t));
    };

    const handleToggleComplete = async (todo: TodoItem) => {
        const updated = { ...todo, completed: !todo.completed };
        await saveTodo(updated);
        setTodos(prev => prev.map(t => t.id === todo.id ? updated : t));
    };

    const handleDelete = async (id: string) => {
        await deleteTodo(id);
        setTodos(prev => prev.filter(t => t.id !== id));
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
            <View style={styles.board}>
                <Text style={styles.boardTitle}>Sticky Reminders 📌</Text>

                {todos.map(todo => (
                    <DraggableTodo
                        key={todo.id}
                        todo={todo}
                        onUpdate={updateTodoPosition}
                        onToggle={() => handleToggleComplete(todo)}
                        onDelete={() => handleDelete(todo.id)}
                    />
                ))}

                {todos.length === 0 && (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Your board is empty!</Text>
                        <Text style={styles.emptySubText}>Tap the + button to add a task.</Text>
                    </View>
                )}
            </View>

            <Pressable style={styles.fab} onPress={() => setIsAddingTodo(true)}>
                <Text style={styles.fabText}>+</Text>
            </Pressable>

            <Modal
                animationType="slide"
                transparent={true}
                visible={isAddingTodo}
                onRequestClose={() => setIsAddingTodo(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>New Sticky Note</Text>
                        <TextInput
                            style={[styles.textInput, { backgroundColor: selectedColor }]}
                            value={newTodoText}
                            onChangeText={setNewTodoText}
                            multiline
                            maxLength={100}
                            placeholder="What needs to be done?"
                            autoFocus
                        />

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
                            <Pressable style={[styles.inputButton, styles.cancelButton]} onPress={() => setIsAddingTodo(false)}>
                                <Text style={styles.buttonText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={[styles.inputButton, styles.saveButton]} onPress={handleAddTodo}>
                                <Text style={styles.buttonText}>Stick It!</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </GestureHandlerRootView>
    );
}

const DraggableTodo = ({
    todo,
    onUpdate,
    onToggle,
    onDelete
}: {
    todo: TodoItem,
    onUpdate: (todo: TodoItem, x: number, y: number, rotation: number) => void,
    onToggle: () => void,
    onDelete: () => void
}) => {
    const isPressed = useSharedValue(false);
    const offset = useSharedValue({ x: todo.x, y: todo.y });
    const start = useSharedValue({ x: todo.x, y: todo.y });
    const rotation = useSharedValue(todo.rotation);
    const startRotation = useSharedValue(todo.rotation);
    const [showDelete, setShowDelete] = useState(false);

    // Sync shared values when props change
    useEffect(() => {
        offset.value = { x: todo.x, y: todo.y };
        start.value = { x: todo.x, y: todo.y };
        rotation.value = todo.rotation;
        startRotation.value = todo.rotation;
    }, [todo.x, todo.y, todo.rotation]);

    const pan = React.useMemo(() => Gesture.Pan()
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
            runOnJS(onUpdate)(todo, offset.value.x, offset.value.y, rotation.value);
        })
        .onFinalize(() => {
            isPressed.value = false;
        }), [todo, onUpdate]);

    const rotate = React.useMemo(() => Gesture.Rotation()
        .onBegin(() => {
            isPressed.value = true;
            startRotation.value = rotation.value;
        })
        .onUpdate((e) => {
            rotation.value = startRotation.value + (e.rotation * 180 / Math.PI);
        })
        .onEnd(() => {
            runOnJS(onUpdate)(todo, offset.value.x, offset.value.y, rotation.value);
        }), [todo, onUpdate]);

    const tap = React.useMemo(() => Gesture.Tap()
        .onEnd((_e, success) => {
            if (success) {
                runOnJS(onToggle)();
                runOnJS(setShowDelete)(false);
            }
        }), [onToggle]);

    const longPress = React.useMemo(() => Gesture.LongPress()
        .onEnd((_e, success) => {
            if (success) {
                runOnJS(setShowDelete)(true);
            }
        }), []);

    const gesture = React.useMemo(() => Gesture.Simultaneous(
        rotate,
        Gesture.Exclusive(longPress, tap, pan)
    ), [rotate, longPress, tap, pan]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: offset.value.x },
                { translateY: offset.value.y },
                { scale: isPressed.value ? 1.1 : 1 },
                { rotate: `${rotation.value}deg` }
            ],
            position: 'absolute',
            zIndex: isPressed.value ? 1000 : 1,
        };
    });

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.stickyNote, animatedStyle, { backgroundColor: todo.color }]}>
                <Text style={[styles.todoText, todo.completed && styles.completedText]}>
                    {todo.text}
                </Text>
                {showDelete && (
                    <Pressable onPress={onDelete} style={styles.deleteBadge}>
                        <Text style={styles.deleteBadgeText}>x</Text>
                    </Pressable>
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
    center: {
        justifyContent: "center",
        alignItems: "center",
    },
    board: {
        flex: 1,
        padding: 20,
    },
    boardTitle: {
        fontSize: 32,
        fontFamily: "PatrickHand_400Regular",
        color: "#333",
        textAlign: "center",
        marginTop: 40,
        marginBottom: 20,
    },
    stickyNote: {
        width: 150,
        minHeight: 150,
        padding: 15,
        borderRadius: 2,
        shadowColor: "#000",
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    todoText: {
        fontSize: 18,
        fontFamily: "PatrickHand_400Regular",
        color: "#333",
        textAlign: "center",
    },
    completedText: {
        textDecorationLine: 'line-through',
        color: '#888',
    },
    deleteBadge: {
        position: 'absolute',
        top: -10,
        left: -10,
        backgroundColor: '#FF5252',
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#fff',
    },
    deleteBadgeText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
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
        fontSize: 30,
        color: 'white',
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    inputContainer: {
        width: '80%',
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 15,
        alignItems: 'center',
    },
    inputLabel: {
        fontFamily: "PatrickHand_400Regular",
        fontSize: 24,
        marginBottom: 15,
        color: '#333',
    },
    textInput: {
        width: '100%',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 15,
        minHeight: 120,
        textAlignVertical: 'top',
        fontSize: 20,
        fontFamily: "PatrickHand_400Regular",
        marginBottom: 20,
    },
    colorContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginBottom: 20,
    },
    colorCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderColor: '#333',
    },
    inputButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    inputButton: {
        padding: 12,
        borderRadius: 10,
        width: '45%',
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#eee',
    },
    saveButton: {
        backgroundColor: '#FF8FAB',
    },
    buttonText: {
        color: '#333',
        fontWeight: 'bold',
        fontSize: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        fontSize: 22,
        fontFamily: "PatrickHand_400Regular",
        color: "#888",
    },
    emptySubText: {
        fontSize: 16,
        fontFamily: "PatrickHand_400Regular",
        color: "#aaa",
        marginTop: 5,
    }
});
