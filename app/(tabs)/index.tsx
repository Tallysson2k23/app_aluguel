import { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  FlatList,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";

import { collection, onSnapshot, doc, getDoc, addDoc } from "firebase/firestore";
import { db, auth } from "../../src/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "expo-router";

const largura = Dimensions.get("window").width;

export default function TabHome() {
  const router = useRouter();

  const [location, setLocation] = useState<any>(null);
  const [casas, setCasas] = useState<any[]>([]);
  const [casasProximas, setCasasProximas] = useState<any[]>([]);
  const [tipoUsuario, setTipoUsuario] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [modalMapa, setModalMapa] = useState<any>(null);
  const [modalCadastro, setModalCadastro] = useState(false);

  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [telefone, setTelefone] = useState("");
  const [proprietario, setProprietario] = useState("");
  const [status, setStatus] = useState("disponivel");
  const [coordSelecionada, setCoordSelecionada] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);

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

  useEffect(() => {
    const carregarTipo = async () => {
      const snap = await getDoc(doc(db, "usuarios", auth.currentUser!.uid));
      setTipoUsuario(snap.data()?.tipo);
    };
    if (auth.currentUser) carregarTipo();
  }, []);

  useEffect(() => {
    if (!location) return;

    const perto = casas.filter((c) => {
      if (c.status !== "disponivel") return false;
      const dx = Math.abs(c.latitude - location.latitude);
      const dy = Math.abs(c.longitude - location.longitude);
      return dx < 0.02 && dy < 0.02;
    });

    setCasasProximas(perto);
  }, [casas, location]);

  const salvarCasa = async () => {
    if (!rua || !numero || !telefone || !proprietario || !coordSelecionada) {
      Alert.alert("Preencha tudo e marque no mapa");
      return;
    }

    await addDoc(collection(db, "casas"), {
      rua,
      numero,
      telefone,
      proprietario,
      latitude: coordSelecionada.latitude,
      longitude: coordSelecionada.longitude,
      status,
      dono: auth.currentUser?.uid,
    });

    setModalCadastro(false);
    setRua("");
    setNumero("");
    setTelefone("");
    setProprietario("");
    setCoordSelecionada(null);
  };

  const sair = async () => await signOut(auth);

  if (!location || !tipoUsuario) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuAberto(true)}>
        <Text style={{ fontSize: 26 }}>☰</Text>
      </TouchableOpacity>

      {tipoUsuario === "locatario" && (
        <FlatList
          data={casasProximas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 15, paddingTop: 80 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => setModalMapa(item)}>
              <Text style={styles.titulo}>{item.rua}, {item.numero}</Text>
              <Text>Status: Disponível</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {tipoUsuario === "locador" && (
        <TouchableOpacity style={styles.botao} onPress={() => setModalCadastro(true)}>
          <Text style={styles.botaoTexto}>➕ Nova Casa</Text>
        </TouchableOpacity>
      )}

      <Modal visible={modalCadastro} animationType="slide">
        <View style={{ flex: 1 }}>
          <MapView
            style={{ flex: 1 }}
            onPress={(e) => setCoordSelecionada(e.nativeEvent.coordinate)}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            {coordSelecionada && <Marker coordinate={coordSelecionada} pinColor="blue" />}
          </MapView>

          <ScrollView style={{ padding: 15 }}>
            <TextInput placeholder="Rua" style={styles.input} value={rua} onChangeText={setRua} />
            <TextInput placeholder="Número" style={styles.input} value={numero} onChangeText={setNumero} />
            <TextInput placeholder="Telefone" style={styles.input} value={telefone} onChangeText={setTelefone} />
            <TextInput placeholder="Proprietário" style={styles.input} value={proprietario} onChangeText={setProprietario} />

            <Text>Status:</Text>
            {["disponivel", "saindo", "alugado"].map((s) => (
              <TouchableOpacity key={s} onPress={() => setStatus(s)}>
                <Text style={status === s ? styles.titulo : {}}>{s}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.botao} onPress={salvarCasa}>
              <Text style={styles.botaoTexto}>Salvar Casa</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModalCadastro(false)}>
              <Text style={{ textAlign: "center" }}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!modalMapa}>
        <MapView style={{ flex: 1 }} initialRegion={{
          latitude: modalMapa?.latitude,
          longitude: modalMapa?.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}>
          {modalMapa && <Marker coordinate={{ latitude: modalMapa.latitude, longitude: modalMapa.longitude }} />}
        </MapView>
        <TouchableOpacity style={styles.fechar} onPress={() => setModalMapa(null)}>
          <Text style={{ color: "white" }}>Fechar</Text>
        </TouchableOpacity>
      </Modal>

      {menuAberto && (
        <View style={styles.overlay}>
          <View style={styles.menu}>
            <TouchableOpacity onPress={() => { setMenuAberto(false); router.push("/perfil"); }}>
              <Text>Perfil</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={sair}>
              <Text>Sair</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  menuBtn: { position: "absolute", top: 40, left: 20, zIndex: 10 },
  botao: { backgroundColor: "black", padding: 15, margin: 15, borderRadius: 10 },
  botaoTexto: { color: "white", textAlign: "center" },
  fechar: { backgroundColor: "black", padding: 15 },
  card: { backgroundColor: "#eee", padding: 15, borderRadius: 10, marginBottom: 10 },
  titulo: { fontWeight: "bold" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, marginTop: 10 },
  overlay: { position: "absolute", width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.4)" },
  menu: { backgroundColor: "white", width: largura * 0.7, padding: 20, marginTop: 60 },
});
