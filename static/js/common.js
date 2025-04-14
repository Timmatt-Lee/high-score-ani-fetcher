// --- Toast Handling ---
// (Keep showToast and related initialization variables/logic as is) ...
let actionToastElement = null;
let actionToastBody = null;
let actionToastTitle = null;
let actionToastTimestamp = null;
let actionToastInstance = null;
$(function () {
  actionToastElement = document.getElementById("actionToast");
  if (actionToastElement) {
    actionToastBody = document.getElementById("toastBody");
    actionToastTitle = document.getElementById("toastTitle");
    actionToastTimestamp = document.getElementById("toastTimestamp");
    actionToastInstance =
      bootstrap.Toast.getOrCreateInstance(actionToastElement);
  } else {
    console.error("Toast element #actionToast not found!");
  }
});
function showToast(message, type = "success") {
  if (
    !actionToastInstance ||
    !actionToastBody ||
    !actionToastElement ||
    !actionToastTitle ||
    !actionToastTimestamp
  ) {
    const prefix = type.charAt(0).toUpperCase() + type.slice(1);
    alert(`[${prefix}] ${message}`);
    return;
  }
  actionToastBody.textContent = message;
  actionToastTimestamp.textContent = new Date().toLocaleTimeString();
  actionToastElement.classList.remove(
    "bg-success",
    "bg-danger",
    "bg-warning",
    "text-white",
    "text-dark"
  );
  actionToastTitle.classList.remove("text-white");
  switch (type) {
    case "error":
      actionToastElement.classList.add("bg-danger", "text-white");
      actionToastTitle.textContent = "Error";
      actionToastTitle.classList.add("text-white");
      break;
    case "warning":
      actionToastElement.classList.add("bg-warning", "text-dark");
      actionToastTitle.textContent = "Warning";
      break;
    case "success":
    default:
      actionToastElement.classList.add("bg-success", "text-white");
      actionToastTitle.textContent = "Success";
      actionToastTitle.classList.add("text-white");
      break;
  }
  actionToastInstance.show();
}
// --- End Toast Handling ---

function formatLargeNumberJS(num) {
  // ... (Keep the robust function) ...
  if (num === null || num === undefined) return "N/A";
  let originalNumStr = String(num);
  try {
    if (typeof num === "string") {
      num = parseFloat(num.replace(/,/g, "")); // Handle commas
    }
    if (isNaN(num)) return originalNumStr; // Return original if still not number

    num = Number(num);
    if (num === 0) return 0;

    if (Math.abs(num) < 1000) {
      return num % 1 === 0 ? parseInt(num) : num.toFixed(1);
    }

    const suffixes = ["", "K", "M", "B"];
    let magnitude = 0;
    let tempNum = Math.abs(num);

    while (tempNum >= 1000 && magnitude < suffixes.length - 1) {
      tempNum /= 1000.0;
      magnitude++;
    }
    const formatted = tempNum.toFixed(1);
    if (formatted.endsWith(".0")) {
      return parseInt(tempNum).toLocaleString() + suffixes[magnitude];
    } else {
      return (
        tempNum.toLocaleString(undefined, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }) + suffixes[magnitude]
      );
    }
  } catch (e) {
    console.error("Error formatting number:", num, e);
    return originalNumStr; // Fallback on error
  }
}

/**
 * Displays a status message in the batch status area.
 * @param {string} message - The message to display.
 * @param {boolean} [isError=false] - True if the message is an error.
 */
