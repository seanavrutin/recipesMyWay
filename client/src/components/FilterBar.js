import React, { useState } from "react";
import { Box, Button, Collapse, IconButton } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

const FilterBar = ({ categories, selectedCategories, onCategoryChange }) => {
    const [expanded, setExpanded] = useState(true); // State to toggle expanded view

    const toggleExpanded = () => {
        setExpanded(!expanded);
    };

    const handleCategoryClick = (category) => {
        if (category === "הכל") {
            // Select all categories if none or not all are selected, otherwise deselect all
            onCategoryChange(
                selectedCategories.length === categories.length ? [] : [...categories]
            );
        } else {
            // Toggle individual category
            const newSelectedCategories = selectedCategories.includes(category)
                ? selectedCategories.filter((c) => c !== category) // Deselect category
                : [...selectedCategories, category]; // Select category
            onCategoryChange(newSelectedCategories);
        }
    };

    return (
        <Box sx={{ marginBottom: "16px", textAlign: "right"}}>
            {/* Buttons Row */}
            <Collapse in={expanded} timeout="auto" collapsedSize="45px">
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        overflow: "hidden"
                    }}
                >
                    {/* Reverse Order for "הכל" */}
                    {[{ label: "הכל", key: "הכל" }, ...categories.map((cat) => ({ label: cat, key: cat }))]
                        
                        .map(({ label, key }) => (
                            <Button
                                key={key}
                                variant={
                                    (key === "הכל" && selectedCategories.length === categories.length) ||
                                    selectedCategories.includes(key)
                                        ? "contained"
                                        : "outlined"
                                }
                                onClick={() => handleCategoryClick(key)}
                                sx={{
                                    fontSize: "14px",
                                    padding: "4px 8px",
                                    minWidth: "80px",
                                    direction: "rtl",
                                }}
                            >
                                {label}
                            </Button>
                        ))}
                </Box>
            </Collapse>

            {/* Expand/Collapse Arrow */}
            <Box sx={{ textAlign: "center", marginTop: "8px" }}>
                <IconButton onClick={toggleExpanded}>
                    {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
            </Box>
        </Box>
    );
};

export default FilterBar;
