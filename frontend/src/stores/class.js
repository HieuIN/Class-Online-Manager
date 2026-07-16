import { defineStore } from 'pinia';
import { classesApi } from '@/api';

export const useClassStore = defineStore('class', {
  state: () => ({
    classes: [],
    selectedId: null,
    loading: false,
  }),
  getters: {
    selected: (s) => s.classes.find(c => Number(c.id) === Number(s.selectedId)) || null,
  },
  actions: {
    async fetchClasses() {
      this.loading = true;
      try {
        this.classes = await classesApi.list();
        const savedId = Number(localStorage.getItem('selectedClassId')) || null;
        const requestedId = this.selectedId || savedId;
        const validClass = this.classes.find(c => Number(c.id) === Number(requestedId));

        if (validClass) this.select(validClass.id);
        else if (this.classes.length) this.select(this.classes[0].id);
        else {
          this.selectedId = null;
          localStorage.removeItem('selectedClassId');
        }
      } finally { this.loading = false; }
    },
    select(id) {
      const normalizedId = Number(id) || null;
      this.selectedId = normalizedId;
      if (normalizedId) localStorage.setItem('selectedClassId', String(normalizedId));
      else localStorage.removeItem('selectedClassId');
    },
  },
});
