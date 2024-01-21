const express = require('express');
const router = express.Router();
const path = require('path');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue, Filter } = require('firebase-admin/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDyxhO5BWrMgOGXnWJfCbTDcpUnGHCvfaQ",
  authDomain: "voicecallwebrtc-fb021.firebaseapp.com",
  projectId: "voicecallwebrtc-fb021",
  storageBucket: "voicecallwebrtc-fb021.appspot.com",
  messagingSenderId: "160134247848",
  appId: "1:160134247848:web:c29fca3f9aabe6ab21199d"
};

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
        // if (!pc.currentRemoteDescription && data?.answer) {
        //   const answerDescription = new RTCSessionDescription(data.answer);
        //   pc.setRemoteDescription(answerDescription);
        // }
        if (data?.answer) {
            console.log("answerDescription setRemoteDescription");
            const time = (new Date()).toLocaleTimeString();

            const massage = `${JSON.stringify({
                type: "answerDescription",
                data:data.answer,
                time:time,
                clientype:clientype
            })}`;

            sendMessageToAll(massage);
        }
      });

    // When answered, add candidate to peer connection
    answerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
            let data = change.doc.data();
            console.log("answerCandidate's ICE data",data);
            // const candidate = new RTCIceCandidate(data);
            // pc.addIceCandidate(candidate);
            const time = (new Date()).toLocaleTimeString();

            const massage = `${JSON.stringify({
              type: "answerIceCandidates",
              data:data,
              time:time,
              clientype:clientype
            })}`;

            sendMessageToAll(massage);
        }
        });
    });  
    // console.log(req.body);
    try {
        res.json({ success : true
         });
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

            const massage = `${JSON.stringify({
              type: "offerIceCandidates",
              data:data,
              time:time,
              clientype:clientype
            })}`;

            sendMessageToAll(massage);

            // const candidate = new RTCIceCandidate(data);
            // pc.addIceCandidate(candidate);
          }
        });
      });

    try {
        res.json({ success : true
         });
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

    // const offer = req.body.offer;
    // await callDoc.set({ offer });

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
    clients.forEach(client => client.response.write(`data: ${JSON.stringify(payload)}\n\n`))
}

const handleSSE = (req, response) =>{

  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const time = (new Date()).toLocaleTimeString();

  const data = `${JSON.stringify({
    offerType: "offer",
    time:time
  })}`;

  response.write(data);

  const clientId = Date.now();
  
  const newClient = {
        id: clientId,
        response
    };
    
  clients.push(newClient);

  req.on('close', () => {
    console.log(`Connection closed`);
    // clients = clients.filter(client => client.id !== clientId);
  });
//   const id = (new Date()).toLocaleTimeString();
  // Sends a SSE every 3 seconds on a single connection.
//   setInterval(function() {
//     emitSSE(res, id, (new Date()).toLocaleTimeString());
//   }, sendInterval);

//   emitSSE(res, req.id, req.dateTime);
}

//use it

router.get("/stream", handleSSE)

module.exports = router;