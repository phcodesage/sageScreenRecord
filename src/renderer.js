// Renderer process - uses electronAPI exposed by preload script

// Get DOM elements
const videoElement = document.getElementById('videoElement');
const videoSelectBtn = document.getElementById('videoSelectBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusText = document.getElementById('statusText');

// Global variables
let mediaRecorder;
let recordedChunks = [];
let currentStream;
let availableSources = [];

// Event listeners
videoSelectBtn.addEventListener('click', getVideoSources);
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);

// Get available video sources
async function getVideoSources() {
  try {
    updateStatus('Getting available sources...');
    availableSources = await window.electronAPI.getVideoSources();
    
    if (availableSources.length === 0) {
      updateStatus('No video sources found');
      return;
    }
    
    // Create a simple selection UI
    showSourceSelection();
    
  } catch (error) {
    console.error('Error getting video sources:', error);
    updateStatus('Error getting video sources');
  }
}

// Show source selection UI
function showSourceSelection() {
  // Create a modal-like selection
  const modal = document.createElement('div');
  modal.className = 'source-modal';
  modal.innerHTML = `
    <div class="source-modal-content">
      <h3>Select Video Source</h3>
      <div class="source-list">
        ${availableSources.map((source, index) => `
          <div class="source-item" data-index="${index}">
            <img src="${source.thumbnail}" alt="${source.name}" />
            <span>${source.name}</span>
          </div>
        `).join('')}
      </div>
      <button class="close-modal">Cancel</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners
  modal.querySelectorAll('.source-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      selectSource(availableSources[index]);
      document.body.removeChild(modal);
    });
  });
  
  modal.querySelector('.close-modal').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
}

// Select a video source
async function selectSource(source) {
  try {
    updateStatus(`Selected: ${source.name}`);
    
    const constraints = {
      audio: false, // Set to true if you want to capture microphone
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id
        }
      }
    };

    // Create a stream
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Preview the source in the video element
    videoElement.srcObject = currentStream;
    videoElement.play();
    
    // Enable the start button
    startBtn.disabled = false;
    updateStatus(`Ready to record: ${source.name}`);
    
  } catch (error) {
    console.error('Error selecting source:', error);
    updateStatus('Error selecting video source');
  }
}

// Start recording
function startRecording() {
  if (!currentStream) {
    updateStatus('No video source selected');
    return;
  }

  try {
    recordedChunks = [];
    
    // Create media recorder
    mediaRecorder = new MediaRecorder(currentStream, {
      mimeType: 'video/webm; codecs=vp9'
    });
    
    // Handle data available event
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    
    // Handle stop event
    mediaRecorder.onstop = handleStop;
    
    // Start recording
    mediaRecorder.start();
    
    // Update UI
    startBtn.disabled = true;
    stopBtn.disabled = false;
    videoSelectBtn.disabled = true;
    updateStatus('🔴 Recording...');
    
  } catch (error) {
    console.error('Error starting recording:', error);
    updateStatus('Error starting recording');
  }
}

// Stop recording
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    
    // Update UI
    startBtn.disabled = false;
    stopBtn.disabled = true;
    videoSelectBtn.disabled = false;
    updateStatus('⏹️ Recording stopped. Saving...');
  }
}

// Handle recording stop
async function handleStop() {
  try {
    const blob = new Blob(recordedChunks, {
      type: 'video/webm; codecs=vp9'
    });
    
    // Convert blob to array buffer
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Save file using IPC
    const result = await window.electronAPI.saveRecording(uint8Array);
    
    if (result.success) {
      updateStatus(`✅ Recording saved: ${result.filePath}`);
    } else if (result.cancelled) {
      updateStatus('Recording save cancelled');
    } else {
      updateStatus(`Error saving recording: ${result.error}`);
    }
    
  } catch (error) {
    console.error('Error handling stop:', error);
    updateStatus('Error processing recording');
  }
}

// Update status text
function updateStatus(message) {
  statusText.textContent = message;
  console.log('Status:', message);
}

// Initialize
updateStatus('Click "Choose a Video Source" to begin');