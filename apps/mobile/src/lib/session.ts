import { createContext, useContext } from 'react';

export type Viewer = {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
  mfaSetupRequired: boolean;
  unreadNotifications: number;
};

export type SessionState = {
  viewer: Viewer | null;
  loading: boolean;
  signIn: (email: string, password: string, mfaCode?: string) => Promise<'ok' | 'mfa_required'>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const SessionContext = createContext<SessionState>({
  viewer: null,
  loading: true,
  signIn: async () => 'ok',
  signOut: async () => undefined,
  refresh: async () => undefined,
});

export const useSession = () => useContext(SessionContext);
