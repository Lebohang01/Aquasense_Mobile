import { useState } from 'react';
import { View,Text,StyleSheet,TouchableOpacity,TextInput,ScrollView,Alert,ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const C={bg0:'#0a0e1a',bg1:'#0f1525',bg2:'#151c30',blue:'#3b82f6',blueLight:'#60a5fa',text0:'#f1f5f9',text1:'#94a3b8',text2:'#475569',border:'#1e2d47',red:'#ef4444'};
const CATS=[{value:'general',label:'General',emoji:'💬'},{value:'water_quality',label:'Water Quality',emoji:'💧'},{value:'alert',label:'Alert',emoji:'🚨'},{value:'resolved',label:'Resolved',emoji:'✅'},{value:'tip',label:'Tip',emoji:'💡'},{value:'question',label:'Question',emoji:'❓'}];
const CAMPUSES=['UJ APK','UJ APB','UJ SWC','UJ DFC'];

export default function NewPostScreen() {
  const router=useRouter();const{user}=useAuth();
  const[title,setTitle]=useState('');const[body,setBody]=useState('');
  const[category,setCategory]=useState('general');const[campus,setCampus]=useState('');
  const[submitting,setSubmitting]=useState(false);
  const canSubmit=title.trim().length>0&&body.trim().length>0;

  const handleSubmit=async()=>{
    if(!canSubmit)return;
    setSubmitting(true);
    try{
      const{error}=await supabase.from('community_posts').insert({user_id:user?.id,title:title.trim(),body:body.trim(),category,campus:campus||null});
      if(error)throw error;
      router.back();
    }catch(err){Alert.alert('Error',err.message);}
    finally{setSubmitting(false);}
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>router.back()}><Text style={s.cancel}>Cancel</Text></TouchableOpacity>
        <Text style={s.title}>New Post</Text>
        <TouchableOpacity style={[s.postBtn,!canSubmit&&s.postBtnOff]} onPress={handleSubmit} disabled={!canSubmit||submitting}>
          {submitting?<ActivityIndicator size="small" color="white"/>:<Text style={s.postBtnTxt}>Post</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{padding:16,gap:16,paddingBottom:60}}>
        <View>
          <Text style={s.label}>Category</Text>
          <View style={s.catGrid}>
            {CATS.map(c=>(
              <TouchableOpacity key={c.value} style={[s.catCard,category===c.value&&s.catCardOn]} onPress={()=>setCategory(c.value)}>
                <Text style={{fontSize:20}}>{c.emoji}</Text>
                <Text style={[s.catLbl,category===c.value&&s.catLblOn]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View>
          <Text style={s.label}>Title <Text style={{color:C.red}}>*</Text></Text>
          <TextInput style={s.input} placeholder="What's happening with the water?" placeholderTextColor={C.text2} value={title} onChangeText={setTitle} maxLength={100}/>
          <Text style={s.count}>{title.length}/100</Text>
        </View>
        <View>
          <Text style={s.label}>Message <Text style={{color:C.red}}>*</Text></Text>
          <TextInput style={[s.input,{minHeight:130}]} placeholder="Share your observations, results, or message..." placeholderTextColor={C.text2} value={body} onChangeText={setBody} multiline numberOfLines={6} maxLength={1000} textAlignVertical="top"/>
          <Text style={s.count}>{body.length}/1000</Text>
        </View>
        <View>
          <Text style={s.label}>Campus <Text style={{color:C.text2,fontWeight:'400'}}>(optional)</Text></Text>
          <View style={s.optRow}>
            <TouchableOpacity style={[s.opt,campus===''&&s.optOn]} onPress={()=>setCampus('')}><Text style={[s.optTxt,campus===''&&s.optTxtOn]}>All</Text></TouchableOpacity>
            {CAMPUSES.map(c=>(
              <TouchableOpacity key={c} style={[s.opt,campus===c&&s.optOn]} onPress={()=>setCampus(c)}>
                <Text style={[s.optTxt,campus===c&&s.optTxtOn]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {(title||body)&&(
          <View style={s.preview}>
            <Text style={s.previewLbl}>PREVIEW</Text>
            {title&&<Text style={s.previewTitle}>{title}</Text>}
            {body&&<Text style={s.previewBody}>{body}</Text>}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:C.bg0},
  header:{backgroundColor:C.bg1,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:C.border},
  cancel:{fontSize:14,color:C.text1},title:{fontSize:16,fontWeight:'700',color:C.text0},
  postBtn:{backgroundColor:C.blue,borderRadius:10,paddingHorizontal:16,paddingVertical:7},postBtnOff:{opacity:0.4},
  postBtnTxt:{fontSize:13,fontWeight:'700',color:'white'},
  label:{fontSize:12,fontWeight:'700',color:C.text1,textTransform:'uppercase',letterSpacing:0.6,marginBottom:10},
  count:{fontSize:10,color:C.text2,textAlign:'right',marginTop:4},
  input:{backgroundColor:C.bg2,borderRadius:12,borderWidth:1,borderColor:C.border,padding:14,fontSize:14,color:C.text0},
  catGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},
  catCard:{width:'31%',backgroundColor:C.bg2,borderRadius:12,padding:10,alignItems:'center',gap:4,borderWidth:1,borderColor:C.border},
  catCardOn:{backgroundColor:'rgba(59,130,246,0.15)',borderColor:C.blue},
  catLbl:{fontSize:12,fontWeight:'700',color:C.text1,textAlign:'center'},catLblOn:{color:C.blueLight},
  optRow:{flexDirection:'row',flexWrap:'wrap',gap:8},
  opt:{paddingHorizontal:14,paddingVertical:7,borderRadius:20,backgroundColor:C.bg2,borderWidth:1,borderColor:C.border},
  optOn:{backgroundColor:'rgba(59,130,246,0.2)',borderColor:C.blue},
  optTxt:{fontSize:12,fontWeight:'500',color:C.text1},optTxtOn:{color:C.blueLight},
  preview:{backgroundColor:C.bg2,borderRadius:12,padding:14,borderWidth:1,borderColor:'rgba(59,130,246,0.3)'},
  previewLbl:{fontSize:10,fontWeight:'700',color:C.blueLight,letterSpacing:0.8,marginBottom:8},
  previewTitle:{fontSize:15,fontWeight:'700',color:C.text0,marginBottom:6},
  previewBody:{fontSize:13,color:C.text1,lineHeight:19},
});
