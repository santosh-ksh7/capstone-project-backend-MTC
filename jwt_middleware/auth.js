// This is a custom middleware that will intercept all secured API routes & validate the JWT token only after which the response is given
import jwt from "jsonwebtoken";

export const auth = (req, res, next) => {
    // used the try & catch block in order to stop the operation in case at any stage error occurs
    try{
        // This is to get the token from header of the request to protected routes
        const token = req.header("x-auth-token");
        // This validates the token against the secret key that was originally used to create the token during the login process
        jwt.verify(token, process.env.secret_key);
        // Only if the token is validated the next() callback function in the fetch API is called
        console.log("Token is verified & now invoking the callback function");
        next();
    }catch(err){
        console.log("Token is not verified");
        res.status(401).send({"error": err.message})
    }
}