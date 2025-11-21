<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { socket } from '@/src/main';

const voiceConfidenceThreshold = ref(0.15);
const noiseFloorLevel = ref(0.03);
const maxNoiseChunks = ref(8);
const isLoading = ref(false);

// Load current settings on mount
onMounted(() => {
    socket.emit('getVoiceSensitivity');
});

// Listen for voice sensitivity settings
socket.on('voiceSensitivity', (settings) => {
    voiceConfidenceThreshold.value = settings.voiceConfidenceThreshold;
    noiseFloorLevel.value = settings.noiseFloorLevel;
    maxNoiseChunks.value = settings.maxNoiseChunks;
});

// Listen for updates confirmation
socket.on('voiceSensitivityUpdated', (settings) => {
    isLoading.value = false;
    console.log('Voice sensitivity updated:', settings);
});

const updateSettings = () => {
    isLoading.value = true;
    socket.emit('updateVoiceSensitivity', {
        voiceConfidenceThreshold: voiceConfidenceThreshold.value,
        noiseFloorLevel: noiseFloorLevel.value,
        maxNoiseChunks: maxNoiseChunks.value
    });
};

const resetToDefaults = () => {
    voiceConfidenceThreshold.value = 0.15;
    noiseFloorLevel.value = 0.03;
    maxNoiseChunks.value = 8;
    updateSettings();
};

const increaseThreshold = () => {
    voiceConfidenceThreshold.value = Math.min(0.9, voiceConfidenceThreshold.value + 0.05);
    updateSettings();
};

const decreaseThreshold = () => {
    voiceConfidenceThreshold.value = Math.max(0.05, voiceConfidenceThreshold.value - 0.05);
    updateSettings();
};
</script>

<template>
    <div class="voice-settings">
        <h3>🎤 Voice Sensitivity Settings</h3>
        
        <div class="quick-controls">
            <button @click="decreaseThreshold" class="btn-sensitivity" title="More Sensitive (picks up quieter sounds)">
                📢 More Sensitive
            </button>
            <button @click="increaseThreshold" class="btn-sensitivity" title="Less Sensitive (ignores background noise)">
                🔇 Less Sensitive
            </button>
        </div>
        
        <div class="settings-grid">
            <div class="setting-group">
                <label>Voice Detection Threshold:</label>
                <input 
                    v-model.number="voiceConfidenceThreshold" 
                    type="range" 
                    min="0.05" 
                    max="0.5" 
                    step="0.01"
                    @input="updateSettings"
                    :disabled="isLoading"
                />
                <span class="value">{{ voiceConfidenceThreshold.toFixed(2) }}</span>
                <p class="help-text">Higher = ignores more background noise</p>
            </div>
            
            <div class="setting-group">
                <label>Noise Floor Level:</label>
                <input 
                    v-model.number="noiseFloorLevel" 
                    type="range" 
                    min="0.01" 
                    max="0.1" 
                    step="0.005"
                    @input="updateSettings"
                    :disabled="isLoading"
                />
                <span class="value">{{ noiseFloorLevel.toFixed(3) }}</span>
                <p class="help-text">Baseline noise level detection</p>
            </div>
        </div>
        
        <div class="controls">
            <button @click="resetToDefaults" class="btn-reset" :disabled="isLoading">
                Reset to Defaults
            </button>
            <div v-if="isLoading" class="loading">⏳ Updating...</div>
        </div>
        
        <div class="tips">
            <h4>💡 Tips:</h4>
            <ul>
                <li><strong>Background noise issues?</strong> Increase voice threshold (less sensitive)</li>
                <li><strong>Voice not detected?</strong> Decrease voice threshold (more sensitive)</li>
                <li><strong>Fan, AC, or crowd noise?</strong> Use "Less Sensitive" button</li>
            </ul>
        </div>
    </div>
</template>

<style scoped>
.voice-settings {
    background: #2a2a2a;
    border-radius: 8px;
    padding: 20px;
    margin: 10px;
    color: white;
}

.quick-controls {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
}

.btn-sensitivity {
    background: #4a9eff;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.3s;
}

.btn-sensitivity:hover {
    background: #3a8edf;
}

.settings-grid {
    display: grid;
    gap: 20px;
    margin-bottom: 20px;
}

.setting-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.setting-group label {
    font-weight: bold;
    color: #ddd;
}

.setting-group input[type="range"] {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: #555;
    outline: none;
    -webkit-appearance: none;
}

.setting-group input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #4a9eff;
    cursor: pointer;
}

.value {
    font-family: monospace;
    color: #4a9eff;
    font-weight: bold;
}

.help-text {
    font-size: 12px;
    color: #999;
    margin: 0;
}

.controls {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 20px;
}

.btn-reset {
    background: #666;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
}

.btn-reset:hover {
    background: #777;
}

.btn-reset:disabled {
    background: #444;
    cursor: not-allowed;
}

.loading {
    color: #4a9eff;
    font-style: italic;
}

.tips {
    background: #1a1a1a;
    border-radius: 6px;
    padding: 15px;
    border-left: 4px solid #4a9eff;
}

.tips h4 {
    margin: 0 0 10px 0;
    color: #4a9eff;
}

.tips ul {
    margin: 0;
    padding-left: 20px;
}

.tips li {
    margin-bottom: 5px;
    font-size: 14px;
}
</style>