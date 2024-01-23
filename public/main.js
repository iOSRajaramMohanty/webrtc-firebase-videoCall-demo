
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
// const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');
const connectButton = document.getElementById('connectButton');

const offerSDPTextView = document.getElementById('offerSDP');
const answerSDPTextView = document.getElementById('answerSDP');

callButton.disabled = true;
answerButton.disabled = true;
webcamButton.disabled = false;
hangupButton.disabled = true;
connectButton.disabled = true;

// callInput.value = "";

//Events
//url can be your server url
const url = "http://localhost:5300/stream"

const handleMessageEvent = (e) =>{
  console.log("message ==> ",e.data);

  const meg = JSON.parse(e.data);    
  switch (meg.type) {
    case "answerDescription":
      if (clientype === meg.clientype){
        console.log("remote answerDescription ==> ",meg.data);
        setRemoteAnswer(meg.data)
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
  connectButton.disabled = false;
};

// 2. Create an offer
callButton.onclick = async () => {
  // Reference Firestore collections for signaling
  clientype = "connect";
  // const callId = await getCallID();
  // callInput.value = callId.id;

  // Get candidates for caller, save to db
  pc.onicecandidate = (event) => {
    console.log(" NEW ICE candidate!! Reprinting SDP\n" )
    console.log(JSON.stringify(pc.localDescription));
  };

  // const sendChannel = pc.createDataChannel("sendChannel");
  // sendChannel.onmessage = e =>  console.log("Message : "  + e.data )
  // sendChannel.onopen = e => console.log("Channel Opened :\n");
  // sendChannel.onclose =e => console.log("Channel Closed :\n");


  // Create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  setTimeout( async () =>{
    offerSDPTextView.value = pc.localDescription.sdp;
    /*
    const connectPayload = {
        call_id:callId.id,
        action: clientype,
        connection: {
            webrtc:{
                sdp : pc.localDescription.sdp
            }
        }
    }

    const data = await connectCall(connectPayload);
    console.log(data);*/
  },1000)
  
};

connectButton.onclick = () => {
  const answerSdp = answerSDPTextView.value;

  const answerDescription = {
    sdp: answerSdp,
    type: "answer",
  };

  setRemoteAnswer(answerDescription);
}

const setRemoteAnswer = (answerDes) =>{
  const answerDescription = new RTCSessionDescription(answerDes);
  pc.setRemoteDescription(answerDescription).then(a=>console.log("done"));
}

// 3. Answer the call with the unique ID
answerButton.onclick = async () => {
  clientype = "accept";
  // const callId = callInput.value;

  //****get offer sdp from textview */
  let offerData = null
  // if (callId != ""){
    if (offerSDPTextView.value != ""){
      offerData = offerSDPTextView.value;
    }else{
      console.log("offer sdp and client id is missing");
      return;
    }
  // }else{
  //   console.log("offer sdp and client id is missing");
  //   return;
  // }

    pc.onicecandidate = (event) => {
      console.log(" NEW ice candidnat!! on localconnection reprinting SDP " )
      console.log(JSON.stringify(pc.localDescription) )
    };
   
  //   pc.ondatachannel= e => {
  //     const receiveChannel = e.channel;
  //     receiveChannel.onmessage =e =>  console.log("Message : " + e.data )
  //     receiveChannel.onopen = e => console.log("Channel Opened :\n");
  //     receiveChannel.onclose =e => console.log("Channel Closed :\n");
  //     pc.channel = receiveChannel;
  //  }

    const offerDescription = {
      sdp: offerData,
      type: "offer",
    };

    console.log("offerData ======> ",offerData);
    await pc.setRemoteDescription(offerDescription);
    console.log("done");
    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    setTimeout( async () =>{ 
      answerSDPTextView.value = pc.localDescription.sdp;
      /*const connectPayload = {
        call_id:callId,
        action: clientype,
        connection: {
            webrtc:{
                sdp : pc.localDescription.sdp
            }
        }
      }
  
      const data = await connectCall(connectPayload);
      console.log(data);*/
    },1000);
    
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
  source = null;

  offerSDPTextView.value = "";
  answerSDPTextView.value = "";


  callButton.disabled = true;
  answerButton.disabled = true;
  webcamButton.disabled = false;
  hangupButton.disabled = true;
  connectButton.disabled = true;

  // callInput.value = "";
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

const connectCall = async (offer) => {
	const response = await fetch(`${apiUrl}calls`, postRequestOption(offer));
  
  if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

  const data = await response.json();
  return data;
}

const getCallID = async () => {
	const response = await fetch(`${apiUrl}register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

  const data = await response.json();
  return data;
}
