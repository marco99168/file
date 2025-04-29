import { initWeb3 } from './web3-config.js';

async function loadNovels() {
  try {
    const { contract } = await initWeb3();
    const novelCount = await contract.methods.novelCount().call();
    const novelList = document.getElementById('novel-list');
    novelList.innerHTML = '';

    for (let i = 1; i <= novelCount; i++) {
      const novel = await contract.methods.getNovelInfo(i).call();
      const div = document.createElement('div');
      div.className = 'border p-4 rounded shadow';
      div.innerHTML = `
        <h2 class="text-xl font-semibold">${novel[2]}</h2>
        <p>Author: ${novel[1]}</p>
        <p>Price: ${Web3.utils.fromWei(novel[3], 'ether')} BNB</p>
        <a href="/novel.html?id=${novel[0]}" class="text-blue-500">View Details</a>
      `;
      novelList.appendChild(div);
    }
  } catch (err) {
    console.error('Failed to load novels:', err);
  }
}

document.addEventListener('DOMContentLoaded', loadNovels);
