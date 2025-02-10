import React, { createContext, useContext, useState } from "react";

// Create the context
const FontSizeContext = createContext();

// Provider component
export const FontSizeProvider = ({ children }) => {
    const [fontSize, setFontSize] = useState(16); // Default font size

    return (
        <FontSizeContext.Provider value={{ fontSize, setFontSize }}>
            <div style={{ fontSize: `${fontSize}px`, transition: "font-size 0.2s ease-in-out" }}>
                {children}
            </div>
        </FontSizeContext.Provider>
    );
};

// Hook to use the context
export const useFontSize = () => {
    const context = useContext(FontSizeContext);
    if (!context) {
        throw new Error("useFontSize must be used within a FontSizeProvider");
    }
    return context;
};
