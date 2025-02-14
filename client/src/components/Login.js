import React, { useState, useEffect } from "react";
import { Box, Button, Typography } from "@mui/material";

const Login = ({ onLogin }) => {
    const [phoneNumber, setPhoneNumber] = useState("");
    const [showBlinker, setShowBlinker] = useState(true);

    const handlePhoneNumberChange = (event) => {
        const input = event.target.value.replace(/\D/g, ""); // Remove non-digit characters
        if (input.length <= 9) {
            setPhoneNumber(input);
        }
    };

    // Toggle the blinking cursor
    useEffect(() => {
        const interval = setInterval(() => {
            setShowBlinker((prev) => !prev);
        }, 500);
        return () => clearInterval(interval);
    }, []);

    const handleLogin = () => {
        if (phoneNumber.length !== 9) {
            alert("מספר הטלפון חייב להיות בן 9 ספרות");
        } else {
            onLogin(`972${phoneNumber}`);
        }
    };

    return (
        <Box sx={{ textAlign: "center", marginTop: "50px" }}>
            <Typography
                variant="h6"
                sx={{
                    fontSize: "18px",
                    marginBottom: "16px",
                    fontWeight: "bold",
                }}
            >
                שלום לך! כדי לראות מתכונים, התחבר עם מספר הפאלפון שלך
            </Typography>

            <Box
                style={{
                    fontSize: "1.5rem",
                    fontFamily: "monospace",
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid #ccc",
                    padding: "8px",
                    borderRadius: "4px",
                    width: "fit-content",
                    margin: "0 auto",
                    direction: "ltr", // Ensure left-to-right alignment for numbers
                    backgroundColor: "#f9f9f9",
                }}
            >
                <Typography variant="body1" style={{ fontWeight: "bold" }}>
                    972
                </Typography>
                {[...Array(9)].map((_, index) => (
                    <span
                        key={index}
                        style={{
                            width: "1.5rem",
                            textAlign: "center",
                            borderBottom: "1px solid #000",
                            fontSize: "1.5rem",
                            fontFamily: "monospace",
                            position: "relative",
                        }}
                    >
                        {phoneNumber[index] || ""}
                        {showBlinker && phoneNumber.length === index && (
                            <span
                                style={{
                                    position: "absolute",
                                    width: "1px",
                                    height: "1.5rem",
                                    backgroundColor: "#000",
                                    animation: "blinker 1s step-start infinite",
                                    top: 0,
                                    bottom: 0,
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                }}
                            ></span>
                        )}
                    </span>
                ))}
            </Box>

            <Button
                variant="outlined"
                onClick={handleLogin}
                sx={{ marginTop: "16px", padding: "8px 16px" }}
            >
                התחבר
            </Button>
        </Box>
    );
};

export default Login;
