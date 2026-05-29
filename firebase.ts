// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs } from "firebase/firestore";
import { User } from "./types";
import firebaseConfig from "./firebase-applet-config.json";

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Services
export const auth = getAuth(app);
const dbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

// Lazy-load Analytics as it is environment-dependent (client-side only)
export const analyticsPromise = isSupported().then((supported) => {
  if (supported) {
    return getAnalytics(app);
  }
  return null;
});

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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Saves or updates a user object in real-time Firestore database.
 * @param user The user details to save.
 */
export async function saveUserToFirestore(user: User): Promise<void> {
  if (!user || !user.email) return;
  const emailKey = user.email.toLowerCase();
  const path = `users/${emailKey}`;
  try {
    const userRef = doc(db, "users", emailKey);
    // Remove functions or undefined values if any exist on the object
    const sanitizedUser = JSON.parse(JSON.stringify(user));
    await setDoc(userRef, sanitizedUser, { merge: true });
    console.log(`Successfully synced user ${user.email} to Firestore.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Retrieves a user object from Firestore database.
 * @param email The user email.
 */
export async function getUserFromFirestore(email: string): Promise<User | null> {
  if (!email) return null;
  const emailKey = email.toLowerCase();
  const path = `users/${emailKey}`;
  try {
    const userRef = doc(db, "users", emailKey);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return userSnap.data() as User;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
  return null;
}

/**
 * Pulls all user records from Firestore (typically for administrator controls).
 */
export async function getAllUsersFromFirestore(): Promise<User[]> {
  const path = "users";
  try {
    const usersColl = collection(db, "users");
    const snapshot = await getDocs(usersColl);
    const list: User[] = [];
    snapshot.forEach((doc) => {
      list.push(doc.data() as User);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Background synchronization of locally stored users into Firestore.
 */
export async function syncLocalToFirestore(): Promise<void> {
  try {
    const stored = localStorage.getItem("star9ja_users") || localStorage.getItem("naira9ja_users");
    if (stored) {
      const parsed = JSON.parse(stored);
      for (const key of Object.keys(parsed)) {
        await saveUserToFirestore(parsed[key]);
      }
    }
  } catch (error) {
    console.error("Sync Local to Firestore Error:", error);
  }
}

/**
 * Background synchronization of all Firestore users down to local storage.
 */
export async function syncFirestoreToLocal(): Promise<void> {
  try {
    const firestoreUsers = await getAllUsersFromFirestore();
    if (firestoreUsers.length > 0) {
      const dbObj: Record<string, User> = {};
      firestoreUsers.forEach((u) => {
        if (u.email) {
          dbObj[u.email.toLowerCase()] = u;
        }
      });
      localStorage.setItem("star9ja_users", JSON.stringify(dbObj));
    }
  } catch (error) {
    console.error("Sync Firestore to Local Error:", error);
  }
}

export default app;
