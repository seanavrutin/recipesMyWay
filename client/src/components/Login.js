import React from "react";
import { GoogleLogin } from "@react-oauth/google";
import {jwtDecode} from "jwt-decode";
import { Box, Typography } from "@mui/material";
import { userAPI } from "../services/api";

const Login = () => {
    const handleLoginSuccess = async (credentialResponse) => {
        try {
            const decoded = jwtDecode(credentialResponse.credential);
            if (decoded.email_verified) {
                localStorage.setItem("recipesMyWay", JSON.stringify({token:credentialResponse.credential}));
                await checkIfUserExists(decoded);
                window.location.reload();
            } else {
                alert("Email is not verified. Please verify your email.");
            }
        } catch (error) {
            console.error("Failed to decode token:", error);
            alert("Login failed. Please try again.");
        }
    };

    const checkIfUserExists = async (decoded) => {
        try {
            await userAPI.getUser(decoded.email);
            return;
        } catch (error) {
            if(error.response?.status === 404){
                await userAPI.createUser({
                    userName: decoded.email,
                    given_name: decoded.given_name,
                    family_name: decoded.family_name
                });
            }
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
