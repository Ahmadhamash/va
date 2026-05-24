import os
import glob

# Files to update
files = [
    "src/pages/BookingsPage.jsx",
    "src/pages/DeliveryPage.jsx",
    "src/pages/OffersPage.jsx",
    "src/pages/PaymentSettingsPage.jsx"
]

for file in files:
    with open(file, "r", encoding="utf-8") as f:
        content = f.read()

    # Replaces
    content = content.replace(
        'className="mx-auto max-w-4xl px-4 py-8 space-y-6" dir="rtl"',
        'className="py-7" dir="rtl">\n    <div className="app-container space-y-6"'
    )
    # The closing div needs to be added manually or we just accept the slight HTML issue (no wait, React will crash if unclosed div).
    # Since we added a <div> we need to add a closing </div> at the end of the return statement.
    content = content.replace(
        '</div>;',
        '</div>\n  </div>;'
    )
    
    content = content.replace(
        'className="bg-white rounded-2xl shadow-sm p-6 space-y-4"',
        'className="surface p-5 sm:p-6 space-y-4"'
    )
    content = content.replace(
        'className="bg-white rounded-xl shadow-sm p-4 space-y-2"',
        'className="surface p-5 space-y-2"'
    )
    content = content.replace(
        'className="bg-white rounded-xl shadow-sm p-4"',
        'className="surface p-5"'
    )
    content = content.replace(
        'className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 text-sm font-medium"',
        'className="btn-primary"'
    )
    content = content.replace(
        'className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2 font-medium"',
        'className="btn-primary"'
    )
    content = content.replace(
        'className="border border-gray-300 text-gray-700 rounded-lg px-4 py-2 hover:bg-gray-50"',
        'className="btn-secondary"'
    )
    content = content.replace(
        'className="text-xl font-bold"',
        'className="text-xl font-black text-gray-950 dark:text-white sm:text-2xl"'
    )
    content = content.replace(
        'className="text-lg font-semibold"',
        'className="text-lg font-black text-gray-950 dark:text-white"'
    )
    content = content.replace(
        '"w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"',
        '"input-field"'
    )

    with open(file, "w", encoding="utf-8") as f:
        f.write(content)

print("Done refactoring UI tokens")
