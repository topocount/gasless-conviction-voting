/*eslint-env node*/
module.exports = function getCaipFromErc20Address(
  address /*: string*/,
  chainId /*: string | number*/,
) /*: string*/ {
  return `eip155:${chainId}/${address}`;
};
