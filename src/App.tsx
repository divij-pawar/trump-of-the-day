import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DisplayAllNews from "../pages/DisplayAllNews";
import Home from "../pages/Home";

function App() {


  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />

        <Route path="/all-news" element={<DisplayAllNews />} />
      </Routes>
    </Router>

  );
}

export default App;
