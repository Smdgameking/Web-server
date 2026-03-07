const express = require("express");
const session = require("express-session");
const fs = require("fs");
const admin = require("firebase-admin");
const readline = require("readline");
const { exec } = require("child_process");
const path = require("path");
require("dotenv").config();

const fetch = global.fetch;

const app = express();

/* ================= DEBUG MODE ================= */

let DEBUG = false;

function checkJavaInstalled(){

return new Promise(resolve=>{

exec("javac -version",(err,stdout,stderr)=>{

if(err){

console.log("❌ Java is NOT installed.");

console.log("Install it with:");

console.log("apt-get install -y openjdk-17");

resolve(false);

}else{

console.log("✅ Java detected:",stderr || stdout);

resolve(true);

}

});

});

}


async function askDebug(){

const rl = readline.createInterface({
input:process.stdin,
output:process.stdout
});

return new Promise(resolve=>{

let answered=false;

const timer=setTimeout(()=>{
if(!answered){
rl.close();
resolve(false);
}
},5000);

rl.question("Enable debugging? (yes/no): ",answer=>{

answered=true;
clearTimeout(timer);

const val=answer.trim().toLowerCase();

if(val==="yes"||val==="y"){
resolve(true);
}else{
resolve(false);
}

rl.close();

});

});

}

function log(...msg){
if(DEBUG){
console.log("[DEBUG]",...msg);
}
}

/* ================= FIREBASE ================= */

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
credential:admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/* ================= MIDDLEWARE ================= */

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(session({
secret:"career-ai-secret",
resave:false,
saveUninitialized:false,
cookie:{maxAge:1000*60*60*24}
}));

app.set("view engine","ejs");
app.use(express.static("public"));

/* ================= LOAD COURSES ================= */

const javaCourse = JSON.parse(
fs.readFileSync("./courses/java.json","utf8")
);

/* ================= AUTH ================= */

function authMiddleware(req,res,next){

if(!req.session.userId){
return res.redirect("/login");
}

next();

}

/* ================= ROUTES ================= */

app.get("/",(req,res)=>{
res.render("index");
});

app.get("/login",(req,res)=>{
res.render("login");
});

app.post("/createSession",(req,res)=>{

const uid=req.body.uid;

req.session.userId=uid;

log("Session created for",uid);

res.send("session created");

});

