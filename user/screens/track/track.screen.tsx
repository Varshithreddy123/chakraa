import { View, Text, StyleSheet } from "react-native";
import color from "@/themes/app.colors";
import { useEffect, useState } from "react";
import * as Location from "expo-location";

export default function TrackScreen() {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission denied");
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Track Your Location</Text>
      {location ? (
        <Text style={styles.text}>
          Lat: {location.coords.latitude.toFixed(4)}, Long: {location.coords.longitude.toFixed(4)}
        </Text>
      ) : (
        <Text style={styles.text}>Fetching location...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: color.whiteColor,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: color.primaryText,
  },
  text: {
    fontSize: 16,
    color: color.regularText,
  },
});

