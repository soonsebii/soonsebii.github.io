// 본문 표의 머리줄을 누르면 그 컬럼 기준으로 정렬한다. 같은 컬럼을 다시 누르면 방향이 바뀐다.
(function () {
  const ASCENDING = "asc";
  const DESCENDING = "desc";
  const TABLE_SELECTOR = ".page__content table";
  const THOUSANDS_SEPARATOR = /,/g;
  const TEXT_LOCALE = "ko";

  function parseCellValue(cell) {
    const text = cell.textContent.trim();
    const number = Number(text.replace(THOUSANDS_SEPARATOR, ""));
    return text !== "" && !Number.isNaN(number) ? number : text;
  }

  function compareValues(left, right) {
    if (typeof left === "number" && typeof right === "number") {
      return left - right;
    }
    return String(left).localeCompare(String(right), TEXT_LOCALE);
  }

  function sortRows(table, columnIndex, direction) {
    const body = table.tBodies[0];
    const sign = direction === ASCENDING ? 1 : -1;
    const rows = Array.from(body.rows).sort(
      (leftRow, rightRow) => sign * compareValues(parseCellValue(leftRow.cells[columnIndex]), parseCellValue(rightRow.cells[columnIndex]))
    );
    body.append(...rows);
  }

  function handleHeaderClick(table, headers, clickedHeader, columnIndex) {
    const direction = clickedHeader.dataset.sort === ASCENDING ? DESCENDING : ASCENDING;
    headers.forEach((header) => delete header.dataset.sort);
    clickedHeader.dataset.sort = direction;
    sortRows(table, columnIndex, direction);
  }

  document.querySelectorAll(TABLE_SELECTOR).forEach((table) => {
    const headers = Array.from(table.tHead.rows[0].cells);
    headers.forEach((header, columnIndex) => {
      header.addEventListener("click", () => handleHeaderClick(table, headers, header, columnIndex));
    });
  });
})();
