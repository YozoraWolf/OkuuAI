import { defineStore } from 'pinia';

export const useSendingStore = defineStore({
  id: 'sending',
  state: () => ({
    sending: false,
  }),
  actions: {
    setSending(value: boolean) {
      this.sending = value;
    },
  },
});