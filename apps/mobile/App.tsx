import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>GoliSafe Base Ready</Text>
      <StatusBar style="light" />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#F8FAFC', fontSize: 20, fontWeight: 'bold' },
});
