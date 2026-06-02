import React from "react";
import { render, type RenderOptions } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

type AnyRoute = {
  key?: string;
  name?: string;
  params?: Record<string, unknown>;
};

type AnyNavigation = Record<string, unknown>;

type RenderScreenOptions = {
  navigation?: AnyNavigation;
  route?: AnyRoute;
  renderOptions?: Omit<RenderOptions, "wrapper">;
};

function TestProviders({ children }: { children: React.ReactNode }) {
  return <SafeAreaProvider>{children}</SafeAreaProvider>;
}

export function renderScreen(
  element: React.ReactElement,
  {
    navigation = {},
    route = { key: "test-route", name: "TestScreen", params: {} },
    renderOptions,
  }: RenderScreenOptions = {},
) {
  const screenElement = element as React.ReactElement<{
    navigation: AnyNavigation;
    route: AnyRoute;
  }>;

  return {
    navigation,
    route,
    ...render(
      React.cloneElement(screenElement, {
        navigation,
        route,
      }),
      {
        wrapper: TestProviders,
        ...renderOptions,
      },
    ),
  };
}
