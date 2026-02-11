import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from "react-native-reanimated";
import {
    deleteDiaryEntry,
    DiaryEntry,
    getDiaryEntries,
    PAPER_COLORS,
    saveDiaryEntry
} from "../../utils/storage";

export default function DiaryListView() {
    const router = useRouter();
    const [entries, setEntries] = useState<DiaryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddingEntry, setIsAddingEntry] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [selectedColor, setSelectedColor] = useState(PAPER_COLORS[0]);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Animation state
    const expandAmount = useSharedValue(0);
    const scrollY = useSharedValue(0);

    const pan = Gesture.Pan()
        .onUpdate((e) => {
            if (e.translationY > 0 && scrollY.value <= 0) {
                expandAmount.value = e.translationY;
            } else {
                expandAmount.value = 0;
            }
        })
        .onEnd(() => {
            expandAmount.value = withSpring(0);
        })
        .activeOffsetY(40) // Increased threshold to avoid tap interference
        .failOffsetX([-20, 20])
        .hitSlop({ top: 0, height: 200 });

    const native = Gesture.Native();
    const composed = Gesture.Simultaneous(pan, native);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (e) => {
            scrollY.value = e.contentOffset.y;
        }
    });

    const loadEntries = async () => {
        setLoading(true);
        const stored = await getDiaryEntries();
        setEntries(stored);
        setLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadEntries();
        }, [])
    );

    const handleCreateEntry = async () => {
        if (!newTitle.trim()) {
            setIsAddingEntry(false);
            return;
        }

        const newEntry: DiaryEntry = {
            id: Date.now().toString(),
            title: newTitle.trim(),
            date: new Date().toLocaleDateString(),
            color: selectedColor,
        };

        await saveDiaryEntry(newEntry);
        setEntries([newEntry, ...entries]);
        setNewTitle("");
        setIsAddingEntry(false);

        // Auto-navigate to the new page
        router.push({ pathname: "/diary-page", params: { id: newEntry.id, title: newEntry.title } });
    };

    const handleDeleteEntry = async (id: string) => {
        await deleteDiaryEntry(id);
        setEntries(prev => prev.filter(e => e.id !== id));
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
            <View style={styles.container}>
                <Text style={styles.title}>My Diaries 📓</Text>

                <GestureDetector gesture={composed}>
                    <Animated.FlatList
                        data={entries}
                        keyExtractor={(item) => item.id}
                        onScroll={scrollHandler}
                        scrollEventThrottle={16}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item, index }) => (
                            <DiaryCard
                                item={item}
                                index={index}
                                total={entries.length}
                                expandAmount={expandAmount}
                                isDeleting={deletingId === item.id}
                                onPress={() => router.push({ pathname: "/diary-page", params: { id: item.id, title: item.title } })}
                                onLongPress={() => setDeletingId(item.id)}
                                onDelete={() => {
                                    handleDeleteEntry(item.id);
                                    setDeletingId(null);
                                }}
                            />
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No diaries yet.</Text>
                                <Text style={styles.emptySubText}>Create your first one below!</Text>
                            </View>
                        }
                    />
                </GestureDetector>

                <Pressable style={styles.fab} onPress={() => setIsAddingEntry(true)}>
                    <Text style={styles.fabText}>+</Text>
                </Pressable>

                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={isAddingEntry}
                    onRequestClose={() => setIsAddingEntry(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.modalTitle}>New Diary Entry</Text>
                            <TextInput
                                style={styles.textInput}
                                value={newTitle}
                                onChangeText={setNewTitle}
                                placeholder="Give it a name..."
                                autoFocus
                            />

                            <View style={styles.colorPicker}>
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

                            <View style={styles.modalButtons}>
                                <Pressable style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsAddingEntry(false)}>
                                    <Text style={styles.buttonText}>Cancel</Text>
                                </Pressable>
                                <Pressable style={[styles.modalButton, styles.saveButton]} onPress={handleCreateEntry}>
                                    <Text style={styles.buttonText}>Create</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </GestureHandlerRootView>
    );
}

const DiaryCard = ({ item, index, total, expandAmount, isDeleting, onPress, onLongPress, onDelete }: any) => {
    const animatedStyle = useAnimatedStyle(() => {
        // As user pulls down, we push each card down proportional to its index
        // but index 0 stays at top.
        const extraTranslate = Math.min(expandAmount.value * 0.8 * (index / Math.max(1, total - 1)), 500);

        return {
            transform: [
                { translateY: extraTranslate },
                { rotate: `${(index % 2 === 0 ? 1 : -1) * 2}deg` }
            ],
            zIndex: total - index,
            marginTop: index === 0 ? 0 : -100, // Keep the base stack
        };
    });

    return (
        <Animated.View style={animatedStyle}>
            <Pressable
                style={[styles.entryCard, { backgroundColor: item.color, zIndex: 100, elevation: 5 }]}
                onPress={onPress}
                onLongPress={onLongPress}
                android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
            >
                <Text style={styles.entryTitle} numberOfLines={1}>{item.title}</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.entryDate}>{item.date}</Text>

                {isDeleting && (
                    <Pressable
                        style={styles.deleteButton}
                        onPress={onDelete}
                    >
                        <Text style={styles.deleteButtonText}>×</Text>
                    </Pressable>
                )}
            </Pressable>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FDF6F0",
        paddingTop: 60,
    },
    center: {
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        fontSize: 34,
        fontFamily: "PatrickHand_400Regular",
        color: "#333",
        textAlign: "center",
        marginBottom: 20,
    },
    listContent: {
        padding: 20,
        paddingBottom: 100,
    },
    entryCard: {
        width: '100%',
        height: 160,
        borderRadius: 12,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.3)',
    },
    entryTitle: {
        fontSize: 16,
        fontFamily: "PatrickHand_400Regular",
        color: "#333",
        fontWeight: 'bold',
    },
    entryDate: {
        fontSize: 12,
        fontFamily: "PatrickHand_400Regular",
        color: "#666",
        textAlign: 'right',
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
        elevation: 10,
        zIndex: 1000,
    },
    fabText: {
        fontSize: 30,
        color: 'white',
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    inputContainer: {
        width: '80%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
    },
    modalTitle: {
        fontSize: 24,
        fontFamily: "PatrickHand_400Regular",
        marginBottom: 20,
        textAlign: 'center',
    },
    textInput: {
        borderBottomWidth: 2,
        borderBottomColor: '#FF8FAB',
        fontSize: 20,
        fontFamily: "PatrickHand_400Regular",
        padding: 10,
        marginBottom: 20,
    },
    colorPicker: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 25,
    },
    colorCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderColor: '#333',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalButton: {
        paddingVertical: 10,
        paddingHorizontal: 25,
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
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        fontSize: 24,
        fontFamily: "PatrickHand_400Regular",
        color: '#999',
    },
    emptySubText: {
        fontSize: 16,
        fontFamily: "PatrickHand_400Regular",
        color: '#bbb',
        marginTop: 10,
    },
    deleteButton: {
        position: 'absolute',
        top: -10,
        right: -10,
        backgroundColor: '#FF6B6B',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        lineHeight: 24,
    }
});
