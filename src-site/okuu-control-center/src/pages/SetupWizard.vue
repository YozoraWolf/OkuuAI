<template>
  <q-page class="setup-page">
    <div class="setup-shell">
      <section class="hero-panel">
        <div>
          <div class="eyebrow">First-run setup</div>
          <h1>Bring OkuuAI online</h1>
          <p>
            Create the first admin account, choose an inference provider, and write the runtime files OkuuAI needs to boot cleanly.
          </p>
        </div>
        <div class="status-card">
          <q-icon name="mdi-shield-key" />
          <span>Setup endpoints are public only until the initial configuration is complete.</span>
        </div>
      </section>

      <q-card class="wizard-card">
        <q-stepper v-model="step" animated flat color="primary" header-nav>
          <q-step :name="1" title="Admin" icon="person" :done="step > 1">
            <div class="mode-row">
              <q-option-group v-model="adminMode" :options="modeOptions" inline dense color="primary" />
            </div>
            <q-input v-model="form.admin.username" label="Admin username" outlined dense autofocus :rules="[required]" />
            <q-input v-model="form.admin.password" label="Admin password" type="password" outlined dense :rules="[passwordRule]" />
            <q-input v-model="confirmPassword" label="Confirm password" type="password" outlined dense :rules="[confirmRule]" />
            <q-input v-if="adminMode === 'advanced'" v-model="form.runtime.api_key" label="Legacy API key" outlined dense />
          </q-step>

          <q-step :name="2" title="Assistant" icon="smart_toy" :done="step > 2">
            <div class="mode-row">
              <q-option-group v-model="assistantMode" :options="modeOptions" inline dense color="primary" />
            </div>
            <q-input v-model="form.assistant.name" label="Assistant name" outlined dense :rules="[required]" />
            <div class="provider-grid">
              <q-card
                v-for="option in providerOptions"
                :key="option.value"
                flat
                bordered
                :class="['provider-card', { selected: form.assistant.inference_provider === option.value }]"
                @click="selectProvider(option.value)"
              >
                <q-card-section>
                  <div class="provider-title">
                    <q-icon :name="option.icon" />
                    <span>{{ option.label }}</span>
                  </div>
                  <p>{{ option.description }}</p>
                </q-card-section>
              </q-card>
            </div>
            <q-select
              v-if="form.assistant.inference_provider === 'ollama'"
              v-model="form.assistant.model"
              :options="stockOllamaModels"
              label="Bundled Ollama model"
              hint="These are intended for the local Ollama Docker setup."
              outlined
              dense
              emit-value
              map-options
              :rules="[required]"
              @update:model-value="syncProviderFields"
            />
            <template v-else>
              <q-input v-model="form.runtime.llm_base_url" label="OpenAI-compatible base URL" hint="Example: https://api.openai.com/v1 or http://localhost:1234/v1" outlined dense :rules="[required]" @update:model-value="markEndpointUntested" />
              <q-input v-model="form.runtime.llm_model" label="Model name (optional)" hint="Leave empty to only test endpoint connectivity." outlined dense @update:model-value="markEndpointUntested" />
              <q-input v-model="form.runtime.llm_api_key" label="API key" type="password" outlined dense @update:model-value="markEndpointUntested" />
              <div class="endpoint-test-row">
                <q-btn color="secondary" outline label="Test endpoint" :loading="endpointTesting" @click="testEndpoint" />
                <q-chip v-if="endpointTested" color="positive" text-color="white" icon="check_circle">Endpoint ready</q-chip>
              </div>
            </template>
            <q-input v-model="form.assistant.system_prompt" label="System prompt" type="textarea" autogrow outlined dense :rules="[required]" />
            <template v-if="assistantMode === 'advanced'">
              <q-input v-model="form.assistant.tool_llm" label="Tool / vision model" outlined dense />
              <q-input v-if="form.assistant.inference_provider === 'ollama'" v-model="form.assistant.template" label="Custom Ollama template" type="textarea" autogrow outlined dense />
              <div class="toggle-grid">
                <q-toggle v-model="form.assistant.global_memory" label="Enable global memory" />
                <q-toggle v-model="form.assistant.think" label="Enable think mode" />
              </div>
            </template>
          </q-step>

          <q-step :name="3" title="Runtime" icon="settings" :done="step > 3">
            <div class="mode-row">
              <q-option-group v-model="runtimeMode" :options="modeOptions" inline dense color="primary" />
            </div>
            <q-input v-model.number="form.runtime.port" label="Backend port" type="number" outlined dense :rules="[positiveNumber]" />
            <q-input v-if="form.assistant.inference_provider === 'ollama'" v-model.number="form.runtime.ollama_port" label="Ollama port" type="number" outlined dense :rules="[positiveNumber]" />
            <template v-if="runtimeMode === 'advanced'">
              <q-input v-model.number="form.runtime.redis_port" label="Redis port" type="number" outlined dense :rules="[positiveNumber]" />
              <q-input v-model="form.runtime.redis_pwd" label="Redis password" type="password" outlined dense />
              <q-input v-model="form.runtime.web_url" label="Public web URL" outlined dense />
              <q-input v-model="form.runtime.proxy_fwd" label="Proxy forward URL" outlined dense />
              <q-input v-model="form.runtime.proxy_email" label="Proxy email" outlined dense />
              <q-input v-model="form.runtime.proxy_pwd" label="Proxy password" type="password" outlined dense />
            </template>
          </q-step>

          <q-step :name="4" title="Finish" icon="task_alt">
            <div class="mode-row">
              <q-option-group v-model="finishMode" :options="modeOptions" inline dense color="primary" />
            </div>
            <div class="review-grid">
              <div><strong>Admin</strong><span>{{ form.admin.username }}</span></div>
              <div><strong>Provider</strong><span>{{ providerLabel }}</span></div>
              <div><strong>Model</strong><span>{{ form.assistant.model }}</span></div>
              <div><strong>Backend</strong><span>localhost:{{ form.runtime.port }}</span></div>
              <div><strong>Inference</strong><span>{{ inferenceTarget }}</span></div>
            </div>
            <template v-if="finishMode === 'advanced'">
              <q-toggle v-model="form.logging.enabled" label="Write logs to file" />
              <q-toggle v-model="form.logging.debug" label="Enable debug logging" />
              <q-input v-model.number="form.logging.maxFileSizeMb" label="Max log file size (MB)" type="number" outlined dense :rules="[positiveNumber]" />
            </template>
            <q-banner v-if="setupComplete" class="complete-banner" rounded>
              Setup files were written. OkuuAI is applying the new provider, ports, and admin credentials automatically. If you changed the backend port, reopen the Control Center using the new port after it finishes applying.
              <template #action>
                <q-btn flat color="positive" label="Go to login" @click="goToLogin" />
              </template>
            </q-banner>
          </q-step>

          <template #navigation>
            <q-stepper-navigation class="nav-row">
              <q-btn v-if="step > 1 && !setupComplete" flat label="Back" @click="step--" />
              <q-space />
              <div v-if="step < 4" class="continue-wrap">
                <q-btn color="primary" label="Continue" :disable="continueDisabled" @click="nextStep" />
                <q-tooltip v-if="continueDisabled">{{ continueTooltip }}</q-tooltip>
              </div>
              <q-btn v-else color="primary" label="Complete setup" :loading="loading" :disable="setupComplete" @click="submit" />
            </q-stepper-navigation>
          </template>
        </q-stepper>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { completeSetup, getSetupStatus, testCustomEndpoint, type SetupPayload } from 'src/services/setup.service';

