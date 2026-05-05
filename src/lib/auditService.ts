import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export enum ActivityAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  CREATE_ASSET = 'CREATE_ASSET',
  UPDATE_ASSET = 'UPDATE_ASSET',
  DELETE_ASSET = 'DELETE_ASSET',
  CREATE_INVENTORY = 'CREATE_INVENTORY',
  UPDATE_INVENTORY = 'UPDATE_INVENTORY',
  DELETE_INVENTORY = 'DELETE_INVENTORY',
  UPDATE_USER = 'UPDATE_USER',
}

export async function logActivity(action: ActivityAction, targetId?: string, targetName?: string, details?: string) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, 'auditLogs'), {
      uid: user.uid,
      userEmail: user.email,
      action,
      targetId: targetId || null,
      targetName: targetName || null,
      details: details || null,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
