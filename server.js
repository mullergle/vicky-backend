require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const upload = multer({
  storage: multer.memoryStorage()
  
});
const path = require("path");
const fs = require("fs");
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);
cloudinary.config({
  
  cloud_name: "dycxrexwg",
  api_key: "769269774738925",
  api_secret: "ganhPMe_Le-nZFfUie_kjZI7FGQ"
});


const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* MULTER */
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads", { recursive: true });
}

/* POSTGRES */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized:false
  }
});
const db = {

run: (query, params, callback)=>{

let index = 1;

query = query.replace(/\?/g, ()=>`$${index++}`);

pool.query(query, params)

.then(result=>{

if(callback){
callback(null,{
lastID: result.rows[0]?.id
});
}

})

.catch(err=>{

console.log(err);

if(callback){
callback(err);
}

});

},


get: (query, params, callback)=>{

let index = 1;

query = query.replace(/\?/g, ()=>`$${index++}`);

pool.query(query, params)

.then(result=>{

if(callback){
callback(null,result.rows[0]);
}

})

.catch(err=>{

console.log(err);

if(callback){
callback(err);
}

});

},


all: (query, params, callback)=>{

let index = 1;

query = query.replace(/\?/g, ()=>`$${index++}`);

pool.query(query, params)

.then(result=>{

if(callback){
callback(null,result.rows);
}

})

.catch(err=>{

console.log(err);

if(callback){
callback(err);
}

});

}

};



pool.connect()

.then(client=>{

console.log("PostgreSQL connected");

client.release();

})

.catch(err=>{

console.log("PostgreSQL connection error:", err.message);

});

/* USERS TABLE */

db.run(`
CREATE TABLE IF NOT EXISTS users(
id SERIAL PRIMARY KEY,
name TEXT,
email TEXT UNIQUE,
password TEXT,
accountType TEXT DEFAULT 'Regular'
)
`);

/* ADMINS TABLE */
db.run(`
CREATE TABLE IF NOT EXISTS admins(
id SERIAL PRIMARY KEY,
email TEXT,
password TEXT
)
`);
db.get(
"SELECT * FROM admins WHERE email=?",
["admin@lavick.com"],
(err,row)=>{

if(!row){

db.run(
"INSERT INTO admins(email,password) VALUES(?,?)",
[
"admin@lavick.com",
"123456"
]
);

}

});

/* FAVOURITES TABLE */
db.run(`
CREATE TABLE IF NOT EXISTS favourites(
id SERIAL PRIMARY KEY,
email TEXT,
name TEXT,
price TEXT,
image TEXT
)
`);

/* DESIGNS TABLE */
db.run(`
CREATE TABLE IF NOT EXISTS designs(
id SERIAL PRIMARY KEY,
name TEXT,
price TEXT,
category TEXT,
description TEXT,
image TEXT
)
`);

/* SLIDER TABLE */

db.run(`
CREATE TABLE IF NOT EXISTS sliders(
id SERIAL PRIMARY KEY,
image TEXT
)
`);

/* RESET CODES TABLE */

db.run(`
CREATE TABLE IF NOT EXISTS reset_codes(
id SERIAL PRIMARY KEY,
email TEXT,
code TEXT,
createdAt INTEGER
)
`);

/* HOME */
app.get("/",(req,res)=>{

res.json({
message:"Lavick backend running"
});

});

/* TEST */
app.get("/api/test",(req,res)=>{

res.json({
message:"Backend connected successfully"
});

});

/* SAVE USER */
app.post("/users",(req,res)=>{

const {name,email,password}=req.body;

db.run(
"INSERT INTO users(name,email,password) VALUES(?,?,?)",
[name,email,password],

function(err){

if(err){

res.json({
error:err.message
});

}else{

res.json({
message:"User registered successfully",
id:this.lastID
});

}

}
);
});


/* GET USERS */
app.get("/users",(req,res)=>{

db.all(
"SELECT * FROM users",
[],
(err,rows)=>{

if(err){

res.json({
error:err.message
});

}else{

res.json(rows);

}

}
);

});

/* GET SINGLE USER */

app.get("/user/:email",(req,res)=>{

const email = req.params.email;

db.get(
'SELECT name, email, "accountType" FROM users WHERE email=?',
[email],

(err,row)=>{

if(err){

return res.json({
error:err.message
});

}

res.json(row);

}

);

});







/* LOGIN */

app.post("/login",(req,res)=>{

const {email,password}=req.body;


/* CHECK ADMIN FIRST */

db.get(
"SELECT * FROM admins WHERE email=? AND password=?",
[email,password],

(err,admin)=>{

if(admin){

return res.json({
message:"Admin login successful",
success:true,
role:"admin"
});

}


/* CHECK NORMAL USER */

db.get(
"SELECT * FROM users WHERE email=? AND password=?",
[email,password],

(err,user)=>{

if(user){

res.json({
message:"Login successful",
success:true,
role:"user"
});

}else{

res.json({
message:"Invalid email or password",
success:false
});

}

});

});

});


/* ADD FAVOURITE */

app.post("/favourite",(req,res)=>{

const {email,name,price,image}=req.body;


// CHECK IF ALREADY EXISTS

db.get(
"SELECT * FROM favourites WHERE email=? AND name=?",
[email,name],

(err,row)=>{


if(row){

return res.json({
message:"Already added"
});

}


// ADD NEW FAVOURITE

db.run(
"INSERT INTO favourites(email,name,price,image) VALUES(?,?,?,?)",
[email,name,price,image],

function(err){

if(err){

res.json({
message:err.message
});

}else{

res.json({
message:"Added to favourite"
});

}

}

);


}

);


});


