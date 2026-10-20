import { Tabs } from 'expo-router';
import SpotlightTabBar from '../../components/SpotlightTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <SpotlightTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="progreso" options={{ title: 'Progreso' }} />
      <Tabs.Screen name="rutinas" options={{ title: 'Rutinas' }} />
      <Tabs.Screen name="index" options={{ title: 'Semana' }} />
      <Tabs.Screen name="notas" options={{ title: 'Notas' }} />
      <Tabs.Screen name="calendario" options={{ title: 'Calendario' }} />
    </Tabs>
  );
}
