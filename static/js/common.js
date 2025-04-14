function formatLargeNumberJS(num) {
  // ... (Keep the robust function) ...
   if (num === null || num === undefined) return "N/A";
   let originalNumStr = String(num);
   try {
       if (typeof num === 'string') {
         num = parseFloat(num.replace(/,/g, '')); // Handle commas
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
       if (formatted.endsWith('.0')) {
           return parseInt(tempNum).toLocaleString() + suffixes[magnitude];
       } else {
           return tempNum.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + suffixes[magnitude];
       }
   } catch (e) {
       console.error("Error formatting number:", num, e);
       return originalNumStr; // Fallback on error
   }
}


// Generic Batch Action Function
function performGenericBatchAction(endpointUrl, tableId, actionType) {
  const selectedAnime = [];
  // Use tableId to target the correct table
  $(`#${tableId} tbody input[name='selected_anime']:checked`).each(function() {
      selectedAnime.push($(this).val());
  });

  if (selectedAnime.length > 0) {
      if (!confirm(`Are you sure you want to perform '${actionType}' on ${selectedAnime.length} selected items?`)) {
          return;
      }
       fetch(endpointUrl, { // Use the generic endpoint passed in
           method: 'POST',
           headers: {
               'Content-Type': 'application/json'
               // No CSRF header needed now
           },
           // Send action type along with links
           body: JSON.stringify({
               links: selectedAnime,
               action: actionType
           })
       })
       .then(response => { // Improved response handling
           if (!response.ok) {
               // Attempt to parse error JSON, fallback to status text
               return response.json()
                   .catch(() => null) // Handle cases where error response is not JSON
                   .then(errData => {
                       const errorMsg = errData?.error || `Request failed with status ${response.status}`;
                       throw new Error(errorMsg);
                    });
           }
           return response.json(); // Parse JSON only if response is ok
       })
       .then(data => {
          alert(data.message || 'Success!');
          window.location.reload();
       })
       .catch(error => {
           console.error('Batch Action Error:', error);
           alert(`An error occurred: ${error.message}`);
       });
  } else {
      alert('Please select at least one anime.');
  }
}
