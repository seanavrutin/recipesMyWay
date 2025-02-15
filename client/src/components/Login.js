import React from "react";
import { GoogleLogin } from "@react-oauth/google";
import {jwtDecode} from "jwt-decode";
import { Box, Typography } from "@mui/material";

const Login = ({ onSuccess }) => {
    const handleLoginSuccess = (credentialResponse) => {
        try {
            const decoded = jwtDecode(credentialResponse.credential);
            if (decoded.email_verified) {
                localStorage.setItem("routs_auth", credentialResponse.credential);
                onSuccess(decoded); // Pass the decoded data back to the parent
            } else {
                alert("Email is not verified. Please verify your email.");
            }
        } catch (error) {
            console.error("Failed to decode token:", error);
            alert("Login failed. Please try again.");
        }
    };

    const handleLoginError = () => {
        alert("Login failed. Please try again.");
    };

    return (
        <Box sx={{ textAlign: "center", marginTop: "32px" }}>
            <GoogleLogin
                onSuccess={handleLoginSuccess}
                onError={handleLoginError}
            />
        </Box>
    );
};

export default Login;
