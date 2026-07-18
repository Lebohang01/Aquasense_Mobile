// app/(tabs)/_layout.js — Updated tabs: Dashboard, Map, Alerts, Community, History, Settings
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';

const C = { bg0:'#0a0e1a', border:'#1e2d47', blueLight:'#60a5fa', text2:'#475569', red:'#ef4444' };

function TabIcon({ emoji, label, focused, badge }) {
  return (
    <View style={st.wrap}>
      <Text style={{ fontSize:19 }}>{emoji}</Text>
      {badge > 0 && <View style={st.badge}><Text style={st.badgeTxt}>{badge > 99 ? '99+' : badge}</Text></View>}
      <Text style={[st.label, focused && st.labelActive]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase.from('messages')
        .select('id', { count:'exact', head:true })
        .eq('receiver_id', user.id).eq('read', false);
      setUnread(count || 0);
    };
    fetchUnread();
    const ch = supabase.channel('tabs-unread-' + Date.now())
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, fetchUnread)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: 'rgba(10,14,26,0.97)',
        borderTopColor: C.border, borderTopWidth: 1,
        height: 76, paddingTop: 8, paddingBottom: 12,
      },
      tabBarShowLabel: false,
    }}>
      <Tabs.Screen name="index"     options={{ tabBarIcon: ({focused}) => <TabIcon emoji="🏠" label="Home"      focused={focused} badge={0}/> }} />
      <Tabs.Screen name="map"       options={{ tabBarIcon: ({focused}) => <TabIcon emoji="🗺️" label="Map"       focused={focused} badge={0}/> }} />
      <Tabs.Screen name="alerts"    options={{ tabBarIcon: ({focused}) => <TabIcon emoji="🔔" label="Alerts"    focused={focused} badge={0}/> }} />
      <Tabs.Screen name="community" options={{ tabBarIcon: ({focused}) => <TabIcon emoji="💬" label="Community" focused={focused} badge={unread}/> }} />
      <Tabs.Screen name="history"   options={{ tabBarIcon: ({focused}) => <TabIcon emoji="📊" label="History"   focused={focused} badge={0}/> }} />
      <Tabs.Screen name="settings"  options={{ tabBarIcon: ({focused}) => <TabIcon emoji="⚙️" label="Settings"  focused={focused} badge={0}/> }} />
      {/* Keep report registered but hidden — redirect to settings */}
      <Tabs.Screen name="report"    options={{ href: null }} />
    </Tabs>
  );
}

const st = StyleSheet.create({
  wrap:        { alignItems:'center', justifyContent:'center', position:'relative' },
  label:       { fontSize:9, fontWeight:'500', color:C.text2, marginTop:1 },
  labelActive: { color:C.blueLight },
  badge:       { position:'absolute', top:-4, right:-10, backgroundColor:C.red, borderRadius:8, minWidth:16, height:16, alignItems:'center', justifyContent:'center', paddingHorizontal:3 },
  badgeTxt:    { fontSize:9, fontWeight:'700', color:'white' },
});
