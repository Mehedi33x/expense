<template>
  <div id="app">
    <header class="header">
      <h1>Monthly Expense Tracker</h1>
      <div class="month-picker">
        <button @click="shiftMonth(-1)">&laquo;</button>
        <span>{{ monthLabel }}</span>
        <button @click="shiftMonth(1)">&raquo;</button>
      </div>
    </header>
    <section class="storage-bar">
      <template v-if="storageState === 'connected'">
        <span class="ok">● Synced with Google Sheets{{ syncing ? ' (syncing…)' : '' }}</span>
        <button @click="loadFromSheet" :disabled="syncing">Refresh</button>
      </template>
      <template v-else-if="storageState === 'connecting'">
        <span class="warn">Connecting to Google Sheets…</span>
      </template>
      <template v-else-if="storageState === 'not-configured'">
        <span class="warn">Google Sheets URL not configured. Check the SHEET_API_URL constant.</span>
      </template>
      <template v-else>
        <span class="warn">⚠️ Could not reach Google Sheets. Data will NOT be saved.</span>
        <button @click="loadFromSheet">Retry</button>
      </template>
    </section>
    <section class="summary">
      <div class="card invest">
        <span class="label">Invested this month</span>
        <span class="value">{{ formatMoney(monthInvested) }}</span>
      </div>
      <div class="card spent">
        <span class="label">Spent this month</span>
        <span class="value">{{ formatMoney(monthSpent) }}</span>
      </div>
      <div class="card remain" :class="{ negative: monthRemaining < 0 }">
        <span class="label">Remaining</span>
        <span class="value">{{ formatMoney(monthRemaining) }}</span>
      </div>
    </section>
    <section class="panels">
      <!-- ============ Investors Panel ============ -->
      <div class="panel">
        <h2>Investors</h2>
        <form class="row-form" @submit.prevent="addInvestor">
          <input v-model="investorForm.name" type="text" placeholder="Investor name" required />
          <input v-model.number="investorForm.amount" type="number" step="0.01" min="0.01" placeholder="Amount"
            required />
          <input v-model="investorForm.date" type="date" class="date-input" :max="todayISO()" required />
          <input v-model="investorForm.comment" type="text" placeholder="Comment (optional)" class="comment-input" />
          <button type="submit">Add</button>
        </form>
        <ul class="entry-list">
          <li v-for="inv in monthInvestors" :key="inv.id">
            <div class="entry-main">
              <strong>{{ inv.name }}</strong>
              <span>{{ formatMoney(inv.amount) }}</span>
            </div>
            <div v-if="inv.comment" class="entry-comment">
              💬 {{ inv.comment }}
            </div>
            <div class="entry-meta">
              <span>{{ formatDateTime(inv.date) }}</span>
              <button class="link-btn" @click="removeInvestor(inv.id)">remove</button>
            </div>
          </li>
          <li v-if="!monthInvestors.length" class="empty">No investors added for this month yet.</li>
        </ul>
      </div>
      <!-- ============ Expenses Panel ============ -->
      <div class="panel">
        <h2>Expenses</h2>
        <form class="row-form" @submit.prevent="addExpense">
          <input v-model="expenseForm.note" type="text" placeholder="What for" required />
          <input v-model.number="expenseForm.amount" type="number" step="0.01" min="0.01" placeholder="Amount"
            required />
          <input v-model="expenseForm.date" type="date" class="date-input" :max="todayISO()" required />
          <input v-model="expenseForm.comment" type="text" placeholder="Comment (optional)" class="comment-input" />
          <button type="submit">Add</button>
        </form>
        <ul class="entry-list">
          <li v-for="exp in monthExpensesSorted" :key="exp.id">
            <div class="entry-main">
              <strong>{{ exp.note }}</strong>
              <span>{{ formatMoney(exp.amount) }}</span>
            </div>
            <div v-if="exp.comment" class="entry-comment">
              💬 {{ exp.comment }}
            </div>
            <div class="entry-meta">
              <span>{{ formatDateTime(exp.date) }}</span>
              <button class="link-btn" @click="removeExpense(exp.id)">remove</button>
            </div>
          </li>
          <li v-if="!monthExpensesSorted.length" class="empty">No expenses logged for this month yet.</li>
        </ul>
      </div>
    </section>
    <section class="daily">
      <h2>Daily breakdown</h2>
      <table v-if="dailyBreakdown.length">
        <thead>
          <tr>
            <th>Date</th>
            <th>Spent</th>
            <th>Running remaining</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="day in dailyBreakdown" :key="day.date">
            <td>{{ day.date }}</td>
            <td>{{ formatMoney(day.spent) }}</td>
            <td :class="{ negative: day.runningRemaining < 0 }">{{ formatMoney(day.runningRemaining) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">Nothing to show for this month yet.</p>
    </section>
  </div>
</template>
<script>
const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbwYvXWWfUnFqZa7yespRVDp1fC4k98KmsUiDKnWj-fb70wS_Ln5L8xnLdPbDtMRZBA8/exec'
export default {
  name: 'App',
  data() {
    return {
      investors: [],
      expenses: [],
      investorForm: { name: '', amount: null, comment: '', date: this.todayISO() },
      expenseForm: { note: '', amount: null, comment: '', date: this.todayISO() },
      currentMonth: this.startOfMonth(new Date()),
      storageState: 'connecting',
      syncing: false
    }
  },
  computed: {
    monthKey() {
      return this.toMonthKey(this.currentMonth)
    },
    monthLabel() {
      return this.currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    },
    monthInvestors() {
      return this.investors
        .filter(i => this.toMonthKey(new Date(i.date)) === this.monthKey)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
    },
    monthExpensesSorted() {
      return this.expenses
        .filter(e => this.toMonthKey(new Date(e.date)) === this.monthKey)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
    },
    monthInvested() {
      return this.monthInvestors.reduce((sum, i) => sum + Number(i.amount), 0)
    },
    monthSpent() {
      return this.monthExpensesSorted.reduce((sum, e) => sum + Number(e.amount), 0)
    },
    monthRemaining() {
      return this.monthInvested - this.monthSpent
    },
    dailyBreakdown() {
      const byDay = {}
      this.expenses
        .filter(e => this.toMonthKey(new Date(e.date)) === this.monthKey)
        .forEach(e => {
          const day = new Date(e.date).toISOString().slice(0, 10)
          byDay[day] = (byDay[day] || 0) + Number(e.amount)
        })
      const days = Object.keys(byDay).sort()
      let running = this.monthInvested
      return days.map(day => {
        running -= byDay[day]
        return { date: day, spent: byDay[day], runningRemaining: running }
      })
    }
  },
  async created() {
    await this.loadFromSheet()
  },
  methods: {
    startOfMonth(d) {
      return new Date(d.getFullYear(), d.getMonth(), 1)
    },
    toMonthKey(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    },
    todayISO() {
      const d = new Date()
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    },
    shiftMonth(delta) {
      const d = new Date(this.currentMonth)
      d.setMonth(d.getMonth() + delta)
      this.currentMonth = d
    },
    formatMoney(n) {
      return Number(n ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    },
    formatDateTime(iso) {
      return new Date(iso).toLocaleString()
    },
    // ---------- CRUD ----------
    addInvestor() {
      if (!this.investorForm.name || !this.investorForm.amount || !this.investorForm.date) return
      const selected = new Date(
        this.investorForm.date + 'T' + new Date().toTimeString().slice(0, 8)
      )
      const entry = {
        id: Date.now(),
        name: this.investorForm.name.trim(),
        amount: this.investorForm.amount,
        date: selected.toISOString(),
        comment: (this.investorForm.comment || '').trim()
      }
      this.investors.push(entry)
      this.investorForm = { name: '', amount: null, comment: '', date: this.todayISO() }
      this.saveAllToSheet()
    },
    removeInvestor(id) {
      this.investors = this.investors.filter(i => i.id !== id)
      this.saveAllToSheet()
    },
    addExpense() {
      if (!this.expenseForm.note || !this.expenseForm.amount || !this.expenseForm.date) return
      const selected = new Date(
        this.expenseForm.date + 'T' + new Date().toTimeString().slice(0, 8)
      )
      const entry = {
        id: Date.now(),
        note: this.expenseForm.note.trim(),
        amount: this.expenseForm.amount,
        date: selected.toISOString(),
        comment: (this.expenseForm.comment || '').trim()
      }
      this.expenses.push(entry)
      this.expenseForm = { note: '', amount: null, comment: '', date: this.todayISO() }
      this.saveAllToSheet()
    },
    removeExpense(id) {
      this.expenses = this.expenses.filter(e => e.id !== id)
      this.saveAllToSheet()
    },
    // ---------- Google Sheets sync ----------
    async loadFromSheet() {
      if (!SHEET_API_URL || SHEET_API_URL.includes('YOUR_APPS_SCRIPT')) {
        this.storageState = 'not-configured'
        return
      }
      this.storageState = 'connecting'
      try {
        const res = await fetch(SHEET_API_URL)
        const data = await res.json()
        if (!data.ok) throw new Error(data.error || 'Unknown error')
        const rows = data.rows || []
        this.investors = rows
          .filter(r => r.type === 'investor')
          .map(r => ({
            id: Number(r.id),
            name: r.name,
            amount: Number(r.amount),
            date: r.date,
            comment: r.comment || ''
          }))
        this.expenses = rows
          .filter(r => r.type === 'expense')
          .map(r => ({
            id: Number(r.id),
            note: r.name,
            amount: Number(r.amount),
            date: r.date,
            comment: r.comment || ''
          }))
        this.storageState = 'connected'
      } catch (e) {
        console.error('Load failed', e)
        this.storageState = 'error'
      }
    },
    async saveAllToSheet() {
      if (this.storageState !== 'connected') return
      this.syncing = true
      try {
        const rows = [
          ...this.investors.map(i => ({
            id: i.id,
            type: 'investor',
            name: i.name,
            amount: i.amount,
            date: i.date,
            comment: i.comment || ''
          })),
          ...this.expenses.map(e => ({
            id: e.id,
            type: 'expense',
            name: e.note,
            amount: e.amount,
            date: e.date,
            comment: e.comment || ''
          }))
        ]
        console.log('Saving rows to sheet:', rows)  // ← DEBUG
        await fetch(SHEET_API_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'replace-all', rows })
        })
        // Increase delay to give Apps Script time to finish
        setTimeout(() => this.loadFromSheet(), 2000)  // ← CHANGED from 400 to 2000
      } catch (e) {
        console.error('Save failed', e)
        this.storageState = 'error'
      } finally {
        setTimeout(() => { this.syncing = false }, 800)
      }
    }
  }
}
</script>
<style>
/* =========================
   Base
========================= */
:root {
  --primary: #2563eb;
  --primary-dark: #1d4ed8;
  --text: #111827;
  --muted: #6b7280;
  --border: #e5e7eb;
  --border-light: #f1f5f9;
  --surface: #ffffff;
  --soft: #f8fafc;
  --green: #059669;
  --orange: #d97706;
  --red: #dc2626;
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow: 0 8px 30px rgba(15, 23, 42, 0.06);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #ffffff;
  color: var(--text);
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont,
    "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

button,
input {
  font: inherit;
}

button {
  transition: background 0.2s ease, border-color 0.2s ease,
    color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
}

button:active {
  transform: translateY(1px);
}

/* App Container — বড় করা হয়েছে */
#app {
  width: min(1400px, calc(100% - 40px));
  margin: 0 auto;
  padding: 38px 0 60px;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
}

