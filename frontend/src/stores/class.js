import { defineStore } from 'pinia';
import { classesApi } from '@/api';

export const useClassStore = defineStore('class', {
  state: () => ({
    classes: [],
    selectedId: parseInt(localStorage.getItem('selectedClassId') || '0') || null,
    loading: false,
  }),
  getters: {
    selected: (s) => s.classes.find(c => c.id === s.selectedId) || s.classes[0],
  },
  actions: {
    async fetchClasses() {
      this.loading = true;
      try {
        this.classes = await classesApi.list();
        if (!this.selectedId && this.classes.length) this.select(this.classes[0].id);
      } finally { this.loading = false; }
    },
    select(id) {
      this.selectedId = id;
      localStorage.setItem('selectedClassId', String(id));
    },
  },
});
