import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Memory } from '../types';

/**
 * Save a new memory to Firestore
 * @param userId - The ID of the current user
 * @param imageUrl - URL of the memory image
 * @param text - Text description of the memory
 */
export const saveMemory = async (
    userId: string,
    imageUrl: string,
    text: string
): Promise<void> => {
    try {
        const memoriesRef = collection(db, 'users', userId, 'memories');
        await addDoc(memoriesRef, {
            imageUrl,
            text,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('Error saving memory:', error);
        throw error;
    }
};

/**
 * Fetch all memories for a specific user
 * @param userId - The ID of the current user
 * @returns Array of Memory objects
 */
export const fetchMemories = async (userId: string): Promise<Memory[]> => {
    try {
        const memoriesRef = collection(db, 'users', userId, 'memories');
        const q = query(memoriesRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        const memories: Memory[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            memories.push({
                id: doc.id,
                imageUrl: data.imageUrl,
                text: data.text,
                createdAt: data.createdAt?.toDate() || new Date(),
            });
        });

        return memories;
    } catch (error) {
        console.error('Error fetching memories:', error);
        throw error;
    }
};

/**
 * Delete a specific memory
 * @param userId - The ID of the current user
 * @param memoryId - The ID of the memory to delete
 */
export const deleteMemory = async (
    userId: string,
    memoryId: string
): Promise<void> => {
    try {
        const memoryRef = doc(db, 'users', userId, 'memories', memoryId);
        await deleteDoc(memoryRef);
    } catch (error) {
        console.error('Error deleting memory:', error);
        throw error;
    }
};
