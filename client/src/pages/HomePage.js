import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { userAPI, recipeAPI } from "../services/api";
import {jwtDecode} from "jwt-decode";
import RecipeCard from "../components/RecipeCard";
import SearchBar from "../components/SearchBar";
import FilterBar from "../components/FilterBar";
import InfiniteScroll from "react-infinite-scroll-component";
import { Box, Typography, CircularProgress, Button } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import Login from "../components/Login";
import UserMenu from "../components/UserMenu";
import AddRecipe from "../components/AddRecipe";
import { Snackbar } from "@mui/material";
import { Dialog } from "@mui/material";
import MuiAlert from "@mui/material/Alert";




const HomePage = () => {
    const [recipes, setRecipes] = useState([]);
    const [filteredRecipes, setFilteredRecipes] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [searchValue, setSearchValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null); // Decoded user from localStorage
    const [sortType, setSortType] = useState("alphabet"); // "alphabet" or "category"
    const [sortDirection, setSortDirection] = useState("asc"); // "asc" or "desc"

    const [dialogOpen, setDialogOpen] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('success');
    const [deleteTargetId, setDeleteTargetId] = useState(null);
    const [fullscreenMode, setFullscreenMode] = useState(false);

    // Function to save fullscreen preference to localStorage
    const saveFullscreenPreference = (preference) => {
        const data = JSON.parse(localStorage.getItem("recipesMyWay")) || {};
        data.fullscreenMode = preference;
        localStorage.setItem("recipesMyWay", JSON.stringify(data));
    };

    // Custom setter that also saves to localStorage
    const updateFullscreenMode = (value) => {
        setFullscreenMode(value);
        saveFullscreenPreference(value);
    };
    const [fullscreenRecipe, setFullscreenRecipe] = useState(null);
    const [isClosingWithAnimation, setIsClosingWithAnimation] = useState(false);

    const navigate = useNavigate();
    const fetchCalled = useRef(false);

    useEffect(() => {
        const data = JSON.parse(localStorage.getItem("recipesMyWay"));
        // const data={};
        // data.token = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjVkMTJhYjc4MmNiNjA5NjI4NWY2OWU0OGFlYTk5MDc5YmI1OWNiODYiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI4NDk5NDMzNDQ1OTUtN3FsY2NuZWVlMWZtc3NzNGozcDdxYTA1cmw3YnRyaDUuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI4NDk5NDMzNDQ1OTUtN3FsY2NuZWVlMWZtc3NzNGozcDdxYTA1cmw3YnRyaDUuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTA4Mzc0MzkwNzE5NjE4MjEyNzAiLCJlbWFpbCI6InNlYW5hdnJ1dGluQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJuYmYiOjE3Mzk2MzIzODcsIm5hbWUiOiJTZWFuIEF2cnV0aW4iLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jSWljanVLUnd5Sk9iS3JvOGdrV3lsZUFXSnMzMXQwcml3X1E0YUQ0T0VwR1JKYk9yTT1zOTYtYyIsImdpdmVuX25hbWUiOiJTZWFuIiwiZmFtaWx5X25hbWUiOiJBdnJ1dGluIiwiaWF0IjoxNzM5NjMyNjg3LCJleHAiOjE3Mzk2MzYyODcsImp0aSI6IjQ2OWNiM2IyYjJiYTRhMjYwYzJkNzBjZmVhZmZjMzY3MTM3ZmQxZDQifQ.U1m3Tknwf-Bk4kS0YQpjuaMJJcXlLs_X-9XeS_Gf_YGI6JIYGzE3da0Lgta1JpUkZp5HwYspNalitHkGojK_s0xToSjfYaDStv0Gf-2tSZ_9oaapGE2OdMEIKMIcLJrnBrtEdLSFOAvkOGTjNz0TGa8WU2DkvOyKBmcQq7rlmIVmZbJn2rN61issCbPzlJZ-lBy-K7LS3uFfIrhr7f3VZRezn5reP3DwJ1aCOhso9tL5-Nt5QltXNv6-8l9mP6X9sX0H-HYsWEbm7KbVQXTk5n1ZApNI_CmHo8tGombHUKfs_4q1pVCXd-1izxc58FJBy1y28aihJgx8Kad9-sulgg";
        
        // Load fullscreen preference
        if (data?.fullscreenMode !== undefined) {
            setFullscreenMode(data.fullscreenMode);
        }

        if (data?.token) {
            try {
                const decoded = jwtDecode(data.token);
                if (decoded.email_verified) {
                    fetchUser(decoded);
                } 
                else {
                    console.warn("Email not verified");
                    localStorage.removeItem("recipesMyWay");
                }
            } catch (error) {
                console.error("Failed to decode token:", error);
                localStorage.removeItem("recipesMyWay");
            }
        }
    }, []);

    useEffect(() => {
        if (user && !fetchCalled.current) {
            fetchCalled.current = true;
            fetchRecipes(user.email);
        }
    }, [user]);

    const fetchRecipes = async (email) => {
        try {
            setLoading(true);
            setError(null);

            const fetchedRecipeDocs = await recipeAPI.getRecipes(email, (updatedRecipes, currentFilters) => {
                // Background update callback - only called if data actually changed
                console.log('Background update received, updating UI...');
                console.log('Background update - Captured filters:', currentFilters);
                
                const extractedCategories = [...new Set(updatedRecipes.flatMap(item => item.recipe.categories))];
                setRecipes(updatedRecipes);
                setCategories(extractedCategories);
                
                // Apply the captured filters to the new data
                console.log('Background update - Current recipes count:', recipes.length);
                console.log('Background update - Updated recipes count:', updatedRecipes.length);
                
                // Apply the captured filters to the updated recipes
                filterRecipes(currentFilters.searchValue, currentFilters.selectedCategories, updatedRecipes);
                
                // Show toast notification for background update
                setSnackbarMessage("המתכונים עודכנו");
                setSnackbarSeverity('info');
                setSnackbarOpen(true);
            });

            const extractedCategories = [...new Set(fetchedRecipeDocs.flatMap(item => item.recipe.categories))];
            setRecipes(fetchedRecipeDocs);
            setCategories(extractedCategories);
            filterRecipes(searchValue, []); // Apply initial filtering
        } catch (error) {
            setError("לא ניתן להתחבר לשרת. נסה שוב מאוחר יותר.");
            setRecipes([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchUser = async (decoded) => {
        try {
            const userResponse = await userAPI.getUser(decoded.email);
            decoded.hebName=userResponse.given_name+" "+userResponse.family_name;
            decoded.familyMembers = userResponse.familyMembers;
            setUser(decoded);

            const localData = JSON.parse(localStorage.getItem("recipesMyWay"));
            localData.name = userResponse.name;
            localData.familyMembers = userResponse.familyMembers;
            localStorage.setItem("recipesMyWay", JSON.stringify(localData));
        } catch (error) {
            console.error("Error fetching user data", error);
        }
    };

    const handleSearch = (value) => {
        setSearchValue(value);
        window.currentSearchValue = value;
        filterRecipes(value, selectedCategories);
    };

    const handleCategoryChange = (selected) => {
        setSelectedCategories(selected);
        window.currentSelectedCategories = selected;
        filterRecipes(searchValue, selected);
    };

    const filterRecipes = (searchValue, selectedCategories, existingRecipes = null) => {
        if (selectedCategories.length === 0 && searchValue.trim() === "") {
            setFilteredRecipes([]);
            return;
        }

        const recipesToFilter = existingRecipes || recipes;

        const filtered = recipesToFilter.filter((recipeDoc) => {
            const matchesSearch = 
                recipeDoc.recipe.title.includes(searchValue)|| 
                recipeDoc.recipe.ingredients.some(ing => ing.includes(searchValue)) || 
                recipeDoc.recipe.instructions.some(inst => inst.includes(searchValue)); 

            const matchesCategories =
                selectedCategories.length === 0 ||
                selectedCategories.some((cat) =>recipeDoc.recipe.categories.includes(cat));

            return matchesSearch && matchesCategories;
        });

        setFilteredRecipes(filtered);
    };

    const handleNewRecipe = (recipeDoc) => {
        const newRecipes = [recipeDoc, ...recipes];
        const newFilteredRecipes = [recipeDoc, ...filteredRecipes];
        const newCategories = [...new Set(newRecipes.flatMap(item => item.recipe.categories))];

        setRecipes(newRecipes);
        setFilteredRecipes(newFilteredRecipes);
        setCategories(newCategories);
        setSelectedCategories(newCategories);
    };

    const handleRecipeUpdate = (updatedRecipe) => {
        const newRecipes = recipes.map(r => r.id === updatedRecipe.id ? updatedRecipe : r);
        const newFilteredRecipes = filteredRecipes.map(r => r.id === updatedRecipe.id ? updatedRecipe : r);
        const newCategories = [...new Set(newRecipes.flatMap(item => item.recipe.categories))];

        setRecipes(newRecipes);
        setFilteredRecipes(newFilteredRecipes);
        setCategories(newCategories);
        setSelectedCategories(newCategories);


        setRecipes(prev =>
            prev.map(r => r.id === updatedRecipe.id ? updatedRecipe : r)
        );
        setFilteredRecipes(prev =>
            prev.map(r => r.id === updatedRecipe.id ? updatedRecipe : r)
        );
    };

    const handleDeleteClick = (id) => {
        setDeleteTargetId(id);
        setDialogOpen(true);
      };

      const handleConfirmDelete = async () => {
        setDialogOpen(false);
      
        try {
          await recipeAPI.deleteRecipe(deleteTargetId);
          
          const newRecipes = recipes.filter(r => r.id !== deleteTargetId);
          const newFiltered = filteredRecipes.filter(r => r.id !== deleteTargetId);
          const newCategories = [...new Set(newRecipes.flatMap(item => item.recipe.categories))];
      
          setRecipes(newRecipes);
          setFilteredRecipes(newFiltered);
          setCategories(newCategories);
          setSelectedCategories(newCategories);
          setSnackbarMessage("המתכון נמחק בהצלחה.");
          setSnackbarSeverity('success');
          
          // Close fullscreen if the deleted recipe was open
          if (fullscreenRecipe && fullscreenRecipe.id === deleteTargetId) {
              handleCloseFullscreen();
          }
        } catch (err) {
          console.error("Delete error:", err);
          setSnackbarMessage("אירעה שגיאה בעת מחיקת המתכון.");
          setSnackbarSeverity('error');
        } finally {
          setSnackbarOpen(true);
        }
      };

      const handleOpenFullscreen = (recipe) => {
        if (fullscreenMode) {
            setFullscreenRecipe(recipe);
        }
      };

      const handleCloseFullscreen = () => {
        setIsClosingWithAnimation(true);
        // Close fullscreen immediately so main screen appears
        setTimeout(() => {
          setFullscreenRecipe(null);
          setIsClosingWithAnimation(false);
        }, 300); // Wait for animation to complete
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
        <Box sx={{ padding: "8px" }}>
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <Box p={2}>
                    <Typography variant="h6" gutterBottom>?האם למחוק את המתכון</Typography>
                    <Box display="flex" gap={2} mt={2}>
                        <Button onClick={handleConfirmDelete} color="error" variant="contained">מחק</Button>
                        <Button onClick={() => setDialogOpen(false)} color="primary">בטל</Button>
                    </Box>
                </Box>
            </Dialog>

            <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={() => setSnackbarOpen(false)}>
                <MuiAlert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
                    {snackbarMessage}
                </MuiAlert>
            </Snackbar>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>    
                <UserMenu 
                    user={user} 
                    setUser={setUser} 
                    fullscreenMode={fullscreenMode}
                    setFullscreenMode={updateFullscreenMode}
                />
                <Typography
                    variant="h4"
                    align="center"
                    gutterBottom
                    sx={{
                        fontFamily: "'Rubik Vinyl', cursive",
                        fontSize: "2.5rem",
                        direction: "rtl",
                        marginBottom: "0px"
                    }}
                >
                    מתכונים
                </Typography>
                <AddRecipe user={user} onRecipeAdded={handleNewRecipe}/>
            </Box>
            <br></br>

            {!loading && !error && recipes.length > 0 && (!fullscreenRecipe || isClosingWithAnimation) && (
                <>
                    <SearchBar searchValue={searchValue} onSearchChange={handleSearch} />
                    <FilterBar
                        categories={categories}
                        selectedCategories={selectedCategories}
                        onCategoryChange={handleCategoryChange}
                    />
                    {filteredRecipes.length > 0 && (
                        <>
                            <Box sx={{ display: "flex"}}>
                                <Button
                                    variant={sortType === "alphabet" ? "outlined" : "text"}
                                    onClick={() => {
                                    setSortType("alphabet");
                                    setSortDirection(prev => prev === "asc" ? "desc" : "asc");
                                    }}
                                    sx={{ minWidth: "fit-content", padding: "4px 8px" }}
                                >
                                    א,ב {sortType === "alphabet" && (sortDirection === "asc" ? "↓" : "↑")}
                                </Button>

                                <Button
                                    variant={sortType === "category" ? "outlined" : "text"}
                                    onClick={() => setSortType("category")}
                                    sx={{ minWidth: "fit-content", padding: "4px 8px" }}
                                >
                                    לפי קטגוריה
                                </Button>
                            </Box>
                        </>
                    )

                    }
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
                        <Typography variant="body1">בחרו קטגוריה או חפשו מתכון כדי להתחיל</Typography>
                    </Box>
                )}

            {/* Fullscreen Recipe Display */}
            {fullscreenRecipe && (
                <Box
                    sx={{
                        position: "fixed",
                        top: 0, // Complete full screen
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "#f0f8ff", // Match user's preference
                        zIndex: 1300,
                        overflow: "hidden", // Prevent container scrolling
                        animation: isClosingWithAnimation ? "slideOut 0.3s ease-in" : "slideIn 0.3s ease-out",
                        "@keyframes slideIn": {
                            "0%": { transform: "translateY(100%)" },
                            "100%": { transform: "translateY(0)" }
                        },
                        "@keyframes slideOut": {
                            "0%": { transform: "translateY(0)" },
                            "100%": { transform: "translateY(100%)" }
                        }
                    }}
                >
                    <RecipeCard
                        recipeDoc={fullscreenRecipe}
                        user={user}
                        onUpdate={(recipe) => {
                            handleRecipeUpdate(recipe);
                            setFullscreenRecipe(recipe); // Update the fullscreen recipe too
                        }}
                        onDelete={(id) => handleDeleteClick(id)}
                        isFullscreen={true}
                        onCloseFullscreen={handleCloseFullscreen}
                        fullscreenMode={fullscreenMode}
                        onOpenFullscreen={handleOpenFullscreen}
                    />
                </Box>
            )}

            {!loading && !error && filteredRecipes.length > 0 && (!fullscreenRecipe || isClosingWithAnimation) && (
                <InfiniteScroll
                    dataLength={filteredRecipes.length}
                    next={() => {}}
                    hasMore={false}
                    loader={<Typography align="center">טוען...</Typography>}
                >
                {sortType === "alphabet" ? (
                [...filteredRecipes]
                    .sort((a, b) => {
                    const titleA = a.recipe.title;;
                    const titleB = b.recipe.title;;
                    return sortDirection === "asc"
                        ? titleA.localeCompare(titleB)
                        : titleB.localeCompare(titleA);
                    })
                    .map((recipe, index) => (
                    <RecipeCard
                        key={recipe.id}
                        recipeDoc={recipe}
                        user={user}
                        index={index}
                        onUpdate={(recipe) => handleRecipeUpdate(recipe)}
                        onDelete={(id) => handleDeleteClick(id)}
                        isFullscreen={false}
                        onCloseFullscreen={handleCloseFullscreen}
                        fullscreenMode={fullscreenMode}
                        onOpenFullscreen={handleOpenFullscreen}
                    />
                    ))
                ) : (
                categories.map((cat) => {
                    const catRecipes = filteredRecipes.filter((r) => r.recipe.categories.includes(cat));

                    if (catRecipes.length === 0) return null;
                    return (
                    <Box key={cat} sx={{ mt: 4 }}>
                        <Typography variant="h6" sx={{ fontWeight: "bold", borderBottom: "1px solid #ccc", mb: 1 }}>
                        {cat}
                        </Typography>
                        {catRecipes.map((recipe, index) => (
                        <RecipeCard
                            key={recipe.id}
                            recipeDoc={recipe}
                            user={user}
                            onUpdate={(recipe) => handleRecipeUpdate(recipe)}
                            onDelete={(id) => handleDeleteClick(id)}
                            isFullscreen={false}
                            onCloseFullscreen={handleCloseFullscreen}
                            fullscreenMode={fullscreenMode}
                            onOpenFullscreen={handleOpenFullscreen}
                        />
                        ))}
                    </Box>
                    );
                })
                )}

                </InfiniteScroll>
            )}
        </Box>
    );
};

export default HomePage;
