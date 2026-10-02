(() => {
  "use strict";

  const config = window.DHT_DASHBOARD_CONFIG || {};
  const channelId = Number(config.channelId);
  const refreshMs = Math.max(15000, Number(config.refreshMs) || 30000);
  const staleAfterMs = Math.max(60000, Number(config.staleAfterMs) || 120000);
  const $ = id => document.getElementById(id);
  const status = $("status");
  const message = $("message");
  let lastReadingAt = null;
  let requestInProgress = false;

  function setStatus(kind, label) {
    status.className = `status ${kind}`;
    status.textContent = label;
  }

  function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
  }

  function updateAge() {
    if (!lastReadingAt) return;
    const ageMs = Date.now() - lastReadingAt.getTime();
    setStatus(ageMs < staleAfterMs ? "live" : "stale",
              ageMs < staleAfterMs ? "Live" : "Last reading is old");
  }

  function showReading(feed) {
    const tempC = Number(feed.field1);
    const humidity = Number(feed.field2);
    const readingAt = new Date(feed.created_at);
    if (!Number.isFinite(tempC) || !Number.isFinite(humidity) ||
        Number.isNaN(readingAt.getTime())) {
      throw new Error("The channel has no valid temperature and humidity reading yet.");
    }

    $("temperature").textContent = tempC.toFixed(1);
    $("fahrenheit").textContent = `${(tempC * 9 / 5 + 32).toFixed(1)} °F`;
    $("humidity").textContent = humidity.toFixed(1);
    $("updated").textContent = readingAt.toLocaleString();
    $("updated").dateTime = readingAt.toISOString();
    lastReadingAt = readingAt;
    showMessage("");
    updateAge();
  }

  async function refresh() {
    if (requestInProgress || !Number.isInteger(channelId) || channelId <= 0) return;
    requestInProgress = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const url = `https://api.thingspeak.com/channels/${channelId}/feeds/last.json`;
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`Channel request failed (${response.status}).`);
      showReading(await response.json());
    } catch (error) {
      if (!lastReadingAt) setStatus("error", "No reading yet");
      showMessage(`Unable to load the latest reading. Check that the channel is public and has data. ${error.message}`);
    } finally {
      clearTimeout(timeout);
      requestInProgress = false;
    }
  }

  $("refresh").addEventListener("click", refresh);

  if (!Number.isInteger(channelId) || channelId <= 0) {
    setStatus("error", "Setup needed");
    showMessage("Add your public ThingSpeak channel ID to docs/config.js, then reload this page.");
    return;
  }

  const chartBase = `https://thingspeak.com/channels/${channelId}/charts/`;
  $("temperature-chart").src = `${chartBase}1?dynamic=true&results=60`;
  $("humidity-chart").src = `${chartBase}2?dynamic=true&results=60`;

  refresh();
  setInterval(refresh, refreshMs);
  setInterval(updateAge, 10000);
})();
