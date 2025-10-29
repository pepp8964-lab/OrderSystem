const DB_NAME = 'NaryadyDB';
const DB_VERSION = 2; // Incremented version to add the new photo store
const PHOTO_STORE = 'photos';
const FILE_STORE = 'fileCache';
const FILE_KEY = 'excel-import-cache';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbPromise) {
        return dbPromise;
    }
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = request.result;
            if (!db.objectStoreNames.contains(FILE_STORE)) {
                db.createObjectStore(FILE_STORE);
            }
            if (!db.objectStoreNames.contains(PHOTO_STORE)) {
                db.createObjectStore(PHOTO_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            dbPromise = null;
            reject(request.error);
        };
    });
    return dbPromise;
}

// --- Photo Functions ---
export async function savePhoto(personId: string, photoData: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PHOTO_STORE, 'readwrite');
        const store = transaction.objectStore(PHOTO_STORE);
        const request = store.put(photoData, personId);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

export async function getPhoto(personId: string): Promise<string | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PHOTO_STORE, 'readonly');
        const store = transaction.objectStore(PHOTO_STORE);
        const request = store.get(personId);
        request.onsuccess = () => resolve(request.result as string | null);
        request.onerror = () => reject(request.error);
    });
}

export async function deletePhoto(personId: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PHOTO_STORE, 'readwrite');
        const store = transaction.objectStore(PHOTO_STORE);
        const request = store.delete(personId);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

// --- File Cache Functions ---
export async function saveFileToDB(file: File): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(FILE_STORE, 'readwrite');
        const store = transaction.objectStore(FILE_STORE);
        const request = store.put(file, FILE_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

export async function getFileFromDB(): Promise<File | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(FILE_STORE, 'readonly');
        const store = transaction.objectStore(FILE_STORE);
        const request = store.get(FILE_KEY);
        request.onsuccess = () => resolve(request.result as File | null);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteFileFromDB(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(FILE_STORE, 'readwrite');
        const store = transaction.objectStore(FILE_STORE);
        const request = store.delete(FILE_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}
