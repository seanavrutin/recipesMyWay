import React, { useState } from "react";
import {
    Box,
    IconButton,
    TextField,
    Button,
    Typography,
    Slide,
    CircularProgress,
    Backdrop
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

const AddRecipe = ({ onRecipeAdded }) => {
    const [open, setOpen] = useState(false);
    const [recipeText, setRecipeText] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [newRecipe, setNewRecipe] = useState(null);

    const handleToggle = () => {
        setOpen(!open);
        resetState();
    };

    const handleClose = () => {
        setOpen(false);
        resetState();
    };

    const resetState = () => {
        setRecipeText("");
        setLoading(false);
        setSuccess(false);
        setNewRecipe(null);
    };

    const handleCreate = async () => {
        setLoading(true);
        setSuccess(false);

        // Simulating API call delay
        setTimeout(() => {
            const mockRecipe = {
                id: Date.now(),
                title: "מתכון לדוגמא",
                content: recipeText
            };

            setNewRecipe(mockRecipe);
            onRecipeAdded(mockRecipe);
            setLoading(false);
            setSuccess(true);
        }, 2000);
    };

    return (
        <Box>
            {/* "+" Button to open menu */}
            <IconButton onClick={handleToggle}>
                <AddIcon fontSize="large" />
            </IconButton>

            {/* Background Blur Effect */}
            <Backdrop open={open} sx={{ zIndex: 1200, backdropFilter: "blur(4px)",backgroundColor: "rgba(0, 0, 0, 0.3)" }} onClick={handleClose} />

            {/* Sliding Down Menu */}
            <Slide direction="down" in={open} mountOnEnter unmountOnExit>
                <Box
                    sx={{
                        position: "absolute",
                        top: "60px",
                        left: 0,
                        right: 0,
                        backgroundColor: "#f0f8ff",
                        padding: "16px",
                        boxShadow: 3,
                        borderRadius: "8px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                        zIndex: 1301,
                    }}
                    onClick={(e) => e.stopPropagation()} // Prevent clicking inside from closing the menu
                >
                    {/* Close "X" Button (Top Right) */}
                    <IconButton
                        onClick={handleClose}
                        sx={{ position: "absolute", top: "0px", left: "0px", color: "#555" }}
                    >
                        <CloseIcon sx={{ fontSize: "1.2rem" }}/>
                    </IconButton>

                    {/* Instructions */}
                    <Typography
                        variant="body2"
                        sx={{ textAlign: "center", fontSize: "0.9rem", direction: "rtl", color: "#333", marginTop: "1rem" }}
                    >
                        ניתן להוסיף מתכון על ידי הקלדה חופשית או הדבקת קישור לאתר המכיל אותו
                    </Typography>

                    {/* Recipe Input */}
                    <TextField
                        fullWidth
                        multiline
                        minRows={4}
                        placeholder="הקלד או הדבק כאן את המתכון..."
                        value={recipeText}
                        onChange={(e) => setRecipeText(e.target.value)}
                        sx={{
                            backgroundColor: "white",
                            borderRadius: "4px",
                            width: "90%",
                        }}
                    />

                    {/* Buttons */}
                    <Box sx={{ width: "80%", display: "flex", justifyContent: "space-between" }}>
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={handleClose}
                            startIcon={<CloseIcon />}
                            sx={{ borderColor: "#ccc", color: "#666" }}
                        >
                            ביטול
                        </Button>
                        <Button
                            variant="outlined"
                            color="primary"
                            onClick={handleCreate}
                            startIcon={<SendIcon />}
                            disabled={loading}
                            sx={{ borderColor: "#aaa", color: "#333" }}
                        >
                            יצירה
                        </Button>
                    </Box>

                    {/* Loading Animation */}
                    {loading && (
                        <Box sx={{ marginTop: 2 }}>
                            <CircularProgress size={24} />
                            {/* <Typography variant="body2" sx={{ marginTop: 1 }}>יוצר מתכון...</Typography> */}
                        </Box>
                    )}

                    {/* Success Message */}
                    {success && (
                        <Box sx={{ marginTop: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
                            {/* <CheckCircleIcon sx={{ color: "green", fontSize: "2rem" }} /> */}
                            <Typography variant="body2" sx={{ fontWeight: "bold", marginTop: 1, color: "#2d8a2d" }}>
                                ✅ נוצר בהצלחה! ניתן לראות אותו ברשימת המתכונים שלך.
                            </Typography>
                        </Box>
                    )}

                    {/* Display Created Recipe */}
                    {newRecipe && (
                        <Box
                            sx={{
                                marginTop: 2,
                                padding: "10px",
                                backgroundColor: "#ffffff",
                                borderRadius: "8px",
                                boxShadow: 2,
                                width: "80%",
                                textAlign: "center",
                            }}
                        >
                            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                                {newRecipe.title}
                            </Typography>
                            <Typography variant="body2">{newRecipe.content}</Typography>
                        </Box>
                    )}
                </Box>
            </Slide>
        </Box>
    );
};

export default AddRecipe;
