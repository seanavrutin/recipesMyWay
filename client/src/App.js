import React from "react";
import HomePage from "./pages/HomePage";
import { createTheme, ThemeProvider, CssBaseline } from "@mui/material";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Background from "./components/Background";
import { FontSizeProvider } from "./context/FontSizeContext";
import FontSizeController from "./components/FontSizeController";
import { GoogleOAuthProvider } from "@react-oauth/google"; // Import Google OAuth Provider
import "@fontsource/rubik-vinyl";

import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import StylisPluginRTL from "stylis-plugin-rtl";

const theme = createTheme({
    direction: "rtl", // Set direction to Right-To-Left
});

const rtlCache = createCache({
    key: "mui-rtl",
    stylisPlugins: [StylisPluginRTL],
});

// Replace with your actual Google Client ID
const GOOGLE_CLIENT_ID = "849943344595-7qlccneee1fmsss4j3p7qa05rl7btrh5.apps.googleusercontent.com";

function App() {
    return (
        <CacheProvider value={rtlCache}>
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <FontSizeProvider>
                    <ThemeProvider theme={theme}>
                        <CssBaseline />
                        <Router>
                            <Routes>
                                <Route
                                    dir="rtl"
                                    path="/"
                                    element={
                                        <div dir="rtl">
                                            <FontSizeController />
                                            <Background />
                                            <HomePage />
                                        </div>
                                    }
                                />
                            </Routes>
                        </Router>
                    </ThemeProvider>
                </FontSizeProvider>
            </GoogleOAuthProvider>
        </CacheProvider>
    );
}

export default App;
