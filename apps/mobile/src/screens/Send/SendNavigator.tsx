import React from "react";
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from "@react-navigation/native-stack";
import { RouteProp, useRoute } from "@react-navigation/native";
import type { RootStackParamList } from "../../navigation/types";
import { SendFlowProvider } from "./SendFlowContext";

export type SendStackParamList = {
  SendAddress: undefined;
  SendAmount: undefined;
  SendFee: undefined;
  SendReview: undefined;
  SendSuccess: undefined;
};
import SendAddressScreen from "./SendAddressScreen";
import SendAmountScreen from "./SendAmountScreen";
import SendFeeScreen from "./SendFeeScreen";
import SendReviewScreen from "./SendReviewScreen";
import SendSuccessScreen from "./SendSuccessScreen";

const Stack = createNativeStackNavigator<SendStackParamList>();

const NO_HEADER: NativeStackNavigationOptions = { headerShown: false };

export default function SendNavigator() {
  const route = useRoute<RouteProp<RootStackParamList, "SendFlow">>();
  const { walletId } = route.params;

  return (
    <SendFlowProvider walletId={walletId}>
      <Stack.Navigator screenOptions={NO_HEADER}>
        <Stack.Screen name="SendAddress" component={SendAddressScreen} />
        <Stack.Screen name="SendAmount" component={SendAmountScreen} />
        <Stack.Screen name="SendFee" component={SendFeeScreen} />
        <Stack.Screen name="SendReview" component={SendReviewScreen} />
        <Stack.Screen name="SendSuccess" component={SendSuccessScreen} />
      </Stack.Navigator>
    </SendFlowProvider>
  );
}
