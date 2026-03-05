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

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');

  res.send(`<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://careernavigator-cq9v.onrender.com/</loc>
      <lastmod>2026-03-04</lastmod>
    </url>
  </urlset>`);
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
app.get("/res", (req, res)=>{
    res.render("res", {
        usename: "",
        usage: "",
        education: ""
    });
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
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.API_KEY}`,
                    "HTTP-Referer": "https://careernavigator-cq9v.onrender.com",
                    "X-Title": "AI Career Recommendation"
                },
                body: JSON.stringify({
                    model: "openai/gpt-4o-mini",
                    messages: [
                        {
                            role: "user",
                            content: `
Return ONLY valid JSON. No markdown.

My Skills: ${skill}
My Education: ${education}

Generate realistic Indian career recommendations.

Return JSON format:

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
- Salaries in ₹ per annum
- Short descriptions
`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1200
                })
            }
        );

        console.log("HTTP Status:", response.status);

        const data = await response.json();

        console.log("Full AI Response:");
        console.dir(data, { depth: null });

        if (!data.choices || !data.choices[0]) {
            return res.send("Invalid AI response");
        }

        let aiText = data.choices[0].message.content.trim();

        // Extract JSON
        const firstBrace = aiText.indexOf("{");
        const lastBrace = aiText.lastIndexOf("}");

        if (firstBrace !== -1 && lastBrace !== -1) {
            aiText = aiText.substring(firstBrace, lastBrace + 1);
        }

        let parsedData;

        try {
            parsedData = JSON.parse(aiText);
        } catch (err) {
            console.log("JSON parse error:", err);
            return res.send("AI returned invalid JSON");
        }

        parsedData = {
            government_jobs: parsedData.government_jobs || [],
            private_jobs: parsedData.private_jobs || [],
            related_interests: parsedData.related_interests || [],
            career_paths: parsedData.career_paths || [],
            required_skills: parsedData.required_skills || [],
            Useful_Certificates: parsedData.Useful_Certificates || [],
            learning_roadmap: parsedData.learning_roadmap || []
        };

        res.render("respon", { data: parsedData });

    } catch (error) {

        console.log("API ERROR:", error);

        res.send("Error calling AI API");

    }

});


// ================= SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
