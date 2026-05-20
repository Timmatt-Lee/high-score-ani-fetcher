"use strict";
// Document Ready
$(function () {
    // Initialize tablesorter with Bootstrap theme
    $("#trash-table").tablesorter({
        // Target trash table
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
        $("#trash-table tbody input[name='selected_anime']").prop("checked", isChecked); // Target trash table
    });
    $("#trash-table tbody").on("change", "input[name='selected_anime']", function () {
        // Target trash table
        if (!$(this).prop("checked")) {
            $("#select-all").prop("checked", false);
        }
    });
});
