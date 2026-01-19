import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";

import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../src/firebase";
import { useRouter } from "expo-router";

export default function Register() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [tipo, setTipo] = useState<"locador" | "locatario">("locatario");

  const cadastrar = async () => {
    if (!email || !senha || !confirmar) {
      Alert.alert("Preencha todos os campos");
      return;
    }

    if (senha !== confirmar) {
      Alert.alert("As senhas não coincidem");
      return;
    }

    try {
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email,
        senha
      );

      await setDoc(doc(db, "usuarios", userCred.user.uid), {
        email,
        tipo,
      });

      Alert.alert("Conta criada com sucesso!");
      router.replace("/login");
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Criar Conta</Text>

      <TextInput
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        placeholder="Senha"
        secureTextEntry
        style={styles.input}
        value={senha}
        onChangeText={setSenha}
      />

      <TextInput
        placeholder="Confirmar senha"
        secureTextEntry
        style={styles.input}
        value={confirmar}
        onChangeText={setConfirmar}
      />

      <Text style={styles.sub}>Escolha seu perfil:</Text>

      {/* LOCATÁRIO */}
      <TouchableOpacity
        style={styles.opcao}
        onPress={() => setTipo("locatario")}
      >
        <View style={styles.checkbox}>
          {tipo === "locatario" && <View style={styles.checked} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>👤 Locatário</Text>
          <Text style={styles.desc}>
            Para quem procura casas para alugar no mapa.
          </Text>
        </View>
      </TouchableOpacity>

      {/* LOCADOR */}
      <TouchableOpacity
        style={styles.opcao}
        onPress={() => setTipo("locador")}
      >
        <View style={styles.checkbox}>
          {tipo === "locador" && <View style={styles.checked} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>🏠 Locador</Text>
          <Text style={styles.desc}>
            Para quem possui casas e deseja cadastrá-las no mapa para aluguel.
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.botao} onPress={cadastrar}>
        <Text style={styles.botaoTexto}>Cadastrar</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ marginTop: 15, textAlign: "center" }}>Voltar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 30,
    backgroundColor: "white",
  },
  titulo: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  sub: {
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 10,
  },
  opcao: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: "black",
    borderRadius: 4,
    marginRight: 10,
    marginTop: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  checked: {
    width: 12,
    height: 12,
    backgroundColor: "black",
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
  },
  desc: {
    fontSize: 13,
    color: "gray",
    marginTop: 2,
  },
  botao: {
    backgroundColor: "black",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  botaoTexto: {
    color: "white",
    fontWeight: "bold",
  },
});
