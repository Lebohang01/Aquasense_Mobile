// app/hooks/useNodes.js
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export function useNodes(campus = null) {
  const [nodes,   setNodes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const channelRef = useRef(null);

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('nodes')
      .select('*')
      .order('campus')
      .order('location_name');
    if (campus) query = query.eq('campus', campus);
    const { data, error: err } = await query;
    if (err) setError(err.message);
    else     setNodes(data || []);
    setLoading(false);
  }, [campus]);

  useEffect(() => {
    fetchNodes();

    // Guard: only create one channel per mount
    if (channelRef.current) return;

    const channelName = 'nodes-status-' + Math.random().toString(36).slice(2, 8);
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'nodes' },
        (payload) => {
          setNodes(prev =>
            prev.map(n => n.node_id === payload.new.node_id ? payload.new : n)
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchNodes]);

  return { nodes, loading, error, refetch: fetchNodes };
}

export function useLatestReading(nodeId) {
  const [reading, setReading] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!nodeId) { setLoading(false); return; }
    supabase
      .from('readings')
      .select('*')
      .eq('node_id', nodeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        setReading(data);
        setLoading(false);
      });
  }, [nodeId]);

  return { reading, loading };
}

export function useReadingHistory(nodeId, days = 7) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!nodeId) { setLoading(false); return; }
    const since = new Date(Date.now() - days * 86400000).toISOString();
    supabase
      .from('readings')
      .select('ph, tds, turbidity, temperature, sans_status, created_at')
      .eq('node_id', nodeId)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setHistory(data || []);
        setLoading(false);
      });
  }, [nodeId, days]);

  return { history, loading };
}
