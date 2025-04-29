import { initWeb3 } from './web3-config.js';

document.addEventListener('DOMContentLoaded', () => {
  const setPriceBtn = document.getElementById('set-price');
  const errorEl = document.getElementById('error');

  setPriceBtn.addEventListener('click', async () => {
    errorEl.textContent = '';
    try {
      const userAddress = document.getElementById('user-address').value;
      const maxPrice = document.getElementById('max-price').value;
      if (!userAddress || !maxPrice) throw new Error('Address and price are required');

      const { web3, contract } = await initWeb3();
      const accounts = await web3.eth.getAccounts();
      if (!accounts[0]) throw new Error('Please connect MetaMask');
      if (accounts[0].toLowerCase() !== (await contract.methods.owner().call()).toLowerCase()) {
        throw new Error('Only owner can set price');
      }

      await contract.methods.setUserMaxPrice(userAddress, web3.utils.toWei(maxPrice, 'ether')).send({ from: accounts[0] });
      alert('User price set!');
    } catch (err) {
      errorEl.textContent = `Error: ${err.message}`;
    }
  });
});