/* GET FAVOURITES */
app.get("/favourites/:email",(req,res)=>{

const email = req.params.email;

db.all(
"SELECT * FROM favourites WHERE email=?",
[email],
(err,rows)=>{

if(err){

res.json({
error:err.message
});

}else{

res.json(rows);

}

}
);

});

/* UPLOAD DESIGN WITH IMAGE */
app.post("/designs", upload.single("image"), async (req,res)=>{

const {
name,
price,
category,
description
} = req.body;
if (!req.file) {
  return res.json({
    message: "Please select an image"
  });
}


try{

const result = await cloudinary.uploader.upload(
`data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
{
folder:"lavick"
}
);


const image = result.secure_url;


db.run(
"INSERT INTO designs(name,price,category,description,image) VALUES(?,?,?,?,?)",
[
name,
price,
category,
description,
image
],

function(err){

if(err){

return res.json({
message:err.message
});

}


res.json({
message:"Design uploaded",
id:this.lastID,
image:image
});


}

);


}catch(error){

res.json({
message:error.message
});

}


});



/* UPLOAD SLIDER IMAGE */

app.post("/sliders", upload.single("image"), async (req,res)=>{

if (!req.file) {
return res.json({
message:"Please select an image"
});
}

try{

const result = await cloudinary.uploader.upload(
`data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
{
folder:"lavick"
}
);

const image = result.secure_url;

db.run(
"INSERT INTO sliders(image) VALUES(?)",
[image],

function(err){

if(err){

return res.json({
message:err.message
});

}

res.json({
message:"Slider uploaded",
image:image
});

}

);

}catch(error){

res.json({
message:error.message
});

}

});


/* GET SLIDER IMAGES */

app.get("/sliders",(req,res)=>{

db.all(
"SELECT * FROM sliders",
[],
(err,rows)=>{

if(err){

res.json({
error:err.message
});

}else{

res.json(rows);

}

}
);

});



/* GET DESIGNS */

app.get("/designs",(req,res)=>{

db.all(
"SELECT * FROM designs",
[],
(err,rows)=>{

if(err){

res.json({
error:err.message
});

}else{

res.json(rows);

}

}
);

});



/* DELETE DESIGN */

app.delete("/designs/:id",(req,res)=>{


const id = req.params.id;


db.run(
"DELETE FROM designs WHERE id=?",
[id],
function(err){


if(err){

return res.json({
message:"Delete failed"
});

}


res.json({
message:"Design deleted"
});


});


});



/* GET SLIDER IMAGES */

app.get("/sliders",(req,res)=>{


db.all(
"SELECT * FROM sliders",
[],
(err,rows)=>{


if(err){

res.json({
error:err.message
});


}else{


res.json(rows);


}


}
);


});




/* DELETE SLIDER */

app.delete("/sliders/:id",(req,res)=>{


const id = req.params.id;


db.run(
"DELETE FROM sliders WHERE id=?",
[id],

function(err){


if(err){

return res.json({
message:"Delete failed"
});

}


res.json({
message:"Slider deleted"
});


});


});


/* DELETE FAVOURITE */

app.delete("/favourites/:id",(req,res)=>{


const id = req.params.id;


db.run(
"DELETE FROM favourites WHERE id=?",
[id],

function(err){


if(err){

res.json({
message:err.message
});

}else{


res.json({
message:"Favourite removed"
});


}


});


});

/* FORGOT PASSWORD */

app.post("/forgot-password", async (req,res)=>{

console.log("Forgot password request received");


const {email}=req.body;


db.get(
"SELECT * FROM users WHERE email=?",
[email],

(err,user)=>{


if(err){

return res.json({
success:false,
message:"Database error"
});

}


if(!user){

return res.json({
success:false,
message:"Email not found"
});

}



const code = Math.floor(100000 + Math.random() * 900000).toString();



db.run(
"DELETE FROM reset_codes WHERE email=?",
[email],

()=>{


db.run(
"INSERT INTO reset_codes(email,code,createdAt) VALUES(?,?,?)",
[email,code,Date.now()],


async (err)=>{


if(err){

return res.json({

success:false,

message:"Could not save code"

});

}




try{


await resend.emails.send({

from:"onboarding@resend.dev",

to:email,

subject:"Lavick Password Reset Code",

html:`

<h2>Lavick Password Reset</h2>

<p>Your verification code is:</p>

<h1>${code}</h1>

`

});



res.json({

success:true,

message:"Reset code sent"

});



}catch(error){


console.log(error);


res.json({

success:false,

message:"Email sending failed"

});


}



}


);


}


);


});


});





/* VERIFY CODE */


app.post("/verify-code",(req,res)=>{


const {email,code}=req.body;


db.get(

"SELECT * FROM reset_codes WHERE email=? AND code=?",

[email,code],


(err,row)=>{


if(err){

return res.json({

success:false,

message:"Database error"

});

}



if(row){

return res.json({

success:true,

message:"Code verified"

});

}



res.json({

success:false,

message:"Invalid code"

});


}

);


});






/* RESET PASSWORD */


app.post("/reset-password",(req,res)=>{


const {email,password}=req.body;



db.run(

"UPDATE users SET password=? WHERE email=?",

[password,email],


function(err){


if(err){

return res.json({

success:false,

message:"Password update failed"

});

}



res.json({

success:true,

message:"Password updated successfully"

});


}

);


});





const PORT = process.env.PORT || 3000;


app.listen(PORT,()=>{

console.log("Server running on port "+PORT);

});