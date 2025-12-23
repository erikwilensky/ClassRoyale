import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { Teacher } from "./pages/Teacher.jsx";
import { TeacherScoreboard } from "./pages/TeacherScoreboard.jsx";
import { TeacherLobby } from "./pages/TeacherLobby.jsx";
import { TeacherCards } from "./pages/TeacherCards.jsx";
import { TeacherModeration } from "./pages/TeacherModeration.jsx";
import { Student } from "./pages/Student.jsx";
import { Lobby } from "./pages/Lobby.jsx";
import { Display } from "./pages/Display.jsx";
import { Login } from "./pages/Login.jsx";
import { Register } from "./pages/Register.jsx";
import { Verified } from "./pages/Verified.jsx";
import { Profile } from "./pages/Profile.jsx";
import { Shop } from "./pages/Shop.jsx";
import { TokenTest } from "./pages/TokenTest.jsx";
import { isAuthenticated, getIsTeacher } from "./utils/auth.js";

function Home() {
  // Redirect based on authentication
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  
  // If authenticated, redirect based on role to lobby
  if (getIsTeacher()) {
    return <Navigate to="/teacher/lobby" replace />;
  } else {
    return <Navigate to="/lobby" replace />;
  }
}

// Protected route wrapper
function ProtectedRoute({ children, requireAuth = true, requireTeacher = false }) {
  if (requireAuth && !isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  
  // If route requires teacher, check role
  if (requireTeacher && !getIsTeacher()) {
    // Non-teachers trying to access teacher routes go to their lobby
    return <Navigate to="/lobby" replace />;
  }
  
  // If route requires student (not teacher), redirect teachers away
  if (!requireTeacher && getIsTeacher() && window.location.pathname === "/student") {
    return <Navigate to="/teacher" replace />;
  }
  
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verified" element={<Verified />} />
        <Route path="/token-test" element={<TokenTest />} />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/teacher" 
          element={
            <ProtectedRoute requireTeacher={true}>
              <Teacher />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/teacher/cards" 
          element={
            <ProtectedRoute requireTeacher={true}>
              <TeacherCards />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/teacher/lobby" 
          element={
            <ProtectedRoute requireTeacher={true}>
              <TeacherLobby />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/teacher/scoreboard" 
          element={
            <ProtectedRoute requireTeacher={true}>
              <TeacherScoreboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/teacher/moderation" 
          element={
            <ProtectedRoute requireTeacher={true}>
              <TeacherModeration />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/lobby" 
          element={
            <ProtectedRoute requireTeacher={false}>
              <Lobby />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/student" 
          element={
            <ProtectedRoute requireTeacher={false}>
              <Student />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/display" 
          element={
            <ProtectedRoute requireAuth={true}>
              <Display />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/shop" 
          element={
            <ProtectedRoute requireAuth={true}>
              <Shop />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);



