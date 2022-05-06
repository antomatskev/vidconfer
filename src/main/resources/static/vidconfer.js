let peerConnection;

const leaveButton = document.getElementById('leaveButton');
leaveButton.addEventListener('click', leave);

const signalingWebsocket = new WebSocket("ws://" + window.location.host + "/socket");

function leave() {
    console.log('Ending call');
    peerConnection.close();
    signalingWebsocket.close();
    window.location.href = './index.html';
}


signalingWebsocket.onmessage = function (msg) {
    console.log("Got message", msg.data);
    const signal = JSON.parse(msg.data);
    switch (signal.type) {
        case "offer":
            handleOffer(signal);
            break;
        case "answer":
            handleAnswer(signal);
            break;
        case "candidate":
            handleCandidate(signal);
            break;
        default:
            break;
    }
};

signalingWebsocket.onopen = init();

function sendSignal(signal) {
    if (signalingWebsocket.readyState === 1) {
        signalingWebsocket.send(JSON.stringify(signal));
    }
}

function init() {
    console.log("Connected to signaling endpoint. Now initializing.");
    preparePeerConnection();
    displayLocalStreamAndSignal(true);
}

function preparePeerConnection() {
    const configuration = {
        iceServers: [{
            urls: 'stun:stun.l.google.com:19302'
        }]
    };
    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.onnegotiationneeded = async () => {
        console.log('onnegotiationneeded');
        sendOfferSignal();
    };
    peerConnection.onicecandidate = function (event) {
        if (event.candidate) {
            sendSignal(event);
        }
    };
    peerConnection.addEventListener('track', displayRemoteStream);
}

async function displayLocalStreamAndSignal(firstTime) {
    console.log('Requesting local stream');
    const localVideo = document.getElementById('localVideo');
    let localStream;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });
        console.log('Received local stream');
        localVideo.srcObject = stream;
        localStream = stream;
        logVideoAudioTrackInfo(localStream);
        if (firstTime) {
            setTimeout(
                function () {
                    addLocalStreamToPeerConnection(localStream);
                }, 2000);
        }
        sendOfferSignal();
    } catch (e) {
        alert(`getUserMedia() error: ${e.name}`);
        throw e;
    }
    console.log('Start complete');
}

async function addLocalStreamToPeerConnection(localStream) {
    console.log('Starting addLocalStreamToPeerConnection');
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    console.log('localStream tracks added');
}

function displayRemoteStream(e) {
    console.log('displayRemoteStream');
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo.srcObject !== e.streams[0]) {
        remoteVideo.srcObject = e.streams[0];
        console.log('pc2 received remote stream');
    }
}

function sendOfferSignal() {
    peerConnection.createOffer(function (offer) {
        sendSignal(offer);
        peerConnection.setLocalDescription(offer);
    }, function (error) {
        alert("Error creating an offer: " + error);
    });
}

function handleOffer(offer) {
    peerConnection
        .setRemoteDescription(new RTCSessionDescription(offer));
    peerConnection.createAnswer(function (answer) {
        peerConnection.setLocalDescription(answer);
        sendSignal(answer);
    }, function (error) {
        alert("Error creating an answer: " + error);
    });
}

function handleAnswer(answer) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(
        answer));
    console.log("connection established successfully!!");
}

function handleCandidate(candidate) {
    alert("handleCandidate");
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

function logVideoAudioTrackInfo(localStream) {
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    if (videoTracks.length > 0) {
        console.log(`Using video device: ${videoTracks[0].label}`);
    }
    if (audioTracks.length > 0) {
        console.log(`Using audio device: ${audioTracks[0].label}`);
    }
}