<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { usePersonStore } from '@/stores/person';

const avatar = ref('');
const name = ref('');
const lineUserIdRows = ref<LineUserIdRow[]>([]);
const formError = ref('');
const formMessage = ref('');
const isSaving = ref(false);
const personStore = usePersonStore();

interface PersonResponse {
  picture: string;
  name: string;
  lineUserIds?: string[];
}

interface LineUserIdRow {
  id: number;
  value: string;
  error: string;
}

const lineUserIdPattern = /^U[0-9a-fA-F]{32}$/;
let nextLineUserIdRowId = 1;

function createLineUserIdRow(value = '') {
  return {
    id: nextLineUserIdRowId++,
    value,
    error: '',
  };
}

function setPersonData(person: PersonResponse) {
  avatar.value = person.picture;
  name.value = person.name;
  personStore.updatePerson(person);
  lineUserIdRows.value = (person.lineUserIds ?? []).map((lineUserId) =>
    createLineUserIdRow(lineUserId),
  );
}

function addLineUserIdRow() {
  lineUserIdRows.value.push(createLineUserIdRow());
  formError.value = '';
  formMessage.value = '';
}

function removeLineUserIdRow(rowId: number) {
  lineUserIdRows.value = lineUserIdRows.value.filter((row) => row.id !== rowId);
  formError.value = '';
  formMessage.value = '';
}

function validateLineUserIds() {
  const seenLineUserIds = new Set<string>();
  let hasError = false;
  const cleanedLineUserIds: string[] = [];

  lineUserIdRows.value = lineUserIdRows.value.map((row) => {
    const value = row.value.trim();
    let error = '';

    if (value) {
      if (!lineUserIdPattern.test(value)) {
        error = 'Line User ID must start with U followed by 32 hex characters.';
      } else if (seenLineUserIds.has(value)) {
        error = 'Duplicate Line User ID.';
      } else {
        seenLineUserIds.add(value);
        cleanedLineUserIds.push(value);
      }
    }

    if (error) {
      hasError = true;
    }

    return {
      ...row,
      value,
      error,
    };
  });

  return hasError ? null : cleanedLineUserIds;
}

async function saveLineUserIds() {
  formError.value = '';
  formMessage.value = '';
  const lineUserIds = validateLineUserIds();

  if (!lineUserIds) {
    formError.value = 'Please fix the highlighted Line User IDs before saving.';
    return;
  }

  isSaving.value = true;

  try {
    const res = await axios({
      method: 'patch',
      url: '/api/person/line-user-ids',
      data: {
        lineUserIds,
      },
    });
    setPersonData(res.data);
    formMessage.value = 'Line User IDs saved.';
  } catch (e) {
    console.log(e);
    formError.value = 'Unable to save Line User IDs. Please try again.';
  } finally {
    isSaving.value = false;
  }
}

onMounted(async () => {
  try {
    const res = await axios({
      method: 'get',
      url: '/api/person',
    });
    setPersonData(res.data);
  } catch (e) {
    console.log(e);
  }
});
</script>

<template>
  <main class="person-page">
    <header class="page-header">
      <h1>Person</h1>
    </header>

    <template v-if="name">
      <section class="profile-card">
        <img class="profile-avatar" :src="avatar" :alt="`${name} avatar`" />
        <h2 class="profile-name">{{ name }}</h2>
      </section>

      <section class="line-user-ids-card" aria-labelledby="line-user-ids-title">
        <div class="section-header">
          <h2 id="line-user-ids-title">Line User IDs</h2>
          <p class="section-help">Type lineinfo in Linebot to get your userId.</p>
        </div>

        <div class="line-user-id-list">
          <div v-for="(row, index) in lineUserIdRows" :key="row.id" class="line-user-id-row">
            <div class="line-user-id-field">
              <label class="sr-only" :for="`line-user-id-${row.id}`">
                Line User ID {{ index + 1 }}
              </label>
              <input
                :id="`line-user-id-${row.id}`"
                v-model="row.value"
                class="line-user-id-input"
                :class="{ 'line-user-id-input-error': row.error }"
                type="text"
                autocomplete="off"
                spellcheck="false"
                placeholder="U followed by 32 hex characters"
                :aria-invalid="Boolean(row.error)"
                :aria-describedby="row.error ? `line-user-id-error-${row.id}` : undefined"
              />
              <p v-if="row.error" :id="`line-user-id-error-${row.id}`" class="field-error">
                {{ row.error }}
              </p>
            </div>
            <button
              class="icon-action-btn"
              type="button"
              :aria-label="`Remove Line User ID ${index + 1}`"
              @click="removeLineUserIdRow(row.id)"
            >
              &times;
            </button>
          </div>

          <p v-if="!lineUserIdRows.length" class="empty-line-user-ids">
            No Line User IDs.
          </p>
        </div>

        <div class="line-user-id-actions">
          <button class="action-btn action-btn-outline" type="button" @click="addLineUserIdRow">
            Add
          </button>
          <button class="action-btn" type="button" :disabled="isSaving" @click="saveLineUserIds">
            {{ isSaving ? 'Saving...' : 'Save' }}
          </button>
        </div>

        <p v-if="formError" class="form-status form-status-error">{{ formError }}</p>
        <p v-else-if="formMessage" class="form-status form-status-success">{{ formMessage }}</p>
      </section>

      <section class="logout-card">
        <a class="logout-btn" href="/auth/logout">Logout</a>
      </section>
    </template>

    <template v-else>
      <section class="profile-card">
        <p class="profile-empty">Please Login.</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.person-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 1rem 0.9rem 2rem;
  color: #1f2937;
}