.header h1 {
  margin: 0;
  color: #111827;
  font-size: 30px;
  line-height: 1.2;
  font-weight: 750;
  letter-spacing: -0.7px;
}

.month-picker {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px;
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 12px;
}

.month-picker span {
  min-width: 145px;
  text-align: center;
  color: #1f2937;
  font-size: 14px;
  font-weight: 650;
}

.month-picker button {
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: #ffffff;
  color: #374151;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.month-picker button:hover {
  color: var(--primary);
  background: #eff6ff;
}

/* Storage Bar */
.storage-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  min-height: 52px;
  padding: 12px 16px;
  margin-bottom: 24px;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  color: var(--muted);
  font-size: 13px;
}

.storage-bar .ok,
.storage-bar .warn,
.storage-bar .hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.storage-bar .ok {
  color: var(--green);
  font-weight: 600;
}

.storage-bar .warn {
  color: #92400e;
}

.storage-bar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: #374151;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.storage-bar button:hover {
  border-color: #93c5fd;
  color: var(--primary);
  background: #eff6ff;
}

.storage-bar button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Summary Cards */
.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}

.card {
  position: relative;
  overflow: hidden;
  min-height: 132px;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #ffffff;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}

.card::after {
  content: "";
  position: absolute;
  right: -35px;
  top: -35px;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  opacity: 0.08;
}

.card .label {
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
}

.card .value {
  color: #111827;
  font-size: 28px;
  line-height: 1;
  font-weight: 750;
  letter-spacing: -0.6px;
}

.card.invest {
  border-top: 3px solid #10b981;
}

.card.invest::after {
  background: #10b981;
}

.card.spent {
  border-top: 3px solid #f59e0b;
}

.card.spent::after {
  background: #f59e0b;
}

.card.remain {
  border-top: 3px solid var(--primary);
}

.card.remain::after {
  background: var(--primary);
}

.card.remain.negative {
  border-top-color: var(--red);
}

.card.remain.negative::after {
  background: var(--red);
}

/* Panels */
.panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-bottom: 28px;
}

