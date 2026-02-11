import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const router = useRouter(); // ✅ hook at top

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Heartfolio 💖</Text>
      <Text style={styles.subtitle}>
        Your personal scrapbook journal
      </Text>

      <Pressable
        style={styles.button}
        onPress={() => router.push("/polaroid")}
      >
        <Text style={styles.buttonText}>Add a Memory ✨</Text>
      </Pressable>
      <Pressable
        style={[styles.button, { marginTop: 12 }]}
        onPress={() => router.push("/gallery")}
      >
        <Text style={styles.buttonText}>View Memories 💌</Text>
      </Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDF6F0",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    marginBottom: 30,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#FF8FAB",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
