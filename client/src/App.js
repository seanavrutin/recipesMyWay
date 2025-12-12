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
    typography: {
        fontFamily: "Calibri, sans-serif",
      },
});

const rtlCache = createCache({
    key: "mui-rtl",
    stylisPlugins: [StylisPluginRTL],
});

// Get Google Client ID from environment variable
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

// Validate that the environment variable is set
if (!GOOGLE_CLIENT_ID) {
    console.error('REACT_APP_GOOGLE_CLIENT_ID is not set in environment variables');
    throw new Error('Google Client ID is not configured. Please check your environment variables.');
}

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
                                            {/* <FontSizeController /> */}
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
