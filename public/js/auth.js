import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyB6IAREUS9JdmhIIcRexSW8SGC8k7n7l54",
    authDomain: "careerrecomendationai.firebaseapp.com",
    projectId: "careerrecomendationai",
    storageBucket: "careerrecomendationai.firebasestorage.app",
    messagingSenderId: "307084032106",
    appId: "1:307084032106:web:65330b73cc58648eeb3213",
    measurementId: "G-JHDLW31455"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
const auth=getAuth(app);

const submitBtn=document.getElementById("submitBtn");

submitBtn.onclick=async function(){

const email=document.getElementById("email").value;
const password=document.getElementById("password").value;

const mode=document.getElementById("formTitle").innerText;

try{

if(mode==="Register"){

await createUserWithEmailAndPassword(auth,email,password);
alert("Account created Please Login");

}else{

const userCredential = await signInWithEmailAndPassword(auth,email,password);

const uid = userCredential.user.uid;

await fetch("/createSession",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({uid})
});

window.location="/dashboard";

}

}catch(err){

alert(err.message);

}

}
