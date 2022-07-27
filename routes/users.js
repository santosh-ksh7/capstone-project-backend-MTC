//  This API is for all the API calls corresponding to fogot password, register, login
import express from "express";
import { client } from "../index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";


const router = express.Router();


export const userRouter = router;


async function generatehash(pwd){
    // specifying no. of rounds for salting
    const round= 5;
    // generating salt {{await used coz generating salt is a time taking process}}
    const salt = await bcrypt.genSalt(round);
    // generating hash {{await used coz generating salt is a time taking process}}
    const hash = await bcrypt.hash(pwd, salt)
    // console.log(hash);
    return hash
}



// API for register process
router.post("/register", async function(req,res){
    const data = req.body;
    // checking the mail if already exists in DB before creating a user/register
    const check_email_before_inserting = await client.db("mtc").collection("users").findOne({email: data.email});
    // logic to insert operation / create user process
    const para2generatehash = data.pwd
    if(!check_email_before_inserting){
        const pwd = await generatehash(para2generatehash);
        const data2enter = {
            ...data,
            pwd: pwd,
            re_pwd: pwd,
            about: "",
            fb_link:"",
            insta_link:"",
            twitter_link: "",
            profile_pic: "https://res.cloudinary.com/dz7pcmtxi/image/upload/v1658877142/blank-profile-picture-g3824f2029_1280_rpx6sg.png"
        }
        const db_insert = await client.db("mtc").collection("users").insertOne(data2enter)
        res.send({"msg": "entered the data successfully coz mail doesn't exist", db_insert})
    }else{
        res.send({"msg": "can't create user because email already registered"})
    }
})





// API for login process
router.post("/login", async function(req,res){
    const data = req.body;
    // first step is to check if the mail id is present in DB
    const check_email = await client.db("mtc").collection("users").findOne({email: data.email});
    if(!check_email){
        res.send({"msg": "Invalid Credentials"})
    }else{
        // Now that the email ID is present second step is to check if the password matches from DB record
        // since password is a hashed value we need to use bcrypt to compare both of them & it is time-taking process hence await
        const compare = await bcrypt.compare(data.pwd, check_email.pwd);
        if(compare){
            // if login is successfull we create jwt token for secured API routes(only get response if jwt token is valid). This validation of JWT is performed through custom middleware which intercepts all  protected API routes.
            const token = jwt.sign({id: check_email._id}, process.env.secret_key)
            // sending the JWT token & _id of user so it could be stored in local storage in frontend
            res.send({"msg": "Succesfully logged in", "token" : token, "_id": check_email._id})
        }else{
            res.send({"msg": "Invalid Credentials"})
        }
    }
})






// API for the forgot password --- to send an OTP in the email of users registered email
router.post("/get-OTP", async function(req,res){
    const data = req.body;
    // Before sending an email first check whether the email is on our DB collection
    const check_email = await client.db("mtc").collection("users").findOne(data);
    // If the mail doesn't exists in our DB records
    if(!check_email){
        res.send({"msg": "This email ID is not registered. Please use your registered email ID"})
    }else{
        // If the mail exists we first generate a random OTP of 10 digits
        let random_string = "";
        const buffer = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
        let i=0;
        while(i<10){
            random_string+= buffer.charAt(Math.floor((Math.random()*(buffer.length))));
            i++;
        }
        // We store this random OTP in the DB to user whose email ID is same as sent from frontend for later verification
        await client.db("mtc").collection("users").updateOne(data, {$set :{otp: random_string}});
        // We now send the email alongwith the generated OTP for verification
        var transporter = nodemailer.createTransport({
            // Mail sender credentials
            service: 'gmail',
            auth: {
              user: 'dummyuser123890@gmail.com',
              pass: process.env.senderpass
            }
          });
          // Mail reciever credentials
          var mailOptions = {
            from: 'dummyuser123890@gmail.com',
            to: `${data.email}`,
            subject: 'Sent Email using Nodemailer from the Node.js MyTravelCompanion application',
            text: `Welcome to the MyTravelCompanion Application.
Have a wonderful day ahead.
In order to successfully reset your password copy the OTP given below & Validate it.
            Copy this OTP :- ${random_string}

Regards
Santosh
MyTravelCompanion
`        
          };
          // Tracking the operation of sending the mail
          transporter.sendMail(mailOptions, function(error, info){
            if (error) {
              console.log(error);
            } else {
              console.log('Email sent: ' + info.response);
            }
          });
        //   sending the data(i.e.. registered email) from the frontend again in the response so that for the subsequent reset password process this email can be used (i.e.. to validate OTP & update password). I will be storing this email id in the local storage until the password reset is completed & sent this email alongwith the body of Subsequent POST requests. Basically this email will act as an indentifier to identify the user whose password is to be updated.
        res.send({"msg": "An email is sent to you. Kindly check your mails", data});
    }
})




// API to validate the OTP sent through the mail -- A subsequent process for reset password
// Note --- For this APi remember to send the email id data that you stored in the local storage from previous step (i.e.. on the get OTP process). It is necesaary to identify the user in order to validate the OTP.
router.post("/validate-OTP", async function(req, res){
    const data = req.body;
    // First step is to uniquely identify the user through his email id& then  validate the OTP by comparing Users OTP sent through the frontend with the OTP that is stored in the DB while sending the OTP through the mail. Both should match to continue the process.
    const find_in_db = await client.db("mtc").collection("users").findOne({email: data.email});
    // comparing OTP in DB with OTP recieved from frontend
    if(find_in_db.otp === data.otp){
        res.send({"msg": "OTP is validated. Now you can proceed to reset password."})
    }else{
        res.send({"msg": "OTP didn't match. Enter the exact OTP sent to your registered email."})
    }
})






// API to reset the password (Update the user password with the new password) -- A final step for reset password
// Note --- For this APi remember to send the email id data that you stored in the local storage from Get OTP step (i.e.. on the get OTP process). It is necesaary to identify the user in order to update his password.
router.post("/reset-password", async function(req,res){
    const data = req.body;
    // First step is to generate the hash value from the new password. This hash value is stored in DB
    const hash = await generatehash(data.new_pwd);
    console.log(hash);
    // Second step is to identidy the user based on the email id whose password is to be updated. Then update the password
    const find_and_update = await client.db("mtc").collection("users").updateOne({email: data.email}, {$set :{pwd: hash}});
    res.send({"msg": "The password is succesfully updated", find_and_update});
    // after succesfully reset password happens remember to clean up the email stored in local storage
})