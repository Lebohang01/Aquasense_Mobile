import { useEffect, useState, useRef, useCallback } from 'react';
import { View,Text,FlatList,TouchableOpacity,StyleSheet,TextInput,ActivityIndicator,KeyboardAvoidingView,Platform,Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, isToday, isYesterday } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const C={bg0:'#0a0e1a',bg1:'#0f1525',bg2:'#151c30',bg3:'#1c2540',blue:'#3b82f6',blueLight:'#60a5fa',green:'#22c55e',red:'#ef4444',text0:'#f1f5f9',text1:'#94a3b8',text2:'#475569',border:'#1e2d47'};
function strColor(s){const c=['#1e3a5f','#1a3d2e','#2e1a5a','#3d2e0a','#0a2e3d','#2e0a2e'];let h=0;for(let i=0;i<s.length;i++)h=s.charCodeAt(i)+((h<<5)-h);return c[Math.abs(h)%c.length];}
function fmtTime(d){const dt=new Date(d);if(isToday(dt))return format(dt,'HH:mm');if(isYesterday(dt))return`Yesterday ${format(dt,'HH:mm')}`;return format(dt,'MMM d, HH:mm');}

function groupByDate(msgs){
  const groups=[];let cur=null;
  msgs.forEach(m=>{
    const ds=new Date(m.created_at).toDateString();
    if(ds!==cur){cur=ds;groups.push({type:'date',id:'d-'+ds,label:isToday(new Date(m.created_at))?'Today':isYesterday(new Date(m.created_at))?'Yesterday':format(new Date(m.created_at),'MMMM d, yyyy')});}
    groups.push({type:'msg',...m});
  });
  return groups;
}

