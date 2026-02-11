import * as ImagePicker from 'expo-image-picker';
import { signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth } from '../firebaseConfig';
import { deleteMemory, fetchMemories, saveMemory } from '../services/memoryService';
import { Memory } from '../types';

export default function HomeScreen() {
    const [memories, setMemories] = useState<Memory[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [memoryText, setMemoryText] = useState('');
    const [saving, setSaving] = useState(false);

    const userId = auth.currentUser?.uid;

    useEffect(() => {
        loadMemories();
    }, []);

    const loadMemories = async () => {
        if (!userId) return;

        try {
            setLoading(true);
            const fetchedMemories = await fetchMemories(userId);
            setMemories(fetchedMemories);
        } catch (error) {
            Alert.alert('Error', 'Failed to load memories');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadMemories();
        setRefreshing(false);
    };

    const handleLogout = async () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await signOut(auth);
                    } catch (error) {
                        Alert.alert('Error', 'Failed to logout');
                    }
                },
            },
        ]);
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'We need camera roll permissions to add memories');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setSelectedImage(result.assets[0].uri);
            setModalVisible(true);
        }
    };

    const handleSaveMemory = async () => {
        if (!userId || !selectedImage) return;

        if (!memoryText.trim()) {
            Alert.alert('Error', 'Please add a description for your memory');
            return;
        }

        try {
            setSaving(true);
            await saveMemory(userId, selectedImage, memoryText);
            Alert.alert('Success', 'Memory saved!');
            setModalVisible(false);
            setSelectedImage(null);
            setMemoryText('');
            await loadMemories();
        } catch (error) {
            Alert.alert('Error', 'Failed to save memory');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteMemory = (memoryId: string) => {
        Alert.alert('Delete Memory', 'Are you sure you want to delete this memory?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    if (!userId) return;
                    try {
                        await deleteMemory(userId, memoryId);
                        setMemories(memories.filter((m) => m.id !== memoryId));
                        Alert.alert('Success', 'Memory deleted');
                    } catch (error) {
                        Alert.alert('Error', 'Failed to delete memory');
                    }
                },
            },
        ]);
    };

    const renderMemory = ({ item }: { item: Memory }) => (
        <TouchableOpacity
            style={styles.memoryCard}
            onLongPress={() => handleDeleteMemory(item.id)}
            activeOpacity={0.8}
        >
            <Image source={{ uri: item.imageUrl }} style={styles.memoryImage} />
            <View style={styles.memoryContent}>
                <Text style={styles.memoryText}>{item.text}</Text>
                <Text style={styles.memoryDate}>
                    {item.createdAt.toLocaleDateString()}
                </Text>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#ff6b9d" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Memories</Text>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={memories}
                renderItem={renderMemory}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#ff6b9d"
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No memories yet</Text>
                        <Text style={styles.emptySubtext}>
                            Tap the + button to add your first memory
                        </Text>
                    </View>
                }
            />

            <TouchableOpacity style={styles.fab} onPress={pickImage}>
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add Memory</Text>

                        {selectedImage && (
                            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                        )}

                        <TextInput
                            style={styles.textInput}
                            placeholder="Describe this memory..."
                            placeholderTextColor="#999"
                            value={memoryText}
                            onChangeText={setMemoryText}
                            multiline
                            numberOfLines={4}
                            editable={!saving}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => {
                                    setModalVisible(false);
                                    setSelectedImage(null);
                                    setMemoryText('');
                                }}
                                disabled={saving}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleSaveMemory}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
    },
    logoutButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#ffe0e9',
    },
    logoutText: {
        color: '#ff6b9d',
        fontWeight: '600',
    },
    listContent: {
        padding: 15,
    },
    memoryCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    memoryImage: {
        width: '100%',
        height: 200,
        resizeMode: 'cover',
    },
    memoryContent: {
        padding: 15,
    },
    memoryText: {
        fontSize: 16,
        color: '#333',
        marginBottom: 8,
    },
    memoryDate: {
        fontSize: 14,
        color: '#999',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyText: {
        fontSize: 20,
        color: '#999',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#bbb',
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#ff6b9d',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#ff6b9d',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    fabText: {
        fontSize: 32,
        color: '#fff',
        fontWeight: '300',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        width: '85%',
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
        textAlign: 'center',
    },
    previewImage: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        marginBottom: 15,
        resizeMode: 'cover',
    },
    textInput: {
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 15,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: '#f0f0f0',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#ff6b9d',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
