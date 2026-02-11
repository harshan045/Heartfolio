import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
} from 'firebase/auth';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth } from '../firebaseConfig';

export default function AuthScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                Alert.alert('Success', 'Account created successfully!');
            }
        } catch (error: any) {
            let errorMessage = 'An error occurred';

            if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address';
            } else if (error.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Incorrect password';
            } else if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Email already in use';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your connection';
            }

            Alert.alert('Error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                <Text style={styles.title}>Heartfolio</Text>
                <Text style={styles.subtitle}>
                    {isLogin ? 'Welcome back!' : 'Create your account'}
                </Text>

                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#999"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        editable={!loading}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#999"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        editable={!loading}
                    />

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleAuth}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>
                                {isLogin ? 'Login' : 'Sign Up'}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setIsLogin(!isLogin)}
                        disabled={loading}
                    >
                        <Text style={styles.switchText}>
                            {isLogin
                                ? "Don't have an account? Sign Up"
                                : 'Already have an account? Login'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 30,
    },
    title: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#ff6b9d',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 18,
        color: '#666',
        textAlign: 'center',
        marginBottom: 40,
    },
    form: {
        width: '100%',
    },
    input: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderRadius: 12,
        fontSize: 16,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    button: {
        backgroundColor: '#ff6b9d',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#ff6b9d',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    switchText: {
        color: '#ff6b9d',
        textAlign: 'center',
        marginTop: 20,
        fontSize: 15,
    },
});
