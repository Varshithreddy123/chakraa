import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import type { LocationObjectCoords } from 'expo-location';
import { getDatabase } from 'firebase/database';
import { initializeApp } from 'firebase/app';
import { onValue, ref } from 'firebase/database';
import axios from 'axios';
import { addDummyQuote } from '../../lib/firebase';

const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});

const database = getDatabase(app);

export default function TrackScreen() {

  const [currentLocation, setCurrentLocation] = useState<LocationObjectCoords | null>(null);
  const [busLocation, setBusLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [eta, setEta] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(true);

  const mapRef = useRef<MapView>(null);

  // USER LOCATION
  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        let loc = await Location.getCurrentPositionAsync({});
        setCurrentLocation(loc.coords);
      } catch (e) {
        console.log("Location error:", e);
      }
    })();
  }, []);

  // FIREBASE DATA (ESP32 GPS)
  useEffect(() => {

    const gpsRef = ref(database, "/GPS");

    const unsubscribe = onValue(gpsRef, (snapshot) => {

      if (!snapshot.exists()) {
        console.log("No GPS data");
        return;
      }

      const data = snapshot.val();

      if (!data?.lat || !data?.lng) {
        console.log("Invalid GPS data");
        return;
      }

      const loc = {
        latitude: data.lat,
        longitude: data.lng,
      };

      setBusLocation(loc);
      setTime(data.time || '');
      setLoading(false);

      // move map
      mapRef.current?.animateToRegion({
        ...loc,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      // optional ETA
      calculateETA(loc);

    });

    return () => unsubscribe();

  }, []);

  // ETA (safe)
  const calculateETA = async (busLoc: { latitude: number; longitude: number }) => {
    if (!currentLocation) return;

    try {
      const res = await axios.get(
        'https://maps.googleapis.com/maps/api/distancematrix/json',
        {
          params: {
            origins: `${currentLocation.latitude},${currentLocation.longitude}`,
            destinations: `${busLoc.latitude},${busLoc.longitude}`,
            key: process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY,
            mode: 'driving',
          },
        }
      );

      const duration =
        res?.data?.rows?.[0]?.elements?.[0]?.duration?.text;

      if (duration) setEta(duration);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log("ETA error:", errorMessage);
    }
  };

  const region =
    currentLocation && busLocation
      ? {
          latitude: (currentLocation.latitude + busLocation.latitude) / 2,
          longitude: (currentLocation.longitude + busLocation.longitude) / 2,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }
      : {
          latitude: 17.385,
          longitude: 78.486,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        };

  // LOADING STATE
  if (!busLocation) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E1B4B" />
        <Text>Waiting for live GPS...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* MAP */}
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        showsUserLocation
      >
        {currentLocation && (
          <Marker coordinate={currentLocation} pinColor="blue" />
        )}

        {busLocation && (
          <Marker coordinate={busLocation} pinColor="green" />
        )}

        {currentLocation && busLocation && (
          <MapViewDirections
            origin={currentLocation}
            destination={busLocation}
            apikey={process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY}
            strokeWidth={4}
            strokeColor="#665CFF"
          />
        )}
      </MapView>

      {/* UI */}
      <View style={styles.overlay}>

        <Text style={styles.title}>Live Bus Tracking</Text>

        <View style={styles.card}>

          <Text style={styles.route}>Bus GPS</Text>

          <View style={styles.row}>
            <Text style={styles.time}>
              Updated: {time || '---'}
            </Text>

            <Text style={styles.eta}>
              {eta || '...'}
            </Text>
          </View>

        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  map: {
    ...StyleSheet.absoluteFillObject,
  },

  overlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
  },

  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    elevation: 5,
  },

  route: {
    fontSize: 16,
    fontWeight: '600',
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },

  time: {
    fontSize: 12,
    color: '#777',
  },

  eta: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6B00',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});