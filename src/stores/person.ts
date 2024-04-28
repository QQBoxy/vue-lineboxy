import { ref } from 'vue';
import { defineStore } from 'pinia';

interface Person {
  id: number;
  googleId: string;
  name: string;
  email: string;
  picture: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const initPerson = {
  id: 0,
  googleId: "",
  name: "",
  email: "",
  picture: "",
  role: "",
  isActive: false,
  createdAt: "",
  updatedAt: ""
};

export const usePersonStore = defineStore('person', () => {
  const person = ref<Person>(initPerson);

  function updatePerson(patch: Partial<Person>) {
    person.value = {
      ...person.value,
      ...patch
    };
  }
  return { updatePerson, person };
})
