const fs = require('fs');

const files = [
  'frontend/src/pages/BookingsPage.jsx',
  'frontend/src/pages/DashboardPage.jsx',
  'frontend/src/pages/DeliveryPage.jsx',
  'frontend/src/pages/EscalationsPage.jsx',
  'frontend/src/pages/LoginPage.jsx',
  'frontend/src/pages/OffersPage.jsx',
  'frontend/src/pages/PaymentSettingsPage.jsx',
  'frontend/src/pages/PoliciesPage.jsx',
  'frontend/src/pages/PrivacyPage.jsx',
  'frontend/src/pages/RegisterPage.jsx',
  'frontend/src/pages/TermsPage.jsx',
  'frontend/src/pages/WorkflowsPage.jsx'
];

files.forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  // Simple regex to find Arabic text
  const regex = /[\u0600-\u06FF]+/g;
  let m;
  const lines = c.split('\n');
  const found = new Set();
  lines.forEach((line, i) => {
    if (regex.test(line)) {
      found.add(line.trim());
    }
  });
  if (found.size > 0) {
    console.log('--- ' + f);
    for (const line of found) {
      console.log(line);
    }
  }
});