app.get("/logout",(req,res)=>{

req.session.destroy(()=>{
res.redirect("/login");
});

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

app.get("/results", authMiddleware , async (req,res)=>{  
  
const userId = req.session.userId;  
  
const snapshot = await db  
.collection("examResults")  
.where("userId","==",userId)  
.get();  
  
let results=[];  
  
snapshot.forEach(doc=>{  
results.push(doc.data());  
});  
  
res.render("results",{results});  
  
});

app.get("/exam", authMiddleware , (req,res)=>{  
res.render("exam",{questions:null});  
});  
app.post("/generateExam",authMiddleware, async (req,res)=>{  
  
const topic = req.body.topic;  
  
try{  
  
const response = await fetch(  
"https://openrouter.ai/api/v1/chat/completions",  
{  
method:"POST",  
headers:{  
"Content-Type":"application/json",  
"Authorization":`Bearer ${process.env.API_KEY}`  
},  
body:JSON.stringify({  
model:"openai/gpt-4o-mini",  
messages:[  
{  
role:"user",  
content:`  
Generate a multiple choice exam.  
  
Topic: ${topic}  
  
Return ONLY JSON.  
  
Format:  
  
{  
 "questions":[  
  {  
   "question":"",  
   "options":["","","",""],  
   "answer":0  
  }  
 ]  
}  
  
Rules:  
- 20 questions  
- 4 options each  
- answer index 0-3  
`  
}  
],  
temperature:0.7  
})  
}  
);  
  
const data = await response.json();  
  
if(!data.choices){  
return res.send("AI error");  
}  
  
let aiText = data.choices[0].message.content.trim();  
  
const firstBrace = aiText.indexOf("{");  
const lastBrace = aiText.lastIndexOf("}");  
  
aiText = aiText.substring(firstBrace,lastBrace+1);  
  
const exam = JSON.parse(aiText);  
  
res.render("exam", {   
questions: exam.questions,  
topic: topic  
});  
  
}catch(err){  
  
console.log(err);  
res.send("Exam generation failed");  
  
}  
  
});

app.post("/submitExam", authMiddleware , async (req,res)=>{  
  
const userId = req.session.userId;  
  
const score = req.body.score;  
const topic = req.body.topic;  
  
const admin = require("firebase-admin");  
  
const db = admin.firestore();  
  
await db.collection("examResults").add({  
userId:userId,  
topic:topic,  
score:score,  
date:new Date()  
});  
  
res.redirect("/dashboard");  
  
});

/* ================= DASHBOARD ================= */

app.get("/dashboard",authMiddleware,(req,res)=>{
res.render("dashboard");
});

app.get("/courses",authMiddleware,(req,res)=>{
res.render("course");
});

/* ================= JAVA COURSE ================= */

app.get("/course/java",authMiddleware,async(req,res)=>{

const userId=req.session.userId;

const totalLessons=javaCourse.lessons.length;

const progressSnapshot = await db.collection("lessonProgress")
.where("userId","==",userId)
.where("course","==","java")
.get();

const completedLessons = progressSnapshot.docs.map(d=>d.data().lesson);

let lessons = javaCourse.lessons.map(l=>{

return{
number:l.lesson_number,
title:l.title,
completed:completedLessons.includes(l.lesson_number),
locked:l.lesson_number>completedLessons.length+1
};

});

res.render("javaRoadmap",{
lessons,
completed:completedLessons.length,
totalLessons
});

});

/* ================= LESSON ================= */

app.get("/course/java/lesson/:num",authMiddleware,(req,res)=>{

const num=parseInt(req.params.num);

const lesson=javaCourse.lessons[num-1];

if(!lesson){
return res.send("Lesson not found");
}

res.render("javacourse",{
lesson,
lessonNumber:num,
totalLessons:javaCourse.lessons.length
});

});

/* ================= COMPLETE LESSON ================= */

app.post("/completeLesson",authMiddleware,async(req,res)=>{

const userId=req.session.userId;

await db.collection("lessonProgress").add({
userId,
course:req.body.course,
lesson:req.body.lesson,
date:new Date()
});

res.send("saved");

});

/* ================= RUN CODE ================= */

app.post("/runCode", async (req,res)=>{

try{

const code = req.body.code;
const filename = req.body.filename || "Main.java";

const tempDir = path.join(__dirname,"temp");

if(!fs.existsSync(tempDir)){
fs.mkdirSync(tempDir);
}

const filePath = path.join(tempDir,filename);

fs.writeFileSync(filePath,code);

const className = filename.replace(".java","");

const command = `cd ${tempDir} && javac ${filename} && java ${className}`;

const child = exec(command,{timeout:5000},(error,stdout,stderr)=>{

let output="";

if(stderr){
output=stderr;
}
else if(stdout){
output=stdout;
}
else if(error){
output=error.message;
}
else{
output="Program ran successfully but produced no output.";
}

try{
fs.unlinkSync(filePath);
const classFile = path.join(tempDir,`${className}.class`);
if(fs.existsSync(classFile)){
fs.unlinkSync(classFile);
}
}catch(e){}

res.json({output});

});

}catch(err){

console.log(err);

res.json({output:"Execution failed"});

}

});

/* ================= CHECK CODE ================= */

app.post("/checkCode",async(req,res)=>{

const {code,output,task}=req.body;

try{

const prompt=`
You are a beginner friendly programming teacher.

Task:
${task}

Student Code:
${code}

Program Output:
${output}

Check if the solution solves the task.

Rules:
- respond under 3 sentences
- start with Correct or Incorrect
- ignore formatting mistakes
- focus on logic and output
`;

const response=await fetch(
"https://openrouter.ai/api/v1/chat/completions",
{
method:"POST",
headers:{
"Content-Type":"application/json",
"Authorization":`Bearer ${process.env.API_KEY}`
},
body:JSON.stringify({
model:"openai/gpt-4o-mini",
messages:[{role:"user",content:prompt}]
})
}
);

const data=await response.json();

log("AI checkCode response:",data);

if(!data.choices){
return res.json({feedback:"AI response error"});
}

res.json({
feedback:data.choices[0].message.content
});

}catch(err){

console.log(err);

res.json({
feedback:"AI check failed"
});

}

});

/* ================= CHECK EXERCISE ================= */

app.post("/checkExercise",async(req,res)=>{

const {questions,answers}=req.body;

try{

const prompt=`
You are a beginner programming teacher.

Questions:
${JSON.stringify(questions)}

Student Answers:
${JSON.stringify(answers)}

Check if answers show correct understanding.

Rules:
- If mostly correct respond PASSED
- Otherwise explain briefly
- Maximum 3 sentences
`;

const response=await fetch(
"https://openrouter.ai/api/v1/chat/completions",
{
method:"POST",
headers:{
"Content-Type":"application/json",
"Authorization":`Bearer ${process.env.API_KEY}`
},
body:JSON.stringify({
model:"openai/gpt-4o-mini",
messages:[{role:"user",content:prompt}]
})
}
);

const data=await response.json();

log("Exercise check response:",data);

const feedback=data.choices[0].message.content;

res.json({
feedback,
passed:feedback.toLowerCase().includes("passed")
});

}catch(err){

console.log(err);

res.json({
feedback:"Exercise check failed",
passed:false
});

}

});

/* ================= PROJECT DETAILS ================= */

app.post("/projectDetails", async (req,res)=>{

try{

const {title, explanation, examples} = req.body;

const prompt = `
You are a programming teacher creating a mini project.

Lesson Title:
${title}

Lesson Explanation:
${explanation}

Example Code:
${JSON.stringify(examples)}

Create a VERY SIMPLE beginner project that uses ONLY concepts from this lesson.

Rules:
- Beginner level
- 10-20 lines of code maximum
- Only console programs
- Use System.out.println
- Do NOT use advanced topics
- Project must match the lesson topic

Return HTML like this:

<h3>🎯 Goal</h3>
Explain what the student will build.

<h3>📋 Requirements</h3>
List 3-5 simple tasks.

<h3>💻 Example Output</h3>
Show expected console output.

<h3>💡 Hint</h3>
Give one helpful hint.
`;

const response = await fetch(
"https://openrouter.ai/api/v1/chat/completions",
{
method:"POST",
headers:{
"Content-Type":"application/json",
"Authorization":`Bearer ${process.env.API_KEY}`
},
body:JSON.stringify({
model:"openai/gpt-4o-mini",
messages:[{role:"user",content:prompt}],
temperature:0.4,
max_tokens:500
})
}
);

const data = await response.json();

if(!data.choices){
return res.json({
details:"<p>Failed to generate project.</p>"
});
}

res.json({
details:data.choices[0].message.content
});

}catch(err){

console.log(err);

res.json({
details:"<p>Project generation failed.</p>"
});

}

});

/* ================= SERVER START ================= */

const PORT = process.env.PORT || 3000;

(async()=>{

DEBUG=await askDebug();

console.log("Debug mode:",DEBUG?"ON":"OFF");

const javaOk = await checkJavaInstalled();

if(!javaOk){

console.log("⚠ Java is required to run code.");
process.exit();

}

app.listen(PORT,()=>{
console.log("🚀 Server running on port",PORT);
});

})();
