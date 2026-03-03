const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));

// ================= ROUTES =================

app.get("/", (req, res) => {
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

    // Send data to result.ejs
    res.render("res",{
      usename: username,
      usage: age,
      education: educ
    });
});

// ================= AI ROUTE =================

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
                    "Authorization": `Bearer ${process.env.API_KEY}`
                },
                body: JSON.stringify({
                    model: "openai/gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: "You must return ONLY valid JSON. No markdown."
                        },
                        {
                            role: "user",
                            content: `
My Skills: ${skill}
My Education: ${education}

Generate realistic Indian career recommendations.

You MUST fill ALL arrays with data.
DO NOT return empty arrays.

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
- Minimum 5 items in each array
- Salaries must be in ₹ per annum
- Description must be 2 lines
- Return ONLY valid JSON
`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1500
                })
            }
        );

        const data = await response.json();

        

        if (!data.choices || !data.choices[0]) {
            return res.send("Invalid AI response");
        }

        let aiText = data.choices[0].message.content;

        

        aiText = aiText
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        let parsedData;

        try {
            parsedData = JSON.parse(aiText);
        } catch (err) {
            console.log("❌ Bad JSON:", aiText);
            return res.send("AI returned invalid JSON format");
        }

        // 🔥 Ensure arrays always exist
        parsedData = {
            government_jobs: parsedData.government_jobs || [],
            private_jobs: parsedData.private_jobs || [],
            related_interests: parsedData.related_interests || [],
            career_paths: parsedData.career_paths || [],
            required_skills: parsedData.required_skills || [],
            Useful_Certificates: parsedData.Useful_Certificates || [],
            learning_roadmap: parsedData.learning_roadmap || []
        };

        console.log("Data recived from AI");
        res.render("respon", { data: parsedData });

    } catch (error) {
        console.log("❌ API ERROR:", error);
        res.send("Error calling AI API");
    }

});

// ================= SERVER =================

app.listen(3000, () => {
    console.log("🚀 Server running on http://localhost:3000");
});