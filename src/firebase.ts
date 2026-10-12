import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { VideoHistoryItem } from './types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying the firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error Handling according to skill specification
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL CONSTRAINT: Validate Connection to Firestore on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Authentication helpers
let isLoggingIn = false;

export async function loginWithGoogle(): Promise<User | null> {
  if (isLoggingIn) {
    return null;
  }
  isLoggingIn = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    const code = error?.code || '';
    const message = error?.message || String(error);

    // Benign popup closure, popup blocker, or known Firebase SDK iframe assertion
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/popup-blocked' ||
      message.includes('Pending promise was never set')
    ) {
      console.warn('Sign-in cancelled or popup closed by browser/user.');
      return null;
    }

    console.warn('Google sign-in attempt completed with warning:', message);
    return null;
  } finally {
    isLoggingIn = false;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.warn('Sign-out completed with warning:', error?.message || error);
  }
}

// Firestore operations for Living Videos
export async function saveVideoToFirestore(video: VideoHistoryItem, user: User) {
  const path = 'videos';
  try {
    const docRef = doc(db, path, video.id);
    const nowIso = new Date().toISOString();
    await setDoc(docRef, {
      id: video.id,
      userId: user.uid,
      title: 'Edinburgh Rush Hour Living Motion',
      prompt: video.prompt.slice(0, 1900),
      aspectRatio: video.aspectRatio,
      model: video.model,
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnailUrl.startsWith('data:') ? video.thumbnailUrl.slice(0, 150000) : video.thumbnailUrl,
      durationSeconds: video.durationSeconds || 15,
      viewsCount: 1,
      isPublic: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${video.id}`);
  }
}

export function subscribeToCommunityVideos(
  callback: (videos: VideoHistoryItem[]) => void
) {
  const path = 'videos';
  try {
    const q = query(
      collection(db, path),
      where('isPublic', '==', true),
      limit(24)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const videos: VideoHistoryItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          videos.push({
            id: data.id || docSnap.id,
            videoUrl: data.videoUrl,
            thumbnailUrl: data.thumbnailUrl,
            prompt: data.prompt,
            aspectRatio: data.aspectRatio,
            model: data.model,
            createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
            durationSeconds: data.durationSeconds || 15,
          });
        });
        callback(videos);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
}

export async function deleteVideoFromFirestore(videoId: string) {
  const path = `videos/${videoId}`;
  try {
    await deleteDoc(doc(db, 'videos', videoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
