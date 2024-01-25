const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
let apiUrl = "http://localhost:5300/";//"https://voice-call-fwdg.onrender.com/";//"http://localhost:5300/";
let pc = null;
let localStream = null;
let remoteStream = null;
let sender;
let clientype = null;
let source = null;

// HTML elements
const webcamButton = document.getElementById("webcamButton");
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById("callButton");
const callInput = document.getElementById("callInput");
const answerButton = document.getElementById("answerButton");
const remoteVideo = document.getElementById("remoteVideo");
const hangupButton = document.getElementById("hangupButton");
// const connectButton = document.getElementById("connectButton");
// const getAnswerSDPButton = document.getElementById("getAnswerSDPButton");


// const offerSDPTextView = document.getElementById("offerSDP");
// const answerSDPTextView = document.getElementById("answerSDP");

callButton.disabled = true;
answerButton.disabled = true;
webcamButton.disabled = false;
hangupButton.disabled = true;
// connectButton.disabled = true;
// getAnswerSDPButton.disabled = true;

callInput.value = "";

//Events
//url can be your server url
const url = `${apiUrl}stream`//"https://voice-call-fwdg.onrender.com/stream";

const handleMessageEvent = (e) => {
  console.log("message ==> ", e.data);

  const meg = JSON.parse(e.data);
  switch (meg.type) {
    case "offerIceCandidates":
      if (clientype === meg.clientype) {
        console.log("offerIceCandidates ==> ", meg.data);
        const offerCandidate = new RTCIceCandidate(meg.data);
        // pc.addIceCandidate(offerCandidate);
      }
      break;
    case "answerIceCandidates":
      if (clientype === meg.clientype) {
        console.log("answerIceCandidates ==> ", meg.data);
        const answerCandidate = new RTCIceCandidate(meg.data);
        // pc.addIceCandidate(answerCandidate);
      }
      break;
    case "answerDescription":
      if (clientype === meg.clientype) {
        console.log("remote answerDescription ==> ", meg.data);
        console.log('Connection State:', pc.connectionState);
        setRemoteAnswer(meg.data);

        // const answerDescription = new RTCSessionDescription(meg.data);
        // pc.setRemoteDescription(answerDescription).then((a) =>
        //   console.log("done")
        // );
      }
      break;
    default:
      break;
  }
};

const handleOpenEvent = (e) => {
  // successful connection.
  console.log("connection open");
};

const handleErrorEvent = (e) => {
  // error occurred
  console.log("onError ==>", e);
};

const addEventListenerForCall = () => {
  if ("EventSource" in window) {
    source = new EventSource(url);

    source.addEventListener("message", handleMessageEvent, false);
    source.addEventListener("open", handleOpenEvent, false);
    source.addEventListener("error", handleErrorEvent, false);
  }
};

// Define audio constraints with all possible configurations
const audioConstraints = {
  echoCancellation: true,     // Enable echo cancellation
  noiseSuppression: true,     // Enable noise suppression
  autoGainControl: true,      // Enable automatic gain control
  latency: 0.01,              // Set the desired latency in seconds (if supported)
  sampleRate: 48000,          // Set the desired audio sample rate (if supported)
  channelCount: 2,            // Use stereo audio (2 channels)
  // deviceId: 'yourAudioDeviceId', // Specify a particular audio device (if needed)
};

let localStreamOption = {
    video: true,
    audio: audioConstraints,
}

let rtcOptions = {
  offerToReceiveAudio: true,   // Default is true, willing to receive audio
  offerToReceiveVideo: true,   // Default is true, willing to receive video
  voiceActivityDetection: true, // Enable voice activity detection 
} 

const answerOptions = {
  voiceActivityDetection: true, // Enable voice activity detection in the answer
};

// 1. Setup media sources
webcamButton.onclick = async () => {
  console.log("Setup media sources");
  addEventListenerForCall();
  pc = new RTCPeerConnection(servers);
  localStream = await navigator.mediaDevices.getUserMedia(localStreamOption);
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

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
  hangupButton.disabled = false;
  // connectButton.disabled = false;
  // getAnswerSDPButton.disabled = false;

};

// 2. Create an offer
callButton.onclick = async () => {
  // Reference Firestore collections for signaling
  clientype = "connect";
  const callId = await getCallID();

  answerButton.disabled = true;
  callButton.disabled = true;

  // Get candidates for caller, save to db
  pc.onicecandidate = (event) => {
    // console.log("offerCandidates ======> ",event.candidate.toJSON())
    if (event.candidate) {
      // ICE candidate available
      console.log(" NEW ICE candidate!! Reprinting SDP\n");
      console.log(JSON.stringify(pc.localDescription));
    } else {
      // ICE gathering is complete
      console.log('ICE gathering complete');
      console.log('Final ICE gathering state:', pc.iceGatheringState);
      sendOfferSdp(pc.localDescription.sdp,clientype,callId.id)

    //   const offerIceCandidate = event.candidate && {
    //     connection: {
    //       webrtc:{
    //           ice : event.candidate.toJSON()
    //       }
    //     },
    //     ice_type:"offer",
    //     call_id: callId.id,
    //   }
    //   event.candidate && setIce(offerIceCandidate);
    }
    
  };

  pc.addEventListener('signalingstatechange', () => {
    console.log('Signaling State:', pc.signalingState);
  });

  // const sendChannel = pc.createDataChannel("sendChannel");
  // sendChannel.onmessage = e =>  console.log("Message : "  + e.data )
  // sendChannel.onopen = e => console.log("Channel Opened :\n");
  // sendChannel.onclose =e => console.log("Channel Closed :\n");

  // pc.createOffer().then(o => pc.setLocalDescription(o) )

  // Create offer
  const offerDescription = await pc.createOffer(rtcOptions);
  await pc.setLocalDescription(offerDescription);
};

