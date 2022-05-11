let peerConnection;
let mediaRecorder;
let recordedBlobs;

const errorMsgElement = document.querySelector('span#errorMsg');
const recordedRemote = document.querySelector('video#remoteRecord');
const recordedLocal = document.querySelector('video#localRecord');
const recordButton = document.querySelector('button#record');

const exitBtn = document.getElementById('exit');

const mime = 'video/mp4;codecs=h264,aac';

exitBtn.addEventListener('click', exit);

recordButton.addEventListener('click', () => {
    if (recordButton.textContent === 'Record') {
        startRecording();
    } else {
        stopRecording();
        recordButton.textContent = 'Record';
        playButton.disabled = false;
        downloadButton.disabled = false;
    }
});

const playButton = document.querySelector('button#play');
playButton.addEventListener('click', () => {
    const superBufferRemote = new Blob(recordedBlobs, {type: mime});
    recordedRemote.src = null;
    recordedRemote.srcObject = null;
    recordedRemote.src = window.URL.createObjectURL(superBufferRemote);
    recordedRemote.controls = true;
    recordedRemote.play();

    const superBufferLocal = new Blob(recordedBlobs, {type: mime});
    recordedLocal.src = null;
    recordedLocal.srcObject = null;
    recordedLocal.src = window.URL.createObjectURL(superBufferLocal);
    recordedLocal.controls = true;
    recordedLocal.play();
});

const downloadButton = document.querySelector('button#download');
downloadButton.addEventListener('click', () => {
    // const blob = new Blob(recordedBlobs, {type: mime});
    const blob = new Blob(recordedBlobs, {type: 'video/webm'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'test.webm';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
});

const signalingWebsocket = new WebSocket("wss://" + window.location.host + "/socket");

function exit() {
    window.location.href = '/';
    console.log('Ending call');
    peerConnection.close();
    signalingWebsocket.close();
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

// signalingWebsocket.onopen = init({
//     audio: {
//         echoCancellation: {exact: true}
//     },
//     video: {
//         width: 1280, height: 720
//     }
// });

function sendSignal(signal) {
    if (signalingWebsocket.readyState === 1) {
        signalingWebsocket.send(JSON.stringify(signal));
    }
}

async function init(constraints) {
    try {
        console.log("Connected to signaling endpoint. Now initializing.");
        preparePeerConnection();
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        handleSuccess(stream, true);
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
            echoCancellation: {exact: true}
        },
        video: {
            width: 800, height: 640
        }
    };
    console.log('Using media constraints:', constraints);
    await init(constraints);
});

function handleSuccess(stream, firstTime) {
    console.log('getUserMedia() got stream:', stream);
    recordButton.disabled = false;
    const localVideo = document.getElementById('localVideo');
    try {
        window.stream = stream;
        console.log('Received local stream');
        localVideo.srcObject = stream;
        if (firstTime) {
            setTimeout(
                function () {
                    // addLocalStreamToPeerConnection(window.stream);
                    addLocalStreamToPeerConnection(stream);
                }, 2000);
        }
        sendOfferSignal();
    } catch (e) {
        alert(`getUserMedia() error: ${e.name}\n` + e);
        throw e;
    }
    console.log('Start complete');
}

// async function displayLocalStreamAndSignal(firstTime) {
//     console.log('Requesting local stream');
//     const localVideo = document.getElementById('localVideo');
//     let localStream;
//     try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//             audio: true,
//             video: true
//         });
//         console.log('Received local stream');
//         localVideo.srcObject = stream;
//         localStream = stream;
//         if (firstTime) {
//             setTimeout(
//                 function () {
//                     addLocalStreamToPeerConnection(localStream);
//                 }, 2000);
//         }
//         sendOfferSignal();
//     } catch (e) {
//         alert(`getUserMedia() error: ${e.name}\n` + e);
//         throw e;
//     }
//     console.log('Start complete');
// }

function handleDataAvailable(event) {
    console.log('handleDataAvailable', event);
    if (event.data && event.data.size > 0) {
        recordedBlobs.push(event.data);
    }
}

function startRecording() {
    recordedBlobs = [];
    const options = {mime};
    try {
        mediaRecorder = new MediaRecorder(window.stream, options);
    } catch (e) {
        console.error('Exception while creating MediaRecorder:', e);
        errorMsgElement.innerHTML = `Exception while creating MediaRecorder: ${JSON.stringify(e)}`;
        return;
    }

    console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
    recordButton.textContent = 'Stop';
    playButton.disabled = true;
    downloadButton.disabled = true;
    mediaRecorder.onstop = (event) => {
        console.log('Recorder stopped: ', event);
        console.log('Recorded Blobs: ', recordedBlobs);
    };
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.start();
    console.log('MediaRecorder started', mediaRecorder);
}

function stopRecording() {
    mediaRecorder.stop();
}