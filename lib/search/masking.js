/**
 *
 * @param {string[]} variableNames
 */
const getVariableMask = (variableNames) => {
  const local = [...variableNames];
  local.sort((a, b) => a < b ? -1 : (a === b ? 0 : 1));
  return local.join('-');
}

module.exports.getVariableMask = getVariableMask;
