// app/hooks/useAuth.js
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const result = await supabase.auth.signInWithPassword({ email, password });
    return result;
  };

  const signUp = async (email, password, campus) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (!error && data.user) {
      // Insert into public users table
      await supabase.from('users').upsert({
        id:                data.user.id,
        email:             email,
        campus_preference: campus,
        role:              'student',
      });
    }
    return { data, error };
  };

  const signOut = () => supabase.auth.signOut();

  return { user, session, loading, signIn, signUp, signOut };
}
