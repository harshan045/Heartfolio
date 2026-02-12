import AsyncStorage from '@react-native-async-storage/async-storage';

export type MagnetData = {
  id: string; // unique id for keying if needed, or just use index
  color: string;
  icon: string;
  x: number; // relative position on the frame (e.g., -10 to 10)
  y: number; // relative position
  rotation: number;
};

export type PaperBit = {
  id: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  color: string;
  width?: number;
  height?: number;
  album: string;
  isSticker?: boolean;
};

export type TodoItem = {
  id: string;
  text: string;
  completed: boolean;
  x: number;
  y: number;
  color: string;
  rotation: number;
};

export type Polaroid = {
  id: string;
  uri: string;
  memory: string;
  date: string;
  rotation: number;
  x: number;
  y: number;
  magnet?: MagnetData;
  album: string; // New field for album organization
};

export type DiaryElement = {
  id: string;
  entryId: string; // Links element to a specific diary entry
  type: 'image' | 'text' | 'sticky' | 'sticker' | 'path';
  content: string; // URI for image, text content for notes/stickers, path data for drawings
  x: number;
  y: number;
  rotation: number;
  scale: number;
  fontFamily?: string;
  color?: string;
  points?: { x: number, y: number }[]; // For freehand drawing
  strokeWidth?: number; // For drawing tools
  width?: number; // Original width for images
  height?: number; // Original height for images
  hasShadow?: boolean; // Shadow effect for images
  zIndex?: number; // Layer order
  fontWeight?: "normal" | "bold"; // For text boldness
};

export type DiaryEntry = {
  id: string;
  title: string;
  date: string;
  color: string;
};

export const MAGNET_COLORS = ['#FF5252', '#448AFF', '#FFEB3B', '#69F0AE', '#E040FB', '#FFAB40'];
export const MAGNET_ICONS = ['📌', '⭐', '❤️', '😊', '🧲', '🌸', '🔥', '✨'];
export const PAPER_COLORS = ['#FFF9C4', '#F8BBD0', '#DCEDC8', '#B3E5FC', '#E1BEE7', '#FFFFFF'];

const STORAGE_KEY = 'heartfolio_memories';
const PAPER_BITS_KEY = 'heartfolio_paper_bits';
const TODOS_KEY = 'heartfolio_todos';
const DIARY_KEY = 'heartfolio_diary_elements'; // Renamed for clarity
const DIARY_ENTRIES_KEY = 'heartfolio_diary_entries';

export const saveMemory = async (newMemory: Polaroid): Promise<void> => {
  try {
    const existingMemories = await getMemories();
    const updatedMemories = [newMemory, ...existingMemories];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMemories));
  } catch (error) {
    console.error('Error saving memory:', error);
    throw error;
  }
};

export const getMemories = async (): Promise<Polaroid[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    const memories: Polaroid[] = jsonValue != null ? JSON.parse(jsonValue) : [];

    // Migration: ensure all memories have an album field
    let needsUpdate = false;
    const updatedMemories = memories.map(m => {
      if (!m.album) {
        needsUpdate = true;
        return { ...m, album: 'Uncategorized' };
      }
      return m;
    });

    if (needsUpdate) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMemories));
      return updatedMemories;
    }

    return memories;
  } catch (error) {
    console.error('Error retrieving memories:', error);
    return [];
  }
};

export const getAlbums = async (): Promise<string[]> => {
  const memories = await getMemories();
  const albums = memories.map(m => m.album);
  return Array.from(new Set(albums)).sort();
};

// ... (previous code)

export const deleteMemory = async (id: string): Promise<void> => {
  try {
    const existingMemories = await getMemories();
    const updatedMemories = existingMemories.filter((m) => m.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMemories));
  } catch (error) {
    console.error('Error deleting memory:', error);
    throw error;
  }
};

export const clearMemories = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(PAPER_BITS_KEY);
  } catch (e) {
    console.error("Error clearing memories", e);
  }
}

export const savePaperBit = async (newBit: PaperBit): Promise<void> => {
  try {
    const existingBits = await getPaperBits();
    // Check if updating existing
    const index = existingBits.findIndex(b => b.id === newBit.id);
    let updatedBits;
    if (index >= 0) {
      updatedBits = [...existingBits];
      updatedBits[index] = newBit;
    } else {
      updatedBits = [...existingBits, newBit];
    }
    await AsyncStorage.setItem(PAPER_BITS_KEY, JSON.stringify(updatedBits));
  } catch (error) {
    console.error('Error saving paper bit:', error);
  }
};

export const getPaperBits = async (): Promise<PaperBit[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(PAPER_BITS_KEY);
    const bits: PaperBit[] = jsonValue != null ? JSON.parse(jsonValue) : [];

    // Migration: ensure all paper bits have an album field
    let needsUpdate = false;
    const updatedBits = bits.map(b => {
      let changed = false;
      const updated = { ...b };

      if (!b.album) {
        updated.album = 'Uncategorized';
        changed = true;
      }

      if (b.width === undefined || b.width === null || isNaN(b.width)) {
        updated.width = 150;
        changed = true;
      }

      // Ensure x, y, rotation are valid numbers
      if (typeof b.x !== 'number' || isNaN(b.x)) {
        updated.x = 20;
        changed = true;
      }

      if (typeof b.y !== 'number' || isNaN(b.y)) {
        updated.y = 100;
        changed = true;
      }

      if (typeof b.rotation !== 'number' || isNaN(b.rotation)) {
        updated.rotation = 0;
        changed = true;
      }

      if (changed) needsUpdate = true;
      return updated;
    });

    if (needsUpdate) {
      await AsyncStorage.setItem(PAPER_BITS_KEY, JSON.stringify(updatedBits));
      return updatedBits;
    }

    return bits;
  } catch (error) {
    console.error('Error retrieving paper bits:', error);
    return [];
  }
};

