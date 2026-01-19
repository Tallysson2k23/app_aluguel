import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { auth, db } from "../src/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "expo-router";

export default function Perfil() {
  const router = useRouter();
  const [dados, setDados] = useState<any>(null);

  useEffect(() => {
    const carregar = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const snap = await getDoc(doc(db, "usuarios", user.uid));
      if (snap.exists()) setDados(snap.data());
    };

    carregar();
  }, []);

  if (!dados) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Meu Perfil</Text>

      <Text style={styles.label}>Email:</Text>
      <Text style={styles.valor}>{dados.email}</Text>

      <Text style={styles.label}>Tipo de usuário:</Text>
      <Text style={styles.valor}>
        {dados.tipo === "locador" ? "🏠 Locador" : "👤 Locatário"}
      </Text>

      <TouchableOpacity style={styles.botao} onPress={() => router.back()}>
        <Text style={styles.botaoTexto}>Voltar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, backgroundColor: "white" },
  titulo: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  label: { fontWeight: "bold", marginTop: 10 },
  valor: { fontSize: 16, marginTop: 2 },
  botao: {
    marginTop: 30,
    backgroundColor: "black",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  botaoTexto: { color: "white", fontWeight: "bold" },
});
