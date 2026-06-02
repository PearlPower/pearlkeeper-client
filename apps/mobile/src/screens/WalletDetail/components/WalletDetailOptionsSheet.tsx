import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fonts } from "../../../theme";

type WalletDetailOptionsSheetProps = {
  deleteVisible: boolean;
  onCancelDelete: () => void;
  onCloseOptionsMenu: () => void;
  onConfirmDelete: () => void;
  onOpenDeleteConfirmation: () => void;
  onOpenWalletList: () => void;
  optionsVisible: boolean;
  walletName: string;
};

export function WalletDetailOptionsSheet({
  deleteVisible,
  onCancelDelete,
  onCloseOptionsMenu,
  onConfirmDelete,
  onOpenDeleteConfirmation,
  onOpenWalletList,
  optionsVisible,
  walletName,
}: WalletDetailOptionsSheetProps) {
  return (
    <>
      <Modal
        visible={optionsVisible}
        transparent
        animationType="slide"
        onRequestClose={onCloseOptionsMenu}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalWalletName}>{walletName}</Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.neutralButton]}
              onPress={onOpenWalletList}
              accessibilityRole="button"
              accessibilityLabel="Wallets list"
            >
              <Text style={styles.neutralButtonText}>Wallets List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.deleteButton]}
              onPress={onOpenDeleteConfirmation}
              accessibilityRole="button"
              accessibilityLabel="Delete wallet"
            >
              <Text style={styles.deleteButtonText}>Delete Wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onCloseOptionsMenu}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteVisible}
        transparent
        animationType="slide"
        onRequestClose={onCancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalWalletName}>{walletName}</Text>
            <Text style={styles.modalWarning}>
              This action cannot be undone. All wallet secrets will be
              permanently deleted.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.deleteButton]}
              onPress={onConfirmDelete}
              accessibilityRole="button"
              accessibilityLabel="Confirm delete wallet"
            >
              <Text style={styles.deleteButtonText}>Delete Wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onCancelDelete}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    gap: 16,
  },
  modalWalletName: {
    color: colors.black,
    fontFamily: fonts.sansBold,
    fontSize: 20,
    textAlign: "center",
  },
  modalWarning: {
    color: colors.gray600,
    fontFamily: fonts.serif,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  modalButton: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  neutralButton: {
    borderColor: colors.black,
    borderWidth: 2,
  },
  neutralButtonText: {
    color: colors.black,
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: colors.errorBg,
    borderColor: colors.error,
  },
  deleteButtonText: {
    color: colors.error,
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
  },
  cancelButton: {
    borderColor: colors.gray300,
  },
  cancelButtonText: {
    color: colors.gray500,
    fontFamily: fonts.sans,
    fontSize: 16,
  },
});
