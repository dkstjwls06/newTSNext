import express from 'express'
import path from 'path' 
import http from 'http'
import https from 'https'
import { Server } from 'socket.io'

const app = express();
const PORT = 80;
const server = http.createServer(app);
const io = new Server(server,{
    cors:{
        origin:"*",
        methods:["GET","POST"]
    }
});

io.on('connection',(socket)=>{
    console.log('a user connected : ',socket.id);
    socket.emit("hello",{msg:"welcome"});
    socket.on("ping", (data) => {
        console.log("ping:", data);
        socket.emit("pong", { at: Date.now() });
        // socket.broadcast.emit("somebodyPinged", { id: socket.id });
    });

    socket.on("disconnect", (reason) => {
        console.log("disconnected:", socket.id, reason);
    });
})

app.use(express.json());

app.use(express.static(
    path.resolve(__dirname, '..', '..', 'frontend', 'dist')
));

app.use(express.static(
    path.resolve(__dirname, '..', '..', 'frontend', 'public')
));

app.get('/', (req, res) => {
    
    res.sendFile('index.html', {
        root:path.resolve(__dirname,'..','..', 'frontend/dist')
    });
})

server.listen(PORT, () => console.log(`http://chess0924.iptime.org:${PORT}`));