export default function ChatScreen() {
  const{userId}=useLocalSearchParams();const router=useRouter();const{user}=useAuth();
  const flatRef=useRef(null);const chRef=useRef(null);
  const[partner,setPartner]=useState(null);const[messages,setMessages]=useState([]);
  const[loading,setLoading]=useState(true);const[text,setText]=useState('');const[sending,setSending]=useState(false);

  const fetchPartner=useCallback(async()=>{
    const{data}=await supabase.from('users').select('id,email,campus_preference,role').eq('id',userId).single();
    setPartner(data);
  },[userId]);

  const fetchMessages=useCallback(async()=>{
    if(!user)return;
    const{data}=await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
      .order('created_at',{ascending:true});
    setMessages(data||[]);setLoading(false);
    // mark as read
    await supabase.from('messages').update({read:true}).eq('sender_id',userId).eq('receiver_id',user.id).eq('read',false);
  },[user,userId]);

  useEffect(()=>{
    fetchPartner();fetchMessages();
    if(chRef.current)supabase.removeChannel(chRef.current);
    const ch=supabase.channel(`chat-${user?.id}-${userId}-${Date.now()}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},async(payload)=>{
        const m=payload.new;
        const rel=(m.sender_id===user?.id&&m.receiver_id===userId)||(m.sender_id===userId&&m.receiver_id===user?.id);
        if(!rel)return;
        setMessages(prev=>{if(prev.find(x=>x.id===m.id))return prev;return[...prev,m];});
        if(m.receiver_id===user?.id)await supabase.from('messages').update({read:true}).eq('id',m.id);
      })
      .subscribe();
    chRef.current=ch;
    return()=>{if(chRef.current)supabase.removeChannel(chRef.current);};
  },[fetchPartner,fetchMessages,user,userId]);

  useEffect(()=>{if(messages.length>0)setTimeout(()=>flatRef.current?.scrollToEnd({animated:true}),100);},[messages]);

  const send=async()=>{
    if(!text.trim()||!user||sending)return;
    const body=text.trim();setText('');setSending(true);
    const{error}=await supabase.from('messages').insert({sender_id:user.id,receiver_id:userId,body,read:false});
    if(error){Alert.alert('Error',error.message);setText(body);}
    setSending(false);
  };

  const delMsg=(id)=>Alert.alert('Delete','Delete this message?',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>{await supabase.from('messages').delete().eq('id',id);setMessages(prev=>prev.filter(m=>m.id!==id));}}]);

  const grouped=groupByDate(messages);

  const renderItem=({item})=>{
    if(item.type==='date')return(<View style={s.dateDivider}><View style={s.dateLine}/><Text style={s.dateLabel}>{item.label}</Text><View style={s.dateLine}/></View>);
    const mine=item.sender_id===user?.id;
    return(
      <TouchableOpacity onLongPress={()=>mine&&delMsg(item.id)} activeOpacity={0.8}>
        <View style={[s.msgRow,mine&&s.msgRowMine]}>
          {!mine&&<View style={[s.msgAv,{backgroundColor:strColor(partner?.email||'')}]}><Text style={s.msgAvTxt}>{(partner?.email||'?')[0].toUpperCase()}</Text></View>}
          <View style={[s.bubble,mine?s.bubbleMine:s.bubbleTheirs]}>
            <Text style={[s.bubbleTxt,mine&&s.bubbleTxtMine]}>{item.body}</Text>
            <View style={s.msgMeta}>
              <Text style={[s.msgTime,mine&&s.msgTimeMine]}>{fmtTime(item.created_at)}</Text>
              {mine&&<Text style={s.tick}>{item.read?'✓✓':'✓'}</Text>}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if(loading)return(<SafeAreaView style={s.safe} edges={['top']}><View style={s.header}><TouchableOpacity onPress={()=>router.back()}><Text style={s.back}>←</Text></TouchableOpacity></View><ActivityIndicator color="#3b82f6" style={{marginTop:40}}/></SafeAreaView>);

  return(
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>router.back()} style={{padding:4}}><Text style={s.back}>←</Text></TouchableOpacity>
        <View style={[s.hAv,{backgroundColor:strColor(partner?.email||'')}]}><Text style={s.hAvTxt}>{(partner?.email||'?')[0].toUpperCase()}</Text></View>
        <View style={{flex:1}}>
          <Text style={s.hName}>{partner?.email?.split('@')[0]||'User'}</Text>
          <Text style={s.hMeta}>{partner?.campus_preference||''} · {partner?.role||'student'}</Text>
        </View>
        <View style={s.onlineDot}/>
      </View>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={0}>
        {messages.length===0?(
          <View style={s.emptyChat}>
            <View style={[s.emptyChatAv,{backgroundColor:strColor(partner?.email||'')}]}><Text style={{fontSize:32,fontWeight:'700',color:'white'}}>{(partner?.email||'?')[0].toUpperCase()}</Text></View>
            <Text style={s.emptyChatName}>{partner?.email?.split('@')[0]}</Text>
            <Text style={s.emptyChatEmail}>{partner?.email}</Text>
            <Text style={s.emptyChatHint}>Start a conversation about water quality at UJ! 💧</Text>
          </View>
        ):(
          <FlatList ref={flatRef} data={grouped} keyExtractor={i=>i.id} contentContainerStyle={{padding:14,paddingBottom:10}} showsVerticalScrollIndicator={false} renderItem={renderItem} onContentSizeChange={()=>flatRef.current?.scrollToEnd({animated:false})}/>
        )}
        <View style={s.inputBar}>
          <TextInput style={s.input} placeholder={`Message ${partner?.email?.split('@')[0]||'user'}...`} placeholderTextColor={C.text2} value={text} onChangeText={setText} multiline maxLength={1000}/>
          <TouchableOpacity style={[s.sendBtn,(!text.trim()||sending)&&s.sendBtnOff]} onPress={send} disabled={!text.trim()||sending}>
            {sending?<ActivityIndicator size="small" color="white"/>:<Text style={s.sendTxt}>↑</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#0a0e1a'},
  header:{backgroundColor:'#0f1525',paddingHorizontal:12,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderBottomColor:'#1e2d47'},
  back:{fontSize:20,color:'#60a5fa',fontWeight:'600'},
  hAv:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center'},
  hAvTxt:{fontSize:14,fontWeight:'700',color:'white'},
  hName:{fontSize:15,fontWeight:'700',color:'#f1f5f9'},hMeta:{fontSize:11,color:'#475569',marginTop:1},
  onlineDot:{width:8,height:8,borderRadius:4,backgroundColor:'#22c55e',marginRight:4},
  dateDivider:{flexDirection:'row',alignItems:'center',gap:10,marginVertical:16},
  dateLine:{flex:1,height:1,backgroundColor:'#1e2d47'},
  dateLabel:{fontSize:11,color:'#475569',fontWeight:'600'},
  msgRow:{flexDirection:'row',alignItems:'flex-end',gap:8,marginBottom:6},
  msgRowMine:{flexDirection:'row-reverse'},
  msgAv:{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center',flexShrink:0},
  msgAvTxt:{fontSize:11,fontWeight:'700',color:'white'},
  bubble:{maxWidth:'78%',borderRadius:18,paddingHorizontal:14,paddingVertical:10},
  bubbleMine:{backgroundColor:'#3b82f6',borderBottomRightRadius:4},
  bubbleTheirs:{backgroundColor:'#151c30',borderBottomLeftRadius:4,borderWidth:1,borderColor:'#1e2d47'},
  bubbleTxt:{fontSize:14,color:'#94a3b8',lineHeight:20},
  bubbleTxtMine:{color:'white'},
  msgMeta:{flexDirection:'row',alignItems:'center',gap:4,marginTop:4,justifyContent:'flex-end'},
  msgTime:{fontSize:10,color:'#475569'},msgTimeMine:{color:'rgba(255,255,255,0.6)'},
  tick:{fontSize:10,color:'rgba(255,255,255,0.7)'},
  emptyChat:{flex:1,alignItems:'center',justifyContent:'center',padding:40,gap:10},
  emptyChatAv:{width:80,height:80,borderRadius:40,alignItems:'center',justifyContent:'center',marginBottom:8},
  emptyChatName:{fontSize:20,fontWeight:'700',color:'#f1f5f9'},
  emptyChatEmail:{fontSize:13,color:'#475569'},
  emptyChatHint:{fontSize:13,color:'#475569',textAlign:'center',lineHeight:20,marginTop:8},
  inputBar:{flexDirection:'row',alignItems:'flex-end',gap:8,padding:10,backgroundColor:'#0f1525',borderTopWidth:1,borderTopColor:'#1e2d47'},
  input:{flex:1,backgroundColor:'#151c30',borderRadius:22,paddingHorizontal:16,paddingVertical:10,fontSize:14,color:'#f1f5f9',maxHeight:120,borderWidth:1,borderColor:'#1e2d47'},
  sendBtn:{width:42,height:42,backgroundColor:'#3b82f6',borderRadius:21,alignItems:'center',justifyContent:'center',flexShrink:0},
  sendBtnOff:{opacity:0.35},sendTxt:{fontSize:20,fontWeight:'700',color:'white',lineHeight:24},
});
