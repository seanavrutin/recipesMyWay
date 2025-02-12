import React, { useState } from "react";
import { Card, CardHeader, CardContent, Collapse, Typography, IconButton, Box } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useFontSize } from "../context/FontSizeContext";

const RecipeCard = ({ recipe, index, onEdit, onDelete }) => {
    const [expandedRecipe, setExpandedRecipe] = useState(false); // State for the entire recipe
    const [expandedIngredients, setExpandedIngredients] = useState(true); // State for ingredients section
    const [expandedInstructions, setExpandedInstructions] = useState(true); // State for instructions section
    const { fontSize } = useFontSize(); // Get global font size

    const handleToggleRecipe = () => {
        setExpandedRecipe(!expandedRecipe);
    };

    const handleToggleIngredients = () => {
        setExpandedIngredients(!expandedIngredients);
    };

    const handleToggleInstructions = () => {
        setExpandedInstructions(!expandedInstructions);
    };

    // Extracting title, ingredients, and instructions from the recipe JSON
    const title = recipe.recipe.find((item) => item.key === "כותרת")?.value || "Unknown Recipe";
    const ingredients = recipe.recipe.find((item) => item.key === "מרכיבים")?.value || [];
    const instructions = recipe.recipe.find((item) => item.key === "הוראות הכנה")?.value || [];

    return (
        <Card sx={{ marginBottom: "16px", backgroundColor: "#ffffff78" }}>
            {/* Recipe Header */}
            <CardHeader
                title={
                    <Typography
                        sx={{
                            fontSize: fontSize * 1.2 + "px",
                            userSelect: "none" // Disable text selection
                        }}
                        align="right"
                        onClick={handleToggleRecipe} // Expand/collapse recipe
                    >
                        {title}
                    </Typography>
                }
                action={
                    <>
                        <IconButton onClick={() => onEdit(recipe.id)}>
                            <EditIcon />
                        </IconButton>
                        <IconButton onClick={() => onDelete(recipe.id)}>
                            <DeleteIcon />
                        </IconButton>
                    </>
                }
            />

            {/* Collapsible Recipe Content */}
            <Collapse in={expandedRecipe} timeout="auto" unmountOnExit>
                <CardContent>
                    {/* Ingredients Section */}
                    <Box
                        sx={{ textAlign: "center", marginY: "8px" }}
                        onClick={handleToggleIngredients} // Expand/collapse ingredients
                    >
                        <Box
                            sx={{
                                height: "1px",
                                backgroundColor: "#bbb",
                                width: "100%",
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
                                >
                                    <span
                                        style={{
                                            width: "10px",
                                            height: "10px",
                                            border: "1px solid #888",
                                            borderRadius: "50%",
                                            display: "inline-block",
                                            flexShrink: 0, // Prevent shrinking of the circle
                                            alignSelf: "center", // Vertically center the circle with the line
                                            marginRight: "px", // Add margin between bullet and text
                                            marginLeft: "10px", // Add margin between bullet and text
                                        }}
                                    ></span>
                                    {ing}
                                </li>
                            ))}
                        </ul>
                    </Collapse>

                    {/* Instructions Section */}
                    <Box
                        sx={{ textAlign: "center", marginY: "16px" }}
                        onClick={handleToggleInstructions} // Expand/collapse instructions
                    >
                        <Box
                            sx={{
                                height: "1px",
                                backgroundColor: "#bbb",
                                width: "100%",
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
                                >
                                    <span
                                        style={{
                                            width: "20px",
                                            height: "20px",
                                            border: "1px solid #888",
                                            borderRadius: "50%",
                                            display: "inline-flex",
                                            flexShrink: 0, // Prevent shrinking of the circle
                                            alignSelf: "center", // Vertically center the circle with the line
                                            justifyContent: "center",
                                            alignItems: "center",
                                            fontSize: "12px",
                                            fontWeight: "bold",
                                            color: "#888",
                                            marginRight: "5px", // Add margin between number and text
                                            marginLeft: "10px", // Add margin between number and text
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
            </Collapse>
        </Card>
    );
};

export default RecipeCard;
