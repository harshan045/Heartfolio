import { Ionicons } from '@expo/vector-icons';
import {
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
} from 'firebase/auth';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth } from '../firebaseConfig';

export default function AuthScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    React.useEffect(() => {
        if (auth.currentUser) {
            console.log('AuthScreen mounted but user exists:', auth.currentUser.uid);
            // This might happen if the layout isn't re-rendering
        }
    }, []);

    const handleAuth = async () => {
        setError(null);
        setIsSuccess(false);

        const trimmedEmail = email.trim();
        const trimmedPassword = password.trim();

        console.log(`Starting Auth: ${isLogin ? 'Login' : 'Signup'} | Email Length: ${trimmedEmail.length} | Pass Length: ${trimmedPassword.length}`);

        if (!trimmedEmail || !trimmedPassword) {
            setError('Please fill in all fields');
            return;
        }

        if (trimmedPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            if (isLogin) {
                const cred = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
                console.log('Login Success! UID:', cred.user.uid);
            } else {
                const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
                console.log('Signup Success! UID:', cred.user.uid);
                setIsSuccess(true);
                setError('Account created successfully! Verifying session...');

                // Extra check: Wait a bit to see if state updates naturally
                setTimeout(() => {
                    console.log('Post-Signup Sync Check | Current User UID:', auth.currentUser?.uid);
                }, 2000);
            }
        } catch (error: any) {
            // Use console.log instead of error to prevent the annoying red overlay in dev mode
            console.log('[AUTH] Auth Failure:', error.code, error.message);

            let errorMessage = 'Oops! Something went wrong. Please try again.';

            const code = error.code;
            if (code === 'auth/invalid-email') {
                errorMessage = 'That email doesn\'t look quite right. Check for typos!';
            } else if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
                errorMessage = isLogin
                    ? "Invalid email or password. Not sure yet? Try 'Forgot Password' or 'Sign Up' for a new account!"
                    : "This email might already be in use, or the details aren't valid.";
            } else if (code === 'auth/wrong-password') {
                errorMessage = 'Incorrect password. You can reset it if you\'ve forgotten!';
            } else if (code === 'auth/email-already-in-use') {
                errorMessage = 'This email is already registered! Try logging in instead.';
            } else if (code === 'auth/network-request-failed') {
                errorMessage = 'Connection lost. Please check your internet!';
            } else if (code === 'auth/too-many-requests') {
                errorMessage = 'Too many attempts. Please take a little break and try later.';
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setError('Please enter your email first to reset password');
            return;
        }

        setLoading(true);
        setError(null);
        setIsSuccess(false);

        try {
            console.log(`[AUTH] Attempting Password Reset for: "${trimmedEmail}"`);
            await sendPasswordResetEmail(auth, trimmedEmail);
            console.log('[AUTH] Password Reset call succeeded');
            setIsSuccess(true);
            setError('Password reset link sent! Check your inbox & SPAM folder. Tip: If using school email, it might be delayed or blocked by your admin.');
        } catch (error: any) {
            console.error('Password Reset Error:', error.code, error.message);
            if (error.code === 'auth/user-not-found') {
                setError('No account found with this email.');
            } else if (error.code === 'auth/too-many-requests') {
                setError('Too many requests. Please wait a bit and try again.');
            } else {
                setError(`Failed to send reset email: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        setError(null);
        setIsSuccess(false);
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

                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
                            placeholder="Password"
                            placeholderTextColor="#999"
                            value={password}
                            onChangeText={(text) => {
                                setPassword(text);
                                setError(null);
                            }}
                            secureTextEntry={!showPassword}
                            editable={!loading}
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowPassword(!showPassword)}
                        >
                            <Ionicons
                                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={24}
                                color="#ff6b9d"
                            />
                        </TouchableOpacity>
                    </View>

                    {error && (
                        <View style={[styles.errorContainer, isSuccess && styles.successContainer]}>
                            <Text style={[styles.errorText, isSuccess && styles.successText]}>{error}</Text>
                        </View>
                    )}

                    {isLogin && (
                        <TouchableOpacity
                            onPress={handleForgotPassword}
                            style={styles.forgotPassword}
                            disabled={loading}
                        >
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                        </TouchableOpacity>
                    )}

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
                        style={styles.switchButton}
                        onPress={toggleMode}
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

            {loading && <View style={styles.overlay} />}
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
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    eyeIcon: {
        paddingHorizontal: 15,
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
    switchButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    switchText: {
        color: '#ff6b9d',
        fontSize: 14,
        fontWeight: '600',
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 20,
    },
    forgotPasswordText: {
        color: '#666',
        fontSize: 14,
        textDecorationLine: 'underline',
    },
    errorContainer: {
        backgroundColor: '#fff0f0',
        padding: 12,
        borderRadius: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#ffcdd2',
    },
    errorText: {
        color: '#d32f2f',
        fontSize: 14,
        textAlign: 'center',
    },
    successContainer: {
        backgroundColor: '#e8f5e9',
        borderColor: '#c8e6c9',
    },
    successText: {
        color: '#2e7d32',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        zIndex: 1000,
    },
});
