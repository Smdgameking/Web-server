const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();

app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));

// ================= ROUTES =================

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/index", (req, res) => {
    res.render("index");
});

app.get("/info", (req, res) => {
    res.render("info");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/result", (req, res) => {
    const username = req.body.UserName;
    const age = req.body.UserAge;
    const educ = req.body.UserEducation;

    res.render("res", {
        usename: username,
        usage: age,
        education: educ
    });
});

// ================= AI ROUTE (GEMINI STABLE) =================

app.post("/reco", async (req, res) => {

    const skill = req.body.skill;
    const education = req.body.education;

    if (!skill) {
        return res.send("Skill is required");
    }

    try {

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `
Return ONLY valid JSON. No markdown. No explanation.

My Skills: ${skill}
My Education: ${education}

Generate realistic Indian career recommendations.

Return this exact JSON format:

{
  "government_jobs": [
    {
      "job_title": "",
      "fresher_salary": "",
      "experienced_salary": "",
      "description": ""
    }
  ],
  "private_jobs": [
    {
      "job_title": "",
      "fresher_salary": "",
      "experienced_salary": "",
      "description": ""
    }
  ],
  "related_interests": [],
  "career_paths": [],
  "required_skills": [],
  "Useful_Certificates": [],
  "learning_roadmap": []
}

Rules:
- Minimum 3 items in each array
- Keep descriptions short (1 line)
- Salaries in ₹ per annum
- Return ONLY JSON
`
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 4000
                    }
                })
            }
        );

        const data = await response.json();

        if (!data.candidates || !data.candidates[0]) {
            console.log("Invalid Gemini response:", data);
            return res.send("Invalid AI response");
        }

        let aiText = data.candidates[0].content.parts[0].text.trim();

        // 🛡️ SAFE JSON EXTRACTION
        const firstBrace = aiText.indexOf("{");
        const lastBrace = aiText.lastIndexOf("}");

        if (firstBrace !== -1 && lastBrace !== -1) {
            aiText = aiText.substring(firstBrace, lastBrace + 1);
        }

        let parsedData;

        try {
            parsedData = JSON.parse(aiText);
        } catch (err) {
            console.log("❌ JSON Parsing Failed:", aiText);
            return res.send("AI returned incomplete JSON");
        }

        // Ensure arrays always exist
        parsedData = {
            government_jobs: parsedData.government_jobs || [],
            private_jobs: parsedData.private_jobs || [],
            related_interests: parsedData.related_interests || [],
            career_paths: parsedData.career_paths || [],
            required_skills: parsedData.required_skills || [],
            Useful_Certificates: parsedData.Useful_Certificates || [],
            learning_roadmap: parsedData.learning_roadmap || []
        };

        console.log("✅ Gemini Response Parsed Successfully");

        res.render("respon", { data: parsedData });

    } catch (error) {
        console.log("❌ Gemini API ERROR:", error);
        res.send("Error calling Gemini API");
    }

});

// ================= SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
