import { initWeb3 } from './web3-config.js';

const USDT_TO_BNB = 0.0018; // 1 USDT ≈ 0.0018 BNB（2025/04/29 估算）

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  const titleEl = document.getElementById('title');
  const authorEl = document.getElementById('author');
  const chapterCountEl = document.getElementById('chapter-count');
  const chapterPriceEl = document.getElementById('chapter-price');
  const connectWalletBtn = document.getElementById('connect-wallet');
  const contentEl = document.getElementById('content');
  const purchaseBtn = document.getElementById('purchase-chapter');
  const chaptersEl = document.getElementById('chapters');
  const chapterNav = document.getElementById('chapter-nav');
  const chapterContentEl = document.getElementById('chapter-content');
  const errorEl = document.getElementById('error');
  const loadingEl = document.getElementById('loading');

  let selectedChapter = 1;
  let chapterPriceInBNB = 0;
  let account = null;

  async function connectWallet() {
    try {
      const { web3 } = await initWeb3();
      const accounts = await web3.eth.getAccounts();
      if (!accounts[0]) throw new Error('Please connect MetaMask');
      account = accounts[0];
      connectWalletBtn.className = 'hidden';
      contentEl.className = '';
      loadNovel();
    } catch (err) {
      errorEl.textContent = `Error: ${err.message}`;
      connectWalletBtn.className = 'bg-purple-500 text-white px-4 py-2 rounded mb-4';
      contentEl.className = 'hidden';
    }
  }

  async function loadNovel() {
    try {
      loadingEl.className = 'text-gray-500';
      errorEl.textContent = '';
      const { web3, contract } = await initWeb3();
      if (!account) throw new Error('Please connect MetaMask');

      const novel = await contract.methods.getNovelInfo(id).call();
      titleEl.textContent = novel[2];
      authorEl.textContent = `Author: ${novel[1]}`;
      chapterCountEl.textContent = `Chapters: ${novel[4]}`;
      const chapterCount = Number(novel[4]);

      const priceInWei = await contract.methods.getChapterPrice(account).call();
      const priceInUSDT = web3.utils.fromWei(priceInWei, 'ether');
      chapterPriceInBNB = priceInUSDT * USDT_TO_BNB;
      chapterPriceEl.textContent = `Price per Chapter: ${priceInUSDT} USDT (${chapterPriceInBNB.toFixed(6)} BNB)`;

      renderChapters(chapterCount);
      loadChapter(id, selectedChapter);
    } catch (err) {
      errorEl.textContent = `Error: ${err.message}`;
    } finally {
      loadingEl.className = 'hidden';
    }
  }

  async function renderChapters(chapterCount) {
    chapterNav.innerHTML = '';
    const { contract } = await initWeb3();
    for (let i = 1; i <= chapterCount; i++) {
      const purchased = await contract.methods.hasPurchasedChapter(account, id, i).call();
      const btn = document.createElement('button');
      btn.className = `px-4 py-2 ${i === selectedChapter ? 'bg-blue-500 text-white' : 'bg-gray-200'} rounded`;
      btn.textContent = `Chapter ${i} ${purchased ? '(Purchased)' : ''}`;
      btn.addEventListener('click', () => {
        selectedChapter = i;
        renderChapters(chapterCount);
        loadChapter(id, i);
      });
      chapterNav.appendChild(btn);
    }
  }

  async function loadChapter(novelId, chapterId) {
    try {
      loadingEl.className = 'text-gray-500';
      errorEl.textContent = '';
      const { contract } = await initWeb3();
      const purchased = await contract.methods.hasPurchasedChapter(account, novelId, chapterId).call();
      purchaseBtn.className = purchased ? 'hidden' : 'bg-blue-500 text-white px-4 py-2 rounded mt-4';

      if (purchased) {
        const content = await contract.methods.getChapterContent(novelId, chapterId).call();
        chapterContentEl.innerHTML = '';
        if (content.startsWith('data:application/pdf;base64,')) {
          const iframe = document.createElement('iframe');
          iframe.src = content;
          iframe.width = '100%';
          iframe.height = '600px';
          iframe.title = `Chapter ${chapterId}`;
          iframe.className = 'border';
          chapterContentEl.appendChild(iframe);
        } else {
          const p = document.createElement('p');
          p.className = 'whitespace-pre-wrap';
          p.textContent = content;
          chapterContentEl.appendChild(p);
        }
      } else {
        chapterContentEl.innerHTML = '<p class="text-gray-500">Purchase this chapter to view content.</p>';
      }
    } catch (err) {
      errorEl.textContent = `Error loading chapter: ${err.message}`;
    } finally {
      loadingEl.className = 'hidden';
    }
  }

  connectWalletBtn.addEventListener('click', connectWallet);

  purchaseBtn.addEventListener('click', async () => {
    try {
      loadingEl.className = 'text-gray-500';
      errorEl.textContent = '';
      const { web3, contract } = await initWeb3();
      if (!account) throw new Error('Please connect MetaMask');
      await contract.methods.purchaseChapter(id, selectedChapter).send({
        from: account,
        value: web3.utils.toWei(chapterPriceInBNB.toString(), 'ether'),
      });
      purchaseBtn.className = 'hidden';
      loadChapter(id, selectedChapter);
      renderChapters(Number(chapterCountEl.textContent.split(' ')[1]));
    } catch (err) {
      errorEl.textContent = `Purchase failed: ${err.message}`;
    } finally {
      loadingEl.className = 'hidden';
    }
  });

  if (id && window.ethereum) {
    connectWallet();
  } else {
    connectWalletBtn.className = 'bg-purple-500 text-white px-4 py-2 rounded mb-4';
    loadingEl.className = 'hidden';
  }
});
