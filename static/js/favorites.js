// Document Ready
$(function () {
  // Initialize tablesorter with Bootstrap theme
  $("#favorites-table").tablesorter({
    // Target favorites table
    theme: "bootstrap",
    headerTemplate: "{content} {icon}",
    widgets: ["uitheme", "zebra"],
    widgetOptions: { zebra: ["even", "odd"] },
    textAttribute: "data-sort-value",
    headers: { 0: { sorter: false } },
  });

  // Select All Logic
  $("#select-all").on("change", function () {
    const isChecked = $(this).prop("checked");
    $("#favorites-table tbody input[name='selected_anime']").prop(
      "checked",
      isChecked
    ); // Target favorites table
  });
  $("#favorites-table tbody").on(
    "change",
    "input[name='selected_anime']",
    function () {
      // Target favorites table
      if (!$(this).prop("checked")) {
        $("#select-all").prop("checked", false);
      }
    }
  );

  // Note: Client-side formatting with formatLargeNumberJS is removed
  // Rely on the Jinja filter {{ value | human_format }} instead.
});
