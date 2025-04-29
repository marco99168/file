const contractABI = [/* 替换为合约ABI，从Remix复制 */];
const contractAddress = '0xYourDeployedContractAddress'; // 替换为你的合约地址
const bscRpcUrl = 'https://data-seed-prebsc-1-s1.binance.org:8545/';

async function initWeb3() {
  let web3;
  if (window.ethereum) {
    web3 = new Web3(window.ethereum);
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
    } catch (error) {
      throw new Error('User denied account access');
    }
  } else {
    web3 = new Web3(bscRpcUrl);
  }
  const contract = new web3.eth.Contract(contractABI, contractAddress);
  return { web3, contract };
}

export { initWeb3 };
