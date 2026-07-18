import { useEffect, useState, useCallback } from 'react';
import { View,Text,ScrollView,TouchableOpacity,StyleSheet,TextInput,ActivityIndicator,RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const C={bg0:'#0a0e1a',bg1:'#0f1525',bg2:'#151c30',blue:'#3b82f6',blueLight:'#60a5fa',green:'#22c55e',red:'#ef4444',text0:'#f1f5f9',text1:'#94a3b8',text2:'#475569',border:'#1e2d47'};
function strColor(s){const c=['#1e3a5f','#1a3d2e','#2e1a5a','#3d2e0a','#0a2e3d','#2e0a2e'];let h=0;for(let i=0;i<s.length;i++)h=s.charCodeAt(i)+((h<<5)-h);return c[Math.abs(h)%c.length];}

export default function MessagesScreen() {
  const router=useRouter();const{user}=useAuth();
  const[convos,setConvos]=useState([]);const[allUsers,setAllUsers]=useState([]);
  const[loading,setLoading]=useState(true);const[refreshing,setRefreshing]=useState(false);
  const[search,setSearch]=useState('');const[tab,setTab]=useState('inbox');

  const fetchConvos=useCallback(async()=>{
    if(!user)return;
    const{data:sent}=await supabase.from('messages').select('*,receiver:receiver_id(id,email)').eq('sender_id',user.id).order('created_at',{ascending:false});
    const{data:recv}=await supabase.from('messages').select('*,sender:sender_id(id,email)').eq('receiver_id',user.id).order('created_at',{ascending:false});
    const map=new Map();
    (sent||[]).forEach(m=>{const p=m.receiver;if(!p)return;if(!map.has(p.id)||new Date(m.created_at)>new Date(map.get(p.id).created_at))map.set(p.id,{...m,partner:p,isMine:true});});
    (recv||[]).forEach(m=>{const p=m.sender;if(!p)return;if(!map.has(p.id)||new Date(m.created_at)>new Date(map.get(p.id).created_at))map.set(p.id,{...m,partner:p,isMine:false});});
    const{data:unread}=await supabase.from('messages').select('sender_id').eq('receiver_id',user.id).eq('read',false);
    const uc={};(unread||[]).forEach(m=>{uc[m.sender_id]=(uc[m.sender_id]||0)+1;});
    setConvos(Array.from(map.values()).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map(c=>({...c,unread:uc[c.partner.id]||0})));
    setLoading(false);
  },[user]);

  const fetchUsers=useCallback(async()=>{
    const{data}=await supabase.from('users').select('id,email,campus_preference,role').neq('id',user?.id).order('email');
    setAllUsers(data||[]);
  },[user]);

  useEffect(()=>{fetchConvos();fetchUsers();},[fetchConvos,fetchUsers]);
  const onRefresh=useCallback(async()=>{setRefreshing(true);await fetchConvos();await fetchUsers();setRefreshing(false);},[fetchConvos,fetchUsers]);

  const totalUnread=convos.reduce((s,c)=>s+c.unread,0);
  const filteredConvos=convos.filter(c=>c.partner?.email?.toLowerCase().includes(search.toLowerCase()));
  const filteredUsers=allUsers.filter(u=>u.email?.toLowerCase().includes(search.toLowerCase())||u.campus_preference?.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>router.back()}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>💬 Messages {totalUnread>0?`(${totalUnread})`:''}</Text>
        <View style={{width:50}}/>
      </View>
      <View style={s.searchBar}>
        <Text style={{fontSize:14,color:C.text2}}>🔍</Text>
        <TextInput style={s.searchInput} placeholder={tab==='inbox'?'Search conversations...':'Search users...'} placeholderTextColor={C.text2} value={search} onChangeText={setSearch}/>
        {search.length>0&&<TouchableOpacity onPress={()=>setSearch('')}><Text style={{color:C.text2,fontSize:16}}>✕</Text></TouchableOpacity>}
      </View>
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab,tab==='inbox'&&s.tabActive]} onPress={()=>setTab('inbox')}>
          <Text style={[s.tabTxt,tab==='inbox'&&s.tabTxtActive]}>📥 Inbox {totalUnread>0?`(${totalUnread})`:''}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab,tab==='users'&&s.tabActive]} onPress={()=>setTab('users')}>
          <Text style={[s.tabTxt,tab==='users'&&s.tabTxtActive]}>👥 All Users ({allUsers.length})</Text>
        </TouchableOpacity>
      </View>
      {loading?<ActivityIndicator color={C.blue} style={{marginTop:40}}/>:(
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:40}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue}/>}>
          {tab==='inbox'?(
            filteredConvos.length===0?(
              <View style={s.empty}>
                <Text style={{fontSize:40}}>💬</Text>
                <Text style={s.emptyTxt}>No conversations yet</Text>
                <Text style={s.emptyHint}>Go to "All Users" to start chatting</Text>
              </View>
            ):(
              <View style={{padding:14,gap:6}}>
                {filteredConvos.map(c=>(
                  <TouchableOpacity key={c.partner.id} style={[s.convoCard,c.unread>0&&s.convoUnread]} onPress={()=>router.push(`/community/chat/${c.partner.id}`)} activeOpacity={0.8}>
                    <View style={[s.av,{backgroundColor:strColor(c.partner.email||'')}]}><Text style={s.avTxt}>{(c.partner.email||'?')[0].toUpperCase()}</Text></View>
                    <View style={{flex:1}}>
                      <View style={s.convoHead}>
                        <Text style={s.convoName}>{c.partner.email?.split('@')[0]}</Text>
                        <Text style={s.convoTime}>{formatDistanceToNow(new Date(c.created_at),{addSuffix:true})}</Text>
                      </View>
                      <Text style={[s.convoPreview,c.unread>0&&s.convoPreviewUnread]} numberOfLines={1}>{c.isMine?'You: ':''}{c.body}</Text>
                    </View>
                    {c.unread>0&&<View style={s.unreadBadge}><Text style={s.unreadTxt}>{c.unread}</Text></View>}
                  </TouchableOpacity>
                ))}
              </View>
            )
          ):(
            <View style={{padding:14,gap:6}}>
              {filteredUsers.map(u=>(
                <TouchableOpacity key={u.id} style={s.userCard} onPress={()=>router.push(`/community/chat/${u.id}`)} activeOpacity={0.8}>
                  <View style={[s.av,{backgroundColor:strColor(u.email||'')}]}><Text style={s.avTxt}>{(u.email||'?')[0].toUpperCase()}</Text></View>
                  <View style={{flex:1}}>
                    <Text style={s.userName}>{u.email?.split('@')[0]}</Text>
                    <Text style={s.userEmail}>{u.email}</Text>
                    <Text style={s.userMeta}>{u.campus_preference||'No campus'} · {u.role||'student'}</Text>
                  </View>
                  <Text style={{fontSize:20}}>💬</Text>
                </TouchableOpacity>
              ))}
              {filteredUsers.length===0&&<View style={s.empty}><Text style={s.emptyTxt}>No users found</Text></View>}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#0a0e1a'},
  header:{backgroundColor:'#0f1525',padding:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#1e2d47'},
  back:{fontSize:14,fontWeight:'600',color:'#60a5fa'},title:{fontSize:16,fontWeight:'700',color:'#f1f5f9'},
  searchBar:{flexDirection:'row',alignItems:'center',gap:8,margin:10,marginBottom:4,backgroundColor:'#151c30',borderRadius:10,padding:10,borderWidth:1,borderColor:'#1e2d47'},
  searchInput:{flex:1,fontSize:13,color:'#f1f5f9'},
  tabs:{flexDirection:'row',backgroundColor:'#0f1525',borderBottomWidth:1,borderBottomColor:'#1e2d47'},
  tab:{flex:1,paddingVertical:12,alignItems:'center'},tabActive:{borderBottomWidth:2,borderBottomColor:'#3b82f6'},
  tabTxt:{fontSize:13,fontWeight:'500',color:'#475569'},tabTxtActive:{color:'#60a5fa',fontWeight:'700'},
  convoCard:{backgroundColor:'#151c30',borderRadius:12,padding:12,flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:'#1e2d47'},
  convoUnread:{borderColor:'rgba(59,130,246,0.4)'},
  av:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',flexShrink:0},
  avTxt:{fontSize:16,fontWeight:'700',color:'white'},
  convoHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:3},
  convoName:{fontSize:14,fontWeight:'700',color:'#f1f5f9'},convoTime:{fontSize:10,color:'#475569'},
  convoPreview:{fontSize:12,color:'#475569'},convoPreviewUnread:{color:'#94a3b8',fontWeight:'600'},
  unreadBadge:{backgroundColor:'#3b82f6',borderRadius:10,minWidth:20,height:20,alignItems:'center',justifyContent:'center',paddingHorizontal:5},
  unreadTxt:{fontSize:10,fontWeight:'700',color:'white'},
  userCard:{backgroundColor:'#151c30',borderRadius:12,padding:12,flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:'#1e2d47'},
  userName:{fontSize:14,fontWeight:'700',color:'#f1f5f9'},
  userEmail:{fontSize:11,color:'#475569',marginTop:1},userMeta:{fontSize:11,color:'#60a5fa',marginTop:2},
  empty:{alignItems:'center',paddingTop:60,gap:10},emptyTxt:{fontSize:14,color:'#475569'},emptyHint:{fontSize:12,color:'#475569',textAlign:'center'},
});
