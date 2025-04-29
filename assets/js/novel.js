import { initWeb3 } from './web3-config.js';

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  const titleEl = document.getElementById('title');
  const authorEl = document.getElementById('author');
  const priceEl = document.getElementById('price');
  const chapterCountEl = document.getElementById('chapter-count');
  const purchaseBtn = document.getElementById('purchase');
  const chaptersEl = document.getElementById('chapters');
  const chapterNav = document.getElementById('chapter-nav');
  const contentEl = document.getElementById('chapter-content');
  const errorEl = document.getElementById('error');
  const loadingEl = document.getElementById('loading');

  let selectedChapter = 1;

  async function loadNovel() {
    try {
      loadingEl.className = 'text-gray-500';
      errorEl.textContent = '';
      const { web3, contract } = await initWeb3();
      const accounts = await web3.eth.getAccounts();
      if (!accounts[0]) throw new Error('Please connect MetaMask');
      const account = accounts[0];

      // 获取小说信息
      const novel = await contract.methods.getNovelInfo(id).call();
      titleEl.textContent = novel[2];
      authorEl.textContent = `Author: ${novel[1]}`;
      priceEl.textContent = `Price: ${web3.utils.fromWei(novel[3], 'ether')} BNB`;
      chapterCountEl.textContent = `Chapters: ${novel[5]}`;
      const chapterCount = Number(novel[5]);

      // 检查是否已购买
      const purchased = await contract.methods.hasPurchased(account, id).call();
      if (purchased) {
        purchaseBtn.className = 'hidden';
        chaptersEl.className = '';
        renderChapters(chapterCount);
        loadChapter(id, selectedChapter);
      } else {
        purchaseBtn.className = 'bg-blue-500 text-white px-4 py-2 rounded';
      }
    } catch (err) {
      errorEl.textContent = `Error: ${err.message}`;
    } finally {
      loadingEl.className = 'hidden';
    }
  }

  function renderChapters(chapterCount) {
    chapterNav.innerHTML = '';
    for (let i = 1; i <= chapterCount; i++) {
      const btn = document.createElement('button');
      btn.className = `px-4 py-2 ${i === selectedChapter ? 'bg-blue-500 text-white' : 'bg-gray-200'} rounded`;
      btn.textContent = `Chapter ${i}`;
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
      const content = await contract.methods.getChapterContent(novelId, chapterId).call();
      contentEl.innerHTML = '';

      if (content.startsWith('data:application/pdf;base64,')) {
        const iframe = document.createElement('iframe');
        iframe.src = content;
        iframe.width = '100%';
        iframe.height = '600px';
        iframe.title = `Chapter ${chapterId}`;
        iframe.className = 'border';
        contentEl.appendChild(iframe);
      } else {
        const p = document.createElement('p');
        p.className = 'whitespace-pre-wrap';
        p.textContent = content;
        contentEl.appendChild(p);
      }
    } catch (err) {
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
      const accounts = await web3.eth.getAccounts();
      if (!accounts[0]) throw new Error('Please connect MetaMask');
      await contract.methods.purchaseNovel(id).send({
        from: accounts[0],
        value: web3.utils.toWei(priceEl.textContent.split(' ')[1], 'ether'),
      });
      purchaseBtn.className = 'hidden';
      chaptersEl.className = '';
      renderChapters(Number(chapterCountEl.textContent.split(' ')[1]));
      loadChapter(id, selectedChapter);
    } catch (err) {
      errorEl.textContent = `Purchase failed: ${err.message}`;
    } finally {
      loadingEl.className = 'hidden';
    }
  });

  if (id) loadNovel();
});
