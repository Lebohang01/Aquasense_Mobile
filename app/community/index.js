// Community Feed Screen
import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const C = { bg0:'#0a0e1a',bg1:'#0f1525',bg2:'#151c30',bg3:'#1c2540',blue:'#3b82f6',blueLight:'#60a5fa',green:'#22c55e',red:'#ef4444',amber:'#f59e0b',text0:'#f1f5f9',text1:'#94a3b8',text2:'#475569',border:'#1e2d47' };
const CATS = [
  {value:'all',label:'All',emoji:'🌊'},{value:'general',label:'General',emoji:'💬'},
  {value:'water_quality',label:'Water Quality',emoji:'💧'},{value:'alert',label:'Alert',emoji:'🚨'},
  {value:'resolved',label:'Resolved',emoji:'✅'},{value:'tip',label:'Tip',emoji:'💡'},
  {value:'question',label:'Question',emoji:'❓'},
];
const CAT_STYLES = {
  general:{color:'#60a5fa',bg:'rgba(59,130,246,0.15)',emoji:'💬'},
  water_quality:{color:'#06b6d4',bg:'rgba(6,182,212,0.15)',emoji:'💧'},
  alert:{color:'#f87171',bg:'rgba(239,68,68,0.15)',emoji:'🚨'},
  resolved:{color:'#4ade80',bg:'rgba(34,197,94,0.15)',emoji:'✅'},
  tip:{color:'#fbbf24',bg:'rgba(245,158,11,0.15)',emoji:'💡'},
  question:{color:'#a78bfa',bg:'rgba(139,92,246,0.15)',emoji:'❓'},
};
function strColor(s){const cols=['#1e3a5f','#1a3d2e','#2e1a5a','#3d2e0a','#0a2e3d','#2e0a2e'];let h=0;for(let i=0;i<s.length;i++)h=s.charCodeAt(i)+((h<<5)-h);return cols[Math.abs(h)%cols.length];}

