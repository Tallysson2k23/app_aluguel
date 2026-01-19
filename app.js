import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";

import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./src/firebase";

export default function App() {
  const [location, setLocation] = useState(null);
  const [casas, setCasas] = useState([]);

  // 📍 Pegar localização do celular
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);

  // 🔥 Buscar casas no Firestore em tempo real
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "casas"), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCasas(lista);
    });

    return () => unsub();
  }, []);

  if (!location) return null;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
      >
        {/* Casas cadastradas */}
        {casas.map((casa) => {
          let cor = "green";
          if (casa.status === "alugado") cor = "red";
          if (casa.status === "saindo") cor = "yellow";

          return (
            <Marker
              key={casa.id}
              coordinate={{
                latitude: casa.latitude,
                longitude: casa.longitude,
              }}
              pinColor={cor}
              title={casa.titulo}
              description={`Status: ${casa.status}`}
            />
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
