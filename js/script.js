// ============================
// DILLO WEBSITE
// script.js
// ============================

console.log("🐢 Dillo Loaded!");

// Welcome message
window.addEventListener("load", () => {
    console.log("Welcome to Dillo!");
});

// ----------------------------
// Search Button
// ----------------------------
const searchButton = document.querySelector(".search button");

if (searchButton) {
    searchButton.addEventListener("click", () => {
        const search = document.querySelector(".search input").value;

        if (search.trim() === "") {
            alert("Please enter a town, street, or owner.");
        } else {
            alert("Searching for: " + search + "\n\n(Search system coming soon)");
        }
    });
}

// ----------------------------
// AI Button
// ----------------------------
const aiButton = document.querySelector(".aiButton");

if (aiButton) {
    aiButton.addEventListener("click", () => {
        alert("🤖 Dillo AI is coming soon!");
    });
}

// ----------------------------
// Property Hover Effect
// ----------------------------
const cards = document.querySelectorAll(".property");

cards.forEach(card => {
    card.addEventListener("mouseenter", () => {
        card.style.transform = "translateY(-10px) scale(1.02)";
    });

    card.addEventListener("mouseleave", () => {
        card.style.transform = "translateY(0px) scale(1)";
    });
});