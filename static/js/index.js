// --- SSE Handling Variable ---
// Declare eventSource globally within this script's scope if needed across functions
let eventSource = null;

// --- SSE Connection Function ---
function connectSSE() {
  // Only function definition here...
  if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
    return;
  }
  console.log("Connecting SSE...");
  eventSource = new EventSource("/progress"); // Assuming /progress route

  eventSource.onmessage = function (event) {
    try {
      const payload = JSON.parse(event.data);
      const $animeTable = $("#anime-table"); // Get table reference
      const $animeTableBody = $("#anime-table-body");
      const $emptyRow = $("#empty-row");
      const progressBar = document.getElementById("progress-bar");
      const progressText = document.getElementById("progress-text");
      const loadingDetails = document.getElementById("loading-details");
      const statusMessage = document.getElementById("status-message");
      const loadingProgress = document.getElementById("loading-progress");
      const startScrapeBtn = document.getElementById("start-scrape");
      const stopScrapeBtn = document.getElementById("stop-scrape");

      // Update Progress Bar
      if (payload.type === "progress") {
        const data = payload;
        const percentage = data.percentage.toFixed(1);
        progressBar.style.width = percentage + "%";
        progressBar.setAttribute("aria-valuenow", percentage);
        progressText.textContent = `${percentage}%`;
        loadingDetails.textContent = `Processed: ${data.loaded_count} / Est. ${
          data.total_estimated
        } | Current: ${data.current_anime || "N/A"}`;
        statusMessage.textContent = data.status_message || "";
        statusMessage.className =
          data.status_message &&
          data.status_message.toLowerCase().includes("retry")
            ? "mt-1 small retry"
            : "mt-1 small";

        if (data.is_running) {
          loadingProgress.style.display = "flex";
          startScrapeBtn.disabled = true;
          stopScrapeBtn.disabled = data.stop_requested;
          if (!progressBar.classList.contains("progress-bar-animated")) {
            progressBar.classList.add("progress-bar-animated");
          }
        } else {
          progressBar.classList.remove("progress-bar-animated");
        }
      }
      // --- Add/Update Table Row ---
      else if (payload.type === "new_anime") {
        const anime = payload.data;
        // Escape quotes in link for selector safety (important!)
        const safeLinkSelector = `tr[data-link="${anime.link.replace(
          /"/g,
          '\\"'
        )}"]`;
        let $row = $animeTableBody.find(safeLinkSelector);

        $emptyRow.hide(); // Hide empty message if adding/updating

        const formattedWatchCount = formatLargeNumberJS(anime.watch_count);
        const formattedRatingCount = formatLargeNumberJS(anime.rating_count);

        if ($row.length > 0) {
          // UPDATE EXISTING ROW LOGIC (ensure it also updates relevant classes if needed)
          let cells = $row.find("td");
          cells
            .eq(1)
            .html(
              `<a href="${anime.link}" target="_blank" title="${anime.title}">${anime.title}</a>`
            );
          cells.eq(2).text(anime.score).addClass("text-end"); // Add alignment class on update
          cells.eq(3).text(formattedWatchCount).addClass("text-end"); // Add alignment class on update
          cells.eq(4).text(formattedRatingCount).addClass("text-end"); // Add alignment class on update
          cells.eq(5).text(anime.episode_count).addClass("text-center"); // Add alignment class on update
          cells.eq(6).text(anime.upload_date);
          cells.eq(7).text(anime.description).attr("title", anime.description); // Update desc + title attr
          // Update ARIA labels on buttons if title changes (though unlikely needed often)
          let btnGroup = cells.eq(8).find(".btn-group");
          if (btnGroup.length)
            btnGroup.attr("aria-label", `Item Actions for ${anime.title}`);
          let favBtn = cells
            .eq(8)
            .find('form[action*="add_to_favorites"] button');
          if (favBtn.length)
            favBtn.attr("aria-label", `Add ${anime.title} to Favorites`);
          let trashBtn = cells
            .eq(8)
            .find('form[action*="move_to_trash"] button');
          if (trashBtn.length)
            trashBtn.attr("aria-label", `Move ${anime.title} to Trash`);

          $animeTable.trigger("updateRow", [$row[0], true]);
        } else {
          // ADD NEW ROW - Apply ALL classes and attributes consistently
          // Escape title simply for attribute values
          const escapedTitle = anime.title.replace(/"/g, "&quot;");

          const newRowHtml = `
          <tr data-link="${anime.link}">
              <td class="checkbox-col text-center"><input type="checkbox" class="form-check-input" name="selected_anime" value="${anime.link}"></td>
              <td><a href="${anime.link}" target="_blank" title="${escapedTitle}">${anime.title}</a></td>
              <td class="text-end">${anime.score}</td>
              <td class="text-end">${formattedWatchCount}</td>
              <td class="text-end">${formattedRatingCount}</td>
              <td class="text-center">${anime.episode_count}</td>
              <td>${anime.upload_date}</td>
              <td class="description-cell" title="${anime.description}">${anime.description}</td>
              <td class="action-buttons-cell">
                  <div class="btn-group btn-group-sm" role="group" aria-label="Item Actions for ${escapedTitle}">
                      <form action="${actionUrls.add_to_favorites}" method="post" style="display: inline;">
                          <input type="hidden" name="link" value="${anime.link}">
                          <button type="submit" class="btn btn-primary" title="Add to Favorites" aria-label="Add ${escapedTitle} to Favorites">
                              <i class="bi bi-heart-fill"></i>
                          </button>
                      </form>
                      <form action="${actionUrls.move_to_trash}" method="post" style="display: inline;">
                          <input type="hidden" name="link" value="${anime.link}">
                          <button type="submit" class="btn btn-warning" title="Move to Trash" aria-label="Move ${escapedTitle} to Trash">
                              <i class="bi bi-trash-fill"></i>
                          </button>
                      </form>
                   </div>
              </td>
          </tr>`;
          $animeTableBody.append(newRowHtml);
          $animeTable.trigger("update", [true]); // Trigger update, potentially resort
        }
      }
      // Handle Final State
      else if (payload.type === "final_state") {
        const data = payload;
        console.log("Received final state:", data);
        loadingProgress.style.display = "none";
        startScrapeBtn.disabled = false;
        stopScrapeBtn.disabled = true;
        progressBar.classList.remove("progress-bar-animated");

        if (data.status_message.includes("finished")) {
          statusMessage.textContent = "Scraping finished!";
        } else if (data.status_message.includes("stopped")) {
          statusMessage.textContent = "Scraping stopped.";
        } else {
          statusMessage.textContent = data.status_message || "Scraping ended.";
        }

        if ($animeTableBody.find("tr[data-link]").length === 0) {
          if ($("#empty-row").length > 0) {
            $("#empty-row").show();
          } else {
            $animeTableBody.append(
              `<tr id="empty-row"><td colspan="9" class="text-center text-muted">No anime found matching the criteria (Score > ${scoreThreshold} and not OVA).</td></tr>`
            );
          } // Use scoreThreshold var
        } else {
          $emptyRow.hide();
        }

        if (eventSource) {
          eventSource.close();
          console.log("SSE closed by client.");
        }
      }
    } catch (e) {
      console.error("Error processing SSE:", e, "Raw:", event.data);
    }
  }; // end onmessage

  eventSource.onerror = function (error) {
    const statusMessage = document.getElementById("status-message");
    const loadingProgress = document.getElementById("loading-progress");
    const startScrapeBtn = document.getElementById("start-scrape");
    const stopScrapeBtn = document.getElementById("stop-scrape");

    console.error("SSE error:", error);
    if (eventSource) eventSource.close();
    if (statusMessage)
      statusMessage.textContent =
        "Progress connection lost. Refresh or try starting again.";
    if (loadingProgress) loadingProgress.style.display = "none";
    if (startScrapeBtn) startScrapeBtn.disabled = false;
    if (stopScrapeBtn) stopScrapeBtn.disabled = true;
  };
  eventSource.onopen = function () {
    console.log("SSE connection opened.");
  };
} // end connectSSE