const $q = useQuasar();
const router = useRouter();

const step = ref(1);
const loading = ref(false);
const setupComplete = ref(false);
const confirmPassword = ref('');
const adminMode = ref('basic');
const assistantMode = ref('basic');
const runtimeMode = ref('basic');
const finishMode = ref('basic');
const endpointTesting = ref(false);
const endpointTested = ref(false);

const modeOptions = [
  { label: 'Basic', value: 'basic' },
  { label: 'Advanced', value: 'advanced' }
];

const providerOptions = [
  {
    label: 'Use bundled Ollama Docker',
    value: 'ollama',
    icon: 'mdi-cube-outline',
    description: 'Fast local setup using the Ollama container managed by OkuuAI.'
  },
  {
    label: 'Use custom endpoint',
    value: 'custom',
    icon: 'mdi-api',
    description: 'Connect to an OpenAI-compatible API, local server, or hosted model provider.'
  }
];

const stockOllamaModels = [
  { label: 'Llama 3 8B (recommended)', value: 'llama3' },
  { label: 'Llama 3.1 8B', value: 'llama3.1:8b' },
  { label: 'Mistral 7B', value: 'mistral' },
  { label: 'Qwen 2.5 7B', value: 'qwen2.5:7b' },
  { label: 'Gemma 2 9B', value: 'gemma2:9b' },
  { label: 'Phi 3 Mini', value: 'phi3:mini' }
];

