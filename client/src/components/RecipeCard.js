import React, { use, useState } from "react";
import { Card, CardHeader, CardContent, Collapse, Typography, IconButton,TextField,Button, Box } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useFontSize } from "../context/FontSizeContext";
import axios from "axios";
import { Snackbar, Alert } from "@mui/material";
import MuiAlert from "@mui/material/Alert";
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Dialog, DialogTitle, DialogContent, Tooltip } from '@mui/material';
import WhatsAppIcon from "@mui/icons-material/WhatsApp";






const RecipeCard = ({ recipe, user, index,onUpdate, onDelete }) => {
    const [expandedRecipe, setExpandedRecipe] = useState(false); // State for the entire recipe
    const [expandedIngredients, setExpandedIngredients] = useState(true); // State for ingredients section
    const [expandedInstructions, setExpandedInstructions] = useState(true); // State for instructions section
    const { fontSize } = useFontSize(); // Get global font size
    const [editMode, setEditMode] = useState(false);
    const [editedText, setEditedText] = useState("");
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleToggleRecipe = () => {
        setExpandedRecipe(!expandedRecipe);
    };

    const handleToggleIngredients = () => {
        setExpandedIngredients(!expandedIngredients);
    };

    const handleToggleInstructions = () => {
        setExpandedInstructions(!expandedInstructions);
    };

    const handleEditClick = () => {
        setEditedText(convertRecipeToText(recipe.recipe));
        setEditMode(true);
        setExpandedRecipe(true);
    };

    const convertRecipeToText = (recipe) => {
        const title = recipe.find(item => item.key === "כותרת")?.value || "";
        const category = recipe.find(item => item.key === "קטגוריה")?.value || "";
        const ingredients = recipe.find(item => item.key === "מרכיבים")?.value || [];
        const instructions = recipe.find(item => item.key === "הוראות הכנה")?.value || [];
        const link = recipe.find(item => item.key === "קישור")?.value;
    
        let text = `${title}\nקטגוריה:\n${category}\nמרכיבים:\n`;
        ingredients.forEach(ing => text += `* ${ing}\n`);
        text += `הוראות הכנה:\n`;
        instructions.forEach((inst, i) => text += `${i + 1}. ${inst}\n`);
        if (link) text += `קישור:\n${link}\n`;
    
        return text.trim();
    };
    

    const convertTextToRecipe = (text) => {
        const lines = text.split("\n");
        const recipe = [];
    
        let stage = "title";
        let title = "";
        let category = "";
        const ingredients = [];
        const instructions = [];
        let link = "";
    
        for (let line of lines) {
            line = line.trim();
            if (line === "") continue;
    
            if (stage === "title") {
                title = line;
                stage = "category";
            } else if (line === "קטגוריה:") {
                continue;
            } else if (stage === "category" && line !== "מרכיבים:") {
                category = line;
            } else if (line === "מרכיבים:") {
                stage = "ingredients";
            } else if (line === "הוראות הכנה:") {
                stage = "instructions";
            } else if (line === "קישור:") {
                stage = "link";
            } else if (stage === "ingredients" && line.startsWith("*")) {
                ingredients.push(line.slice(1).trim());
            } else if (stage === "instructions" && /^\d+\./.test(line)) {
                instructions.push(line.replace(/^\d+\.\s*/, ""));
            } else if (stage === "link") {
                link = line;
            }
        }
    
        if (title) recipe.push({ key: "כותרת", value: title });
        if (category) recipe.push({ key: "קטגוריה", value: category });
        if (ingredients.length) recipe.push({ key: "מרכיבים", value: ingredients });
        if (instructions.length) recipe.push({ key: "הוראות הכנה", value: instructions });
        if (link) recipe.push({ key: "קישור", value: link });
    
        return recipe;
    };

    const handleUpdateRecipe = async () => {
        const updatedRecipe = convertTextToRecipe(editedText);
        try {
            const SERVER = process.env.REACT_APP_SERVER_ADDRESS;
            await axios.post(`${SERVER}/api/updateRecipe`, {userName:user.email, recipe: updatedRecipe });
            setEditMode(false);
            recipe.recipe = updatedRecipe;
            onUpdate(recipe);
            setSnackbarOpen(true);
        } catch (err) {
            alert("שגיאה בעדכון המתכון");
        }
    }

    const formatRecipeForSharing = (recipe) => {
        console.log(recipe)
        const title = recipe.find(item => item.key === "כותרת")?.value || "";
        const ingredients = recipe.find(item => item.key === "מרכיבים")?.value || [];
        const instructions = recipe.find(item => item.key === "הוראות הכנה")?.value || [];
      
        let text = `*${title}*\n\n*מרכיבים:*\n`;
        ingredients.forEach(ing => text += `• ${ing}\n`);
        text += `\n*הוראות הכנה:*\n`;
        instructions.forEach((step, i) => text += `${i + 1}. ${step}\n`);
      
        return text.trim();
    };

    const handleShare = async () => {
        const textToShare = formatRecipeForSharing(recipe.recipe);
    
        const isMobile =
            /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
    
        if (isMobile && navigator.share) {
            try {
                await navigator.share({
                    title: 'מתכון ממתכונים בדרכי',
                    text: textToShare,
                });
                return;
            } catch (err) {
                // If user cancels or something fails, fall back
                console.warn("Share failed, falling back to dialog", err);
            }
        }
    
        // Fallback for desktop or unsupported devices
        setShareOpen(true);
    };

    const handleCopy = async () => {
        try {
          await navigator.clipboard.writeText(formatRecipeForSharing(recipe.recipe));
          setCopied(true)
        } catch (err) {
          console.error("Copy failed:", err);
        }
      };
      
    
    

    // Extracting title, ingredients, and instructions from the recipe JSON
    const title = recipe.recipe.find((item) => item.key === "כותרת")?.value || "Unknown Recipe";
    const ingredients = recipe.recipe.find((item) => item.key === "מרכיבים")?.value || [];
    const instructions = recipe.recipe.find((item) => item.key === "הוראות הכנה")?.value || [];
    const link = recipe.recipe.find(item => item.key === "קישור")?.value || undefined;

    return (
        <Card sx={{ marginBottom: "16px", backgroundColor: "#ffffff78" }}>
            <Dialog open={shareOpen} onClose={() => setShareOpen(false)}>
                <DialogTitle sx={{ textAlign: "center" }}>שיתוף מתכון</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: "flex", justifyContent: "center", gap: 4, mt: 2 }}>
                    {/* Copy Icon */}
                    <IconButton
                        onClick={handleCopy}
                        sx={{ fontSize: "2.5rem" }}
                        title="העתק מתכון"
                    >
                        <ContentCopyIcon fontSize="inherit" />
                    </IconButton>

                    {/* WhatsApp Icon */}
                    <IconButton
                        component="a"
                        href={`https://wa.me/?text=${encodeURIComponent(formatRecipeForSharing(recipe.recipe))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ fontSize: "2.5rem" }}
                        title="שתף בוואטסאפ"
                    >
                        <WhatsAppIcon fontSize="inherit" color="success" />
                    </IconButton>
                    </Box>
                </DialogContent>
            </Dialog>

            <Snackbar
                open={copied}
                autoHideDuration={3000}
                onClose={() => setCopied(false)}
                message="המתכון הועתק!"
            />


            <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={() => setSnackbarOpen(false)}>
                <MuiAlert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
                    המתכון עודכן בהצלחה
                </MuiAlert>
            </Snackbar>
            {/* Recipe Header */}
            <CardHeader
                title={
                    <Typography
                        sx={{
                            fontSize: fontSize * 1.2 + "px",
                            userSelect: "none", // Disable text selection
                            cursor: "pointer", // Indicate clickability
                        }}
                        align="right"
                        onClick={handleToggleRecipe} // Expand/collapse recipe
                    >
                        {title}
                        {link && (
                            <>
                                {" ("}
                                <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: "#1976d2", textDecoration: "underline" }}>
                                    קישור
                                </a>
                                {")"}
                            </>
                        )}
                    </Typography>
                }
                action={
                    <>
                        <Tooltip title="שתף">
                            <IconButton onClick={() => handleShare()}>
                                <ShareIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="ערוך">
                            <IconButton onClick={() => handleEditClick()}>
                                <EditIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="מחק">
                            <IconButton onClick={() => onDelete(recipe.id)}>
                                <DeleteIcon />
                            </IconButton>
                        </Tooltip>
                    </>
                }
            />

            {/* Collapsible Recipe Content */}
            <Collapse in={expandedRecipe} timeout="auto" unmountOnExit>
            {editMode ? (
            <>
                <TextField
                    fullWidth
                    multiline
                    minRows={10}
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    sx={{ whiteSpace: "pre-line" }}
                />
                <Box sx={{ mt: 1, display: "flex", justifyContent: "flex-end", gap: 1 }}>
                <Button
                    variant="contained"
                    onClick={handleUpdateRecipe}
                >
                    עדכן
                </Button>
                <Button variant="outlined" onClick={() => setEditMode(false)}>בטל</Button>
                </Box>
            </>
            ) : (
            <>
                <CardContent>
                    {/* Ingredients Section */}
                    <Box
                        sx={{
                            textAlign: "center",
                            marginY: "8px",
                            cursor: "pointer",
                        }}
                        onClick={handleToggleIngredients} // Expand/collapse ingredients
                    >
                        <Box
                            sx={{
                                height: "1px",
                                backgroundColor: "#bbb",
                                width: "100%",
                                borderRadius: "2px",
                            }}
                        ></Box>
                        <Typography
                            variant="h6"
                            sx={{
                                fontSize: fontSize * 1.1 + "px",
                                fontWeight: "bold",
                                marginY: "8px",
                                color: "#333",
                                userSelect: "none", // Disable text selection
                                backgroundColor: "transparent", // Remove highlighting effect
                            }}
                        >
                            מרכיבים
                        </Typography>
                        <Box
                            sx={{
                                height: "1px",
                                backgroundColor: "#bbb",
                                width: "100%",
                                borderRadius: "2px",
                            }}
                        ></Box>
                    </Box>
                    <Collapse in={expandedIngredients} timeout="auto" unmountOnExit>
                        <ul style={{ listStyle: "none", padding: 0 }}>
                            {ingredients.map((ing, i) => (
                                <li
                                    key={i}
                                    style={{
                                        fontSize: fontSize + "px",
                                        backgroundColor: "rgba(231, 231, 231, 0.49)", // Slightly darker gray
                                        borderRadius: "8px",
                                        marginBottom: "8px",
                                        padding: "8px 12px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                    }}
                                    onClick={(e) => {
                                        e.target.style.textDecoration = e.target.style.textDecoration === "line-through" ? "none" : "line-through";
                                    }}
                                >
                                    <span
                                        style={{
                                            width: "10px",
                                            height: "10px",
                                            border: "1px solid #888",
                                            borderRadius: "50%",
                                            display: "inline-block",
                                            flexShrink: 0, // Prevent shrinking of the circle
                                            marginRight: "10px", // Add margin between bullet and text
                                        }}
                                    ></span>
                                    {ing}
                                </li>
                            ))}
                        </ul>
                    </Collapse>

                    {/* Instructions Section */}
                    <Box
                        sx={{
                            textAlign: "center",
                            marginY: "16px",
                            cursor: "pointer",
                        }}
                        onClick={handleToggleInstructions} // Expand/collapse instructions
                    >
                        <Box
                            sx={{
                                height: "1px",
                                backgroundColor: "#bbb",
                                width: "100%",
                                borderRadius: "2px",
                            }}
                        ></Box>
                        <Typography
                            variant="h6"
                            sx={{
                                fontSize: fontSize * 1.1 + "px",
                                fontWeight: "bold",
                                marginY: "8px",
                                color: "#333",
                                userSelect: "none", // Disable text selection
                                backgroundColor: "transparent", // Remove highlighting effect
                            }}
                        >
                            הוראות הכנה
                        </Typography>
                        <Box
                            sx={{
                                height: "1px",
                                backgroundColor: "#bbb",
                                width: "100%",
                                borderRadius: "2px",
                            }}
                        ></Box>
                    </Box>
                    <Collapse in={expandedInstructions} timeout="auto" unmountOnExit>
                        <ol style={{ padding: 0, margin: 0 }}>
                            {instructions.map((step, i) => (
                                <li
                                    key={i}
                                    style={{
                                        fontSize: fontSize + "px",
                                        backgroundColor: "rgba(231, 231, 231, 0.49)", // Slightly darker gray
                                        borderRadius: "8px",
                                        marginBottom: "8px",
                                        padding: "8px 12px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                    }}
                                    onClick={(e) => {
                                        e.target.style.textDecoration = e.target.style.textDecoration === "line-through" ? "none" : "line-through";
                                    }}
                                >
                                    <span
                                        style={{
                                            width: "20px",
                                            height: "20px",
                                            border: "1px solid #888",
                                            borderRadius: "50%",
                                            display: "inline-flex",
                                            justifyContent: "center",
                                            alignItems: "center",
                                            fontSize: "12px",
                                            fontWeight: "bold",
                                            color: "#888",
                                            marginRight: "10px", // Add margin between number and text
                                        }}
                                    >
                                        {i + 1}
                                    </span>
                                    {step}
                                </li>
                            ))}
                        </ol>
                    </Collapse>
                </CardContent>
            </>
            )}
            </Collapse>
        </Card>
    );
};

export default RecipeCard;
