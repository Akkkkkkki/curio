import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

type AuthState = {
  user: User | null;
  isAdmin: boolean;
  authReady: boolean;
};

export const useAuthState = (isSupabaseReady: boolean): AuthState => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseReady || !supabase) {
      setUser(null);
      setIsAdmin(false);
      setAuthReady(true);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let isActive = true;
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isActive) {
          setUser(session?.user || null);
        }
      } catch (e) {
        console.warn('Auth init failed:', e);
        if (isActive) {
          setUser(null);
        }
      } finally {
        if (isActive) {
          setAuthReady(true);
        }
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (isActive) {
          setUser(session?.user || null);
        }
      });
      unsubscribe = () => subscription.unsubscribe();
    };

    initAuth();
    return () => {
      isActive = false;
      if (unsubscribe) unsubscribe();
    };
  }, [isSupabaseReady]);

  useEffect(() => {
    let isMounted = true;
    if (!isSupabaseReady || !supabase || !user) {
      setIsAdmin(false);
      return () => { isMounted = false; };
    }

    const loadAdminStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();
        if (!isMounted) return;
        if (error) {
          console.warn('Admin status check failed:', error);
          setIsAdmin(false);
          return;
        }
        setIsAdmin(Boolean(data?.is_admin));
      } catch (e) {
        console.warn('Admin status check failed:', e);
        if (isMounted) setIsAdmin(false);
      }
    };

    loadAdminStatus();
    return () => { isMounted = false; };
  }, [isSupabaseReady, user]);

  return { user, isAdmin, authReady };
};
