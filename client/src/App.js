import React from "react";
import HomePage from "./pages/HomePage";
import { createTheme, ThemeProvider, CssBaseline } from "@mui/material";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

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

function App() {
    return (
        <CacheProvider value={rtlCache}>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <Router>
                  <Routes>
                      {/* HomePage with support for userId in query params */}
                      <Route dir="rtl" path="/" element={
                        <div dir="rtl">
                          <HomePage />
                        </div>
                        // <HomePage />
                      } />
                  </Routes>
              </Router>
                {/* <div dir="rtl">
                    <HomePage />
                </div> */}
            </ThemeProvider>
        </CacheProvider>
    );
}

export default App;