import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { PaperBit as PaperBitType } from '../utils/storage';

interface PaperBitProps {
    data: PaperBitType;
}

export default function PaperBit({ data }: PaperBitProps) {
    if (data.isSticker) {
        if (data.imageUri) {
            return (
                <View style={{ width: data.width || 100, height: data.height || (data.width || 100), overflow: 'visible' }}>
                    <Image
                        source={{ uri: data.imageUri }}
                        style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
                    />
                </View>
            );
        }
        return (
            <View style={[{ width: data.width || 100, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: (data.width || 100) / 2 }}>{data.text}</Text>
            </View>
        );
    }

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: data.color,
                width: data.width || 150,
                minHeight: 60, // Minimum height for small text
            }
        ]}>
            <View style={styles.tape} />
            <Text style={styles.text} numberOfLines={undefined}>{data.text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 10,
        paddingTop: 15, // Space for tape
        shadowColor: "#000",
        shadowOffset: { width: 1, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
        zIndex: 100, // Ensure it's above photos
    },
    text: {
        fontFamily: 'PatrickHand_400Regular',
        fontSize: 16,
        color: '#333',
        lineHeight: 20,
    },
    tape: {
        position: 'absolute',
        top: -8,
        alignSelf: 'center',
        width: 30,
        height: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        transform: [{ rotate: '-2deg' }],
    }
});
