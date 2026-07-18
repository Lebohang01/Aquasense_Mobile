// app/hooks/useRealtimeNode.js
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export function useRealtimeNode(nodeId) {
  const [reading, setReading] = useState(null);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!nodeId) return;

    // Clean up any existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = 'node-' + nodeId + '-' + Math.random().toString(36).slice(2, 6);
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'readings',
          filter: 'node_id=eq.' + nodeId,
        },
        (payload) => setReading(payload.new)
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [nodeId]);

  return reading;
}
