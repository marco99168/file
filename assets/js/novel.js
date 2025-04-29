import { initWeb3 } from './web3-config.js';

const USDT_TO_BNB = 0.0018; // 1 USDT ≈ 0.0018 BNB (2025/04/29 估算)

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
      await loadNovel();
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

      const novelId = id;
      const novel = await contract.methods.getNovelInfo(novelId).call();
      if (!novel[3]) throw new Error('Novel not published');
      titleEl.textContent = novel[2];
      authorEl.textContent = `Author: ${novel[1]}`;
      chapterCountEl.textContent = `Chapters: ${novel[4]}`;
      const chapterCount = Number(novel[4]);

      const priceInWei = await contract.methods.getChapterPrice(account).call();
      console.log('Price in Wei:', priceInWei);
      chapterPriceInBNB = Number(web3.utils.fromWei(priceInWei, 'ether')).toFixed(18); // 转换为字符串，避免科学记数法
      console.log('Price in BNB:', chapterPriceInBNB);
      const priceInUSDT = Number(chapterPriceInBNB) / USDT_TO_BNB;
      chapterPriceEl.textContent = `Price per Chapter: ${priceInUSDT.toFixed(2)} USDT (${chapterPriceInBNB} BNB)`;

      await renderChapters(chapterCount);
      await loadChapter(novelId, selectedChapter);
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
    const { web3, contract } = await initWeb3();
    const purchased = await contract.methods.hasPurchasedChapter(account, novelId, chapterId).call();
    console.log('Has Purchased:', purchased); // 调试购买状态
    purchaseBtn.className = purchased ? 'hidden' : 'bg-blue-500 text-white px-4 py-2 rounded mt-4';

    if (purchased) {
      const content = await contract.methods.getChapterContent(novelId, chapterId).call();
      console.log('Chapter Content:', content); // 调试内容
      chapterContentEl.innerHTML = '';
      if (content.startsWith('data:application/pdf;base64,')) {
        const iframe = document.createElement('iframe');
        iframe.src = content;
        iframe.width = '100%';
        iframe.height = '600px';
        iframe.title = `Chapter ${chapterId}`;
        iframe.className = 'border';
        chapterContentEl.appendChild(iframe);
      } else if (content) {
        const p = document.createElement('p');
        p.className = 'whitespace-pre-wrap';
        p.textContent = content;
        chapterContentEl.appendChild(p);
      } else {
        chapterContentEl.innerHTML = '<p class="text-gray-500">Chapter content is empty.</p>';
      }
    } else {
      chapterContentEl.innerHTML = '<p class="text-gray-500">Purchase this chapter to view content.</p>';
    }
  } catch (err) {
    console.error('Load Chapter Error:', err); // 详细错误日志
    errorEl.textContent = `Error loading chapter: ${err.message}`;
  } finally {
    loadingEl.className = 'hidden';
  }
}

purchaseBtn.addEventListener('click', async () => {
  try {
    loadingEl.className = 'text-gray-500';
    errorEl.textContent = '';
    const { web3, contract } = await initWeb3();
    if (!account) throw new Error('Please connect MetaMask');
    const valueInWei = web3.utils.toWei(chapterPriceInBNB.toString(), 'ether');
    console.log('Paying:', chapterPriceInBNB, 'BNB', valueInWei, 'Wei');
    const tx = await contract.methods.purchaseChapter(id, selectedChapter).send({
      from: account,
      value: valueInWei,
    });
    console.log('Transaction Receipt:', tx);
    
    // 等待交易确认
    await web3.eth.getTransactionReceipt(tx.transactionHash, async (err, receipt) => {
      if (err || !receipt) {
        throw new Error('Transaction not confirmed');
      }
      console.log('Transaction Confirmed:', receipt);
      purchaseBtn.className = 'hidden';
      await loadChapter(id, selectedChapter);
      await renderChapters(Number(chapterCountEl.textContent.split(' ')[1]));
    });
  } catch (err) {
    console.error('Purchase Error:', err);
    errorEl.textContent = `Purchase failed: ${err.message}`;
  } finally {
    loadingEl.className = 'hidden';
  }
});
