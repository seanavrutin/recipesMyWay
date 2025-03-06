import React from "react";
import { GoogleLogin } from "@react-oauth/google";
import {jwtDecode} from "jwt-decode";
import { Box, Typography } from "@mui/material";
import axios from "axios";

const Login = () => {
    const handleLoginSuccess = (credentialResponse) => {
        try {
            const decoded = jwtDecode(credentialResponse.credential);
            if (decoded.email_verified) {
                localStorage.setItem("recipesMyWay", JSON.stringify({token:credentialResponse.credential}));
                checkIfUserExists(decoded);
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
        const SERVER = process.env.REACT_APP_SERVER_ADDRESS;
        try {
            const userData = await axios.get(`${SERVER}/api/user/${decoded.email}`);
            if(userData.status == 200){
                return;
            }
        } catch (error) {
            if(error.status == 404){
                await axios.post(`${SERVER}/api/user`, {
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
