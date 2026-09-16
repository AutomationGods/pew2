/**
 * App entry point.
 *
 * The crypto polyfill is first, and before every other import: the encryption
 * layer needs `crypto.getRandomValues`, Hermes has no Web Crypto at all, and
 * without it the app builds and launches and then throws the first time it seals
 * a frame — which is the moment someone scans a pairing code.
 */
import "./src/cryptoPolyfill";

import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import { createElement, useEffect } from 'react';

import { installCrashHandler } from './src/crashLog';
import App from './App';

// Hold the native splash until the app has something real to show.
//
// By default it is dismissed as soon as React commits its first frame, and the
// first frame here is an empty view held on the canvas colour while fonts and
// the stored pairing resolve. That handed the user a dead dark rectangle and
// called it a launch. Holding the splash across that gap costs nothing — it is
// the same colour — and the app appears when it can actually be used.
//
// `App` is responsible for the matching hide, and does it on every path
// including the failure ones, or this would be an app that never opens.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or no splash on this platform. Not a reason to fail launch.
});

// Before anything renders, so a crash during startup is still recorded. Startup
// is where the unexplained ones happen — a native module missing, a stored value
// that no longer parses — and it is the one window `ErrorBoundary` cannot cover,
// because nothing is mounted yet to catch anything.
installCrashHandler();

function Root() {
  useEffect(() => {
    if (!__DEV__ || !process.env.EXPO_PUBLIC_HARNESS) return;
    SplashScreen.hideAsync().catch(() => {
      // Already hidden, or no splash on this platform.
    });
  }, []);

  return createElement(App);
}

// The production app hides the splash after its own startup state resolves.
// Harnesses bypass App, so Root releases it after their first committed frame.
registerRootComponent(Root);
