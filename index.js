import express from 'express'
import { MongoClient } from 'mongodb'
import { ObjectId } from 'mongodb'
import { userRouter } from './routes/users.js'
import { writeablogRouter } from './routes/writeablog.js'
import dotenv from "dotenv"
import cors from "cors"


const app = express()

app.use(cors())

app.use(express.json())


// Express router         if path of fetch starts with /sign go to userRouter
app.use("/sign", userRouter)

// Express router         if path starts with /write-a-blog got to writeablogRouter
app.use("/write-a-blog", writeablogRouter)

dotenv.config()

const mongo_url = "mongodb://127.0.0.1"

async function createConnection(){
    const client = new MongoClient(mongo_url);
    await client.connect();
    console.log("MongoDB is Connected");
    return client
}

export const client = await createConnection();


app.get('/', function (req, res) {
  res.send('Hello World')
})


// UseEffect data for Home component in front end when first Home component is moounted
app.get('/home', async function (req, res) {
  // const data = await client.db("mtc").collection("blogs").find({}).toArray();        {{{{{{{{delete after everything is working fine}}}}}}}}
  const data = await client.db("mtc").collection("blogs").aggregate([
    {$lookup : {
      from: "users",
      localField: "author_id",
      foreignField: "_id",
      as: "user_info"
    }},
    {$unwind: "$user_info"},
    {$sort: {_id : -1}}
  ]).toArray()
  data ? res.status(200).send(data) : res.send({"msg": "No data found"})
})


// API for search component
app.get('/search', async function (req, res) {
  const para = req.query.title;
  console.log(para);
  // const data = await client.db("mtc").collection("blogs").find({title: {$regex : para}}).toArray();
  const data = await client.db("mtc").collection("blogs").aggregate([
    {$match : {title: {$regex : para}}},
    {$lookup : {
      from: "users",
      localField: "author_id",
      foreignField: "_id",
      as: "user_info"
    }},
    {$unwind: "$user_info"}
  ]).toArray()
  res.status(200).send(data)
})



// API for discover by tags
app.get('/tag', async function (req, res) {
  const para = req.query.tag;
  console.log(para);
  // const data = await client.db("mtc").collection("blogs").find({tag: para}).toArray();
  const data = await client.db("mtc").collection("blogs").aggregate([
    {$match : {tag : para}},
    {$lookup : {
      from: "users",
      localField: "author_id",
      foreignField: "_id",
      as: "user_info"
    }},
    {$unwind: "$user_info"}
  ]).toArray()
  data && data.length!==0 ? res.status(200).send(data) : res.send({"msg": "No data found"})
})




// API to fetch specific blog based on ObjectId of blog ------- making use of req.params coz we only need the _id
app.get('/open-a-blog/:id', async function (req, res) {
  const {id} = req.params     // params passed in the url is stored as object = {id: params}. Hence destructuring.
  // The dynamic part of url is sent as string. We need to convert it back to ObjectId data type of mongo DB.
  const data2send = await client.db("mtc").collection("blogs").aggregate([
    {$match : {_id : ObjectId(id)}},
    {$lookup : {
      from: "users",
      localField: "author_id",
      foreignField: "_id",
      as: "user_info"
    }},
    {$unwind: "$user_info"}
  ]).toArray();
  res.send(data2send[0])
})



// API to fetch the comments specific to blog ------- making use of req.params coz we only need the _id
app.get('/comments/:id', async function (req, res) {
  const {id} = req.params     // params passed in the url is stored as object = {id: params}. Hence destructuring.
  // The dynamic part of url is sent as string. We need to convert it back to ObjectId data type of mongo DB.
  const data2send = await client.db("mtc").collection("comments").aggregate([
    {$match : {blog_id : ObjectId(id)}},
    {$lookup : {
      from: "users",
      localField: "author_id",
      foreignField: "_id",
      as: "user_info"
    }},
    {$unwind: "$user_info"}
  ]).toArray();
  res.send(data2send)
})





// API to fetch individual user info for comments data          ---- making use of req.params & local info to find individual logged-in user
app.get('/individual-user-info/:id', async function (req, res) {
  const {id} = req.params     // params passed in the url is stored as object = {id: params}. Hence destructuring.
  // The dynamic part of url is sent as string. We need to convert it back to ObjectId data type of mongo DB.
  const data2send = await client.db("mtc").collection("users").findOne({_id : ObjectId(id)})
  res.send(data2send)
})



