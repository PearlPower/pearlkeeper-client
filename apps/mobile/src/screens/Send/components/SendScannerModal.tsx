import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CameraView } from "expo-camera";
import { colors, fonts } from "../../../theme";

type Props = {
  onClose: () => void;
  onQRScanned: ((event: { data: string }) => void) | undefined;
  topInset: number;
  visible: boolean;
};

export function SendScannerModal({
  onClose,
  onQRScanned,
  topInset,
  visible,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.scannerContainer} testID="send-scanner-modal">
        <CameraView
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onQRScanned}
        />

        <View style={[styles.scannerTopBar, { paddingTop: topInset + 12 }]}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel QR scan"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.scanTargetWrapper}>
          <View style={styles.scanTarget} />
          <Text style={styles.scanInstruction}>
            Point at a recipient address QR code
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scannerContainer: {
    flex: 1,
    backgroundColor: colors.black,
  },
  scannerTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  cancelButton: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: colors.white,
    fontSize: 15,
    fontFamily: fonts.sansSemiBold,
  },
  scanTargetWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  scanTarget: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: colors.blue600,
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  scanInstruction: {
    color: colors.white,
    fontSize: 14,
    textAlign: "center",
    fontFamily: fonts.sans,
  },
});