const form = reactive<SetupPayload>({
  admin: {
    username: 'admin',
    password: ''
  },
  assistant: {
    name: 'OkuuAI',
    system_prompt: "You're a helpful AI assistant.",
    model: 'llama3',
    inference_provider: 'ollama',
    tool_llm: 'redule26/huihui_ai_qwen2.5-vl-7b-abliterated',
    template: '',
    global_memory: false,
    think: false
  },
  runtime: {
    port: 3009,
    redis_port: 6379,
    redis_pwd: 'password',
    api_key: 'adminkey1234',
    ollama_port: 7009,
    ollama_default_model: 'llama3',
    llm_provider: 'ollama',
    llm_base_url: '',
    llm_api_key: '',
    llm_model: 'llama3',
    web_url: '',
    proxy_email: '',
    proxy_pwd: '',
    proxy_fwd: ''
  },
  logging: {
    enabled: true,
    debug: true,
    maxFileSizeMb: 5
  }
});

const required = (value: string) => Boolean(value && value.trim()) || 'Required';
const passwordRule = (value: string) => value.length >= 8 || 'Use at least 8 characters';
const confirmRule = (value: string) => value === form.admin.password || 'Passwords do not match';
const positiveNumber = (value: number) => Number(value) > 0 || 'Must be greater than zero';
const providerLabel = computed(() => form.assistant.inference_provider === 'custom' ? 'Custom endpoint' : 'Bundled Ollama Docker');
const inferenceTarget = computed(() => form.assistant.inference_provider === 'custom' ? form.runtime.llm_base_url || 'Custom endpoint' : `localhost:${form.runtime.ollama_port}`);
const continueDisabled = computed(() => step.value === 2 && form.assistant.inference_provider === 'custom' && !endpointTested.value);
const continueTooltip = computed(() => {
  if (step.value === 2 && form.assistant.inference_provider === 'custom') {
    return 'Test the custom endpoint connection before continuing.';
  }
  return 'Complete this step before continuing.';
});

const syncProviderFields = () => {
  const provider = form.assistant.inference_provider || 'ollama';
  form.runtime.llm_provider = provider;

  if (provider === 'custom') {
    form.assistant.model = form.runtime.llm_model || '';
    return;
  }

  form.runtime.ollama_default_model = form.assistant.model;
  form.runtime.llm_model = form.assistant.model;
};

const selectProvider = (provider: string) => {
  form.assistant.inference_provider = provider;
  endpointTested.value = false;
  if (provider === 'custom') {
    form.assistant.model = form.runtime.llm_model || '';
  }
  syncProviderFields();
};

const markEndpointUntested = () => {
  syncProviderFields();
  endpointTested.value = false;
};

