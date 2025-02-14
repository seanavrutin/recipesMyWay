import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import RecipeCard from "../components/RecipeCard";
import SearchBar from "../components/SearchBar";
import FilterBar from "../components/FilterBar";
import InfiniteScroll from "react-infinite-scroll-component";
import { Box, Typography, CircularProgress, Button } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

const HomePage = () => {
    const [recipes, setRecipes] = useState([]);
    const [filteredRecipes, setFilteredRecipes] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [searchValue, setSearchValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [phoneNumber, setPhoneNumber] = useState("972"); // Initial 972 for Israel
    const fetchCalled = useRef(false);

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const userId = searchParams.get("userId");

    useEffect(() => {
        if (userId && !fetchCalled.current) {
            fetchCalled.current = true;
            fetchRecipes(userId);
        }
    }, [userId]);

    const fetchRecipes = async (userId) => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.get(`http://10.100.102.5:3000/api/recipes/${userId}`);
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
            filterRecipes(searchValue, []);
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

    const handlePhoneNumberChange = (e) => {
        const input = e.target.value.replace(/\D/g, ""); // Remove non-numeric characters
        setPhoneNumber("972" + input.slice(0, 9)); // Limit to 9 digits after "972"
    };

    const handleLogin = () => {
        if (phoneNumber.length !== 12) {
            setError("מספר הפלאפון צריך להיות באורך 9 ספרות לאחר הקידומת.");
            return;
        }
        setError(null);
        navigate(`/?userId=${phoneNumber}`);
        window.location.reload(); // Reload to apply query params
    };

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

            {!userId && (
                <Box sx={{ textAlign: "center", marginTop: "32px" }}>
                    <Typography variant="h6" sx={{ marginBottom: "16px" }}>
                        שלום לך! כדי לראות מתכונים, התחבר עם מספר הפלאפון שלך
                    </Typography>
                    <Box
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            marginBottom: "16px",
                            position: "relative",
                            direction: "ltr", // Force LTR
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: "1.5rem",
                                fontWeight: "bold",
                                marginLeft: "8px",
                            }}
                        >
                            972
                        </Typography>
                        <Box
                            style={{
                                fontSize: "1.5rem",
                                fontFamily: "monospace",
                                display: "flex",
                                gap: "8px",
                                alignItems: "center",
                                border: "1px solid #ccc",
                                padding: "8px",
                                borderRadius: "4px",
                                position: "relative",
                                width: "fit-content",
                                direction: "ltr",
                            }}
                        >
                            <input
                                type="text"
                                value={phoneNumber.slice(3)}
                                onChange={handlePhoneNumberChange}
                                maxLength={9}
                                inputMode="numeric"
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: "100%",
                                    opacity: 0,
                                    cursor: "text",
                                    direction: "ltr",
                                }}
                            />
                            {[...Array(9)].map((_, index) => (
                                <span
                                    key={index}
                                    style={{
                                        width: "1.5rem",
                                        textAlign: "center",
                                        borderBottom: phoneNumber.slice(3)[index] ? "none" : "1px solid #000",
                                        cursor: "text",
                                    }}
                                >
                                    {phoneNumber.slice(3)[index] || "_"}
                                </span>
                            ))}
                        </Box>
                    </Box>
                    <Button
                        variant="outlined"
                        onClick={handleLogin}
                        sx={{
                            borderColor: "#007bff",
                            color: "#007bff",
                            "&:hover": {
                                backgroundColor: "#e6f2ff",
                                borderColor: "#0056b3",
                            },
                        }}
                    >
                        התחבר
                    </Button>
                    {error && (
                        <Typography
                            sx={{
                                marginTop: "16px",
                                color: "red",
                                fontSize: "14px",
                            }}
                        >
                            {error}
                        </Typography>
                    )}
                </Box>
            )}

            {userId && (
                <>
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
                            למשתמש "{userId}" אין מתכונים.
                        </Typography>
                    )}

                    {!loading &&
                        !error &&
                        recipes.length > 0 &&
                        filteredRecipes.length === 0 &&
                        selectedCategories.length > 0 && (
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
                                אין מתכונים שתואמים את הסינון הנבחר.
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
                    )}
                </>
            )}
        </Box>
    );
};

export default HomePage;
