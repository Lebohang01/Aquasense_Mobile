// Redirect to community stack
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
//export default function CommunityTab() {
//  const router = useRouter();
//  useEffect(() => { router.replace('/community'); }, []);
//  return null;
//}
// app/(tabs)/community.js
export { default } from '../community/index';