.panel {
  min-width: 0;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #ffffff;
  box-shadow: var(--shadow-sm);
}

.panel h2,
.daily h2 {
  margin: 0;
  color: #111827;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.2px;
}

.panel h2 {
  margin-bottom: 18px;
}

/* =========================
   Forms — 2-Row Grid
========================= */
.row-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 18px;
}

.row-form input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 9px;
  outline: none;
  background: #ffffff;
  color: #111827;
  font-size: 13px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.row-form input::placeholder {
  color: #9ca3af;
}

.row-form input:hover {
  border-color: #9ca3af;
}

.row-form input:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.row-form button {
  height: 40px;
  padding: 0 18px;
  border: 0;
  border-radius: 9px;
  background: var(--primary);
  color: #ffffff;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  white-space: nowrap;
}

.row-form button:hover {
  background: var(--primary-dark);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
}

/* Entry Lists */
.entry-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 310px;
  overflow-y: auto;
}

.entry-list::-webkit-scrollbar {
  width: 5px;
}

.entry-list::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 999px;
}

.entry-list li {
  padding: 13px 2px;
  border-bottom: 1px solid var(--border-light);
}

.entry-list li:last-child {
  border-bottom: 0;
}

.entry-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}

.entry-main strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #1f2937;
  font-size: 13px;
  font-weight: 650;
}

