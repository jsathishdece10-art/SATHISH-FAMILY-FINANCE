SATHISH FAMILY FINANCE — UPDATED BUILD

This build is based on the four files uploaded in this conversation. Existing collections and records are retained; no bulk Firestore data migration or deletion is performed.

PAYMENT FLOW
1. Multiple credit cards are supported. Add each card with its credit limit and current outstanding.
2. Daily Entry > Expense / Purchase + Payment method "Credit card": select the exact card in "Credit Card used". Only that card's outstanding increases / available limit decreases. Main Bank is not reduced.
3. Daily Entry > Expense / Purchase + UPI, Auto debit, Bank transfer or Debit card: Main Bank balance decreases. No credit card is changed.
4. Daily Entry > Credit Card Bill Payment: select the card bill and use a bank-linked method (UPI / Auto debit / Bank transfer / Debit card). Main Bank decreases and that card's outstanding decreases / available limit increases. This transaction type is not counted as a second expense in the expense totals.
5. Cash and Other methods do not affect Main Bank or a credit card.
6. The Dashboard shows Main Bank Available separately from Total Credit Card Available. Click Total Credit Card Available to expand the HDFC / ICICI / other card-level credit limit, outstanding and available balances.
7. Dashboard "Monthly Net Position" is an income-versus-outflow accounting figure; it is not the Main Bank cash balance.

SETUP / FIRST USE
- Deploy app.js, index.html, style.css and firestore.rules together.
- Publish firestore.rules to the same Firebase project used by app.js.
- In Credit Cards > Main Bank Balance, enter the actual bank balance as of the moment you save it. This becomes the baseline; only newly recorded bank-linked transactions after that baseline change the displayed bank balance. Existing historical transactions are not replayed.
- For each credit card, enter its actual current outstanding and total credit limit. This establishes that card's baseline; only newly recorded linked card purchases and bill payments change its balance.
- For a card purchase, always choose the card. For a card bill payment, always choose the card being paid.
- Test with a small sample transaction and verify the app balance against your bank/card statement before relying on it.

IMPORTANT LIMITATIONS
- Existing old transactions without card links or bank-impact metadata are not automatically classified or replayed. This avoids unexpectedly changing your current real balances.
- Deleting or editing a previously recorded linked transaction does not automatically reverse/rebuild the original bank/card movement history. If you need to correct a past linked transaction, reconcile the account/card opening baseline to the actual current statement after correction.
- This build was syntax-checked locally. It has not been live-tested against your Firebase account or deployed hosting.
- Firestore rules file is preserved from your upload; confirm it is published in Firebase Console.
