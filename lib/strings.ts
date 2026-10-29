// All UI text lives here, keyed, so Sesotho can be added later.
// English only for now.

export const strings = {
  brand: {
    name: "Khoebo",
    prototypePill: "Prototype · RSL Taxathon 2026",
    prototypeLabel: "Prototype for the RSL Taxathon 2026",
    description:
      "A prototype records and tax assistant for informal traders in Lesotho, with an officer worklist for RSL.",
  },
  footer: {
    text: "Prototype built for the RSL Taxathon 2026 by Tumelo Mofubetsoana, New Empire AI. Not an official RSL service. All data shown is simulated.",
  },
  actions: {
    followup: "Officer follow-up",
    review: "Human review",
    checkin: "Automated check-in",
    none: "No action",
  },
  common: {
    close: "Close",
    cancel: "Cancel",
    confirm: "Confirm",
  },
  chat: {
    title: "Khoebo",
    subtitle: "Records and tax assistant",
    summary: {
      moneyIn: "Money in",
      moneyOut: "Money out",
      profit: "Profit",
      entries: (n: number) => `${n} ${n === 1 ? "entry" : "entries"}`,
    },
    periods: {
      this_week: "This week",
      last_week: "Last week",
      this_month: "This month",
      filing_period: (period: string) => `Filing period ${period}`,
    },
    registration: {
      checklist: [
        "Your ID or passport",
        "Your business name and where you trade",
        "A phone number RSL can reach you on",
        "Your trading licence, if you have one",
      ],
      handoff: "Register through the RSL registration channel (to be confirmed).",
    },
    back: "Back to home",
    demo: "Demo",
    placeholder: "Type a message",
    send: "Send",
    openVoice: "Voice notes",
    typing: "Khoebo is typing",
    notSent: "Not sent. Tap to retry",
    youSaid: "You",
    assistantSaid: "Khoebo",
    messages: "Messages",
    transcript: "Transcript",
    voiceNote: (duration: string) => `Voice note, ${duration}`,
    quickRepliesLabel: "Suggested replies",
    // The first message, shown without calling the API.
    greeting:
      "Hi, I'm Khoebo. I help you keep your sales records by message and file your tax return in a minute. What kind of business do you run?",
    demoLoaded:
      "Demo trader loaded: a fruit and vegetable seller in Maseru, registered with RSL, with four weeks of sales and purchases. Try asking how the week is going.",
    demoQuickReplies: ["How am I doing?", "How much tax do I owe?", "File my return"],
    voice: {
      title: "Voice notes (simulated in this prototype)",
      intro: "Tap a note to send it. In a pilot, Khoebo would transcribe real voice notes.",
      play: "Send voice note",
      samples: [
        { duration: "0:04", transcript: "Sold four hundred and twenty today, mostly tomatoes" },
        { duration: "0:06", transcript: "Bought stock from the wholesaler for nine hundred" },
        {
          duration: "0:03",
          transcript: "Ke rekisitse makholo a mararo kajeno",
          translation: "I sold three hundred today",
        },
      ],
    },
    demoMenu: {
      title: "Demo",
      loadTrader: "Load demo trader",
      loadTraderHint: "Fruit and vegetable seller in Maseru, four weeks of records",
      weekSummary: "Show this week's summary",
      weekSummaryMessage: "how am I doing this week?",
      reminder: "Simulate a reminder",
      reminderHint: "As if it were 3 days before the due date",
      reset: "Reset everything",
      resetHint: "Clears this phone's records and starts again",
      resetTitle: "Reset everything?",
      resetBody: "This deletes the records and chat on this phone and starts the set-up again.",
      resetConfirm: "Reset",
      buttonMessages: {
        confirm_return: "Confirm",
        change_return: "Change",
        pay_return: "Pay (demo)",
        file_now: "File now",
        undo_entry: "Undo",
      },
    },
    cards: {
      recorded: "Recorded",
      sale: "Sale",
      purchase: "Purchase",
      undo: "Undo",
      undone: "Undone",
      returnTitle: (period: string) => `Tax return ${period}`,
      periodDates: (from: string, to: string) => `${from} to ${to}`,
      turnover: "Turnover (money in)",
      estimatedTax: "Estimated tax",
      dueDate: "Due date",
      confirm: "Confirm",
      change: "Change",
      confirmed: "Confirmed",
      paymentTitle: "Mobile money payment (demo)",
      amount: "Amount",
      reference: "Reference",
      pay: "Pay (demo)",
      paid: "Paid (demo)",
      noRealMoney: "This is a demo. No real money moves.",
      registrationTitle: "Registering with RSL",
      registrationIntro: "You'll need:",
      reminderTitle: (period: string) => `Reminder: return ${period}`,
      fileNow: "File now",
      done: "Done",
    },
    // Replies the server sends without asking the model.
    replies: {
      limitReached:
        "You've reached the message limit for this demo. Open the Demo menu and choose \"Reset everything\" to start again.",
      refusal: "Sorry, I can't help with that. I can help you record sales and purchases, or with your tax return.",
      fallback: "Sorry, something went wrong on my side. Please try again.",
    },
  },
  onboarding: {
    businessTypes: [
      "Fruit and veg",
      "Spaza / general dealer",
      "Street food",
      "Hair salon",
      "Clothing",
      "Phone repair",
      "Other",
    ],
    districts: [
      "Berea",
      "Butha-Buthe",
      "Leribe",
      "Mafeteng",
      "Maseru",
      "Mohale's Hoek",
      "Mokhotlong",
      "Qacha's Nek",
      "Quthing",
      "Thaba-Tseka",
    ],
    registered: { yes: "Yes", no: "No", not_sure: "Not sure" },
  },
  landing: {
    nav: {
      label: "Main",
      howItWorks: "How it works",
      forOfficers: "For officers",
      results: "Results",
      tryChat: "Try the chat",
    },
    hero: {
      eyebrow: "For informal traders and RSL officers",
      headline: "Keep your business records in a chat. File your tax return in a minute.",
      subline:
        "Khoebo helps traders in Lesotho log sales by message, see what their business earns each week, and file a pre-filled return. RSL officers get a short list of who to follow up, with the reasons written out.",
      primary: "Try it as a trader",
      secondary: "Open the officer view",
      phoneLabel: "Example chat with Khoebo",
      // A static illustration of the chat, not tool output.
      demo: {
        trader1: "sold 350 today",
        reply1: "Recorded a sale of M350 for today. That's M1,840 so far this week.",
        trader2: "how am I doing this week?",
        summaryPeriod: "This week",
        moneyIn: "M1,840",
        moneyOut: "M1,120",
        profit: "about M720",
        times: ["09:12", "09:12", "17:40", "17:40"],
      },
    },
    problem:
      "A nil return doesn't always mean someone is hiding income. Many traders are seasonal, or have closed, or just never kept records. Khoebo helps traders keep those records, and helps RSL tell the difference.",
    howItWorks: {
      heading: "How it works for traders",
      steps: [
        { title: "Log a sale", body: "Send a short message or voice note, like 'sold 350 today'." },
        { title: "See your week", body: "Get money in, money out and profit every Sunday." },
        { title: "Get a reminder", body: "A message before each due date, with your estimated tax." },
        {
          title: "File in a minute",
          body: "Your return is filled in from your records. You check it and confirm.",
        },
      ],
    },
    officers: {
      heading: "For RSL officers",
      lead: "Every trader is placed in one of four actions. Each one shows the evidence behind it, and the officer always makes the final call.",
      actions: {
        followup: "Strong, repeated evidence of trading well above what was declared.",
        review: "Some evidence, but thin or mixed. An officer checks before any visit.",
        checkin:
          "Nil returns and no sign of trading. A friendly message asks if the business is still running.",
        none: "Declarations match the evidence, or nil months match months with no activity.",
      },
      // Copied from a real line of the simulated worklist (seed 7).
      example: {
        caption: "Example from the simulated worklist",
        id: "TRD-0167",
        meta: "General dealer / spaza · Mafeteng",
        whyHeading: "Why this action",
        reasons: [
          "Supplier e-invoices show M74,430 of stock bought May to Oct 2026.",
          "Mobile money wallet inflows above M1,000 total M61,390 over the same months.",
          "Declared turnover for the period: M0 (5 nil returns).",
          "Trading evidence in 6 of 6 months; declared turnover is 0% of the minimum the evidence suggests.",
        ],
        figures: [
          { label: "Declared (6 months)", value: "M0" },
          { label: "Evidence minimum", value: "M74,430" },
          { label: "Months with evidence", value: "6 of 6" },
        ],
      },
    },
    lesotho: {
      heading: "Built for Lesotho",
      items: [
        {
          title: "Ready for WhatsApp",
          body: "The prototype runs in the browser. In a pilot, the same assistant runs on WhatsApp, with SMS for basic phones.",
        },
        { title: "Light on data", body: "Small pages and short messages that work on a weak connection." },
        {
          title: "English, with Sesotho next",
          body: "It already understands common Sesotho phrases. Full Sesotho replies come with the pilot.",
        },
        {
          title: "Records stay with the trader",
          body: "RSL sees the return a trader files, not their daily sales.",
        },
      ],
    },
    results: {
      heading: "Tested on simulated data",
      fewerCases: (pct: number) => `${pct}% fewer officer cases`,
      fewerCasesLabel: "than following up every nil return",
      precision: (pct: number) => `${pct}% of field visits`,
      precisionLabel: "reached a trader who really was under-declaring",
      found: (n: number) => `${n} found`,
      foundLabel: (population: number, baseline: number) =>
        `undeclared traders per ${population}, close to the ${baseline} found by following up every nil return`,
      note: (population: number) =>
        `Average of 30 simulated populations of ${population} traders. No real taxpayer data was used. The next step is testing on masked RSL data.`,
      stubNote: "Placeholder figures until the simulation results are added.",
    },
    closing: {
      heading: "See it for yourself.",
      chat: "Try the trader chat",
      officer: "Open the officer view",
    },
  },
} as const;

export type ActionKey = keyof typeof strings.actions;
