<template>
  <AposModal
    :modal="modal"
    :modal-title="$t('project:dataDashboard')"
    class="assurer-dashboard"
    data-apos-test="data-dashboard"
    @esc="close"
    @no-modal="$emit('safe-close')"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
  >
    <template #secondaryControls>
      <AposButton
        type="default"
        label="apostrophe:exit"
        @click="close"
      />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div class="assurer-dashboard__body">
            <div
              class="assurer-dashboard__tabs"
              role="tablist"
              :aria-label="$t('project:dataDashboardTabs')"
            >
              <button
                v-for="tab in tabs"
                :id="`assurer-dashboard-tab-${tab}`"
                :key="tab"
                type="button"
                role="tab"
                class="assurer-dashboard__tab"
                :class="{ 'is-active': current === tab }"
                :aria-selected="current === tab ? 'true' : 'false'"
                :aria-controls="`assurer-dashboard-panel-${tab}`"
                :data-apos-test="`data-dashboard-tab-${tab}`"
                @click="show(tab)"
              >
                {{ $t(`project:dataDashboard${capitalize(tab)}`) }}
              </button>
            </div>

            <section
              :id="`assurer-dashboard-panel-${current}`"
              role="tabpanel"
              class="assurer-dashboard__panel"
              :aria-labelledby="`assurer-dashboard-tab-${current}`"
            >
              <p
                v-if="state[current].status === 'loading'"
                class="assurer-dashboard__note"
                role="status"
              >
                {{ $t('project:dataDashboardLoading') }}
              </p>
              <div
                v-else-if="state[current].status === 'error'"
                class="assurer-dashboard__note"
                role="alert"
              >
                <p>{{ $t('project:dataDashboardLoadError') }}</p>
                <AposButton
                  type="default"
                  label="project:dataDashboardRetry"
                  @click="load(current)"
                />
              </div>

              <!-- Overview -->
              <template v-if="current === 'overview' && state.overview.status === 'ready'">
                <div class="assurer-dashboard__scroll">
                  <table class="assurer-dashboard__table">
                    <thead>
                      <tr>
                        <th scope="col">
                          {{ $t('project:dataDashboardType') }}
                        </th>
                        <th scope="col">
                          {{ $t('project:dataDashboardLive') }}
                        </th>
                        <th scope="col">
                          {{ $t('project:dataDashboardPublished') }}
                        </th>
                        <th scope="col">
                          {{ $t('project:dataDashboardModified') }}
                        </th>
                        <th scope="col">
                          {{ $t('project:dataDashboardArchived') }}
                        </th>
                        <th scope="col">
                          {{ $t('project:dataDashboardLastChange') }}
                        </th>
                        <th scope="col">
                          {{ $t('project:dataDashboardActions') }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="type in state.overview.data.types"
                        :key="type.name"
                      >
                        <th scope="row">
                          {{ type.label }}
                        </th>
                        <td>{{ type.live }}</td>
                        <td>{{ dash(type.published) }}</td>
                        <td>{{ dash(type.modified) }}</td>
                        <td>{{ type.archived }}</td>
                        <td>
                          <template v-if="type.newest">
                            {{ type.newest.title }}<br>
                            <span class="assurer-dashboard__muted">
                              {{ when(type.newest.updatedAt) }}{{ type.newest.updatedBy ? ` · ${type.newest.updatedBy}` : '' }}
                            </span>
                          </template>
                          <template v-else>
                            —
                          </template>
                        </td>
                        <td>
                          <div class="assurer-dashboard__actions">
                            <AposButton
                              v-if="managerFor(type.name)"
                              type="subtle"
                              :modifiers="[ 'small' ]"
                              label="project:dataDashboardOpen"
                              @click="openManager(type.name)"
                            />
                            <AposButton
                              v-if="type.canCreate"
                              type="subtle"
                              :modifiers="[ 'small' ]"
                              label="project:dataDashboardNew"
                              @click="create(type.name)"
                            />
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p
                  v-if="state.overview.data.formSubmissions"
                  class="assurer-dashboard__note"
                >
                  {{ $t('project:dataDashboardFormSubmissions', { count: state.overview.data.formSubmissions.count }) }}
                  <a :href="state.overview.data.formSubmissions.url">
                    {{ $t('project:dataDashboardFormSubmissionsLink') }}
                  </a>
                </p>
              </template>

              <!-- Find -->
              <template v-if="current === 'find'">
                <p class="assurer-dashboard__muted">
                  {{ $t('project:dataDashboardFindHelp') }}
                </p>
                <form
                  class="assurer-dashboard__form"
                  @submit.prevent="load('find')"
                >
                  <label>
                    <span>{{ $t('project:dataDashboardFindLabel') }}</span>
                    <input
                      v-model="search.q"
                      type="search"
                      maxlength="200"
                      data-apos-test="data-dashboard-find-q"
                    >
                  </label>
                  <label>
                    <span>{{ $t('project:dataDashboardType') }}</span>
                    <select v-model="search.type">
                      <option value="">
                        {{ $t('project:dataDashboardFindAllTypes') }}
                      </option>
                      <option
                        v-for="type in typeChoices"
                        :key="type.name"
                        :value="type.name"
                      >
                        {{ type.label }}
                      </option>
                    </select>
                  </label>
                  <label>
                    <span>{{ $t('project:dataDashboardStatus') }}</span>
                    <select v-model="search.status">
                      <option value="live">
                        {{ $t('project:dataDashboardStatusLive') }}
                      </option>
                      <option value="archived">
                        {{ $t('project:dataDashboardArchived') }}
                      </option>
                      <option value="all">
                        {{ $t('project:dataDashboardStatusAll') }}
                      </option>
                    </select>
                  </label>
                  <AposButton
                    type="primary"
                    label="project:dataDashboardSearch"
                    :disabled="state.find.status === 'loading'"
                    @click="load('find')"
                  />
                </form>
                <template v-if="state.find.status === 'ready'">
                  <p
                    v-if="!state.find.data.results.length"
                    class="assurer-dashboard__note"
                  >
                    {{ $t('project:dataDashboardFindNone') }}
                  </p>
                  <div
                    v-else
                    class="assurer-dashboard__scroll"
                  >
                    <table class="assurer-dashboard__table">
                      <thead>
                        <tr>
                          <th scope="col">
                            {{ $t('project:dataDashboardTitle') }}
                          </th>
                          <th scope="col">
                            {{ $t('project:dataDashboardType') }}
                          </th>
                          <th scope="col">
                            {{ $t('project:dataDashboardStatus') }}
                          </th>
                          <th scope="col">
                            {{ $t('project:dataDashboardUpdated') }}
                          </th>
                          <th scope="col">
                            {{ $t('project:dataDashboardActions') }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="doc in state.find.data.results"
                          :key="doc._id"
                        >
                          <th scope="row">
                            {{ doc.title }}<br>
                            <span class="assurer-dashboard__muted">{{ doc.slug }}</span>
                          </th>
                          <td>{{ typeLabel(doc.type) }}</td>
                          <td>{{ $t(statusKey(doc)) }}</td>
                          <td>
                            {{ when(doc.updatedAt) }}<br>
                            <span class="assurer-dashboard__muted">{{ doc.updatedBy || '' }}</span>
                          </td>
                          <td>
                            <div class="assurer-dashboard__actions">
                              <AposButton
                                type="subtle"
                                :modifiers="[ 'small' ]"
                                label="project:dataDashboardViewData"
                                @click="viewData(doc)"
                              />
                              <AposButton
                                type="subtle"
                                :modifiers="[ 'small' ]"
                                label="project:dataDashboardEdit"
                                @click="edit(doc)"
                              />
                              <AposButton
                                v-if="doc.history"
                                type="subtle"
                                :modifiers="[ 'small' ]"
                                label="project:dataDashboardHistory"
                                @click="history(doc)"
                              />
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p
                    v-if="state.find.data.limited"
                    class="assurer-dashboard__muted"
                  >
                    {{ $t('project:dataDashboardFindLimited') }}
                  </p>
                </template>
                <div
                  v-if="data.status !== 'idle'"
                  class="assurer-dashboard__data"
                  data-apos-test="data-dashboard-json"
                >
                  <h3 class="assurer-dashboard__heading">
                    {{ $t('project:dataDashboardDataHeading', { title: data.title }) }}
                  </h3>
                  <p
                    v-if="data.status === 'loading'"
                    role="status"
                  >
                    {{ $t('project:dataDashboardLoading') }}
                  </p>
                  <p
                    v-else-if="data.status === 'error'"
                    role="alert"
                  >
                    {{ $t('project:dataDashboardLoadError') }}
                  </p>
                  <template v-else>
                    <div class="assurer-dashboard__actions">
                      <AposButton
                        type="default"
                        :modifiers="[ 'small' ]"
                        :label="copied ? 'project:dataDashboardCopied' : 'project:dataDashboardCopyJson'"
                        @click="copyJson"
                      />
                      <AposButton
                        type="default"
                        :modifiers="[ 'small' ]"
                        label="project:dataDashboardClose"
                        @click="closeData"
                      />
                    </div>
                    <pre class="assurer-dashboard__json">{{ data.json }}</pre>
                  </template>
                </div>
              </template>

              <!-- Activity -->
              <template v-if="current === 'activity'">
                <p class="assurer-dashboard__muted">
                  {{ $t('project:dataDashboardActivityHelp') }}
                </p>
                <form
                  class="assurer-dashboard__form"
                  @submit.prevent
                >
                  <label>
                    <span>{{ $t('project:dataDashboardWhat') }}</span>
                    <select
                      v-model="activity.kind"
                      @change="activity.page = 1; load('activity')"
                    >
                      <option value="">
                        {{ $t('project:dataDashboardActivityAll') }}
                      </option>
                      <option
                        v-for="kind in kinds"
                        :key="kind"
                        :value="kind"
                      >
                        {{ $t(`project:dataDashboardKind_${kind}`) }}
                      </option>
                    </select>
                  </label>
                </form>
                <template v-if="state.activity.status === 'ready'">
                  <p
                    v-if="!state.activity.data.entries.length"
                    class="assurer-dashboard__note"
                  >
                    {{ $t('project:dataDashboardActivityEmpty') }}
                  </p>
                  <div
                    v-else
                    class="assurer-dashboard__scroll"
                  >
                    <table class="assurer-dashboard__table">
                      <thead>
                        <tr>
                          <th scope="col">
                            {{ $t('project:dataDashboardWhen') }}
                          </th>
                          <th scope="col">
                            {{ $t('project:dataDashboardWho') }}
                          </th>
                          <th scope="col">
                            {{ $t('project:dataDashboardWhat') }}
                          </th>
                          <th scope="col">
                            {{ $t('project:dataDashboardDetails') }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="entry in state.activity.data.entries"
                          :key="entry._id"
                        >
                          <td>{{ when(entry.at) }}</td>
                          <td>{{ entry.username || '—' }}</td>
                          <th scope="row">
                            {{ $t(`project:dataDashboardKind_${entry.kind}`) }}
                          </th>
                          <td class="assurer-dashboard__details">
                            {{ details(entry.details) }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div
                    v-if="state.activity.data.pages > 1"
                    class="assurer-dashboard__actions"
                  >
                    <AposButton
                      type="default"
                      :modifiers="[ 'small' ]"
                      label="project:dataDashboardPrevious"
                      :disabled="activity.page <= 1"
                      @click="activity.page--; load('activity')"
                    />
                    <span>{{ $t('project:dataDashboardPageOf', { page: activity.page, pages: state.activity.data.pages }) }}</span>
                    <AposButton
                      type="default"
                      :modifiers="[ 'small' ]"
                      label="project:dataDashboardNext"
                      :disabled="activity.page >= state.activity.data.pages"
                      @click="activity.page++; load('activity')"
                    />
                  </div>
                </template>
              </template>

              <!-- Health -->
              <template v-if="current === 'health' && state.health.status === 'ready'">
                <dl class="assurer-dashboard__facts">
                  <dt>{{ $t('project:dataDashboardEngine') }}</dt>
                  <dd>{{ state.health.data.engine }}</dd>
                  <dt>{{ $t('project:dataDashboardServerVersion') }}</dt>
                  <dd>{{ orNa(state.health.data.serverVersion) }}</dd>
                  <dt>{{ $t('project:dataDashboardDataSize') }}</dt>
                  <dd>{{ bytes(state.health.data.database?.dataBytes) }}</dd>
                  <dt>{{ $t('project:dataDashboardStorageSize') }}</dt>
                  <dd>{{ bytes(state.health.data.database?.storageBytes) }}</dd>
                  <dt>{{ $t('project:dataDashboardIndexSize') }}</dt>
                  <dd>{{ bytes(state.health.data.database?.indexBytes) }}</dd>
                  <dt>{{ $t('project:dataDashboardCollections') }}</dt>
                  <dd>{{ orNa(state.health.data.database?.collections) }}</dd>
                  <dt>{{ $t('project:dataDashboardDocumentCounts') }}</dt>
                  <dd>
                    <span
                      v-for="(count, name) in state.health.data.counts"
                      :key="name"
                      class="assurer-dashboard__count"
                    >{{ name }}: {{ orNa(count) }}</span>
                  </dd>
                  <dt>{{ $t('project:dataDashboardMedia') }}</dt>
                  <dd>
                    {{ state.health.data.media ? `${state.health.data.media.files} · ${bytes(state.health.data.media.bytes)}` : $t('project:dataDashboardNotAvailable') }}
                  </dd>
                  <dt>{{ $t('project:dataDashboardDiskFree') }}</dt>
                  <dd>
                    {{ state.health.data.disk ? `${bytes(state.health.data.disk.freeBytes)} / ${bytes(state.health.data.disk.totalBytes)}` : $t('project:dataDashboardNotAvailable') }}
                  </dd>
                  <dt>{{ $t('project:dataDashboardBackups') }}</dt>
                  <dd>{{ $t('project:dataDashboardBackupsNote') }}</dd>
                  <dt>{{ $t('project:dataDashboardVersions') }}</dt>
                  <dd>
                    Apostrophe {{ state.health.data.versions.apostrophe }} ·
                    import-export {{ state.health.data.versions.importExport }} ·
                    Node {{ state.health.data.versions.node }}
                  </dd>
                  <dt>{{ $t('project:dataDashboardCheckedAt') }}</dt>
                  <dd>{{ when(state.health.data.checkedAt) }}</dd>
                </dl>
                <AposButton
                  type="default"
                  label="project:dataDashboardRefresh"
                  @click="load('health')"
                />
              </template>
            </section>
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
// The data dashboard modal (m1-070, D-DB-24). Reads only, through the
// module's admin-only GET routes. Edit, New, Open and History open
// Apostrophe's own editors, managers and Document Versions.
//
// Each tab has an explicit load state: idle (never loaded), loading, ready
// or error. A tab loads the first time it is shown; Refresh, Search, the
// filters and closing an editor load it again.
const API = '/api/v1/assurer-data-dashboard';
const TABS = [ 'overview', 'find', 'activity', 'health' ];
const KINDS = [ 'export', 'import', 'import-replace', 'refused' ];
const UNITS = [ 'B', 'KB', 'MB', 'GB', 'TB' ];

export default {
  emits: [ 'safe-close' ],
  data() {
    return {
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      },
      tabs: TABS,
      kinds: KINDS,
      current: 'overview',
      state: Object.fromEntries(TABS.map(tab => [ tab, {
        status: 'idle',
        data: null
      } ])),
      search: {
        q: '',
        type: '',
        status: 'live'
      },
      activity: {
        kind: '',
        page: 1
      },
      data: {
        status: 'idle',
        _id: '',
        title: '',
        json: ''
      },
      copied: false
    };
  },
  computed: {
    typeChoices() {
      return this.state.overview.data?.types || [];
    }
  },
  async mounted() {
    this.modal.active = true;
    await this.load('overview');
  },
  methods: {
    close() {
      this.modal.showModal = false;
    },
    async show(tab) {
      this.current = tab;
      if (tab === 'find' && this.state.overview.status === 'idle') {
        // The type filter lists the overview's types
        await this.load('overview');
      }
      if (this.state[tab].status === 'idle' && tab !== 'find') {
        await this.load(tab);
      }
    },
    async load(tab) {
      const state = this.state[tab];
      state.status = 'loading';
      try {
        state.data = await apos.http.get(`${API}/${tab}`, {
          qs: this.queryFor(tab)
        });
        state.status = 'ready';
      } catch (error) {
        state.status = 'error';
      }
    },
    queryFor(tab) {
      if (tab === 'find') {
        return this.search;
      }
      if (tab === 'activity') {
        return this.activity;
      }
      return {};
    },
    managerFor(type) {
      return apos.modules[type]?.components?.managerModal || null;
    },
    async openManager(type) {
      await apos.modal.execute(this.managerFor(type), { moduleName: type });
      await this.load('overview');
    },
    async create(type) {
      await apos.doc.edit({ type });
      await this.load('overview');
    },
    async edit(doc) {
      await apos.doc.edit({
        type: doc.type,
        _id: doc._id
      });
      await this.afterChange(doc);
    },
    async history(doc) {
      const versions = apos.modules['@apostrophecms/document-versions'];
      await apos.modal.execute(versions.components.versions, {
        moduleName: '@apostrophecms/document-versions',
        doc: {
          _id: doc._id,
          type: doc.type
        }
      });
      await this.afterChange(doc);
    },
    // An editor or History can change the document: reload the results, and
    // the data panel when it shows the same document, so it is never stale.
    async afterChange(doc) {
      await this.load('find');
      if (this.data.status !== 'idle' && this.data._id === doc._id) {
        await this.viewData(doc);
      }
    },
    async viewData(doc) {
      this.copied = false;
      this.data = {
        status: 'loading',
        _id: doc._id,
        title: doc.title,
        json: ''
      };
      try {
        const result = await apos.http.get(`${API}/document`, {
          qs: { _id: doc._id }
        });
        this.data.json = JSON.stringify(result.doc, null, 2);
        this.data.status = 'ready';
      } catch (error) {
        this.data.status = 'error';
      }
    },
    closeData() {
      this.data = {
        status: 'idle',
        _id: '',
        title: '',
        json: ''
      };
    },
    async copyJson() {
      try {
        await navigator.clipboard.writeText(this.data.json);
        this.copied = true;
      } catch (error) {
        this.copied = false;
      }
    },
    typeLabel(type) {
      const pageTypes = apos.page?.validPageTypes || [];
      const name = pageTypes.includes(type) ? '@apostrophecms/page' : type;
      return this.typeChoices.find(choice => choice.name === name)?.label || type;
    },
    statusKey(doc) {
      if (doc.archived) {
        return 'project:dataDashboardArchived';
      }
      if (!doc.lastPublishedAt) {
        return 'project:dataDashboardDraftOnly';
      }
      return doc.modified
        ? 'project:dataDashboardModified'
        : 'project:dataDashboardPublished';
    },
    details(details = {}) {
      return Object.entries(details)
        .filter(([ , value ]) => value !== null && value !== undefined && value !== '')
        .map(([ key, value ]) => `${key}: ${Array.isArray(value) ? value.join(', ') || '—' : value}`)
        .join(' · ');
    },
    when(date) {
      return date ? new Date(date).toLocaleString() : '—';
    },
    dash(value) {
      return value === null || value === undefined ? '—' : value;
    },
    orNa(value) {
      return value === null || value === undefined
        ? this.$t('project:dataDashboardNotAvailable')
        : value;
    },
    bytes(value) {
      if (value === null || value === undefined) {
        return this.$t('project:dataDashboardNotAvailable');
      }
      let size = value;
      let unit = 0;
      while (size >= 1024 && unit < UNITS.length - 1) {
        size /= 1024;
        unit++;
      }
      return `${size.toFixed(unit ? 1 : 0)} ${UNITS[unit]}`;
    },
    capitalize(text) {
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
  }
};
</script>

<style lang="scss" scoped>
// The modal sits on the public page, so the site's own styles for
// headings, tables and `pre` would apply: set the admin UI's own type,
// colour and alignment, as core's admin components do.
.assurer-dashboard__body {
  max-width: 1100px;
  margin: 0 auto;
  color: var(--a-text-primary);
  font-family: var(--a-family-default);
  font-size: var(--a-type-base);
  line-height: var(--a-line-tall);
  text-align: left;
}

.assurer-dashboard__heading {
  margin: 0 0 $spacing-base;
  font-size: var(--a-type-large);
  font-weight: var(--a-weight-bold);
  text-align: left;
}

.assurer-dashboard__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-half;
  margin-bottom: $spacing-double;
  border-bottom: 1px solid var(--a-base-8);
}

.assurer-dashboard__tab {
  padding: $spacing-base $spacing-double;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--a-base-2);
  font: inherit;
  cursor: pointer;

  &.is-active {
    border-bottom-color: var(--a-primary);
    color: var(--a-text-primary);
    font-weight: var(--a-weight-bold);
  }

  &:focus-visible {
    outline: 2px solid var(--a-primary);
    outline-offset: 2px;
  }
}

.assurer-dashboard__panel {
  color: var(--a-text-primary);
}

.assurer-dashboard__scroll {
  overflow-x: auto;
}

.assurer-dashboard__table {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: $spacing-base;
    border-bottom: 1px solid var(--a-base-9);
    color: inherit;
    font-size: inherit;
    line-height: inherit;
    text-align: left;
    vertical-align: middle;
  }

  thead th {
    color: var(--a-base-2);
    font-weight: var(--a-weight-bold);
  }
}

.assurer-dashboard__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $spacing-half;
}

