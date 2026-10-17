import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const SUPER_ADMIN_EMAILS = [
  'shongwut.tab@mfu.ac.th',
  'info.finance@mfu.ac.th'
];

export type UserRole = 'view' | 'edit' | 'admin' | 'none';

export interface UserPermissionItem {
  id: string;
  email: string;
  role: 'view' | 'edit' | 'admin';
  addedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.some(admin => admin.toLowerCase() === cleanEmail);
}

// Fetch all permissions from Firestore
export async function fetchUserPermissions(): Promise<UserPermissionItem[]> {
  try {
    const snap = await getDocs(collection(db, 'user_permissions'));
    const list: UserPermissionItem[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        email: data.email || d.id,
        role: data.role || 'view',
        addedBy: data.addedBy || '',
        createdAt: data.createdAt || '',
        updatedAt: data.updatedAt || '',
      });
    });
    return list;
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return [];
  }
}

// Subscribe to real-time user permissions
export function subscribeUserPermissions(
  callback: (permissions: UserPermissionItem[]) => void
) {
  return onSnapshot(
    collection(db, 'user_permissions'),
    (snap) => {
      const list: UserPermissionItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          email: data.email || d.id,
          role: data.role || 'view',
          addedBy: data.addedBy || '',
          createdAt: data.createdAt || '',
          updatedAt: data.updatedAt || '',
        });
      });
      callback(list);
    },
    (error) => {
      console.error('Error subscribing to permissions:', error);
      callback([]);
    }
  );
}

// Save or update user permission
export async function saveUserPermission(
  email: string,
  role: 'view' | 'edit' | 'admin',
  adminEmail: string
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const docId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
  const now = new Date().toISOString();
  await setDoc(
    doc(db, 'user_permissions', docId),
    {
      email: cleanEmail,
      role,
      addedBy: adminEmail,
      updatedAt: now,
      createdAt: now,
    },
    { merge: true }
  );
}

// Delete user permission
export async function removeUserPermission(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const docId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
  await deleteDoc(doc(db, 'user_permissions', docId));
}

export interface PermissionRequestItem {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  requestedRole: 'view' | 'edit';
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  updatedAt: string;
}

// Submit permission request from user
export async function submitPermissionRequest(
  email: string,
  displayName: string,
  photoURL: string | undefined,
  requestedRole: 'view' | 'edit'
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const docId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
  const now = new Date().toISOString();
  await setDoc(
    doc(db, 'permission_requests', docId),
    {
      email: cleanEmail,
      displayName: displayName || '',
      photoURL: photoURL || '',
      requestedRole,
      status: 'pending',
      requestedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
}

// Fetch single user permission request status
export async function fetchUserPermissionRequest(email: string): Promise<PermissionRequestItem | null> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const docId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
    const snap = await getDoc(doc(db, 'permission_requests', docId));
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: snap.id,
        email: data.email || cleanEmail,
        displayName: data.displayName || '',
        photoURL: data.photoURL || '',
        requestedRole: data.requestedRole || 'view',
        status: data.status || 'pending',
        requestedAt: data.requestedAt || '',
        updatedAt: data.updatedAt || '',
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user request:', error);
    return null;
  }
}

// Real-time listener for all permission requests (for Admin dashboard)
export function subscribePermissionRequests(
  callback: (requests: PermissionRequestItem[]) => void
) {
  return onSnapshot(
    collection(db, 'permission_requests'),
    (snap) => {
      const list: PermissionRequestItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.status !== 'rejected') {
          list.push({
            id: d.id,
            email: data.email || d.id,
            displayName: data.displayName || '',
            photoURL: data.photoURL || '',
            requestedRole: data.requestedRole || 'view',
            status: data.status || 'pending',
            requestedAt: data.requestedAt || '',
            updatedAt: data.updatedAt || '',
          });
        }
      });
      list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
      callback(list);
    },
    (error) => {
      console.error('Error subscribing to permission requests:', error);
      callback([]);
    }
  );
}

// Remove or reject permission request
export async function removePermissionRequest(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const docId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
  await deleteDoc(doc(db, 'permission_requests', docId));
}

// Approve permission request
export async function approvePermissionRequest(
  email: string,
  role: 'view' | 'edit',
  adminEmail: string
): Promise<void> {
  await saveUserPermission(email, role, adminEmail);
  await removePermissionRequest(email);
}

const provider = new GoogleAuthProvider();
// Request the Sheets and Drive scopes specified in the applet config
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('google_access_token') : null;

// Initialize auth listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken && typeof window !== 'undefined') {
        cachedAccessToken = localStorage.getItem('google_access_token');
      }
      const token = cachedAccessToken || 'firebase-authenticated-session';
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      cachedAccessToken = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('google_access_token');
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || 'firebase-authenticated-session';
    if (typeof window !== 'undefined' && credential?.accessToken) {
      localStorage.setItem('google_access_token', credential.accessToken);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      return null;
    }
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('google_access_token');
  }
};

