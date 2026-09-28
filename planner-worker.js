import { generatePlan } from "./planner.js?v=review1";

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ plan: generatePlan(data.foods, data.target) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
