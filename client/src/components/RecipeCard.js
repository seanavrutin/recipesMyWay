import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, Collapse, Typography, IconButton,TextField,Button, Box } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useFontSize } from "../context/FontSizeContext";
import { recipeAPI } from "../services/api";
import { Snackbar, Alert } from "@mui/material";
import MuiAlert from "@mui/material/Alert";
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Dialog, DialogTitle, DialogContent, Tooltip } from '@mui/material';
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const RecipeCard = ({ recipeDoc, user, onUpdate, onDelete, isFullscreen = false, onCloseFullscreen, fullscreenMode, onOpenFullscreen }) => {
    const [expandedRecipe, setExpandedRecipe] = useState(false); // State for the entire recipe
    const [expandedIngredients, setExpandedIngredients] = useState(true); // State for ingredients section
    const [expandedInstructions, setExpandedInstructions] = useState(true); // State for instructions section
    const [expandedNotes, setExpandedNotes] = useState(true); // State for instructions section
    const { fontSize } = useFontSize(); // Get global font size
    const [editMode, setEditMode] = useState(false);
    const [editedText, setEditedText] = useState("");
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleToggleRecipe = () => {
        if (fullscreenMode && !isFullscreen) {
            onOpenFullscreen(recipeDoc);
        } else {
            setExpandedRecipe(!expandedRecipe);
        }
    };

    const handleToggleIngredients = () => {
        setExpandedIngredients(!expandedIngredients);
    };

    const handleToggleInstructions = () => {
        setExpandedInstructions(!expandedInstructions);
    };
    const handleToggleNotes = () => {
        setExpandedNotes(!expandedNotes);
    };

    const handleEditClick = () => {
        setEditedText(convertRecipeToText(recipeDoc.recipe));
        setEditMode(true);
        setExpandedRecipe(true);
    };

    const convertRecipeToText = (recipeDoc) => {
        let text = `${recipeDoc.title}\nקטגוריה:\n${recipeDoc.categories}\nמרכיבים:\n`;
        recipeDoc.ingredients.forEach(ing => text += `* ${ing}\n`);
        text += `הוראות הכנה:\n`;
        recipeDoc.instructions.forEach((inst, i) => text += `${i + 1}. ${inst}\n`);
        if (recipeDoc.url) text += `קישור:\n${recipeDoc.url}\n`;
        if (recipeDoc.notes) text += `הערות:\n${recipeDoc.notes}\n`;
    
        return text.trim();
    };
    

    const convertTextToRecipe = (text) => {
        let lines = text.split("\n");
        let recipe = {};
    
        let stage = "title";
        let title = "";
        let category = [];
        let ingredients = [];
        let instructions = [];
        let url = "";
        let notes ="";
    
        for (let line of lines) {
            line = line.trim();
            if (line === "") continue;
    
            if (stage === "title") {
                title = line;
                stage = "category";
            } else if (line === "קטגוריה:") {
                continue;
            } else if (stage === "category" && line !== "מרכיבים:") {
                category = line.split(',');
            } else if (line === "מרכיבים:") {
                stage = "ingredients";
            } else if (line === "הוראות הכנה:") {
                stage = "instructions";
            } else if (line === "קישור:") {
                stage = "url";
            } else if (line === "הערות:") {
                stage = "notes";
            } else if (stage === "ingredients" && line.startsWith("*")) {
                ingredients.push(line.slice(1).trim());
            } else if (stage === "instructions" && /^\d+\./.test(line)) {
                instructions.push(line.replace(/^\d+\.\s*/, ""));
            } else if (stage === "url") {
                url = line;
            } else if (stage === "notes") {
                notes = line;
            }
            
        }

        if (title) recipe.title = title;
        if (category) recipe.categories = category;
        if (ingredients.length) recipe.ingredients = ingredients;
        if (instructions.length) recipe.instructions = instructions;
        if (url) recipe.url = url;
        if (notes) recipe.notes = notes;
    
        return recipe;
    };

    let handleUpdateRecipe = async () => {
        let updatedRecipe = convertTextToRecipe(editedText);
        console.log(updatedRecipe)
        try {
            let newRecipeDoc = await recipeAPI.updateRecipe({userName:recipeDoc.userName, recipe: updatedRecipe, docId: recipeDoc.id });
            setEditMode(false);
            recipeDoc = newRecipeDoc;
            onUpdate(newRecipeDoc);
            setSnackbarOpen(true);
            
            // Cache is automatically cleared in the API service
        } catch (err) {
            alert("שגיאה בעדכון המתכון");
        }
    }

    const formatRecipeForSharing = (recipe) => {
      
        let text = `*${recipe.title}*\n\n*מרכיבים:*\n`;
        recipe.ingredients.forEach(ing => text += `• ${ing}\n`);
        text += `\n*הוראות הכנה:*\n`;
        recipe.instructions.forEach((step, i) => text += `${i + 1}. ${step}\n`);
        if(recipe.notes && recipe.notes.length > 0){
            text += `\n*הערות:*\n`;
            text += recipe.notes;
            text += `\n`;
        }
        if(recipe.url && recipe.url.length > 0){
            text += `\n*קישור:*\n`;
            text += recipe.url;
        }
      
        return text.trim();
    };

    const handleShare = async () => {
        const textToShare = formatRecipeForSharing(recipeDoc.recipe);
    
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
          await navigator.clipboard.writeText(formatRecipeForSharing(recipeDoc.recipe));
          setCopied(true)
        } catch (err) {
          console.error("Copy failed:", err);
        }
      };
      
    
    

    // Extracting title, ingredients, and instructions from the recipe JSON
    const title = recipeDoc.recipe.title;
    const ingredients = recipeDoc.recipe.ingredients;
    const instructions = recipeDoc.recipe.instructions;
    const url = (recipeDoc.recipe.url && recipeDoc.recipe.url.length) > 0 ? recipeDoc.recipe.url : undefined;
    const notes = (recipeDoc.recipe.notes && recipeDoc.recipe.notes.length) > 0 ? recipeDoc.recipe.notes : undefined;

    // Set expanded state to true for fullscreen mode
    useEffect(() => {
        if (isFullscreen) {
            setExpandedRecipe(true);
        }
    }, [isFullscreen]);

    return (
        <Card sx={{ 
            marginBottom: isFullscreen ? "0" : "16px", 
            backgroundColor: isFullscreen ? "#f0f8ff" : "#ffffff78", // Full opacity for fullscreen
            height: isFullscreen ? "100vh" : "auto", // Complete full screen height
            borderRadius: isFullscreen ? 0 : undefined,
            boxShadow: isFullscreen ? "none" : undefined,
            maxWidth: isFullscreen ? "none" : undefined, // Full width for fullscreen
            margin: isFullscreen ? "0" : undefined,
            overflow: isFullscreen ? "hidden" : "visible", // No scrolling on card itself
            display: isFullscreen ? "flex" : "block",
            flexDirection: isFullscreen ? "column" : undefined
        }}>
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
                        href={`https://wa.me/?text=${encodeURIComponent(formatRecipeForSharing(recipeDoc.recipe))}`}
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
            {isFullscreen ? (
                <Box 
                    sx={{ 
                        p: 2,
                        flexShrink: 0, // Prevent header from shrinking
                        position: "sticky",
                        top: 0,
                        backgroundColor: "#f0f8ff",
                        zIndex: 10
                    }}
                >
                    {/* Fullscreen Header */}
                    <Box sx={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        position: "relative",
                        mb: 2
                    }}>
                        {/* Back Arrow */}
                        <IconButton 
                            onClick={onCloseFullscreen}
                            sx={{ 
                                position: "absolute", 
                                right: 0,
                                transition: "transform 0.2s ease",
                                "&:hover": { transform: "scale(1.1)" }
                            }}
                        >
                            <ArrowBackIcon />
                        </IconButton>
                        
                        {/* Centered Title */}
                        <Typography
                            sx={{
                                fontSize: fontSize * 1.4 + "px",
                                fontWeight: "bold",
                                textAlign: "center",
                                animation: "titleSlide 0.5s ease-out",
                                "@keyframes titleSlide": {
                                    "0%": { transform: "translateX(-50px)", opacity: 0 },
                                    "100%": { transform: "translateX(0)", opacity: 1 }
                                }
                            }}
                        >
                            {title}
                            {url && (
                                <>
                                    {" ("}
                                    <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#1976d2", textDecoration: "underline" }}>
                                        {url.includes("instagram") ? "אינסטגרם" : "קישור"}
                                    </a>
                                    {")"}
                                </>
                            )}
                        </Typography>
                    </Box>
                    
                    {/* Action Buttons Row */}
                    <Box sx={{ 
                        display: "flex", 
                        justifyContent: "space-around", 
                        alignItems: "center",
                        py: 2,
                        borderBottom: "1px solid #eee",
                        animation: "buttonsSlide 0.6s ease-out 0.2s both",
                        "@keyframes buttonsSlide": {
                            "0%": { transform: "translateY(20px)", opacity: 0 },
                            "100%": { transform: "translateY(0)", opacity: 1 }
                        }
                    }}>
                        <Tooltip title="שתף">
                            <IconButton onClick={() => handleShare()} size="large">
                                <ShareIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="ערוך">
                            <IconButton onClick={() => handleEditClick()} size="large">
                                <EditIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="מחק">
                            <IconButton onClick={() => onDelete(recipeDoc.id)} size="large">
                                <DeleteIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            ) : (
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
                            {url && (
                                <>
                                    {" ("}
                                    <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#1976d2", textDecoration: "underline" }}>
                                        {url.includes("instagram") ? "אינסטגרם" : "קישור"}
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
                                <IconButton onClick={() => onDelete(recipeDoc.id)}>
                                    <DeleteIcon />
                                </IconButton>
                            </Tooltip>
                        </>
                    }
                />
            )}

            {/* Collapsible Recipe Content */}
            <Collapse 
                in={expandedRecipe || isFullscreen} 
                timeout="auto" 
                unmountOnExit
                sx={isFullscreen ? { 
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "auto" // Allow scrolling
                } : {}}
            >
            {editMode ? (
            <Box sx={{ 
                flex: 1, 
                overflow: "auto", 
                p: 2,
                display: "flex",
                flexDirection: "column"
            }}>
                <TextField
                    fullWidth
                    multiline
                    minRows={10}
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    sx={{ 
                        whiteSpace: "pre-line",
                        flex: 1
                    }}
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
            </Box>
            ) : (
                <CardContent sx={isFullscreen ? {
                    px: 3,
                    py: 2,
                    pb: 4, // Extra bottom padding for fullscreen
                    animation: "contentFade 0.8s ease-out 0.4s both",
                    "@keyframes contentFade": {
                        "0%": { opacity: 0, transform: "translateY(10px)" },
                        "100%": { opacity: 1, transform: "translateY(0)" }
                    }
                } : {
                    px: 2,
                    py: 1,
                    pb: 2
                }}>
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
                                        gap: "10px"
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
                                            flexShrink: 0
                                        }}
                                    >
                                        {i + 1}
                                    </span>
                                    {step}
                                </li>
                            ))}
                        </ol>
                    </Collapse>
                    {/* Notes Section */}
                    {notes &&
                        <span>
                        <Box
                            sx={{
                                textAlign: "center",
                                marginY: "16px",
                                cursor: "pointer",
                            }}
                            onClick={handleToggleNotes} // Expand/collapse notes
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
                                הערות
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
                        <Collapse in={expandedNotes} timeout="auto" unmountOnExit>
                            {notes}
                        </Collapse>
                        </span>
                    }
                </CardContent>
            )}
            </Collapse>
        </Card>
    );
};

export default RecipeCard;
