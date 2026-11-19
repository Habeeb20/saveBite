import "../../../global.css";
import { Stack } from "expo-router";
import {AuthProvider} from "../../context/AuthContext";


export default function RootLayout() {
  return (
   
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />

  );
}
