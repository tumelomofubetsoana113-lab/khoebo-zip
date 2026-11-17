// The demo trader for the chat's "Load demo trader": the ordinary case, a
// registered fruit and vegetable seller in Maseru who buys stock from a
// wholesaler every Monday and Friday. Four weeks of records ending today. The same
// "today" always gives the same records, so a demo can be repeated.

import { addDays, weekdayName } from "./dates";
import type { Entry, TraderState } from "./state";

const DAYS = 28;

// A small seeded random generator (mulberry32), so the numbers look real
// but are repeatable.
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Round to the nearest M10, as traders count.
function tens(n: number): number {
  return Math.round(n / 10) * 10;
}

// Busier on Fridays and Saturdays, quieter on Sundays.
const dayFactor: Record<string, number> = {
  Monday: 0.9,
  Tuesday: 0.9,
  Wednesday: 1,
  Thursday: 1,
  Friday: 1.25,
  Saturday: 1.4,
  Sunday: 0.6,
};

const saleNotes = ["tomatoes and spinach", "apples and oranges", "potatoes and onions", "bananas", "cabbage and carrots"];

export function demoTraderState(today: string): TraderState {
  const rand = random(Number(today.replaceAll("-", "")));
  const entries: Entry[] = [];
  const start = addDays(today, -(DAYS - 1));

  for (let i = 0; i < DAYS; i++) {
    const date = addDays(start, i);
    const day = weekdayName(date);
    const stamp = (time: string) => `${date}T${time}:00.000Z`; // 15:00 UTC is 17:00 in Lesotho

    // Stock from the wholesaler on Monday mornings, and on Friday mornings
    // before the busy weekend.
    if (day === "Monday" || day === "Friday") {
      entries.push({
        id: `demo-${date}-p`,
        kind: "purchase",
        amount: tens(700 + rand() * 300),
        date,
        note: "stock from the wholesaler",
        source: "text",
        createdAt: stamp("05:30"),
      });
    }

    entries.push({
      id: `demo-${date}-s`,
      kind: "sale",
      amount: tens((320 + rand() * 260) * dayFactor[day]),
      date,
      note: saleNotes[Math.floor(rand() * saleNotes.length)],
      source: "text",
      createdAt: stamp("15:00"),
    });
  }

  return {
    version: 1,
    onboardingDone: true,
    profile: {
      businessType: "Fruit and veg",
      district: "Maseru",
      registered: "yes",
      language: "en",
    },
    entries,
    returns: [],
    messageCount: 0,
  };
}

// The demo runner: a registered runner in Maseru who goes to Bloemfontein
// every Tuesday and Friday to buy goods for clients. Each order is the client's
// money for the goods (client_money, not income) and the runner's fee (a sale,
// the only turnover). The taxi fare is a purchase. Same "today", same records.

const orders = [
  "fridge",
  "school uniforms",
  "building tools",
  "bedroom suite",
  "stove",
  "baby clothes",
  "car parts",
  "TV stand",
];

export function demoRunnerState(today: string): TraderState {
  const rand = random(Number(today.replaceAll("-", "")) + 1);
  const entries: Entry[] = [];
  const start = addDays(today, -(DAYS - 1));

  for (let i = 0; i < DAYS; i++) {
    const date = addDays(start, i);
    const day = weekdayName(date);
    if (day !== "Tuesday" && day !== "Friday") continue;
    const stamp = (time: string) => `${date}T${time}:00.000Z`;

    entries.push({
      id: `demo-${date}-fare`,
      kind: "purchase",
      amount: 280,
      date,
      note: "taxi to Bloemfontein and back",
      source: "text",
      createdAt: stamp("04:00"),
    });

    const clients = 2 + Math.floor(rand() * 3); // 2 to 4 orders a trip
    for (let c = 0; c < clients; c++) {
      const item = orders[Math.floor(rand() * orders.length)];
      const goods = tens(600 + rand() * 4400);
      // The fee is about 10% of the goods, at least M100.
      const fee = Math.max(100, tens(goods * 0.1));
      entries.push({
        id: `demo-${date}-c${c}`,
        kind: "client_money",
        amount: goods,
        date,
        note: `for a client's ${item}`,
        currency: "rand",
        source: "text",
        createdAt: stamp(`0${5 + c}:00`),
      });
      entries.push({
        id: `demo-${date}-f${c}`,
        kind: "sale",
        amount: fee,
        date,
        note: `runner fee, ${item}`,
        source: "text",
        createdAt: stamp(`0${5 + c}:30`),
      });
    }
  }

  return {
    version: 1,
    onboardingDone: true,
    profile: {
      businessType: "Runner (cross-border)",
      district: "Maseru",
      registered: "yes",
      language: "en",
    },
    entries,
    returns: [],
    messageCount: 0,
  };
}
