<template>
  <div class="mic-selector">
    <div class="q-py-md">
      <div class="text-h6 q-mb-md">
        <q-icon name="mic" class="q-mr-sm" />
        Microphone Settings
      </div>
      
      <!-- Microphone Selection with Refresh Button -->
      <div class="row q-gutter-sm q-mb-md">
        <q-select
          v-model="selectedDevice"
          :options="audioDevices"
          option-value="deviceId"
          option-label="label"
          label="Select Microphone"
          outlined
          :loading="loadingDevices"
          :disable="loadingDevices"
          emit-value
          map-options
          @update:model-value="onDeviceChange"
          class="col-grow"
        >
          <template v-slot:no-option>
            <q-item>
              <q-item-section class="text-grey">
                No microphones found
              </q-item-section>
            </q-item>
          </template>
        </q-select>

        <q-btn
          flat
          icon="refresh"
          @click="refreshDevices"
          :loading="loadingDevices"
          round
        />
      </div>

        <!-- Microphone Test Section -->
        <div class="q-mt-md">
          <div class="text-subtitle2 q-mb-sm">Microphone Test</div>
          
          <!-- Test Controls -->
          <div class="row q-gutter-sm q-mb-md">
            <q-btn
              :color="isTestingMic ? 'negative' : 'primary'"
              :icon="isTestingMic ? 'stop' : 'play_arrow'"
              :label="isTestingMic ? 'Stop Test' : 'Start Test'"
              @click="toggleMicTest"
              :disable="!selectedDevice"
            />
            
            <q-chip
              v-if="isTestingMic"
              :color="micLevel > 50 ? 'positive' : micLevel > 20 ? 'warning' : 'grey'"
              text-color="white"
              icon="volume_up"
            >
              {{ Math.round(micLevel) }}%
            </q-chip>
          </div>

          <!-- Visual Activity Bar -->
          <div class="mic-activity-container q-mb-md">
            <div class="text-caption q-mb-xs">Activity Level</div>
            <div class="mic-activity-bar">
              <div 
                class="mic-activity-fill"
                :style="{ width: micLevel + '%' }"
                :class="{
                  'activity-low': micLevel < 20,
                  'activity-medium': micLevel >= 20 && micLevel < 50,
                  'activity-high': micLevel >= 50
                }"
              ></div>
            </div>
            <div class="row justify-between text-caption q-mt-xs">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <!-- Audio Permissions Status -->
          <q-banner
            v-if="permissionStatus === 'denied'"
            class="bg-negative text-white q-mb-md"
            icon="mic_off"
          >
            Microphone access denied. Please enable microphone permissions in your browser.
          </q-banner>

          <q-banner
            v-else-if="permissionStatus === 'prompt'"
            class="bg-warning text-white q-mb-md"
            icon="warning"
          >
          Click "Start Test" to request microphone permissions.
        </q-banner>
      </div>
    </div>
  </div>
</template><script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface AudioDevice {
  deviceId: string
  label: string
  kind: string
}

// Reactive state
const audioDevices = ref<AudioDevice[]>([])
const selectedDevice = ref<string>('')
const loadingDevices = ref(false)
const isTestingMic = ref(false)
const micLevel = ref(0)
const permissionStatus = ref<'granted' | 'denied' | 'prompt'>('prompt')

// localStorage key for saving microphone selection
const MIC_STORAGE_KEY = 'okuu-selected-microphone'

// Audio context and analysis
let audioContext: AudioContext | null = null
let mediaStream: MediaStream | null = null
let analyser: AnalyserNode | null = null
let micLevelInterval: number | null = null

// Save microphone selection to localStorage
const saveMicSelection = (deviceId: string) => {
  try {
    localStorage.setItem(MIC_STORAGE_KEY, deviceId)
  } catch (error) {
    console.error('Error saving microphone selection:', error)
  }
}

// Load microphone selection from localStorage
const loadMicSelection = (): string => {
  try {
    return localStorage.getItem(MIC_STORAGE_KEY) || ''
  } catch (error) {
    console.error('Error loading microphone selection:', error)
    return ''
  }
}