const sendOfferSdp = async (offersdp, client_type, call_id) => {
  // offerSDPTextView.value = offersdp;
  callInput.value = call_id;

  const connectPayload = {
    call_id: call_id,
    action: client_type,
    connection: {
      webrtc: {
        sdp: offersdp,
      },
    },
  };

  const data = await connectCall(connectPayload);
  console.log(data);
};

/*connectButton.onclick = () => {
  const answerSdp = answerSDPTextView.value;

  const answerDescription = {
    sdp: answerSdp,
    type: "answer",
  };

  setRemoteAnswer(answerDescription);

  connectButton.disabled = true;
  getAnswerSDPButton.disabled = true;
};*/

const setRemoteAnswer = (answerDes) => {
  const answerDescription = new RTCSessionDescription(answerDes);
  pc.setRemoteDescription(answerDescription).then((a) => console.log("done"));
  console.log('Connection State:', pc.connectionState);
};

/*getAnswerSDPButton.onclick = async () => {
  getAnswerSDPButton.disabled = true;
  const callId = callInput.value;
  const answerRowData = await getAnswerSdp(callId); //offerSDPTextView.value;//await getOfferSdp(callId);
  const answerData = answerRowData.answerDescription.sdp;

  answerSDPTextView.value = answerData;
}*/

// 3. Answer the call with the unique ID
answerButton.onclick = async () => {
  clientype = "accept";
  const callId = callInput.value;

  // connectButton.disabled = true;
  // getAnswerSDPButton.disabled = true;
  callButton.disabled = true;
  answerButton.disabled = true;

  pc.addEventListener('signalingstatechange', () => {
    console.log('Signaling State:', pc.signalingState);
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      // ICE candidate available
      console.log(" NEW ice candidnat!! on localconnection reprinting SDP ");
      console.log(JSON.stringify(pc.localDescription));
    } else {
      // ICE gathering is complete
      console.log('ICE gathering complete');
      console.log('Final ICE gathering state:', pc.iceGatheringState);
      sendAnswerSdp(pc.localDescription.sdp,clientype,callId)

      // const answerIceCandidate = event.candidate &&  {
      //   connection: {
      //     webrtc:{
      //         ice : event.candidate.toJSON()
      //     }
      //   },
      //   ice_type:"answer",
      //   call_id: callId,
      // };
      // event.candidate && setIce(answerIceCandidate);
    }
  };

  //****get offer sdp from textview */
  let offerData = null;
  if (callId != "") {
    // if (offerSDPTextView.value != "") {
    //   offerData = offerSDPTextView.value; //offerSDPTextView.value;//await getOfferSdp(callId);
    // } else {
      //****Get offer from firestore as per the callid*/
      const offerRowData = await getOfferSdp(callId); //offerSDPTextView.value;//await getOfferSdp(callId);
      offerData = offerRowData.offerDescription.sdp;
      // offerSDPTextView.value = offerData;
    // }
  } else {
    console.log("offer sdp and client id is missing");
    return;
  }

  const offerDescription = {
    sdp: offerData,
    type: "offer",
  };

  console.log("offerData ======> ", offerData);
  await pc.setRemoteDescription(offerDescription);
  console.log("done");
  const answerDescription = await pc.createAnswer(answerOptions);
  await pc.setLocalDescription(answerDescription);
};

const sendAnswerSdp = async (answersdp, client_type, call_id) => {
  // answerSDPTextView.value = answersdp;

  const connectPayload = {
    call_id: call_id,
    action: client_type,
    connection: {
      webrtc: {
        sdp: answersdp,
      },
    },
  };

  const data = await connectCall(connectPayload);
  console.log(data);
};

// 3. Hangup the call
hangupButton.onclick = async () => {
  remoteStream.clone();
  remoteStream = null;
  webcamVideo.srcObject=null;
  remoteVideo.srcObject = null;
  localStream.getTracks().forEach(function (track) {
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

  // offerSDPTextView.value = "";
  // answerSDPTextView.value = "";

  callButton.disabled = true;
  answerButton.disabled = true;
  webcamButton.disabled = false;
  hangupButton.disabled = true;
  // connectButton.disabled = true;
  // getAnswerSDPButton.disabled = true;

  callInput.value = "";
};

//Api call methodes
const postRequestOption = (requestBody) => {
  return {
    method: "POST",
    body: JSON.stringify(requestBody),
    headers: {
      "Content-Type": "application/json",
    },
  };
};

const getRequestOption = () => {
  return {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  };
};

const connectCall = async (offer) => {
  const response = await fetch(`${apiUrl}calls`, postRequestOption(offer));

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
};

const setIce = async (offerIce) => {
  const response = await fetch(
    `${apiUrl}icecandidate`,
    postRequestOption(offerIce)
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
};

const getCallID = async () => {
  const response = await fetch(`${apiUrl}register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
};

const getOfferSdp = async (callId) => {
  const response = await fetch(`${apiUrl}${callId}/offerSdp`, getRequestOption);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  console.log("data ======> ", data);
  return data;
};

const getAnswerSdp = async (callId) => {
  const response = await fetch(`${apiUrl}${callId}/answersdp`, getRequestOption);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  console.log("data ======> ", data);
  return data;
};
