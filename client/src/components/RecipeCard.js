import React, { useState } from "react";
import { Card, CardHeader, CardContent, Collapse, Typography, IconButton } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useFontSize } from "../context/FontSizeContext";

const RecipeCard = ({ recipe, index, onEdit, onDelete }) => {
    const [expanded, setExpanded] = useState(false);
    const { fontSize } = useFontSize(); // Get global font size

    const handleExpandClick = () => {
        setExpanded(!expanded);
    };

    // Extracting title, ingredients, and instructions from the recipe JSON
    const title = recipe.recipe.find((item) => item.key === "כותרת")?.value || "Unknown Recipe";
    const ingredients = recipe.recipe.find((item) => item.key === "מרכיבים")?.value || [];
    const instructions = recipe.recipe.find((item) => item.key === "הוראות הכנה")?.value || [];

    return (
        <Card sx={{ marginBottom: "16px", backgroundColor: index % 2 === 0 ? "#e0f7fa" : "#f1f8ff" }}>
            <CardHeader
                title={
                    <Typography sx={{ fontSize: fontSize * 1.2 + "px" }} align="right">
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
                onClick={handleExpandClick}
            />
            <Collapse in={expanded} timeout="auto" unmountOnExit>
                <CardContent>
                    {/* Updated Section Title Font Size */}
                    <Typography variant="h6" sx={{ fontSize: fontSize * 1.1 + "px" }}>
                        מרכיבים
                    </Typography>
                    {/* Updated Ingredients List Font Size */}
                    <ul>
                        {ingredients.map((ing, i) => (
                            <li key={i} style={{ fontSize: fontSize + "px" }}>{ing}</li>
                        ))}
                    </ul>
                    {/* Updated Section Title Font Size */}
                    <Typography variant="h6" sx={{ marginTop: "16px", fontSize: fontSize * 1.1 + "px" }}>
                        הוראות הכנה
                    </Typography>
                    {/* Updated Instructions List Font Size */}
                    <ol>
                        {instructions.map((step, i) => (
                            <li key={i} style={{ fontSize: fontSize + "px" }}>{step}</li>
                        ))}
                    </ol>
                </CardContent>
            </Collapse>
        </Card>
    );
};

export default RecipeCard;
