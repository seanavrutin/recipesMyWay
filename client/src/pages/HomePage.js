import React, { useEffect, useState, useRef  } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import RecipeCard from "../components/RecipeCard";
import SearchBar from "../components/SearchBar";
import FilterBar from "../components/FilterBar";
import InfiniteScroll from "react-infinite-scroll-component";
import { Box, Typography } from "@mui/material";

const HomePage = () => {
    const [recipes, setRecipes] = useState([]);
    const [filteredRecipes, setFilteredRecipes] = useState([]);
    const [categories, setCategories] = useState([]); // Dynamic categories
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [searchValue, setSearchValue] = useState("");
    const [searchParams] = useSearchParams(); // Get query params
    const fetchCalled = useRef(false);

    const userId = searchParams.get("userId"); // Extract userId from query params

    useEffect(() => {
        if (userId && !fetchCalled.current) {
            fetchCalled.current = true;
            fetchRecipes(userId);
        }
    }, [userId]);

    const fetchRecipes = async (userId) => {
        try {
            const response = await axios.get(`http://10.100.102.5:3000/api/recipes/${userId}`);
            const fetchedRecipes = response.data;

            // Extract unique categories from recipes
            const extractedCategories = Array.from(
                new Set(
                    fetchedRecipes.flatMap((recipe) =>
                        recipe.recipe
                            .filter((item) => item.key === "קטגוריה")
                            .flatMap((item) => item.value.split(",").map((cat) => cat.trim())) // Split and trim categories
                    )
                )
            );

            setRecipes(fetchedRecipes);
            setFilteredRecipes(fetchedRecipes);
            setCategories(extractedCategories); // Populate the dynamic categories
        } catch (error) {
            console.error("Error fetching recipes:", error);
        }
    };

    const handleSearch = (value) => {
        setSearchValue(value);
        filterRecipes(value, selectedCategories);
    };

    const handleCategoryChange = (selected) => {
        setSelectedCategories(selected);
        filterRecipes(searchValue, selected);
    };

    const filterRecipes = (searchValue, selectedCategories) => {
        const filtered = recipes.filter((recipe) => {
            const matchesSearch =
                recipe.recipe.some(
                    (item) =>
                        (item.key === "כותרת" || item.key === "מרכיבים" || item.key === "הוראות הכנה") &&
                        item.value.toString().includes(searchValue)
                );

            const matchesCategories =
                selectedCategories.length === 0 ||
                selectedCategories.every((cat) =>
                    recipe.recipe.some(
                        (item) =>
                            item.key === "קטגוריה" &&
                            item.value.split(",").map((c) => c.trim()).includes(cat) // Split and trim for filtering
                    )
                );

            return matchesSearch && matchesCategories;
        });

        setFilteredRecipes(filtered);
    };

    return (
        <Box sx={{ padding: "16px" }}>
            <Typography variant="h4" align="center" gutterBottom>
                מתכונים
            </Typography>

            {/* Search Bar */}
            <SearchBar searchValue={searchValue} onSearchChange={handleSearch} />

            {/* Filter Bar */}
            <FilterBar
                categories={categories} // Dynamic categories from fetched recipes
                selectedCategories={selectedCategories}
                onCategoryChange={handleCategoryChange}
            />

            {/* Infinite Scroll */}
            <InfiniteScroll
                dataLength={filteredRecipes.length}
                next={() => {}} // Add pagination if needed
                hasMore={false} // Adjust if implementing pagination
                loader={<Typography align="center">טוען...</Typography>}
            >
                {filteredRecipes.map((recipe, index) => (
                    <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        index={index}
                        onEdit={(id) => console.log("Edit recipe:", id)}
                        onDelete={(id) => console.log("Delete recipe:", id)}
                    />
                ))}
            </InfiniteScroll>
        </Box>
    );
};

export default HomePage;
