// Choices offered on /yard (the yard-sign QR landing page) and where /go sends visitors.
// Kept out of worker.js: a Worker module may only export handlers and functions.
export const YARD_LEAD_SOURCE = "yard_sign_picker";
export const YARD_CATEGORIES = {
  mini_split: { label: "Mini-Split", tasks: ["install_replace", "repair", "maintenance"] },
  heat_pump: { label: "Heat Pump", tasks: ["install_replace", "repair", "maintenance"] },
  furnace: { label: "Furnace", tasks: ["install_replace", "repair", "maintenance"] },
  repair_maintenance: { label: "Repair & Maintenance", tasks: ["repair", "maintenance"] },
  other: { label: "Other", tasks: ["other"] }
};
export const YARD_TASKS = { install_replace: "Install or Replace", repair: "Repair", maintenance: "Maintenance", other: "Other request" };
export const YARD_EQUIPMENT = {
  mini_split: "Mini-Split",
  heat_pump: "Heat Pump",
  furnace: "Furnace",
  air_conditioner: "Air Conditioner",
  not_sure: "Not sure / other"
};
export const YARD_REDIRECT_URL = "https://apexgroupwa.com/yard?utm_source=yard_sign&utm_medium=offline&utm_campaign=local_hvac";
