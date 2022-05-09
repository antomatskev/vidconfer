let peerConnection;
let mediaRecorder;
let recordedBlobs;

const codecPreferences = document.querySelector('#codecPreferences');

const errorMsgElement = document.querySelector('span#errorMsg');
const recordedVideo = document.querySelector('video#recorded');
const recordButton = document.querySelector('button#record');

const exitBtn = document.getElementById('exit');
exitBtn.addEventListener('click', exit);

const signalingWebsocket = new WebSocket("wss://" + window.location.host + "/socket");

function exit() {
    console.log('Ending call');
    peerConnection.close();
    signalingWebsocket.close();
    window.location.href = '/';
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

// signalingWebsocket.onopen = init();

function sendSignal(signal) {
    if (signalingWebsocket.readyState === 1) {
        signalingWebsocket.send(JSON.stringify(signal));
    }
}

async function init(constraints) {
    try {
        // const stream = await navigator.mediaDevices.getUserMedia(constraints);
        // handleSuccess(stream);
        console.log("Connected to signaling endpoint. Now initializing.");
        preparePeerConnection();
        displayLocalStreamAndSignal(true);
    } catch (e) {
        console.error('navigator.getUserMedia error:', e);
        errorMsgElement.innerHTML = `navigator.getUserMedia error:${e.toString()}`;
    }
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

document.querySelector('button#start').addEventListener('click', async () => {
    document.querySelector('button#start').disabled = true;
    const constraints = {
        audio: {
            // echoCancellation: {exact: true}
        },
        video: {
            width: 1280, height: 720
        }
    };
    console.log('Using media constraints:', constraints);
    await init(constraints);
});

function handleSuccess(stream) {
    recordButton.disabled = false;
    console.log('getUserMedia() got stream:', stream);
    window.stream = stream;

    const gumVideo = document.querySelector('video#localVideo');
    gumVideo.srcObject = stream;

    getSupportedMimeTypes().forEach(mimeType => {
        const option = document.createElement('option');
        option.value = mimeType;
        option.innerText = option.value;
        codecPreferences.appendChild(option);
    });
    codecPreferences.disabled = false;
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
        if (firstTime) {
            setTimeout(
                function () {
                    addLocalStreamToPeerConnection(localStream);
                }, 2000);
        }
        sendOfferSignal();
    } catch (e) {
        alert(`getUserMedia() error: ${e.name}\n` + e);
        throw e;
    }
    console.log('Start complete');
}