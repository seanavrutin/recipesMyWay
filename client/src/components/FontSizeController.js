import React, { useState } from "react";
import { Slider, IconButton, Box } from "@mui/material";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import { useFontSize } from "../context/FontSizeContext";

const FontSizeController = () => {
    const [sliderVisible, setSliderVisible] = useState(false); // Slider visibility
    const { fontSize, setFontSize } = useFontSize(); // Access context

    const handleFontSizeChange = (event, newValue) => {
        setFontSize(newValue); // Update global font size
    };

    return (
        <Box
            sx={{
                position: "fixed",
                top: "10px",
                left: "10px",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
            }}
        >
            {/* Toggle Button */}
            <IconButton
                onClick={() => setSliderVisible(!sliderVisible)}
                sx={{ backgroundColor: "white", boxShadow: 2 }}
            >
                <TextFieldsIcon />
            </IconButton>

            {/* Slider */}
            {sliderVisible && (
                <Slider
                    value={fontSize} // Use global font size
                    min={12}
                    max={32}
                    step={1}
                    onChange={handleFontSizeChange}
                    sx={{ width: 150, marginTop: 1 }}
                    aria-labelledby="font-size-slider"
                />
            )}
        </Box>
    );
};

export default FontSizeController;