const testEndpoint = async () => {
  if (!form.runtime.llm_base_url) {
    $q.notify({ type: 'negative', message: 'Endpoint URL is required.' });
    return;
  }

  endpointTesting.value = true;
  try {
    const result = await testCustomEndpoint(form.runtime.llm_base_url, form.runtime.llm_api_key || '', form.runtime.llm_model);
    endpointTested.value = true;
    syncProviderFields();
    if (result.warning) {
      $q.notify({ type: 'warning', message: result.warning });
    } else {
      $q.notify({ type: 'positive', message: 'Custom endpoint is reachable.' });
    }
  } catch (error: any) {
    endpointTested.value = false;
    $q.notify({ type: 'negative', message: error.response?.data?.error || 'Endpoint test failed' });
  } finally {
    endpointTesting.value = false;
  }
};

const nextStep = () => {
  if (step.value === 1 && (!form.admin.username || !form.admin.password || confirmPassword.value !== form.admin.password || form.admin.password.length < 8)) {
    $q.notify({ type: 'negative', message: 'Finish the admin credentials first.' });
    return;
  }
  if (step.value === 2 && (!form.assistant.name || !form.assistant.system_prompt)) {
    $q.notify({ type: 'negative', message: 'Assistant name and prompt are required.' });
    return;
  }
  if (step.value === 2 && form.assistant.inference_provider === 'ollama' && !form.assistant.model) {
    $q.notify({ type: 'negative', message: 'Select an Ollama model before continuing.' });
    return;
  }
  if (step.value === 2 && form.assistant.inference_provider === 'custom' && !form.runtime.llm_base_url) {
    $q.notify({ type: 'negative', message: 'Custom endpoint URL is required.' });
    return;
  }
  if (step.value === 2 && form.assistant.inference_provider === 'custom' && !endpointTested.value) {
    $q.notify({ type: 'negative', message: 'Test the custom endpoint before continuing.' });
    return;
  }
  syncProviderFields();
  step.value++;
};

const submit = async () => {
  loading.value = true;
  try {
    await completeSetup(form);
    setupComplete.value = true;
    localStorage.setItem('setupJustCompleted', 'true');
    $q.notify({ type: 'positive', message: 'Setup complete. OkuuAI is applying the new values.' });
  } catch (error: any) {
    $q.notify({ type: 'negative', message: error.response?.data?.error || 'Setup failed' });
  } finally {
    loading.value = false;
  }
};

const goToLogin = () => {
  localStorage.removeItem('setupJustCompleted');
  router.push('/login');
};

onMounted(async () => {
  try {
    const status = await getSetupStatus();
    if (status.defaults?.assistant) {
      form.assistant.name = status.defaults.assistant.name || form.assistant.name;
      form.assistant.system_prompt = status.defaults.assistant.system_prompt || form.assistant.system_prompt;
      form.assistant.model = status.defaults.assistant.model || form.assistant.model;
      form.assistant.inference_provider = status.defaults.assistant.inference_provider || form.assistant.inference_provider;
      form.assistant.tool_llm = status.defaults.assistant.tool_llm || form.assistant.tool_llm;
    }
    if (status.defaults?.runtime) {
      form.runtime.port = Number(status.defaults.runtime.port || form.runtime.port);
      form.runtime.redis_port = Number(status.defaults.runtime.redis_port || form.runtime.redis_port);
      form.runtime.redis_pwd = status.defaults.runtime.redis_pwd || form.runtime.redis_pwd;
      form.runtime.api_key = status.defaults.runtime.api_key || form.runtime.api_key;
      form.runtime.ollama_port = Number(status.defaults.runtime.ollama_port || form.runtime.ollama_port);
      form.runtime.ollama_default_model = status.defaults.runtime.ollama_default_model || form.runtime.ollama_default_model;
      form.runtime.llm_provider = status.defaults.runtime.llm_provider || form.runtime.llm_provider;
      form.runtime.llm_base_url = status.defaults.runtime.llm_base_url || form.runtime.llm_base_url;
      form.runtime.llm_model = status.defaults.runtime.llm_model || form.runtime.llm_model;
    }
    syncProviderFields();
  } catch (error) {
    $q.notify({ type: 'warning', message: 'Could not load setup defaults. Using built-in defaults.' });
  }
});
</script>

