import axios from 'axios';

// Base configuration
const SERVER = process.env.REACT_APP_SERVER_ADDRESS;

// Create axios instance with base configuration
const api = axios.create({
    baseURL: SERVER,
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for adding auth tokens if needed
api.interceptors.request.use(
    (config) => {
        // You can add auth token here if needed in the future
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for consistent error handling
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        console.error('API Error:', error);
        return Promise.reject(error);
    }
);

// Cache management functions
const CACHE_KEY = 'recipesMyWay';

const getLocalStorageData = () => {
    try {
        const data = localStorage.getItem(CACHE_KEY);
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return {};
    }
};

const setLocalStorageData = (data) => {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('Error writing to localStorage:', error);
    }
};

const getCachedRecipes = (email) => {
    const data = getLocalStorageData();
    const cached = data.cachedRecipes;
    
    if (!cached || cached.userEmail !== email) {
        return null;
    }
    
    return cached.recipes;
};

const setCachedRecipes = (email, recipes) => {
    const data = getLocalStorageData();
    data.cachedRecipes = {
        userEmail: email,
        recipes: recipes,
        lastUpdated: new Date().toISOString(),
        categories: [...new Set(recipes.flatMap(item => item.recipe.categories))]
    };
    setLocalStorageData(data);
};



// Deep comparison function for recipes
const areRecipesEqual = (recipes1, recipes2) => {
    if (!recipes1 || !recipes2) return false;
    if (recipes1.length !== recipes2.length) return false;
    
    // Create maps for efficient comparison
    const map1 = new Map(recipes1.map(r => [r.id, r]));
    const map2 = new Map(recipes2.map(r => [r.id, r]));
    
    // Check if all recipes exist and are identical
    for (const [id, recipe1] of map1) {
        const recipe2 = map2.get(id);
        if (!recipe2) return false;
        
        // Deep compare recipe objects
        if (JSON.stringify(recipe1) !== JSON.stringify(recipe2)) {
            return false;
        }
    }
    
    return true;
};

// User API functions
export const userAPI = {
    // Get user by email
    getUser: async (email) => {
        try {
            const response = await api.get(`/api/user/${email}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    // Create new user
    createUser: async (userData) => {
        try {
            const response = await api.post('/api/user', userData);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    // Update user family
    updateUserFamily: async (familyData) => {
        try {
            const response = await api.put('/api/user/family', familyData);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    // Delete family member
    deleteFamilyMember: async (memberEmail) => {
        try {
            const response = await api.post('/api/user/deleteFamily', { memberEmail });
            return response.data;
        } catch (error) {
            throw error;
        }
    },
};

// Recipe API functions with caching
export const recipeAPI = {
    // Get recipes by user email (with caching)
    getRecipes: async (email, onBackgroundUpdate = null) => {
        try {
            // First, try to get from cache
            const cachedRecipes = getCachedRecipes(email);
            
            if (cachedRecipes) {
                // Return cached data immediately
                console.log('Returning cached recipes');
                
                // Start background sync
                setTimeout(async () => {
                    try {
                        const serverRecipes = await api.get(`/api/recipes/${email}`);
                        const serverData = serverRecipes.data;
                        
                        // Compare with cache
                        if (!areRecipesEqual(cachedRecipes, serverData)) {
                            console.log('Cache differs from server, updating...');
                            setCachedRecipes(email, serverData);
                            
                            // Capture current filters right before the merge
                            const currentFilters = {
                                searchValue: window.currentSearchValue || "",
                                selectedCategories: window.currentSelectedCategories || []
                            };
                            
                            // Notify about background update with captured filters
                            if (onBackgroundUpdate) {
                                onBackgroundUpdate(serverData, currentFilters);
                            }
                        } else {
                            console.log('Cache is up to date');
                        }
                    } catch (error) {
                        console.error('Background sync failed:', error);
                        // Don't show error to user - they already have cached data
                    }
                }, 100); // Small delay to ensure UI renders first
                
                return cachedRecipes;
            }
            
            // No cache available, fetch from server
            console.log('No cache available, fetching from server');
            const response = await api.get(`/api/recipes/${email}`);
            const serverData = response.data;
            
            // Cache the fresh data
            setCachedRecipes(email, serverData);
            
            return serverData;
        } catch (error) {
            throw error;
        }
    },

    // Create new recipe
    createRecipe: async (formData) => {
        try {
            const response = await api.post('/api/recipes', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            
            // Let background sync handle all updates naturally
            
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    // Update existing recipe
    updateRecipe: async (recipeData) => {
        try {
            const response = await api.post('/api/updateRecipe', recipeData);
            
            // Let background sync handle all updates naturally
            
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    // Delete recipe
    deleteRecipe: async (recipeId) => {
        try {
            const response = await api.delete(`/api/recipes/${recipeId}`);
            
            // Let background sync handle all updates naturally
            
            return response.data;
        } catch (error) {
            throw error;
        }
    },
};

// Family API functions
export const familyAPI = {
    // Add family member
    addFamilyMember: async (memberEmail) => {
        try {
            const response = await api.get(`/api/user/${memberEmail}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    // Remove family member
    removeFamilyMember: async (memberEmail) => {
        try {
            const response = await api.post('/api/user/deleteFamily', { memberEmail });
            return response.data;
        } catch (error) {
            throw error;
        }
    },
};

// Export cache management functions for external use
export const cacheAPI = {
    getCachedRecipes,
    setCachedRecipes,
    areRecipesEqual,
    // Debug function to check cache status
    getCacheStatus: (email) => {
        const data = getLocalStorageData();
        const cached = data.cachedRecipes;
        if (!cached || cached.userEmail !== email) {
            return { hasCache: false };
        }
        return {
            hasCache: true,
            lastUpdated: cached.lastUpdated,
            recipeCount: cached.recipes?.length || 0
        };
    }
};

// Export the base api instance for custom calls if needed
export { api };

// Export default for backward compatibility
export default {
    userAPI,
    recipeAPI,
    familyAPI,
    cacheAPI,
    api,
};
