import React from "react";
import { TextField } from "@mui/material";

const SearchBar = ({ searchValue, onSearchChange }) => {
    return (
        <TextField
            fullWidth
            label="חפש מתכון"
            variant="outlined"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ marginBottom: "16px" }}
        />
    );
};

export default SearchBar;