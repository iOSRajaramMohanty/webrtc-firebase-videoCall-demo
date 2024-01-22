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

router.get('/createCallID', (req, res) => {
    const callDoc = firestore.collection('calls').doc();

    try {
        res.json({ 
            success : true,
            id:callDoc.id
         });
    } catch (error) {
        res.status(400).json(error);
    }
});

router.post('/offerSdp', async (req, res) => {
    const callId = req.body.id;
    const callDoc = firestore.collection('calls').doc(callId);
    const callData = (await callDoc.get()).data();
    const offerDescription = callData.offer;
    // console.log("offerDescription -----> ",callData);
    // console.log("offerDescription -----> ",offerDescription);

    try {
        res.json({ 
            success : true,
            offerDescription:offerDescription
         });
    } catch (error) {
        res.status(400).json(error);
    }
});

router.post('/offer', async (req, res) => {//id = phone-number-id
    const callId = req.body.id;
    const offerSdp = req.body.offer;
    const clientype = req.body.clientype;//clientype: "callee"

    const callDoc = firestore.collection('calls').doc(callId);
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    console.log("callDoc.id =====>",callId);

    await callDoc.set({ offer:offerSdp });

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
                clientype:clientype
            };

            sendMessageToAll(massage);
        }
      });

    // When answered, add candidate to peer connection
    answerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
            let data = change.doc.data();
            console.log("answerCandidate's ICE data",data);
            const time = (new Date()).toLocaleTimeString();

            const massage = {
              type: "answerIceCandidates",
              data:data,
              time:time,
              clientype:clientype
            };

            sendMessageToAll(massage);
        }
        });
    });  
    // console.log(req.body);
    try {
        res.json(
            { 
                success : true
            }
        );
    } catch (error) {
        res.status(400).json(error);
    }
});

router.post('/answer', async (req, res) => {//id = phone-number-id
    const callId = req.body.id;
    const answerSdp = req.body.answer;
    const clientype = req.body.clientype;//clientype: "callee"


    const callDoc = firestore.collection('calls').doc(callId);
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    console.log("callDoc.id =====>",callId);

    await callDoc.update({ answer:answerSdp });

    // console.log(req.body);
    offerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          console.log(change);
          if (change.type === 'added') {
            let data = change.doc.data();
            console.log("offerCandidate's ICE data",data);
            const time = (new Date()).toLocaleTimeString();

            const massage = {
              type: "offerIceCandidates",
              data:data,
              time:time,
              clientype:clientype
            };

            sendMessageToAll(massage);

          }
        });
      });

    try {
        res.json(
            { 
                success : true
            }
        );
    } catch (error) {
        res.status(400).json(error);
    }
});

router.post('/offerICE', async (req, res) => {//id = phone-number-id
    // console.log("offerICE =====>",req.body);

    const callId = req.body.id;
    const offer_ice = req.body.offer_ice;

    const callDoc = firestore.collection('calls').doc(callId);
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    // console.log("callDoc.id =====>",callDoc.id);

    offerCandidates.add(offer_ice);

    // console.log(req.body);
    try {
        res.json({ success : true,
            id:callId
         });
    } catch (error) {
        res.status(400).json(error);
    }
});

router.post('/answerICE', async (req, res) => {//id = phone-number-id
    // console.log("offerICE =====>",req.body);

    const callId = req.body.id;
    const answer_ice = req.body.answer_ice;

    const callDoc = firestore.collection('calls').doc(callId);
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    // console.log("callDoc.id =====>",callDoc.id);

    answerCandidates.add(answer_ice);

    // console.log(req.body);
    try {
        res.json({ success : true,
            id:callId
         });
    } catch (error) {
        res.status(400).json(error);
    }
});

/*
 * send message event
 */ 
function sendMessageToAll(payload) {
    console.log("payload ------> ",clients);
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

//use it

router.get("/stream", handleSSE)

module.exports = router;