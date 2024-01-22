
const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
let apiUrl = "http://localhost:5300/";
let pc = null;
let localStream = null;
let remoteStream = null;
let sender;
let clientype = null;
let source = null;

// HTML elements
const webcamButton = document.getElementById('webcamButton');
// const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');

callButton.disabled = true;
answerButton.disabled = true;
webcamButton.disabled = false;
hangupButton.disabled = true;

callInput.value = "";

//Events
//url can be your server url
const url = "http://localhost:5300/stream"

const handleMessageEvent = (e) =>{
  console.log("message ==> ",e.data);

  const meg = JSON.parse(e.data);    
  switch (meg.type) {
    case "offerIceCandidates":
      if (clientype === meg.clientype){
        console.log("offerIceCandidates ==> ",meg.data);
        const offerCandidate = new RTCIceCandidate(meg.data);
        pc.addIceCandidate(offerCandidate);
      }
      break;
    case "answerIceCandidates":
      if (clientype === meg.clientype){
        console.log("answerIceCandidates ==> ",meg.data);
        const answerCandidate = new RTCIceCandidate(meg.data);
        pc.addIceCandidate(answerCandidate);
      }
      break;
    case "answerDescription":
      if (clientype === meg.clientype){
        console.log("remote answerDescription ==> ",meg.data);
        const answerDescription = new RTCSessionDescription(meg.data);
        pc.setRemoteDescription(answerDescription);
      }
      break;
    default:
      break;
  }
}

const handleOpenEvent = (e) =>{
  // successful connection.
  console.log("connection open");
}

const handleErrorEvent = (e) =>{
  // error occurred
  console.log("onError ==>",e);
}

const addEventListenerForCall = () =>{
  if ('EventSource' in window) {
    source = new EventSource(url)

    source.addEventListener('message', handleMessageEvent, false);
    source.addEventListener('open', handleOpenEvent, false);
    source.addEventListener('error', handleErrorEvent, false);
  }
}

// 1. Setup media sources
webcamButton.onclick = async () => {
  console.log("Setup media sources");
  addEventListenerForCall();
  pc = new RTCPeerConnection(servers);
  // localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
  remoteStream = new MediaStream();

  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    sender = pc.addTrack(track, localStream);
  });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => {
    console.log("ontrack");
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  // webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
  hangupButton.disabled = false;
};

// 2. Create an offer
callButton.onclick = async () => {
  // Reference Firestore collections for signaling
  /*const callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');*/
  clientype = "caller";
  const callId = await getCallID();
  callInput.value = callId.id;

  // Get candidates for caller, save to db
  pc.onicecandidate = (event) => {
    // console.log("offerCandidates ======> ",event.candidate.toJSON())
    const offerIceCandidate = event.candidate && {
      offer_ice: event.candidate.toJSON(),
      id: callId.id,
    };
    event.candidate && setOfferIce(offerIceCandidate);
  };

  // Create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  const data = await setOffer({clientype: clientype,offer:offer, id:callId.id});
  console.log(data);
  // callInput.value = data.id;
  // await callDoc.set({ offer });

  // Listen for remote answer
  /*callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // When answered, add candidate to peer connection
  answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        let data = change.doc.data();
        console.log("answerCandidate's ICE data",data);
        const candidate = new RTCIceCandidate(data);
        pc.addIceCandidate(candidate);
      }
    });
  });*/

  // hangupButton.disabled = false;
};

// 3. Answer the call with the unique ID
answerButton.onclick = async () => {
  clientype = "callee";
  const callId = callInput.value;
  /*const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');*/

  pc.onicecandidate = (event) => {
    // event.candidate && answerCandidates.add(event.candidate.toJSON());
    const answerIceCandidate = event.candidate && {
      answer_ice: event.candidate.toJSON(),
      id: callId,
      clientype: clientype,
    };
    event.candidate && setAnswerIce(answerIceCandidate);
  };

  // const callData = (await callDoc.get()).data();

  // const offerDescription = callData.offer;
  const offerData = await getOfferSdp(callId);
  // console.log("offerData ======> ",offerData);
  await pc.setRemoteDescription(new RTCSessionDescription(offerData.offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  const data = await setAnswer({clientype: clientype, answer:answer, id:callId});
  console.log(data);

  // await callDoc.update({ answer });
  /*offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        console.log("offerCandidate's ICE data",data);
        const candidate = new RTCIceCandidate(data);
        pc.addIceCandidate(candidate);
      }
    });
  });*/
};

// 3. Hangup the call
hangupButton.onclick = async () => {
  remoteStream.clone();
  remoteStream = null;
  // webcamVideo.srcObject=null;
  remoteVideo.srcObject= null;
  localStream.getTracks().forEach(function(track) {
    track.stop();
  });
  localStream = null;

  pc.removeTrack(sender);
  pc.close();
  pc = null;

  source.removeEventListener("message", handleMessageEvent, false);
  source.removeEventListener("open", handleOpenEvent, false);
  source.removeEventListener("error", handleErrorEvent, false);

  callButton.disabled = true;
  answerButton.disabled = true;
  webcamButton.disabled = false;
  hangupButton.disabled = true;

  callInput.value = "";
};





//Api call methodes
const postRequestOption = (requestBody) => {
  return {
    method: 'POST',
    body: JSON.stringify(requestBody),
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

const getRequestOption = () => {
  return {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

const setOffer = async (offer) => {
	const response = await fetch(`${apiUrl}offer`, postRequestOption(offer));
  
  if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

  const data = await response.json();
  return data;
}

const setAnswer = async (answer) => {
	const response = await fetch(`${apiUrl}answer`, postRequestOption(answer));
  
  if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

  const data = await response.json();
  return data;
}

const setOfferIce = async (offerIce) => {
	const response = await fetch(`${apiUrl}offerICE`, postRequestOption(offerIce));
  
  if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

  const data = await response.json();
  return data;
}

const setAnswerIce = async (answerIce) => {
	const response = await fetch(`${apiUrl}answerICE`, postRequestOption(answerIce));
  
  if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

  const data = await response.json();
  return data;
}

const getCallID = async () => {
	const response = await fetch(`${apiUrl}createCallID`, getRequestOption());
  
  if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

  const data = await response.json();
  return data;
}

const getOfferSdp = async (callId) => {
	const response = await fetch(`${apiUrl}offerSdp`, {
    method: 'POST',
    body: JSON.stringify({id:callId}),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

  const data = await response.json();
  console.log("data ======> ",data);
  return data;
}