.page-header {
  margin-bottom: 1rem;
}

.page-header h1 {
  margin: 0;
  font-size: clamp(1.55rem, 2.6vw, 2rem);
}

.profile-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.1rem 0.95rem;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  text-align: center;
}

.line-user-ids-card {
  margin-top: 1rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.1rem 0.95rem;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
}

.section-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.45rem 0.8rem;
  margin-bottom: 0.85rem;
}

.section-header h2 {
  margin: 0;
  color: #0f172a;
  font-size: 1.08rem;
}

.section-help {
  margin: 0;
  color: #64748b;
  font-size: 0.88rem;
  font-weight: 600;
}

.line-user-id-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.line-user-id-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 54px;
  align-items: start;
  gap: 0.55rem;
}

.line-user-id-field {
  min-width: 0;
}

.line-user-id-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 54px;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 0.65rem 0.75rem;
  color: #0f172a;
  font-size: 1rem;
  line-height: 1.35;
  background: #ffffff;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.line-user-id-input:focus {
  border-color: #0f766e;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.16);
  outline: none;
}

.line-user-id-input-error {
  border-color: #dc2626;
}

.line-user-id-input-error:focus {
  border-color: #dc2626;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.14);
}

.icon-action-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border: 1px solid #fecaca;
  border-radius: 12px;
  background: #fff1f2;
  color: #be123c;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.icon-action-btn:hover {
  background: #ffe4e6;
  border-color: #fb7185;
}

.empty-line-user-ids {
  margin: 0;
  color: #64748b;
  font-size: 0.95rem;
  font-weight: 600;
}

.field-error {
  margin: 0.35rem 0 0;
  color: #dc2626;
  font-size: 0.86rem;
  font-weight: 600;
}

.line-user-id-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.55rem;
  margin-top: 0.95rem;
}

.action-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 54px;
  padding: 0.65rem 0.75rem;
  border-radius: 12px;
  border: 1px solid #0f766e;
  background: #0f766e;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.action-btn:hover:not(:disabled) {
  background: #115e59;
  border-color: #115e59;
}

.action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.68;
}

.action-btn-outline {
  background: #ffffff;
  color: #0f766e;
}

.action-btn-outline:hover:not(:disabled) {
  background: #ecfeff;
}

.form-status {
  margin: 0.85rem 0 0;
  font-size: 0.92rem;
  font-weight: 700;
}

.form-status-error {
  color: #dc2626;
}

.form-status-success {
  color: #0f766e;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.profile-avatar {
  width: clamp(110px, 24vw, 150px);
  height: clamp(110px, 24vw, 150px);
  border-radius: 999px;
  object-fit: cover;
  border: 3px solid #0f766e;
  background: #f8fafc;
}

.profile-name {
  margin: 0;
  font-size: clamp(1.05rem, 2vw, 1.28rem);
  font-weight: 700;
  color: #0f172a;
}

.profile-empty {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #64748b;
}

@media (min-width: 960px) {
  .person-page {
    padding-top: 1.2rem;
  }
}

.logout-card {
  margin-top: 1rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.1rem 0.95rem;
  box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.38);
  display: flex;
  justify-content: center;
}

.logout-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 320px;
  min-height: 50px;
  border-radius: 12px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #475569;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.logout-btn:hover {
  background: #fff1f2;
  border-color: #fecaca;
  color: #be123c;
}
</style>
