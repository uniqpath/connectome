// source: https://www.sitepoint.com/sort-an-array-of-objects-in-javascript/
//
// usage:
// array is sorted by band only
// singers.sort(orderBy('band'));
//
// in descending order
// singers.sort(orderBy('band', null, 'desc'));
//
// array is sorted by band, then by year in ascending order by default
// singers.sort(orderBy('band', 'year'));
//
// array is sorted by band, then by year in descending order
// singers.sort(orderBy('band', 'year', 'desc'));
function orderBy(key, key2, order = 'asc') {
  function _comparison(a, b, key) {
    if (!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) {
      return 0;
    }

    const varA = typeof a[key] === 'string' ? a[key].toUpperCase() : a[key];
    const varB = typeof b[key] === 'string' ? b[key].toUpperCase() : b[key];

    let comparison = 0;
    if (varA > varB) {
      comparison = 1;
    } else if (varA < varB) {
      comparison = -1;
    }

    return order === 'desc' ? comparison * -1 : comparison;
  }

  return function innerSort(a, b) {
    let comparison = _comparison(a, b, key);

    if (comparison == 0 && key2) {
      comparison = _comparison(a, b, key2);
    }

    return comparison;
  };
}

export { orderBy };
