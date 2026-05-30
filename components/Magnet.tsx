import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MagnetData } from '../utils/storage';

interface MagnetProps {
    data: MagnetData;
    size?: number;
}

export default function Magnet({ data, size = 40 }: MagnetProps) {
    return (
        <View style={[
            styles.magnet,
            {
                backgroundColor: data.color,
                width: size,
                height: size,
                borderRadius: size / 2,
                transform: [{ rotate: `${data.rotation}deg` }]
            }
        ]}>
            <View style={styles.highlight} />
            <Text style={[styles.icon, { fontSize: size * 0.5 }]}>{data.icon}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    magnet: {
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 5,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        zIndex: 10,
    },
    highlight: {
        position: 'absolute',
        top: '15%',
        left: '20%',
        width: '25%',
        height: '25%',
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    icon: {
        textShadowColor: 'rgba(0,0,0,0.1)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1,
    }
});