export const deletePaperBit = async (id: string): Promise<void> => {
  try {
    const existingBits = await getPaperBits();
    const updatedBits = existingBits.filter(b => b.id !== id);
    await AsyncStorage.setItem(PAPER_BITS_KEY, JSON.stringify(updatedBits));
  } catch (e) {
    console.error("Error deleting bit", e);
  }
}

export const renameAlbum = async (oldName: string, newName: string): Promise<void> => {
  try {
    // 1. Rename in memories
    const memoriesJson = await AsyncStorage.getItem(STORAGE_KEY);
    if (memoriesJson) {
      const memories: Polaroid[] = JSON.parse(memoriesJson);
      const updatedMemories = memories.map(m =>
        m.album === oldName ? { ...m, album: newName } : m
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMemories));
    }

    // 2. Rename in paper bits
    const bitsJson = await AsyncStorage.getItem(PAPER_BITS_KEY);
    if (bitsJson) {
      const bits: PaperBit[] = JSON.parse(bitsJson);
      const updatedBits = bits.map(b =>
        b.album === oldName ? { ...b, album: newName } : b
      );
      await AsyncStorage.setItem(PAPER_BITS_KEY, JSON.stringify(updatedBits));
    }
  } catch (error) {
    console.error('Error renaming album:', error);
    throw error;
  }
};

export const getTodos = async (): Promise<TodoItem[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(TODOS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error('Error retrieving todos:', error);
    return [];
  }
};

export const saveTodo = async (todo: TodoItem): Promise<void> => {
  try {
    const existing = await getTodos();
    const index = existing.findIndex(t => t.id === todo.id);
    let updated;
    if (index >= 0) {
      updated = [...existing];
      updated[index] = todo;
    } else {
      updated = [todo, ...existing];
    }
    await AsyncStorage.setItem(TODOS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving todo:', error);
  }
};

export const deleteTodo = async (id: string): Promise<void> => {
  try {
    const existing = await getTodos();
    const updated = existing.filter(t => t.id !== id);
    await AsyncStorage.setItem(TODOS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error deleting todo:', error);
  }
};

export const saveTodos = async (todos: TodoItem[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(TODOS_KEY, JSON.stringify(todos));
  } catch (error) {
    console.error('Error saving todos:', error);
  }
};

export const getDiaryElements = async (entryId?: string): Promise<DiaryElement[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(DIARY_KEY);
    const allElements: DiaryElement[] = jsonValue != null ? JSON.parse(jsonValue) : [];
    if (entryId) {
      return allElements.filter(e => e.entryId === entryId);
    }
    return allElements;
  } catch (error) {
    console.error('Error retrieving diary elements:', error);
    return [];
  }
};

export const saveDiaryElement = async (element: DiaryElement): Promise<void> => {
  try {
    const jsonValue = await AsyncStorage.getItem(DIARY_KEY);
    const existing: DiaryElement[] = jsonValue != null ? JSON.parse(jsonValue) : [];
    const index = existing.findIndex(e => e.id === element.id);
    let updated;
    if (index >= 0) {
      updated = [...existing];
      updated[index] = element;
    } else {
      updated = [...existing, element];
    }
    await AsyncStorage.setItem(DIARY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving diary element:', error);
  }
};

export const saveDiaryElements = async (elements: DiaryElement[], entryId?: string): Promise<void> => {
  try {
    const jsonValue = await AsyncStorage.getItem(DIARY_KEY);
    const allExisting: DiaryElement[] = jsonValue != null ? JSON.parse(jsonValue) : [];

    let updated;
    if (entryId) {
      updated = [
        ...allExisting.filter(e => e.entryId !== entryId),
        ...elements
      ];
    } else {
      updated = elements;
    }
    await AsyncStorage.setItem(DIARY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving diary elements:', error);
  }
};

export const deleteDiaryElement = async (id: string): Promise<void> => {
  try {
    const elements = await getDiaryElements();
    const updated = elements.filter(e => e.id !== id);
    await AsyncStorage.setItem(DIARY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error deleting diary element:', error);
  }
};

// Diary Entry Functions
export const getDiaryEntries = async (): Promise<DiaryEntry[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(DIARY_ENTRIES_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error('Error retrieving diary entries:', error);
    return [];
  }
};

export const saveDiaryEntry = async (entry: DiaryEntry): Promise<void> => {
  try {
    const existing = await getDiaryEntries();
    const index = existing.findIndex(e => e.id === entry.id);
    let updated;
    if (index >= 0) {
      updated = [...existing];
      updated[index] = entry;
    } else {
      updated = [entry, ...existing];
    }
    await AsyncStorage.setItem(DIARY_ENTRIES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving diary entry:', error);
  }
};

export const deleteDiaryEntry = async (id: string): Promise<void> => {
  try {
    const entries = await getDiaryEntries();
    const updated = entries.filter(e => e.id !== id);
    await AsyncStorage.setItem(DIARY_ENTRIES_KEY, JSON.stringify(updated));

    // Also delete elements associated with this entry
    const elements = await getDiaryElements();
    const updatedElements = elements.filter(e => e.entryId !== id);
    await AsyncStorage.setItem(DIARY_KEY, JSON.stringify(updatedElements));
  } catch (error) {
    console.error('Error deleting diary entry:', error);
  }
};