// --- Document Ready ---
$(function () {
  // Initialize tablesorter with Bootstrap theme
  const $animeTable = $("#anime-table").tablesorter({
    theme: "bootstrap",
    headerTemplate: "{content} {icon}",
    widgets: ["uitheme", "zebra"],
    widgetOptions: { zebra: ["even", "odd"] },
    headers: { 0: { sorter: false } },
  });

  // Cache DOM elements (ensure they exist before caching)
  const startScrapeBtn = document.getElementById("start-scrape");
  const stopScrapeBtn = document.getElementById("stop-scrape");
  const loadingProgress = document.getElementById("loading-progress");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const loadingDetails = document.getElementById("loading-details");
  const statusMessage = document.getElementById("status-message");
  const $animeTableBody = $("#anime-table-body");
  const $emptyRow = $("#empty-row");

  // Select All Checkbox Logic
  $("#select-all").on("change", function () {
    const isChecked = $(this).prop("checked");
    $animeTableBody
      .find("input[name='selected_anime']")
      .prop("checked", isChecked);
  });
  $animeTableBody.on("change", "input[name='selected_anime']", function () {
    if (!$(this).prop("checked")) {
      $("#select-all").prop("checked", false);
    }
  });

  // Button Actions (Start/Stop) - Ensure elements exist before adding listeners
  if (startScrapeBtn) {
    startScrapeBtn.addEventListener("click", () => {
      startScrapeBtn.disabled = true;
      if (statusMessage) statusMessage.textContent = "Initializing...";
      $emptyRow.hide(); // Hide empty message
      fetch("/start_scrape")
        .then((response) => {
          // Assuming /start_scrape route
          if (!response.ok) {
            startScrapeBtn.disabled = false;
            if (statusMessage) statusMessage.textContent = "Failed to start.";
          } else {
            console.log("Scraping start request sent...");
            connectSSE();
          }
        })
        .catch((err) => {
          startScrapeBtn.disabled = false;
          if (statusMessage) statusMessage.textContent = "Error: " + err;
        });
    });
  }
  if (stopScrapeBtn) {
    stopScrapeBtn.addEventListener("click", () => {
      stopScrapeBtn.disabled = true;
      fetch("/stop_scrape")
        .then((response) => {
          // Assuming /stop_scrape route
          if (!response.ok) {
            if (statusMessage)
              statusMessage.textContent = "Failed to send stop.";
          } else {
            console.log("Stop request sent...");
            if (statusMessage) statusMessage.textContent = "Stop requested...";
          }
        })
        .catch((err) => {
          if (statusMessage)
            statusMessage.textContent = "Error stopping: " + err;
        });
    });
  }

  // Initial State Logic (Uses 'initialScrapingState' defined in the inline script)
  // Ensure all elements accessed here exist
  if (
    typeof initialScrapingState !== "undefined" &&
    initialScrapingState.is_running
  ) {
    if (loadingProgress) loadingProgress.style.display = "flex";
    if (startScrapeBtn) startScrapeBtn.disabled = true;
    if (stopScrapeBtn)
      stopScrapeBtn.disabled = initialScrapingState.stop_requested;

    const initialProgress = initialScrapingState.progress;
    if (
      initialProgress &&
      progressBar &&
      progressText &&
      loadingDetails &&
      statusMessage
    ) {
      const percentage = (initialProgress.percentage || 0).toFixed(1);
      progressBar.style.width = percentage + "%";
      progressBar.setAttribute("aria-valuenow", percentage);
      progressText.textContent = `${percentage}%`;
      loadingDetails.textContent = `Processed: ${
        initialProgress.loaded_count || 0
      } / Est. ${initialProgress.total_estimated || 0} | Current: ${
        initialProgress.current_anime || "N/A"
      }`;
      statusMessage.textContent =
        initialProgress.status_message || "Scraping in progress...";
      statusMessage.className =
        initialProgress.status_message &&
        initialProgress.status_message.toLowerCase().includes("retry")
          ? "mt-1 small retry"
          : "mt-1 small";
      progressBar.classList.add("progress-bar-animated");
    }
    $emptyRow.hide();
    connectSSE(); // Reconnect SSE
  } else {
    // Not running initially
    if (loadingProgress) loadingProgress.style.display = "none";
    if (startScrapeBtn) startScrapeBtn.disabled = false;
    if (stopScrapeBtn) stopScrapeBtn.disabled = true;

    if ($animeTableBody.find("tr[data-link]").length === 0) {
      if ($("#empty-row").length > 0) {
        $("#empty-row").show();
      }
    } else {
      $emptyRow.hide();
    }
  }
}); // end document ready
