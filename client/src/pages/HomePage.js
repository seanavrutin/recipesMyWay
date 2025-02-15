import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {jwtDecode} from "jwt-decode";
import RecipeCard from "../components/RecipeCard";
import SearchBar from "../components/SearchBar";
import FilterBar from "../components/FilterBar";
import InfiniteScroll from "react-infinite-scroll-component";
import { Box, Typography, CircularProgress, Button } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import Login from "../components/Login";

const HomePage = () => {
    const [recipes, setRecipes] = useState([]);
    const [filteredRecipes, setFilteredRecipes] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [searchValue, setSearchValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null); // Decoded user from localStorage

    const navigate = useNavigate();
    const fetchCalled = useRef(false);

    useEffect(() => {
        const token = localStorage.getItem("routs_auth");

        if (token) {
            try {
                const decoded = jwtDecode(token);
                if (decoded.email_verified) {
                    setUser(decoded);
                } else {
                    console.warn("Email not verified");
                    localStorage.removeItem("routs_auth");
                }
            } catch (error) {
                console.error("Failed to decode token:", error);
                localStorage.removeItem("routs_auth");
            }
        }
    }, []);

    useEffect(() => {
        if (user && !fetchCalled.current) {
            fetchCalled.current = true;
            fetchRecipes(user.email); // Assuming `email` is used as the identifier
        }
    }, [user]);

    const fetchRecipes = async (email) => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.get(`http://10.100.102.5:3000/api/recipes/${email}`);
            const fetchedRecipes = response.data;

            const extractedCategories = Array.from(
                new Set(
                    fetchedRecipes.flatMap((recipe) =>
                        recipe.recipe
                            .filter((item) => item.key === "קטגוריה")
                            .flatMap((item) => item.value.split(",").map((cat) => cat.trim()))
                    )
                )
            );

            setRecipes(fetchedRecipes);
            setCategories(extractedCategories);
            filterRecipes(searchValue, []); // Apply initial filtering
        } catch (error) {
            setError("לא ניתן להתחבר לשרת. נסה שוב מאוחר יותר.");
            setRecipes([]);
        } finally {
            setLoading(false);
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
        if (selectedCategories.length === 0 && searchValue.trim() === "") {
            setFilteredRecipes([]);
            return;
        }

        const filtered = recipes.filter((recipe) => {
            const matchesSearch =
                recipe.recipe.some(
                    (item) =>
                        (item.key === "כותרת" || item.key === "מרכיבים" || item.key === "הוראות הכנה") &&
                        item.value.toString().includes(searchValue)
                );

            const matchesCategories =
                selectedCategories.length === 0 ||
                selectedCategories.some((cat) =>
                    recipe.recipe.some(
                        (item) =>
                            item.key === "קטגוריה" &&
                            item.value.split(",").map((c) => c.trim()).includes(cat)
                    )
                );

            return matchesSearch && matchesCategories;
        });

        setFilteredRecipes(filtered);
    };

    if (!user) {
        return (
            <Box sx={{ padding: "16px", textAlign: "center" }}>
                <Typography
                    variant="h4"
                    gutterBottom
                    sx={{
                        fontFamily: "'Rubik Vinyl', cursive",
                        fontSize: "2.5rem",
                        direction: "rtl",
                    }}
                >
                    מתכונים
                </Typography>
                <Typography variant="h6" sx={{ marginBottom: "16px" }}>
                    כדי לראות את המתכונים שלך תתחבר לחשבון:
                </Typography>
                <Login />
            </Box>
        );
    }

    return (
        <Box sx={{ padding: "16px" }}>
            <Typography
                variant="h4"
                align="center"
                gutterBottom
                sx={{
                    fontFamily: "'Rubik Vinyl', cursive",
                    fontSize: "2.5rem",
                    direction: "rtl",
                }}
            >
                מתכונים
            </Typography>

            {!loading && !error && recipes.length > 0 && (
                <>
                    <SearchBar searchValue={searchValue} onSearchChange={handleSearch} />
                    <FilterBar
                        categories={categories}
                        selectedCategories={selectedCategories}
                        onCategoryChange={handleCategoryChange}
                    />
                </>
            )}

            {loading && (
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
                    <CircularProgress />
                </Box>
            )}

            {!loading && error && (
                <Box sx={{ textAlign: "center", marginTop: "32px" }}>
                    <ErrorOutlineIcon sx={{ fontSize: "40px", color: "red", marginBottom: "16px" }} />
                    <Typography sx={{ fontSize: "18px", color: "red" }}>{error}</Typography>
                </Box>
            )}

            {!loading && !error && recipes.length === 0 && (
                <Typography
                    align="center"
                    sx={{
                        marginTop: "32px",
                        fontSize: "18px",
                        color: "#555",
                        backgroundColor: "#f7f7f7",
                        padding: "16px",
                        borderRadius: "8px",
                    }}
                >
                    למשתמש "{user.email}" אין מתכונים.
                </Typography>
            )}

            {!loading &&
                !error &&
                recipes.length > 0 &&
                filteredRecipes.length === 0 &&
                selectedCategories.length === 0 &&
                searchValue.trim() === "" && (
                    <Box
                        sx={{
                            textAlign: "center",
                            marginTop: "32px",
                            fontSize: "18px",
                            color: "#555",
                            backgroundColor: "#f0f8ff",
                            padding: "16px",
                            borderRadius: "8px",
                            boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
                        }}
                    >
                        <Typography variant="h6" sx={{ marginBottom: "8px", fontWeight: "bold" }}>
                            נתחיל לבשל?
                        </Typography>
                        <Typography variant="body1">בחר קטגוריה או חפש מתכון כדי להתחיל</Typography>
                    </Box>
                )}

            {!loading && !error && filteredRecipes.length > 0 && (
                <InfiniteScroll
                    dataLength={filteredRecipes.length}
                    next={() => {}} // Add pagination if needed
                    hasMore={false}
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
            )}
        </Box>
    );
};

export default HomePage;
