import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    where
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { DiaryElement, DiaryEntry, PaperBit, Polaroid, TodoItem } from '../types';

// Generic CRUD helpers
const getCollectionPath = (userId: string, subcollection: string) =>
    collection(db, 'users', userId, subcollection);

const getDocPath = (userId: string, subcollection: string, docId: string) =>
    doc(db, 'users', userId, subcollection, docId);

/**
 * --- MEMORIES (POLAROIDS) ---
 */
export const saveMemory = async (userId: string, memory: Polaroid): Promise<void> => {
    const ref = getDocPath(userId, 'memories', memory.id);
    await setDoc(ref, {
        ...memory,
        updatedAt: serverTimestamp(),
    }, { merge: true });
};

export const getMemories = async (userId: string): Promise<Polaroid[]> => {
    const q = query(getCollectionPath(userId, 'memories'), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Polaroid);
};

export const deleteMemory = async (userId: string, id: string): Promise<void> => {
    await deleteDoc(getDocPath(userId, 'memories', id));
};

/**
 * --- PAPER BITS ---
 */
export const savePaperBit = async (userId: string, bit: PaperBit): Promise<void> => {
    const ref = getDocPath(userId, 'paper_bits', bit.id);
    await setDoc(ref, {
        ...bit,
        updatedAt: serverTimestamp(),
    });
};

export const getPaperBits = async (userId: string): Promise<PaperBit[]> => {
    const snapshot = await getDocs(getCollectionPath(userId, 'paper_bits'));
    return snapshot.docs.map(doc => doc.data() as PaperBit);
};

export const deletePaperBit = async (userId: string, id: string): Promise<void> => {
    await deleteDoc(getDocPath(userId, 'paper_bits', id));
};

/**
 * --- TODOS ---
 */
export const saveTodo = async (userId: string, todo: TodoItem): Promise<void> => {
    const ref = getDocPath(userId, 'todos', todo.id);
    await setDoc(ref, { ...todo, updatedAt: serverTimestamp() });
};

export const saveTodos = async (userId: string, todos: TodoItem[]): Promise<void> => {
    for (const todo of todos) {
        await saveTodo(userId, todo);
    }
};

export const getTodos = async (userId: string): Promise<TodoItem[]> => {
    const q = query(getCollectionPath(userId, 'todos'), orderBy('rotation', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as TodoItem);
};

export const deleteTodo = async (userId: string, id: string): Promise<void> => {
    await deleteDoc(getDocPath(userId, 'todos', id));
};

/**
 * --- DIARY ---
 */
export const saveDiaryEntry = async (userId: string, entry: DiaryEntry): Promise<void> => {
    const ref = getDocPath(userId, 'diary_entries', entry.id);
    await setDoc(ref, { ...entry, updatedAt: serverTimestamp() });
};

export const getDiaryEntries = async (userId: string): Promise<DiaryEntry[]> => {
    const q = query(getCollectionPath(userId, 'diary_entries'), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as DiaryEntry);
};

export const deleteDiaryEntry = async (userId: string, id: string): Promise<void> => {
    await deleteDoc(getDocPath(userId, 'diary_entries', id));
};

export const saveDiaryElement = async (userId: string, element: DiaryElement): Promise<void> => {
    const ref = getDocPath(userId, 'diary_elements', element.id);
    await setDoc(ref, { ...element, updatedAt: serverTimestamp() });
};

export const getDiaryElements = async (userId: string, entryId?: string): Promise<DiaryElement[]> => {
    let q = query(getCollectionPath(userId, 'diary_elements'));
    if (entryId) {
        q = query(q, where('entryId', '==', entryId));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as DiaryElement);
};

export const deleteDiaryElement = async (userId: string, id: string): Promise<void> => {
    await deleteDoc(getDocPath(userId, 'diary_elements', id));
};

export const saveDiaryElements = async (userId: string, elements: DiaryElement[]): Promise<void> => {
    for (const el of elements) {
        await saveDiaryElement(userId, el);
    }
};

/**
 * --- HOME SCREEN DATA ---
 */
export const saveUserProfile = async (userId: string, profile: { nickname?: string, bio?: string, banner?: string }): Promise<void> => {
    const ref = getDocPath(userId, 'profile', 'main');
    await setDoc(ref, { ...profile, updatedAt: serverTimestamp() }, { merge: true });
};

export const getUserProfile = async (userId: string): Promise<any> => {
    const ref = getDocPath(userId, 'profile', 'main');
    const snapshot = await getDocs(query(collection(db, 'users', userId, 'profile')));
    return snapshot.docs.length > 0 ? snapshot.docs[0].data() : null;
};

export const saveHomeStickers = async (userId: string, stickers: any[]): Promise<void> => {
    const ref = getDocPath(userId, 'home_data', 'stickers');
    await setDoc(ref, { stickers, updatedAt: serverTimestamp() });
};

export const getHomeStickers = async (userId: string): Promise<any[]> => {
    const ref = getDocPath(userId, 'home_data', 'stickers');
    const snapshot = await getDocs(query(collection(db, 'users', userId, 'home_data')));
    const doc = snapshot.docs.find(d => d.id === 'stickers');
    return doc ? doc.data().stickers : [];
};

export const saveDecoPositions = async (userId: string, deco: any): Promise<void> => {
    const ref = getDocPath(userId, 'home_data', 'deco');
    await setDoc(ref, { deco, updatedAt: serverTimestamp() });
};

export const getDecoPositions = async (userId: string): Promise<any> => {
    const ref = getDocPath(userId, 'home_data', 'deco');
    const snapshot = await getDocs(query(collection(db, 'users', userId, 'home_data')));
    const doc = snapshot.docs.find(d => d.id === 'deco');
    return doc ? doc.data().deco : null;
};
