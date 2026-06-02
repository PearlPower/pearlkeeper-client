import { createNavigationContainerRef } from "@react-navigation/native";
import { RootStackParamList } from "./types";

/**
 * Global navigation ref — attached to NavigationContainer in AppNavigator.
 * Use this to navigate from contexts where the screen-scoped navigation prop
 * is stale or unavailable (e.g. after a conditional stack switch).
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
