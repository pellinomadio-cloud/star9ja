import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const FALLBACK_BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "FCMB", code: "214" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank", code: "011" },
  { name: "GTBank", code: "058" },
  { name: "KUDA", code: "50211" },
  { name: "MONIEPOINT", code: "50515" },
  { name: "OPAY", code: "999992" },
  { name: "PALMPAY", code: "999991" },
  { name: "Sterling Bank", code: "232" },
  { name: "UBA", code: "033" },
  { name: "Union Bank", code: "032" },
  { name: "Zenith Bank", code: "057" }
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing middleware
  app.use(express.json());

  // Initialize Firebase App
  const firebaseConfigPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
  const appFirebase = initializeApp(firebaseConfig);
  const dbId = firebaseConfig.firestoreDatabaseId;
  const db = dbId ? getFirestore(appFirebase, dbId) : getFirestore(appFirebase);

  // API Routes
  app.get("/api/paystack/banks", async (req, res) => {
    try {
      const paystackKey = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackKey) {
        console.warn("PAYSTACK_SECRET_KEY is missing, returning fallback bank list.");
        return res.json({ status: true, data: FALLBACK_BANKS });
      }

      const response = await fetch("https://api.paystack.co/bank?country=nigeria", {
        headers: {
          Authorization: `Bearer ${paystackKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Paystack API returned status ${response.status}`);
      }

      const data = await response.json();
      return res.json(data);
    } catch (error: any) {
      console.error("Error fetching banks from Paystack:", error);
      return res.json({ status: true, data: FALLBACK_BANKS });
    }
  });

  app.get("/api/paystack/resolve", async (req, res) => {
    const { account_number, bank_code } = req.query;

    if (!account_number || !bank_code) {
      return res.status(400).json({ status: false, message: "Account number and bank code are required." });
    }

    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackKey) {
      return res.status(500).json({ 
        status: false, 
        message: "Paystack Secret Key is missing. Please add PAYSTACK_SECRET_KEY in settings or env file." 
      });
    }

    try {
      const url = `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${paystackKey}`,
        },
      });

      const data: any = await response.json();
      if (!response.ok || !data.status) {
        return res.status(response.status || 400).json({ 
          status: false, 
          message: data.message || "Failed to resolve account with Paystack." 
        });
      }

      return res.json(data);
    } catch (error: any) {
      console.error("Error resolving account via Paystack:", error);
      return res.status(500).json({ status: false, message: error.message || "Internal server error during verification." });
    }
  });

  app.post("/api/paystack/withdraw", async (req, res) => {
    const { userId, bankName, accountNumber, accountName, amount } = req.body;

    if (!userId || !bankName || !accountNumber || !accountName || !amount) {
      return res.status(400).json({ status: false, message: "All fields are required." });
    }

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ status: false, message: "Invalid withdrawal amount." });
    }

    try {
      const emailKey = userId.toLowerCase();
      const userRef = doc(db, "users", emailKey);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        return res.status(404).json({ status: false, message: "User not found." });
      }

      const userData = userSnap.data();
      const isDeactivated = userData.deactivationDate && Date.now() > userData.deactivationDate;
      if (isDeactivated) {
        return res.status(403).json({ status: false, message: "Account is deactivated." });
      }

      if (withdrawAmount > userData.balance) {
        return res.status(400).json({ status: false, message: "Insufficient funds." });
      }

      const newBalance = userData.balance - withdrawAmount;
      const newTransaction = {
        id: `trx-withdraw-${Date.now()}`,
        type: "debit",
        amount: withdrawAmount,
        description: `Withdrawal to ${bankName} - ${accountName}`,
        date: new Date().toISOString(),
        status: "pending"
      };

      const currentTransactions = userData.transactions || [];
      const updatedTransactions = [newTransaction, ...currentTransactions];

      await setDoc(userRef, {
        ...userData,
        balance: newBalance,
        transactions: updatedTransactions
      }, { merge: true });

      const withdrawalId = `withdrawal-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const withdrawalRef = doc(db, "withdrawals", withdrawalId);
      
      const withdrawalData = {
        userId: emailKey,
        bankName,
        accountNumber,
        accountName,
        amount: withdrawAmount,
        timestamp: Date.now(),
        status: "pending"
      };

      await setDoc(withdrawalRef, withdrawalData);

      return res.json({
        status: true,
        message: "Withdrawal request submitted successfully.",
        data: {
          withdrawalId,
          newBalance,
          transaction: newTransaction
        }
      });

    } catch (error: any) {
      console.error("Error processing withdrawal:", error);
      return res.status(500).json({ status: false, message: error.message || "Failed to process withdrawal request." });
    }
  });

  // Vite Integration Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
