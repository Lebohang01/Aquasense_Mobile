import { useEffect, useState, useRef, useCallback } from 'react';
import { View,Text,ScrollView,TouchableOpacity,StyleSheet,TextInput,Alert,ActivityIndicator,KeyboardAvoidingView,Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const C={bg0:'#0a0e1a',bg1:'#0f1525',bg2:'#151c30',bg3:'#1c2540',blue:'#3b82f6',blueLight:'#60a5fa',green:'#22c55e',red:'#ef4444',amber:'#f59e0b',text0:'#f1f5f9',text1:'#94a3b8',text2:'#475569',border:'#1e2d47'};
const CAT_STYLES={general:{color:'#60a5fa',bg:'rgba(59,130,246,0.15)',emoji:'💬'},water_quality:{color:'#06b6d4',bg:'rgba(6,182,212,0.15)',emoji:'💧'},alert:{color:'#f87171',bg:'rgba(239,68,68,0.15)',emoji:'🚨'},resolved:{color:'#4ade80',bg:'rgba(34,197,94,0.15)',emoji:'✅'},tip:{color:'#fbbf24',bg:'rgba(245,158,11,0.15)',emoji:'💡'},question:{color:'#a78bfa',bg:'rgba(139,92,246,0.15)',emoji:'❓'}};
function strColor(s){const c=['#1e3a5f','#1a3d2e','#2e1a5a','#3d2e0a','#0a2e3d','#2e0a2e'];let h=0;for(let i=0;i<s.length;i++)h=s.charCodeAt(i)+((h<<5)-h);return c[Math.abs(h)%c.length];}

export default function PostDetailScreen() {
  const{id}=useLocalSearchParams();const router=useRouter();const{user}=useAuth();
  const scrollRef=useRef(null);const chRef=useRef(null);
  const[post,setPost]=useState(null);const[comments,setComments]=useState([]);
  const[loading,setLoading]=useState(true);const[newComment,setNewComment]=useState('');
  const[submitting,setSubmitting]=useState(false);const[liked,setLiked]=useState(false);

  const fetchPost=useCallback(async()=>{
    const{data}=await supabase.from('community_posts').select('*,users(id,email,campus_preference),nodes(node_id,location_name,campus)').eq('id',id).single();
    setPost(data);
    if(data&&user){const{data:lk}=await supabase.from('post_likes').select('id').eq('post_id',id).eq('user_id',user.id).single();setLiked(!!lk);}
  },[id,user]);

  const fetchComments=useCallback(async()=>{
    const{data}=await supabase.from('community_comments').select('*,users(id,email)').eq('post_id',id).order('created_at',{ascending:true});
    if(data&&user){
      const ids=data.map(c=>c.id);
      const{data:lks}=await supabase.from('comment_likes').select('comment_id').eq('user_id',user.id).in('comment_id',ids);
      const ls=new Set((lks||[]).map(l=>l.comment_id));
      setComments(data.map(c=>({...c,user_liked:ls.has(c.id)})));
    } else setComments(data||[]);
    setLoading(false);
  },[id,user]);

  useEffect(()=>{
    fetchPost();fetchComments();
    if(chRef.current)supabase.removeChannel(chRef.current);
    const ch=supabase.channel('post-'+id+'-'+Date.now())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'community_comments',filter:`post_id=eq.${id}`},()=>fetchComments())
      .subscribe();
    chRef.current=ch;
    return()=>{if(chRef.current)supabase.removeChannel(chRef.current);};
  },[fetchPost,fetchComments]);

  const handleLikePost=async()=>{
    if(!user||!post)return;
    if(liked){
      await supabase.from('post_likes').delete().eq('post_id',id).eq('user_id',user.id);
      await supabase.from('community_posts').update({likes:Math.max(0,post.likes-1)}).eq('id',id);
      setPost(p=>({...p,likes:Math.max(0,p.likes-1)}));setLiked(false);
    } else {
      await supabase.from('post_likes').insert({post_id:id,user_id:user.id});
      await supabase.from('community_posts').update({likes:post.likes+1}).eq('id',id);
      setPost(p=>({...p,likes:p.likes+1}));setLiked(true);
    }
  };

  const submitComment=async()=>{
    if(!newComment.trim()||!user)return;
    setSubmitting(true);
    const body=newComment.trim();setNewComment('');
    const{error}=await supabase.from('community_comments').insert({post_id:id,user_id:user.id,body});
    if(error){Alert.alert('Error',error.message);setNewComment(body);}
    else{await fetchComments();setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}),300);}
    setSubmitting(false);
  };

  const deleteComment=(cid)=>{Alert.alert('Delete','Delete this comment?',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>{await supabase.from('community_comments').delete().eq('id',cid);setComments(prev=>prev.filter(c=>c.id!==cid));}}]);};
  const deletePost=()=>{Alert.alert('Delete Post','Delete this post and all comments?',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>{await supabase.from('community_posts').delete().eq('id',id);router.back();}}]);};

  if(loading||!post)return(<SafeAreaView style={s.safe} edges={['top']}><View style={s.header}><TouchableOpacity onPress={()=>router.back()}><Text style={s.back}>← Back</Text></TouchableOpacity></View><ActivityIndicator color="#3b82f6" style={{marginTop:40}}/></SafeAreaView>);

  const cat=CAT_STYLES[post.category]||CAT_STYLES.general;
  const isOwner=post.user_id===user?.id;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>router.back()}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.headerTxt}>Post</Text>
        {isOwner&&<TouchableOpacity onPress={deletePost}><Text style={{fontSize:16,color:C.red}}>🗑</Text></TouchableOpacity>}
      </View>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:20}}>
          <View style={s.postCard}>
            <View style={s.postHead}>
              <View style={[s.av,{backgroundColor:strColor(post.users?.email||'')}]}><Text style={s.avTxt}>{(post.users?.email||'?')[0].toUpperCase()}</Text></View>
              <View style={{flex:1}}>
                <Text style={s.author}>{post.users?.email?.split('@')[0]||'Anonymous'}</Text>
                <Text style={s.meta}>{post.campus||'All campuses'} · {formatDistanceToNow(new Date(post.created_at),{addSuffix:true})}</Text>
              </View>
              <View style={[s.catBadge,{backgroundColor:cat.bg}]}><Text style={[s.catTxt,{color:cat.color}]}>{cat.emoji} {post.category.replace('_',' ')}</Text></View>
            </View>
            <Text style={s.postTitle}>{post.title}</Text>
            <Text style={s.postBody}>{post.body}</Text>
            {post.nodes&&<TouchableOpacity style={s.nodeTag} onPress={()=>router.push(`/node/${post.nodes.node_id}`)}><Text style={s.nodeTagTxt}>📡 {post.nodes.location_name} · {post.nodes.campus} →</Text></TouchableOpacity>}
            <View style={s.postActions}>
              <TouchableOpacity style={s.likeBtn} onPress={handleLikePost}>
                <Text style={{fontSize:18}}>{liked?'❤️':'🤍'}</Text>
                <Text style={[s.likeTxt,liked&&{color:C.red}]}>{post.likes} likes</Text>
              </TouchableOpacity>
              <Text style={s.commentCount}>{comments.length} comments</Text>
            </View>
          </View>
          <View style={s.commentsSection}>
            <Text style={s.commentsTitle}>💬 Comments ({comments.length})</Text>
            {comments.length===0?(
              <View style={s.noComments}><Text style={s.noCommentsTxt}>No comments yet — be the first!</Text></View>
            ):(
              <View style={{gap:8}}>
                {comments.map(cm=>(
                  <View key={cm.id} style={s.cmCard}>
                    <View style={s.cmHead}>
                      <View style={[s.cmAv,{backgroundColor:strColor(cm.users?.email||'')}]}><Text style={s.cmAvTxt}>{(cm.users?.email||'?')[0].toUpperCase()}</Text></View>
                      <View style={{flex:1}}>
                        <Text style={s.cmName}>{cm.users?.email?.split('@')[0]||'Anonymous'}</Text>
                        <Text style={s.cmTime}>{formatDistanceToNow(new Date(cm.created_at),{addSuffix:true})}</Text>
                      </View>
                      {cm.user_id===user?.id&&<TouchableOpacity onPress={()=>deleteComment(cm.id)}><Text style={{fontSize:14,color:C.text2}}>🗑</Text></TouchableOpacity>}
                    </View>
                    <Text style={s.cmBody}>{cm.body}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
        <View style={s.inputBar}>
          <View style={[s.inputAv,{backgroundColor:strColor(user?.email||'')}]}><Text style={{fontSize:12,fontWeight:'700',color:'white'}}>{(user?.email||'?')[0].toUpperCase()}</Text></View>
          <TextInput style={s.commentInput} placeholder="Add a comment..." placeholderTextColor={C.text2} value={newComment} onChangeText={setNewComment} multiline maxLength={500}/>
          <TouchableOpacity style={[s.sendBtn,(!newComment.trim()||submitting)&&s.sendBtnOff]} onPress={submitComment} disabled={!newComment.trim()||submitting}>
            {submitting?<ActivityIndicator size="small" color="white"/>:<Text style={s.sendTxt}>↑</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#0a0e1a'},
  header:{backgroundColor:'#0f1525',paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#1e2d47'},
  back:{fontSize:14,fontWeight:'600',color:'#60a5fa'},headerTxt:{fontSize:16,fontWeight:'700',color:'#f1f5f9'},
  postCard:{backgroundColor:'#151c30',margin:14,borderRadius:14,padding:16,borderWidth:1,borderColor:'#1e2d47'},
  postHead:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12},
  av:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center'},
  avTxt:{fontSize:14,fontWeight:'700',color:'white'},
  author:{fontSize:13,fontWeight:'600',color:'#f1f5f9'},meta:{fontSize:11,color:'#475569',marginTop:1},
  catBadge:{paddingHorizontal:8,paddingVertical:3,borderRadius:8},catTxt:{fontSize:10,fontWeight:'700'},
  postTitle:{fontSize:18,fontWeight:'700',color:'#f1f5f9',marginBottom:10,lineHeight:24},
  postBody:{fontSize:14,color:'#94a3b8',lineHeight:21,marginBottom:12},
  nodeTag:{backgroundColor:'#1c2540',borderRadius:8,paddingHorizontal:12,paddingVertical:8,alignSelf:'flex-start',marginBottom:14},
  nodeTagTxt:{fontSize:12,color:'#60a5fa',fontWeight:'500'},
  postActions:{flexDirection:'row',alignItems:'center',gap:16,paddingTop:12,borderTopWidth:1,borderTopColor:'#1e2d47'},
  likeBtn:{flexDirection:'row',alignItems:'center',gap:6},
  likeTxt:{fontSize:14,color:'#475569',fontWeight:'500'},
  commentCount:{fontSize:13,color:'#475569',marginLeft:'auto'},
  commentsSection:{paddingHorizontal:14,paddingBottom:20},
  commentsTitle:{fontSize:15,fontWeight:'700',color:'#f1f5f9',marginBottom:12},
  noComments:{backgroundColor:'#151c30',borderRadius:10,padding:20,alignItems:'center',borderWidth:1,borderColor:'#1e2d47'},
  noCommentsTxt:{fontSize:13,color:'#475569'},
  cmCard:{backgroundColor:'#151c30',borderRadius:12,padding:12,borderWidth:1,borderColor:'#1e2d47'},
  cmHead:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:8},
  cmAv:{width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center'},
  cmAvTxt:{fontSize:12,fontWeight:'700',color:'white'},
  cmName:{fontSize:12,fontWeight:'600',color:'#f1f5f9'},cmTime:{fontSize:10,color:'#475569',marginTop:1},
  cmBody:{fontSize:13,color:'#94a3b8',lineHeight:18},
  inputBar:{flexDirection:'row',alignItems:'flex-end',gap:8,padding:10,backgroundColor:'#0f1525',borderTopWidth:1,borderTopColor:'#1e2d47'},
  inputAv:{width:32,height:32,borderRadius:16,alignItems:'center',justifyContent:'center',flexShrink:0,marginBottom:4},
  commentInput:{flex:1,backgroundColor:'#151c30',borderRadius:20,paddingHorizontal:14,paddingVertical:10,fontSize:14,color:'#f1f5f9',maxHeight:100,borderWidth:1,borderColor:'#1e2d47'},
  sendBtn:{width:36,height:36,backgroundColor:'#3b82f6',borderRadius:18,alignItems:'center',justifyContent:'center',flexShrink:0,marginBottom:2},
  sendBtnOff:{opacity:0.4},sendTxt:{fontSize:18,fontWeight:'700',color:'white',lineHeight:22},
});
