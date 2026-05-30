import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../firebaseConfig';

/**
 * Upload an image to Firebase Storage and return the download URL
 * @param uri - Local URI of the image
 * @param path - Storage path (e.g., 'users/{uid}/gallery/{filename}')
 */
export const uploadImage = async (uri: string, path: string): Promise<string> => {
    try {
        console.log(`[STORAGE] Starting upload process to: ${path}`);
        console.log(`[STORAGE] Input URI: ${uri}`);

        // 1. Fetch the image and convert to blob
        const response = await fetch(uri);
        const blob = await response.blob();

        console.log(`[STORAGE] Blob prepared. Size: ${blob.size} bytes, Type: ${blob.type}`);

        if (blob.size === 0) {
            throw new Error('Prepared blob has 0 size. The local file might be inaccessible.');
        }

        const storageRef = ref(storage, path);

        const metadata = {
            contentType: blob.type || 'image/jpeg',
        };

        // 2. Use resumable upload for better error tracking
        return new Promise((resolve, reject) => {
            const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`[STORAGE] Upload is ${progress.toFixed(2)}% done`);
                },
                (error) => {
                    console.error('[STORAGE] Upload Task Error:', error);
                    console.error('[STORAGE] Error Code:', error.code);
                    console.error('[STORAGE] Error Message:', error.message);
                    if (error.serverResponse) {
                        console.error('[STORAGE] Server Response:', error.serverResponse);
                    }
                    reject(error);
                },
                async () => {
                    console.log('[STORAGE] Upload Task Completed Successfully');
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(downloadURL);
                }
            );
        });
    } catch (error: any) {
        console.error('[STORAGE] High-level error in uploadImage:', error);
        throw error;
    }
};