// Get available audio devices
const getAudioDevices = async (): Promise<AudioDevice[]> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
      .filter(device => device.kind === 'audioinput')
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
        kind: device.kind
      }))
  } catch (error) {
    console.error('Error getting audio devices:', error)
    return []
  }
}

// Refresh device list
const refreshDevices = async () => {
  loadingDevices.value = true
  try {
    // Request permissions first to get device labels
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach(track => track.stop())
    
    audioDevices.value = await getAudioDevices()
    permissionStatus.value = 'granted'
    
    // Load saved selection or select first device
    const savedDevice = loadMicSelection()
    if (savedDevice && audioDevices.value.some(device => device.deviceId === savedDevice)) {
      // Set the saved device after devices are loaded
      selectedDevice.value = savedDevice
    } else if (audioDevices.value.length > 0) {
      // Select first device if no saved device or saved device not found
      selectedDevice.value = audioDevices.value[0]?.deviceId || ''
      if (selectedDevice.value) {
        saveMicSelection(selectedDevice.value)
      }
    } else {
      // No devices available
      selectedDevice.value = ''
    }
  } catch (error) {
    console.error('Error refreshing devices:', error)
    permissionStatus.value = 'denied'
    selectedDevice.value = ''
  } finally {
    loadingDevices.value = false
  }
}

// Handle device selection change
const onDeviceChange = (deviceId: string) => {
  selectedDevice.value = deviceId
  saveMicSelection(deviceId)
  // If testing, restart with new device
  if (isTestingMic.value) {
    stopMicTest()
    setTimeout(startMicTest, 100)
  }
}

// Start microphone test
const startMicTest = async () => {
  try {
    if (!selectedDevice.value) return
    
    // Create audio context
    audioContext = new AudioContext()
    
    // Get media stream from selected device
    const constraints: MediaStreamConstraints = {
      audio: selectedDevice.value 
        ? {
            deviceId: { exact: selectedDevice.value },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        : {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
    }
    
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
    
    // Create analyser for audio level detection
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    
    const source = audioContext.createMediaStreamSource(mediaStream)
    source.connect(analyser)
    
    // Start monitoring audio level
    startMicLevelMonitoring()
    
    isTestingMic.value = true
    permissionStatus.value = 'granted'
  } catch (error) {
    console.error('Error starting mic test:', error)
    permissionStatus.value = 'denied'
  }
}

// Stop microphone test
const stopMicTest = () => {
  if (micLevelInterval) {
    clearInterval(micLevelInterval)
    micLevelInterval = null
  }
  
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop())
    mediaStream = null
  }
  
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  
  analyser = null
  isTestingMic.value = false
  micLevel.value = 0
}

// Toggle microphone test
const toggleMicTest = () => {
  if (isTestingMic.value) {
    stopMicTest()
  } else {
    startMicTest()
  }
}

// Monitor microphone level
const startMicLevelMonitoring = () => {
  if (!analyser) return
  
  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)
  
  micLevelInterval = setInterval(() => {
    if (!analyser) return
    
    analyser.getByteFrequencyData(dataArray)
    
    // Calculate average volume
    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] || 0
    }
    const average = sum / bufferLength
    
    // Convert to percentage (0-100)
    micLevel.value = (average / 255) * 100
  }, 100) as unknown as number
}

// Component lifecycle
onMounted(() => {
  refreshDevices()
})

onUnmounted(() => {
  stopMicTest()
})
</script>

<style scoped>
.mic-selector {
  max-width: 500px;
}

.mic-activity-container {
  width: 100%;
}

.mic-activity-bar {
  width: 100%;
  height: 20px;
  background-color: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
}

.mic-activity-fill {
  height: 100%;
  transition: width 0.1s ease-out;
  border-radius: 10px;
}

.activity-low {
  background-color: #9e9e9e;
}

.activity-medium {
  background-color: #ff9800;
}

.activity-high {
  background-color: #4caf50;
}
</style>
