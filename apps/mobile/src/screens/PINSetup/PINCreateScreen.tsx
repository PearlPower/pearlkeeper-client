import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import PINPad from "../../components/PINPad";
import { RootStackParamList } from "../../navigation/types";
import { colors } from "../../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "PINCreate">;
};

export default function PINCreateScreen({ navigation }: Props) {
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  const handleComplete = (pin: string) => {
    navigation.navigate("PINConfirm", { pin });
  };

  return (
    <View style={styles.container}>
      <PINPad
        title="Create a PIN"
        subtitle="Choose a 6-digit PIN to secure your wallet"
        onComplete={handleComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
});
