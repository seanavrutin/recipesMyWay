import React, { useState } from "react";
import {
    Box,
    IconButton,
    TextField,
    Button,
    Typography,
    Slide,
    CircularProgress,
    Backdrop,
    Grid,ButtonBase
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import { Snackbar } from "@mui/material";
import axios from "axios";
import MuiAlert from "@mui/material/Alert";

import TextFieldsIcon from '@mui/icons-material/TextFields';
import LinkIcon from '@mui/icons-material/Link';
import ImageIcon from '@mui/icons-material/Image';
import InstagramIcon from '@mui/icons-material/Instagram';
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';




const AddRecipe = ({ user,onRecipeAdded }) => {
    const [open, setOpen] = useState(false);
    const [recipeText, setRecipeText] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [finishedLoading, setFinishedLoading] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [selectedInputMethod, setSelectedInputMethod] = useState("text");
    const [linkUrl, setLinkUrl] = useState(null);
    const [linkInstagram, setLinkInstagram] = useState(null);

    const handleToggle = () => {
        setOpen(!open);
        resetState();
    };

    const handleClose = () => {
        setOpen(false);
        resetState();
    };

    const resetState = () => {
        setRecipeText("");
        setSelectedInputMethod("text");
        setLinkUrl(null);
        setLinkInstagram(null);
        setImageFile(null);
        setLoading(false);
        setSuccess(false);
        setFinishedLoading(false);
    };

    const handleCreate = async () => {
        setLoading(true);
        setSuccess(false);

        const SERVER = process.env.REACT_APP_SERVER_ADDRESS;
        try{
            const formData = new FormData();
            formData.append("userName", user.email);
            if(recipeText){
                formData.append("text", recipeText);
            }
            if(linkUrl && selectedInputMethod == "link"){
                formData.append("url", linkUrl);
            }
            if(linkUrl && selectedInputMethod == "instagram"){
                formData.append("url", linkInstagram);
            }
            if (imageFile && selectedInputMethod == "image") {
              formData.append("image", imageFile);
            }
            
            let response = await axios.post(`${SERVER}/api/recipes`, formData, {
              headers: {
                "Content-Type": "multipart/form-data"
              }
            });
            
            onRecipeAdded(response.data);
            setLoading(false);
            setSuccess(true);
            setSnackbarOpen(true);
            handleClose();
        }
        catch(error){
            if(error?.response?.data?.error){
                setErrorMessage(error.response.data.error);
            }
            console.log(error);
            setLoading(false);
            setSuccess(false);
            setFinishedLoading(true);
        }
    };

    return (
        <Box>
            <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={() => setSnackbarOpen(false)}>
                <MuiAlert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
                    המתכון נוצר בהצלחה
                </MuiAlert>
            </Snackbar>
            {/* "+" Button to open menu */}
            <IconButton onClick={handleToggle}>
                <AddIcon fontSize="large" />
            </IconButton>

            {/* Background Blur Effect */}
            <Backdrop open={open} sx={{ zIndex: 1200, backdropFilter: "blur(4px)",backgroundColor: "rgba(0, 0, 0, 0.3)" }} onClick={handleClose} />

            {/* Sliding Down Menu */}
            <Slide direction="down" in={open} mountOnEnter unmountOnExit>
                <Box
                    sx={{
                        position: "absolute",
                        top: "60px",
                        left: 0,
                        right: 0,
                        backgroundColor: "#f0f8ff",
                        padding: "16px",
                        boxShadow: 3,
                        borderRadius: "8px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                        zIndex: 1301,
                    }}
                    onClick={(e) => e.stopPropagation()} // Prevent clicking inside from closing the menu
                >
                    {/* Close "X" Button (Top Right) */}
                    <IconButton
                        onClick={handleClose}
                        sx={{ position: "absolute", top: "0px", left: "0px", color: "#555" }}
                    >
                        <CloseIcon sx={{ fontSize: "1.2rem" }}/>
                    </IconButton>
                    <div></div>

                    <Grid container spacing={1} justifyContent="center" sx={{ width:"90%" }}> 
                    {[
                        { label: "טקסט חופשי", type: "text", icon: <TextFieldsIcon /> },
                        { label: "קישור לאתר", type: "link", icon: <LinkIcon /> },
                        { label: "תמונה של מתכון", type: "image", icon: <ImageIcon /> },
                        { label: "קישור לריל באינסטגרם", type: "instagram", icon: <InstagramIcon /> },
                    ].map((option, i) => (
                        <Grid item xs={3} key={i}>
                        <ButtonBase
                            sx={{
                                width: "100%",
                                border: "1px solid #ccc",
                                borderRadius: 2,
                                padding: "8px 4px",
                                flexDirection: "column",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "70px",
                                gap: "4px",
                                backgroundColor: selectedInputMethod === option.type ? "#cde4ff" : "#fff",
                                '&:hover': {
                                    backgroundColor: selectedInputMethod === option.type ? "#bbd9ff" : "#e8e8e8"
                                }
                            }}
                            variant={selectedInputMethod === option.type ? "contained" : "outlined"}
                            onClick={() => {
                                setSelectedInputMethod(option.type);
                                if (option.type === "image") {
                                    document.getElementById("imageUploadInput")?.click();
                                }
                            }}
                        >
                            {option.icon}
                            <Typography variant="body2" sx={{ fontSize: "0.75rem" }}>
                                {option.label}
                            </Typography>
                        </ButtonBase>
                        </Grid>
                    ))}
                    </Grid>
                    <input
                        type="file"
                        accept="image/*"
                        id="imageUploadInput"
                        style={{ display: "none" }}
                        onChange={(e) => setImageFile(e.target.files?.[0])}
                    />

                    {selectedInputMethod === "text" && (
                        <TextField
                            fullWidth
                            multiline
                            minRows={4}
                            placeholder="הקלד כאן את המתכון..."
                            value={recipeText}
                            onChange={(e) => setRecipeText(e.target.value)}
                            sx={{ backgroundColor: "white", borderRadius: "4px", width: "90%" }}
                        />
                    )}
                    {selectedInputMethod === "link" && (
                        <Box sx={{ width: "90%", display: "flex", flexDirection: "column", gap: 1 }}>
                        <TextField
                            sx={{ backgroundColor: "white", borderRadius: "4px", width: "90%" }}
                            fullWidth
                            multiline
                            minRows={2}
                            placeholder="הדבק את הקישור כאן"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                        />
                        <TextField
                            sx={{ backgroundColor: "white", borderRadius: "4px", width: "90%" }}
                            fullWidth
                            multiline
                            minRows={2}
                            placeholder="טקסט נוסף (אופציונלי)"
                            value={recipeText}
                            onChange={(e) => setRecipeText(e.target.value)}
                        />
                    </Box>
                    )}

                    {selectedInputMethod === "instagram" && (
                        <Box sx={{ width: "90%", display: "flex", flexDirection: "column", gap: 1 }}>
                            <TextField
                                sx={{ backgroundColor: "white", borderRadius: "4px", width: "90%" }}
                                fullWidth
                                multiline
                                minRows={2}
                                placeholder="הדבק את הקישור כאן"
                                value={linkInstagram}
                                onChange={(e) => setLinkInstagram(e.target.value)}
                            />
                            <TextField
                                sx={{ backgroundColor: "white", borderRadius: "4px", width: "90%" }}
                                fullWidth
                                multiline
                                minRows={2}
                                placeholder="טקסט נוסף (אופציונלי)"
                                value={recipeText}
                                onChange={(e) => setRecipeText(e.target.value)}
                            />
                        </Box>
                    )}

                    {selectedInputMethod === "image" && imageFile && (
                        <Box sx={{ width: "90%", display: "flex", flexDirection: "column", gap: 1 }}>
                            <Typography variant="caption">✔ תמונה עלתה בהצלחה: {imageFile.name}</Typography>
                            <TextField
                                sx={{ backgroundColor: "white", borderRadius: "4px", width: "90%" }}
                                fullWidth
                                multiline
                                minRows={2}
                                placeholder="טקסט נוסף (אופציונלי)"
                                value={recipeText}
                                onChange={(e) => setRecipeText(e.target.value)}
                            />
                        </Box>
                    )}
                    <Box sx={{ width: "80%", display: "flex", justifyContent: "space-between" }}>
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={handleClose}
                            startIcon={<CloseIcon />}
                            sx={{ borderColor: "#ccc", color: "#666" }}
                        >
                            ביטול
                        </Button>
                        <Button
                            variant="outlined"
                            color="primary"
                            onClick={handleCreate}
                            startIcon={<SendIcon />}
                            disabled={loading}
                            sx={{ borderColor: "#aaa", color: "#333" }}
                        >
                            יצירה
                        </Button>
                    </Box>

                    {/* Loading Animation */}
                    {loading && (
                        <Box sx={{ marginTop: 2 }}>
                            <CircularProgress size={24} />
                            {/* <Typography variant="body2" sx={{ marginTop: 1 }}>יוצר מתכון...</Typography> */}
                        </Box>
                    )}

                    {!success && finishedLoading && (
                        <Box sx={{ marginTop: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <Typography variant="body2" sx={{ fontWeight: "bold", marginTop: 1, color: "red" }}>
                            {errorMessage !== '' ? errorMessage : 'תקלה בשמירת המתכון, נסה שוב'}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Slide>
        </Box>
    );
};

export default AddRecipe;