// API to post the comment
app.post("/post-comment", async function (req,res){
  const datafromfrontend = req.body;
  let data2insert = {...datafromfrontend, "blog_id" : ObjectId(datafromfrontend.blog_id), "author_id" : ObjectId(datafromfrontend.author_id)}
  console.log(data2insert);
  // insert to comments DB
  let result = await client.db("mtc").collection("comments").insertOne(data2insert);
  // get updated comments from DB after insertion & send the data back
  let resultff = await client.db("mtc").collection("comments").aggregate([
    {$match : {blog_id : ObjectId(datafromfrontend.blog_id)}},
    {$lookup : {
      from: "users",
      localField: "author_id",
      foreignField: "_id",
      as: "user_info"
    }},
    {$unwind: "$user_info"}
  ]).toArray();
  res.send(resultff);
})





// API for the liked_posts data when the component first mounts
app.post("/get-like-info", async function(req, res){
  const data = req.body;
  const result = await client.db("mtc").collection("liked_posts").findOne({blog_id : ObjectId(data.blog_id), author_id: ObjectId(data.author_id)});
  if(result){
    res.send({"msg": true});
  }else{
    res.send({"msg": false});
  }
})





// API to alter the clap count of blogs
app.post("/alter-clap-count/:id", async function(req,res){
  const{id} = req.params;
  const data2update = req.body;
  const result = await client.db("mtc").collection("blogs").updateOne({_id: ObjectId(id)}, {$set : data2update});
  res.send(result)
})



// API to remove/add records from liked_posts     ---   same API will add/remove doc. from collection based on req.params
app.post("/alter-liked_posts/:id", async function(req,res){
  const{id} = req.params;
  const data2alter = req.body;
  console.log(data2alter, id);
  if(id==="remove"){
    const result = await client.db("mtc").collection("liked_posts").deleteOne(
      {blog_id: ObjectId(data2alter.blog_id), author_id: ObjectId(data2alter.author_id)});
    res.send(result)
  }else{
    const result = await client.db("mtc").collection("liked_posts").insertOne(
      {blog_id: ObjectId(data2alter.blog_id), author_id: ObjectId(data2alter.author_id)});
    res.send(result)
  }
})






// API for bookmarks data when the component first mounts
app.post("/get-bookmark-info", async function(req, res){
  const data = req.body;
  const result = await client.db("mtc").collection("saved_posts").findOne({blog_id : ObjectId(data.blog_id), author_id: ObjectId(data.author_id)});
  if(result){
    res.send({"msg": true});
  }else{
    res.send({"msg": false});
  }
})






// API to add/remove records from saved_posts     ---   same API will add/remove doc. from collection based on req.params
app.post("/alter-saved_posts/:id", async function(req,res){
  const{id} = req.params;
  const data2alter = req.body;
  console.log(data2alter, id);
  if(id==="remove"){
    const result = await client.db("mtc").collection("saved_posts").deleteOne(
      {blog_id: ObjectId(data2alter.blog_id), author_id: ObjectId(data2alter.author_id)});
    res.send(result)
  }else{
    const result = await client.db("mtc").collection("saved_posts").insertOne(
      {blog_id: ObjectId(data2alter.blog_id), author_id: ObjectId(data2alter.author_id)});
    res.send(result)
  }
})






// API for Keep reading data for open-a-blog component
app.get("/keep-reading", async function(req,res){
  const data = await client.db("mtc").collection("blogs").aggregate([
    {$lookup : {
      from: "users",
      localField: "author_id",
      foreignField: "_id",
      as: "user_info"
    }},
    {$unwind: "$user_info"}
  ]).toArray()
  let resff = data.slice(data.length-2,data.length);
  res.send(resff);
})





// API for more from author data for open-a-ablog component
app.get("/more-from-author/:id", async function(req,res){
  const {id} = req.params
  // query was to extract the author_id of the blog using it's blog_id
  const result = await client.db("mtc").collection("blogs").findOne({ _id: ObjectId(id)});
  const author_id = result.author_id;
  // query to get all blogs from the author except the one whose _id = id from req.params
  const resultff = await client.db("mtc").collection("blogs").find({ author_id: ObjectId(author_id), _id : {$ne : ObjectId(id)}}).toArray();
  let resultfinal = resultff.slice(0,2);
  res.send(resultfinal);
})







app.listen(process.env.PORT)