function PostCard({ post, onPress, onLike, userId }) {
  const cat = CAT_STYLES[post.category]||CAT_STYLES.general;
  return (
    <TouchableOpacity style={[s.card,post.is_pinned&&s.pinned]} onPress={onPress} activeOpacity={0.85}>
      {post.is_pinned&&<View style={s.pinnedBadge}><Text style={s.pinnedTxt}>📌 Pinned</Text></View>}
      <View style={s.cardHead}>
        <View style={[s.av,{backgroundColor:strColor(post.users?.email||'')}]}>
          <Text style={s.avTxt}>{(post.users?.email||'?')[0].toUpperCase()}</Text>
        </View>
        <View style={{flex:1}}>
          <Text style={s.author}>{post.users?.email?.split('@')[0]||'Anonymous'}</Text>
          <Text style={s.meta}>{post.campus||'All campuses'} · {formatDistanceToNow(new Date(post.created_at),{addSuffix:true})}</Text>
        </View>
        <View style={[s.catBadge,{backgroundColor:cat.bg}]}>
          <Text style={[s.catTxt,{color:cat.color}]}>{cat.emoji} {post.category.replace('_',' ')}</Text>
        </View>
      </View>
      <Text style={s.postTitle}>{post.title}</Text>
      <Text style={s.postBody} numberOfLines={3}>{post.body}</Text>
      {post.nodes&&<View style={s.nodeTag}><Text style={s.nodeTagTxt}>📡 {post.nodes.location_name} · {post.nodes.campus}</Text></View>}
      <View style={s.actions}>
        <TouchableOpacity style={s.likeBtn} onPress={()=>onLike(post.id,post.user_liked)}>
          <Text style={{fontSize:14}}>{post.user_liked?'❤️':'🤍'}</Text>
          <Text style={[s.likeTxt,post.user_liked&&{color:C.red}]}>{post.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.commentBtn} onPress={onPress}>
          <Text style={{fontSize:14}}>💬</Text>
          <Text style={s.commentTxt}>{post.comment_count||0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.viewBtn} onPress={onPress}>
          <Text style={s.viewTxt}>View →</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function CommunityScreen() {
  const router=useRouter();const{user}=useAuth();
  const [posts,setPosts]=useState([]);const[loading,setLoading]=useState(true);
  const[refreshing,setRefreshing]=useState(false);const[cat,setCat]=useState('all');
  const[search,setSearch]=useState('');const[unread,setUnread]=useState(0);
  const chRef=useRef(null);

  const fetchPosts=useCallback(async()=>{
    let q=supabase.from('community_posts').select('*,users(id,email,campus_preference),nodes(node_id,location_name,campus),community_comments(id)').order('is_pinned',{ascending:false}).order('created_at',{ascending:false});
    if(cat!=='all')q=q.eq('category',cat);
    const{data}=await q;
    if(data&&user){
      const ids=data.map(p=>p.id);
      const{data:likes}=await supabase.from('post_likes').select('post_id').eq('user_id',user.id).in('post_id',ids);
      const ls=new Set((likes||[]).map(l=>l.post_id));
      setPosts(data.map(p=>({...p,comment_count:p.community_comments?.length||0,user_liked:ls.has(p.id)})));
    } else setPosts((data||[]).map(p=>({...p,comment_count:p.community_comments?.length||0})));
    setLoading(false);
  },[cat,user]);

  const fetchUnread=useCallback(async()=>{
    if(!user)return;
    const{count}=await supabase.from('messages').select('id',{count:'exact',head:true}).eq('receiver_id',user.id).eq('read',false);
    setUnread(count||0);
  },[user]);

  useEffect(()=>{
    fetchPosts();fetchUnread();
    if(chRef.current)supabase.removeChannel(chRef.current);
    const ch=supabase.channel('community-'+Date.now())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'community_posts'},()=>fetchPosts())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},()=>fetchUnread())
      .subscribe();
    chRef.current=ch;
    return()=>{if(chRef.current)supabase.removeChannel(chRef.current);};
  },[fetchPosts,fetchUnread]);

  const onRefresh=useCallback(async()=>{setRefreshing(true);await fetchPosts();await fetchUnread();setRefreshing(false);},[fetchPosts,fetchUnread]);

  const handleLike=async(postId,liked)=>{
    if(!user)return;
    if(liked){
      await supabase.from('post_likes').delete().eq('post_id',postId).eq('user_id',user.id);
      await supabase.from('community_posts').update({likes:Math.max(0,(posts.find(p=>p.id===postId)?.likes||1)-1)}).eq('id',postId);
      setPosts(prev=>prev.map(p=>p.id===postId?{...p,likes:Math.max(0,p.likes-1),user_liked:false}:p));
    } else {
      await supabase.from('post_likes').insert({post_id:postId,user_id:user.id});
      await supabase.from('community_posts').update({likes:(posts.find(p=>p.id===postId)?.likes||0)+1}).eq('id',postId);
      setPosts(prev=>prev.map(p=>p.id===postId?{...p,likes:p.likes+1,user_liked:true}:p));
    }
  };

  const filtered=posts.filter(p=>!search||p.title.toLowerCase().includes(search.toLowerCase())||p.body.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View><Text style={s.headerTitle}>💧 Community</Text><Text style={s.headerSub}>UJ Water Quality Forum</Text></View>
        <View style={s.headerBtns}>
          <TouchableOpacity style={s.msgBtn} onPress={()=>router.push('/community/messages')}>
            <Text style={{fontSize:18}}>💬</Text>
            {unread>0&&<View style={s.unreadBadge}><Text style={s.unreadTxt}>{unread}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity style={s.newPostBtn} onPress={()=>router.push('/community/new-post')}>
            <Text style={s.newPostTxt}>＋ Post</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={s.searchBar}>
        <Text style={{fontSize:14,color:C.text2}}>🔍</Text>
        <TextInput style={s.searchInput} placeholder="Search posts..." placeholderTextColor={C.text2} value={search} onChangeText={setSearch}/>
        {search.length>0&&<TouchableOpacity onPress={()=>setSearch('')}><Text style={{color:C.text2,fontSize:16}}>✕</Text></TouchableOpacity>}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={{paddingHorizontal:14,gap:6}}>
        {CATS.map(c=>(
          <TouchableOpacity key={c.value} style={[s.chip,cat===c.value&&s.chipActive]} onPress={()=>setCat(c.value)}>
            <Text style={[s.chipTxt,cat===c.value&&s.chipTxtActive]}>{c.emoji} {c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {loading?<ActivityIndicator color={C.blue} style={{marginTop:40}}/>:(
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding:14,gap:10,paddingBottom:90}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue}/>}>
          {filtered.length===0?(
            <View style={s.empty}>
              <Text style={{fontSize:40}}>💧</Text>
              <Text style={s.emptyTxt}>No posts yet</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={()=>router.push('/community/new-post')}>
                <Text style={s.emptyBtnTxt}>Be the first to post</Text>
              </TouchableOpacity>
            </View>
          ):filtered.map(post=>(
            <PostCard key={post.id} post={post} userId={user?.id} onPress={()=>router.push(`/community/post/${post.id}`)} onLike={handleLike}/>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#0a0e1a'},
  header:{backgroundColor:'#0f1525',paddingHorizontal:16,paddingVertical:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#1e2d47'},
  headerTitle:{fontSize:18,fontWeight:'700',color:'#f1f5f9'},headerSub:{fontSize:11,color:'#475569',marginTop:2},
  headerBtns:{flexDirection:'row',gap:8,alignItems:'center'},
  msgBtn:{width:38,height:38,backgroundColor:'#151c30',borderRadius:10,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#1e2d47',position:'relative'},
  unreadBadge:{position:'absolute',top:-4,right:-4,backgroundColor:'#ef4444',borderRadius:8,minWidth:16,height:16,alignItems:'center',justifyContent:'center',paddingHorizontal:3},
  unreadTxt:{fontSize:9,fontWeight:'700',color:'white'},
  newPostBtn:{backgroundColor:'#3b82f6',borderRadius:10,paddingHorizontal:14,paddingVertical:7},
  newPostTxt:{fontSize:13,fontWeight:'700',color:'white'},
  searchBar:{flexDirection:'row',alignItems:'center',gap:8,margin:10,marginBottom:4,backgroundColor:'#151c30',borderRadius:10,padding:10,borderWidth:1,borderColor:'#1e2d47'},
  searchInput:{flex:1,fontSize:13,color:'#f1f5f9'},
  chips:{paddingVertical:8,maxHeight:48},
  chip:{paddingHorizontal:12,paddingVertical:5,borderRadius:20,backgroundColor:'#151c30',borderWidth:1,borderColor:'#1e2d47'},
  chipActive:{backgroundColor:'rgba(59,130,246,0.2)',borderColor:'rgba(59,130,246,0.5)'},
  chipTxt:{fontSize:12,fontWeight:'600',color:'#94a3b8'},chipTxtActive:{color:'#60a5fa'},
  card:{backgroundColor:'#151c30',borderRadius:14,padding:14,borderWidth:1,borderColor:'#1e2d47'},
  pinned:{borderColor:'rgba(245,158,11,0.4)'},
  pinnedBadge:{backgroundColor:'rgba(245,158,11,0.15)',borderRadius:6,paddingHorizontal:8,paddingVertical:3,alignSelf:'flex-start',marginBottom:8},
  pinnedTxt:{fontSize:11,fontWeight:'600',color:'#f59e0b'},
  cardHead:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:10},
  av:{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center'},
  avTxt:{fontSize:14,fontWeight:'700',color:'white'},
  author:{fontSize:13,fontWeight:'600',color:'#f1f5f9'},meta:{fontSize:11,color:'#475569',marginTop:1},
  catBadge:{paddingHorizontal:8,paddingVertical:3,borderRadius:8},catTxt:{fontSize:10,fontWeight:'700'},
  postTitle:{fontSize:15,fontWeight:'700',color:'#f1f5f9',marginBottom:6,lineHeight:21},
  postBody:{fontSize:13,color:'#94a3b8',lineHeight:19,marginBottom:8},
  nodeTag:{backgroundColor:'#1c2540',borderRadius:8,paddingHorizontal:10,paddingVertical:5,alignSelf:'flex-start',marginBottom:10},
  nodeTagTxt:{fontSize:11,color:'#60a5fa',fontWeight:'500'},
  actions:{flexDirection:'row',gap:16,paddingTop:10,borderTopWidth:1,borderTopColor:'#1e2d47'},
  likeBtn:{flexDirection:'row',alignItems:'center',gap:4},
  likeTxt:{fontSize:12,color:'#475569',fontWeight:'500'},
  commentBtn:{flexDirection:'row',alignItems:'center',gap:4},
  commentTxt:{fontSize:12,color:'#475569',fontWeight:'500'},
  viewBtn:{marginLeft:'auto'},viewTxt:{fontSize:12,color:'#60a5fa',fontWeight:'600'},
  empty:{alignItems:'center',paddingTop:60,gap:12},emptyTxt:{fontSize:16,color:'#475569'},
  emptyBtn:{backgroundColor:'#3b82f6',borderRadius:10,paddingHorizontal:20,paddingVertical:10},
  emptyBtnTxt:{fontSize:13,fontWeight:'700',color:'white'},
});
