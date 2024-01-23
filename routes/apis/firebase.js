const express = require('express');
const router = express.Router();
const path = require('path');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue, Filter } = require('firebase-admin/firestore');


console.log("Path =====>",path.join(__dirname, '../../voicecallwebrtc-serviceAccountKey.json'));
const serviceAccount = require(path.join(__dirname, '../../voicecallwebrtc-serviceAccountKey.json'));
initializeApp({
    credential: cert(serviceAccount)
});

const firestore = getFirestore();

let clients = [];
let callID = null;
router.post('/register', (req, res) => {
    const callDoc = firestore.collection('calls').doc();
    callID = callDoc.id;
    try {
        res.json({ 
            success : true,
            id:callDoc.id
         });
    } catch (error) {
        res.status(400).json(error);
    }
});

router.post('/calls', async (req, res) => {//id = phone-number-id
    // {
    //     call_id:"123",
    //     action: "connect/accept",
    //     connection: {
    //         webrtc:{
    //             sdp : '<<SDP INFO>>'
    //         }
    //     }
    // }

    // console.log("body ====> ",req.body);
    if (req.body.call_id === "" || req.body.call_id == undefined) {
        res.status(400).json({error:"please register first"});
    } else {
        const callId = req.body.call_id;
        const sdp = req.body.connection?.webrtc?.sdp;
        const action = req.body.action; //action: "connect/accept"

        if (action === "connect") {
        
            const offer = {
                sdp: sdp,
                type: "offer",
            };

            const callDoc = firestore.collection('calls').doc(callId);

            console.log("callDoc.id =====>",callId);

            await callDoc.set({ offer });

            // Listen for remote answer
            callDoc.onSnapshot((snapshot) => {
                const data = snapshot.data();
                console.log("data?.answer =====> ",data?.answer);
                if (data?.answer) {
                    console.log("answerDescription setRemoteDescription");
                    const time = (new Date()).toLocaleTimeString();

                    const massage = {
                        type: "answerDescription",
                        data:data.answer,
                        time:time,
                        clientype:action
                    };

                    sendMessageToAll(massage);
                }
            });

            res.json(
                { 
                    success : true,
                    callId:callId,
                    action:action,
                    offer:offer
                }
            );

        } else {
            const callDoc = firestore.collection('calls').doc(callId);

            console.log("callDoc.id =====>",callId);
            const answer = {
                sdp: sdp,
                type: "answer",
            };

            await callDoc.update({ answer });

            res.json(
                { 
                    success : true,
                    callId:callId,
                    action:action,
                    offer:answer
                }
            );
        }
    }
});


/*
 * send message event
 */ 
function sendMessageToAll(payload) {
    // console.log("payload ------> ",clients);
    clients.forEach(client => {
        sendMessage(client.response, payload);
    })
}

const sendMessage = (res, payload) => {
    const data = 'data: ' + `${JSON.stringify(payload)}` + '\n\n';
    res.write(data);
    res.flush();
}

const handleSSE = (req, response) =>{
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const clientId = Date.now();
  
  const newClient = {
        id: clientId,
        response
    };
    
  clients.push(newClient);

  const time = (new Date()).toLocaleTimeString();

  const payload = 'data: ' + `${JSON.stringify({
    offerType: "offer",
    time:time
  })}` + '\n\n';

  console.log("payload ===> ",payload);

  sendMessage(response, payload); 

  req.on('close', () => {
    console.log(`Connection closed`);
    // clients = clients.filter(client => client.id !== clientId);
  });

//   Sends a SSE every 3 seconds on a single connection.
//   setInterval(function() {
//     const time = (new Date()).toLocaleTimeString();

//     const payload = 'data: ' + `${JSON.stringify({
//         offerType: "offer",
//         time:time
//     })}` + '\n\n';
//     sendMessage(response, payload); 
//   }, 3000);

}

router.get("/stream", handleSSE)

module.exports = router;