<style scoped>
.setup-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 18% 18%, rgba(255, 145, 0, 0.28), transparent 30%),
    radial-gradient(circle at 82% 76%, rgba(255, 96, 37, 0.16), transparent 28%),
    linear-gradient(145deg, #070a12 0%, #111827 58%, #0b1020 100%);
  color: white;
  padding: 32px 24px;
}

.setup-shell {
  display: grid;
  grid-template-columns: minmax(280px, 390px) minmax(420px, 720px);
  gap: 22px;
  width: min(1120px, 100%);
  max-height: calc(100vh - 64px);
  margin: 0 auto;
  align-items: center;
}

.hero-panel,
.wizard-card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: linear-gradient(180deg, rgba(18, 25, 40, 0.92), rgba(10, 15, 27, 0.9));
  backdrop-filter: blur(18px);
  border-radius: 28px;
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.38);
}

.hero-panel {
  min-height: 560px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  position: relative;
}

.hero-panel::after {
  content: '';
  position: absolute;
  width: 220px;
  height: 220px;
  right: -70px;
  top: -70px;
  border: 1px solid rgba(255, 184, 107, 0.22);
  border-radius: 50%;
}

.eyebrow {
  color: #ffb86b;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 12px;
}

h1 {
  font-size: clamp(34px, 5vw, 56px);
  line-height: 0.98;
  margin: 18px 0 14px;
  letter-spacing: -0.045em;
}

.hero-panel p {
  color: rgba(255, 255, 255, 0.72);
  font-size: 16px;
}

.status-card {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 145, 0, 0.12);
  color: #ffd6a6;
}

.wizard-card {
  padding: 10px;
  max-height: calc(100vh - 64px);
  overflow: auto;
}

.wizard-card :deep(.q-stepper) {
  background: transparent;
}

.wizard-card :deep(.q-stepper__header) {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.wizard-card :deep(.q-stepper__content) {
  padding: 22px 24px 8px;
}

.wizard-card :deep(.q-field) {
  margin-bottom: 12px;
}

.mode-row {
  margin-bottom: 18px;
}

.toggle-grid,
.review-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.review-grid div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
}

.review-grid span {
  color: rgba(255, 255, 255, 0.7);
}

.complete-banner {
  margin-top: 18px;
  background: rgba(40, 167, 69, 0.18);
  color: #b8f5c8;
}

.endpoint-test-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.provider-card {
  cursor: pointer;
  background: rgba(255, 255, 255, 0.045);
  border-color: rgba(255, 255, 255, 0.12);
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.provider-card:hover,
.provider-card.selected {
  border-color: #ffb86b;
  background: rgba(255, 145, 0, 0.12);
  transform: translateY(-1px);
}

.provider-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  margin-bottom: 8px;
}

.provider-title .q-icon {
  color: #ffb86b;
  font-size: 22px;
}

.provider-card p {
  margin: 0;
  color: rgba(255, 255, 255, 0.68);
  font-size: 13px;
}

.nav-row {
  display: flex;
  align-items: center;
}

.continue-wrap {
  display: inline-flex;
}

@media (max-width: 860px) {
  .setup-page {
    padding: 18px;
    align-items: flex-start;
  }

  .setup-shell {
    grid-template-columns: 1fr;
    max-height: none;
  }

  .hero-panel,
  .wizard-card {
    min-height: auto;
    max-height: none;
  }

  .toggle-grid,
  .review-grid,
  .provider-grid {
    grid-template-columns: 1fr;
  }
}
</style>
