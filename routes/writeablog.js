//  This API is for all the API calls corresponding to write a blog, upload a blog, edit a blog, delte a blog
import { ObjectID } from "bson";
import express from "express";
import { client } from "../index.js";


const router = express.Router();


export const writeablogRouter = router;




// API to upload blog
router.post("/upload-blog", async function(req,res){
    let data = req.body;
    // Adding additional data to blog post sent by user -- like date, time2read, like count
    // initializing clap/like count to zero for newly uploaded blog
    const clap= 0;
    // Giving a date to blogpost
    let monthname = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    const date = new Date();
    let date2give="";
    date2give= date.getDate() + " " + monthname[date.getMonth()];
    // Giving estimated time2read based onlength of story string
    const len_story = data.story;
    const len = len_story.length;
    let time_to_read;
    if(len < 400){
        time_to_read = 1
    }else if(len < 800){
        time_to_read = 2
    }else if(len < 1200){
        time_to_read = 3
    }else if(len < 1600){
        time_to_read = 4
    }else if(len < 2000){
        time_to_read = 5
    }else{
        time_to_read = "5 +"
    }
    const data2insert = {
        ...data,
        clap,
        date: date2give,
        time_to_read,
        author_id: ObjectID(data.author_id)
    }
    console.log(data2insert);
    let insert2db = await client.db("mtc").collection("blogs").insertOne(data2insert);
    res.send(insert2db);
})