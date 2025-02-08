import React, { useState } from "react";
import { Card, CardHeader, CardContent, Collapse, Typography, IconButton } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

const RecipeCard = ({ recipe, index, onEdit, onDelete }) => {
    const [expanded, setExpanded] = useState(false);

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
                title={title}
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
                    <Typography variant="h6">מרכיבים</Typography>
                    <ul>
                        {ingredients.map((ing, i) => (
                            <li key={i}>{ing}</li>
                        ))}
                    </ul>
                    <Typography variant="h6" sx={{ marginTop: "16px" }}>
                        הוראות הכנה
                    </Typography>
                    <ol>
                        {instructions.map((step, i) => (
                            <li key={i}>{step}</li>
                        ))}
                    </ol>
                </CardContent>
            </Collapse>
        </Card>
    );
};

export default RecipeCard;
