import React, { useState } from "react";
import {
    Box,
    IconButton,
    Menu,
    MenuItem,
    Divider,
    Avatar,
    Slider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button
} from "@mui/material";
import { useFontSize } from "../context/FontSizeContext";

const UserMenu = ({ user }) => {
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [fontSizeOpen, setFontSizeOpen] = useState(false);
    const { fontSize, setFontSize } = useFontSize(); // Restore Font Size Control
    const [familyModalOpen, setFamilyModalOpen] = useState(false);

    const handleMenuOpen = (event) => setMenuAnchor(event.currentTarget);
    const handleMenuClose = () => {
        setMenuAnchor(null);
        setFontSizeOpen(false); // Close font size slider when closing menu
    };
    const handleFontSizeToggle = () => setFontSizeOpen(!fontSizeOpen);

    const handleFamilyModalOpen = () => {
        setFamilyModalOpen(true);
        handleMenuClose();
    };

    const handleFamilyModalClose = () => setFamilyModalOpen(false);

    return (
        <Box>
            {/* Profile Button */}
            <IconButton onClick={handleMenuOpen}>
                <Avatar src={user?.picture} alt={user?.name} />
            </IconButton>

            {/* Dropdown Menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleMenuClose}
                sx={{
                    direction: "rtl", // Ensure RTL alignment
                    "& .MuiPaper-root": {
                        backgroundColor: "#f0f8ff", // Match AddRecipeMenu background
                        minWidth: 150,
                        boxShadow: 3,
                        borderRadius: "8px",
                        padding: "0 0" // Reduce vertical spacing
                    }
                }}
            >
                {/* User Name */}
                <MenuItem disabled sx={{ fontWeight: "bold", justifyContent: "left", minHeight: "5px" }}>
                    {user?.name}
                </MenuItem>
                <hr sx={{ backgroundColor: "#ccc" }}></hr>

                {/* My Family */}
                <MenuItem onClick={handleFamilyModalOpen} sx={{ justifyContent: "left", minHeight: "5px"}}>
                    המשפחה שלי
                </MenuItem>
                {/* <hr sx={{ backgroundColor: "#ccc" }}></hr> */}

                {/* Change Font Size */}
                <MenuItem onClick={handleFontSizeToggle} sx={{ justifyContent: "left", minHeight: "5px"}}>
                    שינוי גודל גופן
                </MenuItem>

                {/* Font Size Slider (Appears inside menu when toggled) */}
                {fontSizeOpen && (
                    <Box sx={{ px: 2, width: "90%", margin: "8px auto" }}>
                        <Slider
                            value={fontSize}
                            min={12}
                            max={32}
                            step={1}
                            onChange={(e, newValue) => setFontSize(newValue)}
                        />
                    </Box>
                )}
            </Menu>
            {/* My Family Modal */}
            <Dialog open={familyModalOpen} onClose={handleFamilyModalClose}>
                <DialogTitle sx={{ textAlign: "center", fontSize: "1.5rem", fontWeight: "bold" }}>
                    המשפחה שלי
                </DialogTitle>
                <DialogContent>
                    <p>כאן נוכל להוסיף תוכן בהמשך...</p>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleFamilyModalClose} variant="outlined">סגור</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default UserMenu;