function displayBatchStatus(message, isError = false) {
  const statusDiv = document.getElementById("batch-status-message");
  if (!statusDiv) {
    console.warn("Batch status message container not found.");
    return; // Exit if placeholder doesn't exist
  }

  // Clear any previous message timeout
  if (statusDiv.timeoutId) {
    clearTimeout(statusDiv.timeoutId);
  }

  // Set message content and base classes
  statusDiv.textContent = message;
  // Using text-center for better visibility in the container
  statusDiv.className = "mt-2 alert alert-dismissible fade show text-center";

  // Add success or danger class
  if (isError) {
    statusDiv.classList.remove("alert-success"); // Ensure success is removed
    statusDiv.classList.add("alert-danger");
    statusDiv.setAttribute("role", "alert"); // Use alert role for errors
  } else {
    statusDiv.classList.remove("alert-danger"); // Ensure danger is removed
    statusDiv.classList.add("alert-success");
    statusDiv.setAttribute("role", "status"); // Use status role for success
  }

  statusDiv.innerHTML +=
    '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>';

  // Automatically clear the message and classes after ~5 seconds
  statusDiv.timeoutId = setTimeout(() => {
    statusDiv.textContent = "";
    // Remove alert classes, keep base class if any, or clear entirely
    statusDiv.className = "mt-2";
    statusDiv.removeAttribute("role");
    delete statusDiv.timeoutId; // Clean up property
  }, 5000); // 5000 milliseconds = 5 seconds
}

// --- Updated Batch Action Function ---
function performGenericBatchAction(endpointUrl, tableId, actionType) {
  const tableElement = $(`#${tableId}`); // jQuery object for the table
  const tableBody = tableElement.find("tbody");
  const selectedCheckboxes = tableBody.find(
    "input[name='selected_anime']:checked"
  ); // Get checked checkboxes
  const selectedAnimeLinks = []; // Array to hold the links

  selectedCheckboxes.each(function () {
    selectedAnimeLinks.push($(this).val()); // Populate links array
  });

  if (selectedAnimeLinks.length > 0) {
    // Clear previous toast messages immediately if any are visible
    if (actionToastInstance) actionToastInstance.hide();
    // Optional: Add visual indicator that action is processing (e.g., disable buttons)
    $("#batch-actions button").prop("disabled", true);

    fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        links: selectedAnimeLinks,
        action: actionType,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          // Try to get error details, then throw
          return response
            .json()
            .catch(() => null)
            .then((errData) => {
              const errorMsg =
                errData?.error ||
                `Request failed: ${response.statusText} (${response.status})`;
              throw new Error(errorMsg);
            });
        }
        return response.json(); // Parse JSON only if response is ok
      })
      .then((data) => {
        // Success! Backend confirmed action
        let removedRowCount = 0;

        // --- IMMEDIATE UI UPDATE ---
        // 1. Remove rows from the table
        selectedCheckboxes.each(function () {
          $(this).closest("tr").remove(); // Remove the parent table row
          removedRowCount++;
        });

        if (removedRowCount > 0) {
          // 2. Update tablesorter's cache (important for sorting after removal)
          tableElement.trigger("update", [true]); // Pass true to resort automatically if desired

          // 3. Update the displayed item count badge
          const countBadge = document.getElementById("listCountBadge");
          if (countBadge) {
            const currentText = countBadge.textContent || "";
            const match = currentText.match(/(\d+)/); // Extract number
            if (match) {
              let currentCount = parseInt(match[1], 10);
              let newCount = Math.max(0, currentCount - removedRowCount);
              // Adjust text slightly based on page if needed (or keep generic)
              let suffix = " item(s)";
              if (tableId === "anime-table") suffix += " shown";
              countBadge.textContent = `${newCount}${suffix}`;
            }
          }

          // 4. Check if table body is now empty and show empty row message
          const $emptyRow = tableElement.find("#empty-row");
          // Check if any rows with data-link attribute remain
          if (
            tableBody.find("tr[data-link]").length === 0 &&
            $emptyRow.length > 0
          ) {
            // Ensure colspan matches current header count
            $emptyRow
              .find("td")
              .attr("colspan", tableElement.find("thead th").length);
            $emptyRow.show(); // Display the empty row message
          }

          // 5. Uncheck the "Select All" checkbox
          tableElement.find("#select-all").prop("checked", false);
        }
        // --- END IMMEDIATE UI UPDATE ---

        showToast(data.message || "Operation successful!", "success"); // Show success toast notification
      })
      .catch((error) => {
        console.error("Batch Action Error:", error);
        showToast(`${error.message}`, "error"); // Show error toast notification
      })
      .finally(() => {
        // Re-enable buttons regardless of success or error
        $("#batch-actions button").prop("disabled", false);
        // Remove any processing indicator here
      });
  } else {
    showToast("Please select at least one anime.", "warning"); // Show warning toast
  }
}
