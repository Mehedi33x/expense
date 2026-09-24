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
      <!-- Investors panel -->
      <div class="panel">
        <h2>Investors</h2>
        <form class="row-form" @submit.prevent="addInvestor">
          <input v-model="investorForm.name" type="text" placeholder="Investor name" required />
          <input v-model.number="investorForm.amount" type="number" step="0.01" min="0.01" placeholder="Amount"
            required />
          <button type="submit">Add</button>
        </form>
        <ul class="entry-list">
          <li v-for="inv in monthInvestors" :key="inv.id">
            <div class="entry-main">
              <strong>{{ inv.name }}</strong>
              <span>{{ formatMoney(inv.amount) }}</span>
            </div>
            <div class="entry-meta">
              <span>{{ formatDateTime(inv.date) }}</span>
              <button class="link-btn" @click="removeInvestor(inv.id)">remove</button>
            </div>
          </li>
          <li v-if="!monthInvestors.length" class="empty">No investors added for this month yet.</li>
        </ul>
      </div>

      <!-- Expenses panel -->
      <div class="panel">
        <h2>Expenses</h2>
        <form class="row-form" @submit.prevent="addExpense">
          <input v-model="expenseForm.note" type="text" placeholder="What for" required />
          <input v-model.number="expenseForm.amount" type="number" step="0.01" min="0.01" placeholder="Amount"
            required />
          <button type="submit">Add</button>
        </form>
        <ul class="entry-list">
          <li v-for="exp in monthExpensesSorted" :key="exp.id">
            <div class="entry-main">
              <strong>{{ exp.note }}</strong>
              <span>{{ formatMoney(exp.amount) }}</span>
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

    <!-- Daily breakdown for the selected month -->
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
const STORAGE_KEY = 'expense-tracker-data-v1'

export default {
  name: 'App',
  data() {
    return {
      investors: [],
      expenses: [],
      investorForm: { name: '', amount: null },
      expenseForm: { note: '', amount: null },
      // First day of the currently viewed month
      currentMonth: this.startOfMonth(new Date())
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
      return this.monthInvestors.reduce((sum, i) => sum + i.amount, 0)
    },
    monthSpent() {
      return this.monthExpensesSorted.reduce((sum, e) => sum + e.amount, 0)
    },
    monthRemaining() {
      return this.monthInvested - this.monthSpent
    },
    dailyBreakdown() {
      // Group this month's expenses by day, oldest first, with a running remaining balance
      const byDay = {}
      this.expenses
        .filter(e => this.toMonthKey(new Date(e.date)) === this.monthKey)
        .forEach(e => {
          const day = new Date(e.date).toISOString().slice(0, 10)
          byDay[day] = (byDay[day] || 0) + e.amount
        })
      const days = Object.keys(byDay).sort()
      let running = this.monthInvested
      return days.map(day => {
        running -= byDay[day]
        return { date: day, spent: byDay[day], runningRemaining: running }
      })
    }
  },
  created() {
    this.loadData()
  },
  methods: {
    startOfMonth(d) {
      return new Date(d.getFullYear(), d.getMonth(), 1)
    },
    toMonthKey(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    },
    shiftMonth(delta) {
      const d = new Date(this.currentMonth)
      d.setMonth(d.getMonth() + delta)
      this.currentMonth = d
    },
    formatMoney(n) {
      return (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    formatDateTime(iso) {
      return new Date(iso).toLocaleString()
    },
    addInvestor() {
      if (!this.investorForm.name || !this.investorForm.amount) return
      this.investors.push({
        id: Date.now(),
        name: this.investorForm.name.trim(),
        amount: this.investorForm.amount,
        date: new Date().toISOString() // auth date/time = moment it was saved
      })
      this.investorForm = { name: '', amount: null }
      this.saveData()
    },
    removeInvestor(id) {
      this.investors = this.investors.filter(i => i.id !== id)
      this.saveData()
    },
    addExpense() {
      if (!this.expenseForm.note || !this.expenseForm.amount) return
      this.expenses.push({
        id: Date.now(),
        note: this.expenseForm.note.trim(),
        amount: this.expenseForm.amount,
        date: new Date().toISOString()
      })
      this.expenseForm = { note: '', amount: null }
      this.saveData()
    },
    removeExpense(id) {
      this.expenses = this.expenses.filter(e => e.id !== id)
      this.saveData()
    },
    saveData() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        investors: this.investors,
        expenses: this.expenses
      }))
    },
    loadData() {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      try {
        const parsed = JSON.parse(raw)
        this.investors = parsed.investors || []
        this.expenses = parsed.expenses || []
      } catch (e) {
        console.error('Could not parse stored expense data', e)
      }
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  max-width: 900px;
  margin: 40px auto;
  padding: 0 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.month-picker {
  display: flex;
  align-items: center;
  gap: 12px;
}

.month-picker button {
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
}

.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.card {
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #fff;
}

.card .label {
  font-size: 0.8rem;
  opacity: 0.85;
}

.card .value {
  font-size: 1.4rem;
  font-weight: 600;
}

.card.invest {
  background: #2c7a7b;
}

.card.spent {
  background: #b7791f;
}

.card.remain {
  background: #2b6cb0;
}

.card.remain.negative {
  background: #c53030;
}

.panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.panel {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  text-align: left;
}

.panel h2 {
  margin-top: 0;
  font-size: 1.1rem;
}

.row-form {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.row-form input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
}

.row-form button {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  background: #2b6cb0;
  color: #fff;
  cursor: pointer;
}

.entry-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 260px;
  overflow-y: auto;
}

.entry-list li {
  padding: 8px 0;
  border-bottom: 1px solid #edf2f7;
}

.entry-main {
  display: flex;
  justify-content: space-between;
}

.entry-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #718096;
  margin-top: 2px;
}

.link-btn {
  border: none;
  background: none;
  color: #c53030;
  cursor: pointer;
  padding: 0;
  font-size: 0.75rem;
}

.empty {
  color: #a0aec0;
  font-style: italic;
  padding: 8px 0;
}

.daily {
  text-align: left;
}

.daily table {
  width: 100%;
  border-collapse: collapse;
}

.daily th,
.daily td {
  padding: 8px;
  border-bottom: 1px solid #edf2f7;
  text-align: left;
}

.daily td.negative {
  color: #c53030;
  font-weight: 600;
}
</style>