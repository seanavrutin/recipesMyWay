import React, { useState,useEffect } from "react";
import {
    Box,
    IconButton,
    Menu,
    MenuItem,
    Chip,
    Avatar,
    Slider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Badge,
    CircularProgress,
    Checkbox,
    FormControlLabel
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";
import { useFontSize } from "../context/FontSizeContext";
import { userAPI, familyAPI } from "../services/api";


const UserMenu = ({ user,setUser, fullscreenMode, setFullscreenMode }) => {
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [fontSizeOpen, setFontSizeOpen] = useState(false);
    const { fontSize, setFontSize } = useFontSize(); // Restore Font Size Control
    const [familyModalOpen, setFamilyModalOpen] = useState(false);
    const [newMemberEmail, setNewMemberEmail] = useState("");
    const [loadingFamily, setLoadingFamily] = useState(false);
    const [errorFamily, setErrorFamily] = useState(false);
    const [pendingRequests, setPendingRequests] = useState([]);


    const handleMenuOpen = (event) => setMenuAnchor(event.currentTarget);
    const handleMenuClose = () => {
        setMenuAnchor(null);
        setFontSizeOpen(false); // Close font size slider when closing menu
    };
    const handleFontSizeToggle = () => setFontSizeOpen(!fontSizeOpen);

    const handleFamilyModalOpen = () => {
        setFamilyModalOpen(true);
        handleMenuClose();
    };

    const handleFamilyModalClose = () => setFamilyModalOpen(false);

    const getStatusIcon = (status) => {
        if (status === "true") return <CheckCircleIcon sx={{ color: "green", fontSize: "1rem", ml: 1 }} />;
        if (status === "pending") return <HourglassEmptyIcon sx={{ color: "orange", fontSize: "1rem", ml: 1 }} />;
        return <CancelIcon sx={{ color: "red", fontSize: "1rem", ml: 1 }} />;
    };

    const handleRemoveFamilyMember = async (email) => {
        setUser(prevUser => ({
            ...prevUser,
            familyMembers: prevUser.familyMembers.filter(member => member.memberName !== email)
        }));

        setErrorFamily("");
        try {
            setLoadingFamily(true);
            await userAPI.deleteFamilyMember({
                mainUser: user.email,
                modifiedFamilyMember: email,
            });
            await userAPI.deleteFamilyMember({
                mainUser: email,
                modifiedFamilyMember: user.email,
            });
        } catch (error) {
            console.error("Error removing family member:", error);
            setErrorFamily("שגיאה בהסרת בן משפחה. נסה שוב.");
        }
        finally {
            setLoadingFamily(false);
        }
    };
    const handleAddFamilyMember = async () => {
        if (!newMemberEmail.trim()) return;
        setLoadingFamily(true);
        setErrorFamily("");

        try {
            await familyAPI.addFamilyMember(newMemberEmail);

            // Simulating API call to add family member
            const newMember = { memberName: newMemberEmail, allowedToSeeMyRecipes: "true", allowedToSeeTheirRecipes: "pending" };

            setUser(prevUser => ({
                ...prevUser,
                familyMembers: [...prevUser.familyMembers, newMember]
            }));

            await userAPI.updateUserFamily({
                mainUser: user.email,
                modifiedFamilyMember: newMemberEmail,
                allowedToSeeMyRecipes: "true",
                allowedToSeeTheirRecipes: "pending"
            });

            await userAPI.updateUserFamily({
                mainUser: newMemberEmail,
                modifiedFamilyMember: user.email,
                allowedToSeeMyRecipes: "pending",
                allowedToSeeTheirRecipes: "true"
            });

            setNewMemberEmail("");
        } catch (error) {
            if(error.response?.status === 404){
                setErrorFamily("האימייל לא נמצא במערכת.");
            }
            else{
                console.error("Error adding family member:", error);
                setErrorFamily("שגיאה בהוספת בן משפחה. נסה שוב.");
            }
        } finally {
            setLoadingFamily(false);
        }
    };

    const handlePendingRequest = async (email,status) => {
        try {
            await userAPI.updateUserFamily({
                mainUser: user.email,
                modifiedFamilyMember: email,
                allowedToSeeMyRecipes: status,
                allowedToSeeTheirRecipes: status
            });

            await userAPI.updateUserFamily({
                mainUser: email,
                modifiedFamilyMember: user.email,
                allowedToSeeMyRecipes: status,
                allowedToSeeTheirRecipes: status
            });

            setUser(prevUser => ({
                ...prevUser,
                familyMembers: prevUser.familyMembers.map(member => 
                    member.memberName === email ? { ...member, allowedToSeeMyRecipes: "true" } : member
                )
            }));

            // setPendingRequests(pendingRequests.filter(member => member.memberName !== email));
        } catch (error) {
            console.error("Error approving request:", error);
        }
    };

    useEffect(() => {
        setPendingRequests(user.familyMembers?.filter(member => member.allowedToSeeMyRecipes === "pending") || []);
    }, [user]);

    return (
        <Box>
            {/* Profile Button */}
            <IconButton onClick={handleMenuOpen}>
                <Badge
                    color="warning"
                    variant="dot"
                    invisible={pendingRequests.length === 0}
                >
                    <Avatar src={user?.picture} alt={user?.name} />
                </Badge>
            </IconButton>

            {/* Dropdown Menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleMenuClose}
                sx={{
                    direction: "rtl", // Ensure RTL alignment
                    "& .MuiPaper-root": {
                        backgroundColor: "#f0f8ff", // Match AddRecipeMenu background
                        minWidth: 150,
                        boxShadow: 3,
                        borderRadius: "8px",
                        padding: "0 0" // Reduce vertical spacing
                    }
                }}
            >
                <Box>
                {/* User Name */}
                <MenuItem disabled sx={{ fontWeight: "bold", justifyContent: "left", minHeight: "5px" }}>
                    {user.hebName}
                </MenuItem>
                <hr sx={{ backgroundColor: "#ccc" }}></hr>

                {/* My Family */}
                <MenuItem onClick={handleFamilyModalOpen} sx={{ justifyContent: "left", minHeight: "5px"}}>
                    המשפחה שלי
                </MenuItem>
                {/* <hr sx={{ backgroundColor: "#ccc" }}></hr> */}

                {/* Change Font Size */}
                <MenuItem onClick={handleFontSizeToggle} sx={{ justifyContent: "left", minHeight: "5px"}}>
                    שינוי גודל גופן
                </MenuItem>

                {/* Font Size Slider (Appears inside menu when toggled) */}
                {fontSizeOpen && (
                    <Box sx={{ px: 2, width: "90%", margin: "8px auto" }}>
                        <Slider
                            value={fontSize}
                            min={12}
                            max={32}
                            step={1}
                            onChange={(e, newValue) => setFontSize(newValue)}
                        />
                    </Box>
                )}

                {/* Fullscreen Recipe Mode Toggle */}
                <MenuItem sx={{ minHeight: "5px", padding: 0 }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={fullscreenMode}
                                onChange={(e) => setFullscreenMode(e.target.checked)}
                                size="small"
                            />
                        }
                        label="מתכון במסך מלא"
                        sx={{ fontSize: "0.875rem", margin: 0 }}
                    />
                </MenuItem>
                <MenuItem onClick={() => {localStorage.removeItem("recipesMyWay"); window.location.reload();}} sx={{ justifyContent: "left", minHeight: "5px"}}>
                    התנתק
                </MenuItem>
                {pendingRequests.length > 0 && (
                    <>
                        <hr sx={{ backgroundColor: "#ccc" }} />
                        <Typography variant="body2" sx={{ textAlign: "center", fontWeight: "bold", mt: 1 }}>
                            בקשות ממתינות
                        </Typography>
                        {pendingRequests.map((request) => (
                            <Box key={request.memberName} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 2 }}>
                                <Typography>{request.memberName}</Typography>
                                <Box>
                                    <IconButton size="small" color="success" onClick={() => handlePendingRequest(request.memberName,"true")}>
                                        <CheckCircleIcon />
                                    </IconButton>
                                    <IconButton size="small" color="error" onClick={() => handlePendingRequest(request.memberName,"false")}>
                                        <CancelIcon />
                                    </IconButton>
                                </Box>
                            </Box>
                        ))}
                    </>
                )}
                </Box>
            </Menu>
            {/* My Family Modal */}
            <Dialog open={familyModalOpen} onClose={handleFamilyModalClose}>
                <DialogTitle sx={{ textAlign: "center", fontSize: "1.5rem", fontWeight: "bold" }}>
                    המשפחה שלי
                </DialogTitle>
                <DialogContent>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                    {user?.familyMembers?.map((member) => (
                        <Chip
                            key={member.memberName}
                            label={member.memberName}
                            onDelete={() => handleRemoveFamilyMember(member.memberName)}
                            deleteIcon={<CloseIcon sx={{ fontSize: "1rem" }} />}
                            icon={getStatusIcon(member.allowedToSeeTheirRecipes)}
                            sx={{ direction: "ltr" }}
                        />
                    ))}
                </Box>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="הזן אימייל של בן משפחה"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    sx={{ direction: "ltr" }}
                />

                {errorFamily && <Typography color="error" sx={{ direction: "ltr" }}>{errorFamily}</Typography>}
                {loadingFamily && <CircularProgress size={24} sx={{ display: "block", margin: "auto", direction: "ltr" }} />}

                <Typography variant="body2" sx={{ mt: 1, color: "#666", direction: "ltr" }}>
                    כאשר תוסיף בן משפחה, הוא יוכל לראות את המתכונים שלך. אך כדי לראות את המתכונים שלו, עליו לאשר אותך.
                </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleFamilyModalClose} variant="outlined">סגור</Button>
                    <Button onClick={handleAddFamilyMember} variant="contained" disabled={loadingFamily}>הוסף</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default UserMenu;