.assurer-dashboard__muted {
  color: var(--a-base-3);
}

.assurer-dashboard__note {
  margin: $spacing-double 0;
}

.assurer-dashboard__form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: $spacing-double;
  margin: $spacing-double 0;

  label {
    display: flex;
    flex-direction: column;
    gap: $spacing-half;
  }

  input,
  select {
    min-width: 180px;
    padding: $spacing-half $spacing-base;
    border: 1px solid var(--a-base-8);
    border-radius: var(--a-border-radius);
    background: var(--a-background-primary);
    color: var(--a-text-primary);
    font: inherit;
  }
}

.assurer-dashboard__data {
  margin-top: $spacing-double;
  padding: $spacing-double;
  border: 1px solid var(--a-base-8);
  border-radius: var(--a-border-radius);
}

.assurer-dashboard__json {
  overflow: auto;
  box-sizing: border-box;
  width: 100%;
  max-width: none;
  max-height: 50vh;
  margin: $spacing-base 0 0;
  padding: $spacing-base;
  border: none;
  background: var(--a-base-10);
  color: var(--a-text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--a-type-label);
  line-height: var(--a-line-tall);
  text-align: left;
  white-space: pre;
}

.assurer-dashboard__details {
  overflow-wrap: anywhere;
}

.assurer-dashboard__facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: $spacing-base $spacing-double;
  margin-bottom: $spacing-double;

  dt {
    color: var(--a-base-2);
    font-weight: var(--a-weight-bold);
  }

  dd {
    margin: 0;
  }
}

.assurer-dashboard__count {
  display: inline-block;
  margin-right: $spacing-double;
}
</style>