.entry-main>span {
  flex-shrink: 0;
  color: #111827;
  font-size: 13px;
  font-weight: 700;
}

.entry-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 5px;
  color: #9ca3af;
  font-size: 11px;
}

.link-btn {
  padding: 0;
  border: 0;
  background: transparent;
  color: #ef4444;
  font-size: 11px;
  cursor: pointer;
}

.link-btn:hover {
  color: #b91c1c;
  text-decoration: underline;
}

.empty {
  padding: 25px 10px !important;
  border: 0 !important;
  color: #9ca3af;
  font-size: 13px;
  font-style: italic;
  text-align: center;
}

/* Daily Breakdown */
.daily {
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #ffffff;
  box-shadow: var(--shadow-sm);
  text-align: left;
}

.daily h2 {
  margin-bottom: 18px;
}

.daily table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.daily th {
  padding: 12px 14px;
  background: #f8fafc;
  border-bottom: 1px solid var(--border);
  color: #6b7280;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.daily td {
  padding: 13px 14px;
  border-bottom: 1px solid var(--border-light);
  color: #374151;
  font-size: 13px;
}

.daily tbody tr:last-child td {
  border-bottom: 0;
}

.daily tbody tr:hover {
  background: #fafcff;
}

.daily td:nth-child(2),
.daily td:nth-child(3) {
  font-weight: 650;
}

.daily td.negative {
  color: var(--red);
  font-weight: 750;
}

/* =========================
   Comment + Date Features
========================= */
.comment-input {
  font-size: 12px !important;
  color: #6b7280;
}

.comment-input::placeholder {
  color: #9ca3af;
  font-style: italic;
}

.date-input {
  font-size: 12px !important;
  color: #6b7280;
  cursor: pointer;
}

.date-input::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.6;
}

.date-input::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
}

.entry-comment {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 6px;
  padding: 6px 10px;
  background: #f8fafc;
  border-left: 3px solid #cbd5e1;
  border-radius: 6px;
  color: #475569;
  font-size: 12px;
  line-height: 1.4;
  word-break: break-word;
  font-style: italic;
}

/* Focus Accessibility */
button:focus-visible,
input:focus-visible,
label:focus-visible {
  outline: 3px solid rgba(37, 99, 235, 0.2);
  outline-offset: 2px;
}

/* =========================
   Responsive
========================= */
@media (max-width: 1000px) {
  .row-form {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 800px) {
  #app {
    width: min(100% - 24px, 680px);
    padding-top: 24px;
  }

  .header {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }

  .header h1 {
    font-size: 25px;
  }

  .month-picker {
    width: 100%;
    justify-content: space-between;
  }

  .month-picker span {
    flex: 1;
  }

  .summary {
    grid-template-columns: 1fr;
  }

  .card {
    min-height: 110px;
  }

  .panels {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  #app {
    width: calc(100% - 20px);
    padding-bottom: 35px;
  }

  .storage-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .row-form {
    grid-template-columns: 1fr;
  }

  .row-form button {
    width: 100%;
  }

  .panel,
  .daily {
    padding: 16px;
  }

  .daily {
    overflow-x: auto;
  }

  .daily table {
    min-width: 500px;
  }

  .card .value {
    font-size: 25px;
  }

  .comment-input {
    font-size: 13px !important;
  }

  .date-input {
    font-size: 13px !important;
  }
}
</style>