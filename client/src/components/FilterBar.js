import React from "react";
import { Box, FormControl, InputLabel, Select, MenuItem, Chip, OutlinedInput  } from "@mui/material";

const FilterBar = ({ categories, selectedCategories, onCategoryChange }) => {
    const handleAddCategory = (event) => {
        const { value } = event.target;
        // Add only unique categories
        onCategoryChange([...selectedCategories, ...value.filter((v) => !selectedCategories.includes(v))]);
    };

    const handleRemoveCategory = (categoryToRemove) => {
        // Remove category
        onCategoryChange(selectedCategories.filter((category) => category !== categoryToRemove));
    };

    return (
        <Box sx={{ marginBottom: "16px", textAlign: "right" }}>
            {/* Select Dropdown */}
            <FormControl fullWidth>
                <InputLabel
                    sx={{
                        textAlign: "right"
                    }}
                >
                    בחר קטגוריות
                </InputLabel>
                <Select
                    multiple
                    value={selectedCategories}
                    onChange={handleAddCategory}
                    input={<OutlinedInput id="select-multiple-chip" label="בחר קטגוריות" />}
                    renderValue={(selected) => (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {selected.map((category) => (
                                <Chip
                                    key={category}
                                    label={category}
                                    onDelete={() => handleRemoveCategory(category)} // Enable the "X" button
                                    onMouseDown={(e) => e.stopPropagation()} // Prevent dropdown from opening
                                    sx={{
                                        cursor: "pointer",
                                        direction: "rtl",
                                        ".MuiChip-deleteIcon": {
                                            marginRight: "0px",
                                            marginLeft: "2px",
                                        },
                                    }}
                                />
                            ))}
                        </Box>
                    )}
                >
                    {categories.map((category) => (
                        <MenuItem
                            key={category}
                            value={category}
                            sx={{
                                textAlign: "right", // Align text in the menu item to the right
                                justifyContent: "flex-end", // Align text within the menu item to the end (right-aligned)
                                direction: "rtl", // RTL support for proper behavior
                            }}
                        >
                            {category}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Box>
    );
};

export default FilterBar;
