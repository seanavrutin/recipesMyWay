import { jwtDecode } from 'jwt-decode';

class AuthService {
    constructor() {
        this.CACHE_KEY = 'recipesMyWay';
        this.isRefreshing = false;
        this.refreshPromise = null;
    }

    // Get current auth data from localStorage
    getAuthData() {
        try {
            const data = localStorage.getItem(this.CACHE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('Failed to get auth data:', error);
            return null;
        }
    }

    // Get current token
    getToken() {
        const authData = this.getAuthData();
        return authData?.token || null;
    }

    // Check if user is authenticated
    isAuthenticated() {
        const token = this.getToken();
        return !!token;
    }

    // Check if token is expiring soon (within 15 minutes)
    isTokenExpiringSoon() {
        try {
            const token = this.getToken();
            if (!token) return false;

            const decoded = jwtDecode(token);
            const now = Math.floor(Date.now() / 1000);
            const timeUntilExpiry = decoded.exp - now;
            
            // Return true if token expires in next 15 minutes
            return timeUntilExpiry < 9000; // 15 minutes = 900 seconds
        } catch (error) {
            console.warn('Error checking token expiry:', error);
            return false;
        }
    }

    // Get user info from token
    getUserInfo() {
        try {
            const token = this.getToken();
            if (!token) return null;

            const decoded = jwtDecode(token);
            return {
                email: decoded.email,
                name: decoded.name,
                givenName: decoded.given_name,
                familyName: decoded.family_name,
                picture: decoded.picture,
                email_verified: decoded.email_verified,
                sub: decoded.sub
            };
        } catch (error) {
            console.warn('Failed to decode user info from token:', error);
            return null;
        }
    }

    // Store auth data
    setAuthData(authData) {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(authData));
        } catch (error) {
            console.warn('Failed to store auth data:', error);
        }
    }

    // Store token
    setToken(token) {
        const authData = this.getAuthData() || {};
        authData.token = token;
        this.setAuthData(authData);
    }

    // Clear auth data (logout)
    clearAuth() {
        try {
            localStorage.removeItem(this.CACHE_KEY);
        } catch (error) {
            console.warn('Failed to clear auth data:', error);
        }
    }

    // Token refresh is now handled server-side
    // Client just sends the current token and server handles refresh if needed

    // Check if token is expiring soon (for server-side refresh)
    async checkAndRefreshTokenIfNeeded() {
        // Token refresh is now handled server-side
        // This method is kept for compatibility but doesn't do client-side refresh
        return false;
    }

    // Handle authentication errors
    handleAuthError(error) {
        if (error.response?.status === 401) {
            const errorMessage = error.response?.data?.error;
            
            if (errorMessage === 'Token expired' || errorMessage === 'Authentication failed') {
                console.warn('Authentication failed - clearing invalid token');
                this.clearAuth();
                // Optionally redirect to login or reload
                window.location.reload();
            }
        }
    }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;