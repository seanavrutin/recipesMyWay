const { OAuth2Client } = require('google-auth-library');
const TokenRefreshService = require('../services/TokenRefreshService');

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Initialize token refresh service
const tokenRefreshService = new TokenRefreshService();

/**
 * Authentication middleware for Google ID tokens
 * Validates the token and extracts user information
 */
const authMiddleware = async (req, res, next) => {
    try {
        // 1. Extract token from Authorization header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'No valid authorization header found'
            });
        }
        
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        // 2. Verify the Google ID token
        try {
            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID
            });
            
            // 3. Extract user information from the validated token
            const payload = ticket.getPayload();
            
            // 4. Attach user information to the request object
            req.user = {
                email: payload.email,
                name: payload.name,
                givenName: payload.given_name,
                familyName: payload.family_name,
                picture: payload.picture,
                email_verified: payload.email_verified,
                sub: payload.sub, // Google's unique user ID
                iat: payload.iat, // Token issued at
                exp: payload.exp  // Token expiration
            };
            
            // 5. Continue to the next middleware/route handler
            next();
            
        } catch (tokenError) {
            // Token validation failed - check if it's expired
            if (tokenError.message.includes('Token used too late')) {
                console.log('Token expired, attempting server-side refresh...');
                
                try {
                    // Attempt to refresh the token server-side
                    const newToken = await tokenRefreshService.refreshToken(token);
                    
                    if (newToken) {
                        // Set the new token in response headers for client to pick up
                        res.setHeader('X-New-Token', newToken);
                        res.setHeader('X-Token-Refreshed', 'true');
                        
                        // Continue with the request using the new token
                        const newTicket = await client.verifyIdToken({
                            idToken: newToken,
                            audience: process.env.GOOGLE_CLIENT_ID
                        });
                        
                        const newPayload = newTicket.getPayload();
                        req.user = {
                            email: newPayload.email,
                            name: newPayload.name,
                            givenName: newPayload.given_name,
                            familyName: newPayload.family_name,
                            picture: newPayload.picture,
                            email_verified: newPayload.email_verified,
                            sub: newPayload.sub,
                            iat: newPayload.iat,
                            exp: newPayload.exp
                        };
                        
                        console.log('Token refreshed successfully, continuing request...');
                        next();
                        return;
                    }
                } catch (refreshError) {
                    console.error('Server-side token refresh failed:', refreshError);
                }
            }
            
            // If refresh failed or token is invalid for other reasons, reject
            throw tokenError;
        }
        
    } catch (error) {
        console.error('Token validation failed:', error);
        
        // Handle specific Google Auth errors
        if (error.message.includes('Token used too late')) {
            return res.status(401).json({ 
                error: 'Token expired',
                message: 'Your session has expired. Please log in again.'
            });
        }
        
        if (error.message.includes('Invalid token')) {
            return res.status(401).json({ 
                error: 'Invalid token',
                message: 'Authentication failed. Please log in again.'
            });
        }
        
        // Generic authentication error
        return res.status(401).json({ 
            error: 'Authentication failed',
            message: 'Unable to verify your identity. Please log in again.'
        });
    }
};

module.exports = {
    authMiddleware
};