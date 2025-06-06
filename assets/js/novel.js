import { initWeb3 } from './web3-config.js';
import { Buffer } from 'buffer';

const USDT_TO_BNB = 0.0018; // 1 USDT ≈ 0.0018 BNB (2025/04/29)

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
      console.error('Connect Wallet Error:', err);
      errorEl.textContent = `Error: ${err.message}`;
      connectWalletBtn.className = 'bg-purple-500 text-white px-4 py-2 rounded mb-4';
      contentEl.className = 'hidden';
    } finally {
      loadingEl.className = 'hidden';
    }
  }

  async function loadNovel() {
    try {
      loadingEl.className = 'text-gray-500';
      errorEl.textContent = '';
      const { web3, contract } = await initWeb3();
      if (!account) throw new Error('Please connect MetaMask');

      const novelId = Number(id);
      if (isNaN(novelId) || novelId <= 0) throw new Error('Invalid novel ID');

      const novel = await contract.methods.getNovelInfo(novelId).call();
      if (!novel[3]) throw new Error('Novel not published');
      titleEl.textContent = novel[2];
      authorEl.textContent = `Author: ${novel[1]}`;
      chapterCountEl.textContent = `Chapters: ${novel[4]}`;
      const chapterCount = Number(novel[4]);

      const priceInWei = await contract.methods.getChapterPrice(account).call();
      console.log('Price in Wei:', priceInWei);
      chapterPriceInBNB = Number(web3.utils.fromWei(priceInWei, 'ether')).toFixed(18);
      console.log('Price in BNB:', chapterPriceInBNB);
      const priceInUSDT = Number(chapterPriceInBNB) / USDT_TO_BNB;
      chapterPriceEl.textContent = `Price per Chapter: ${priceInUSDT.toFixed(2)} USDT (${chapterPriceInBNB} BNB)`;

      await renderChapters(chapterCount);
      await loadChapter(novelId, selectedChapter);
    } catch (err) {
      console.error('Load Novel Error:', err);
      errorEl.textContent = `Error: ${err.message}`;
    } finally {
      loadingEl.className = 'hidden';
    }
  }

  async function renderChapters(chapterCount) {
    try {
      chapterNav.innerHTML = '';
      const { contract } = await initWeb3();
      for (let i = 1; i <= chapterCount; i++) {
        const purchased = await contract.methods.hasPurchasedChapter(account, Number(id), i).call();
        const btn = document.createElement('button');
        btn.className = `px-4 py-2 ${i === selectedChapter ? 'bg-blue-500 text-white' : 'bg-gray-200'} rounded`;
        btn.textContent = `Chapter ${i} ${purchased ? '(Purchased)' : ''}`;
        btn.addEventListener('click', () => {
          selectedChapter = i;
          renderChapters(chapterCount);
          loadChapter(Number(id), i);
        });
        chapterNav.appendChild(btn);
      }
    } catch (err) {
      console.error('Render Chapters Error:', err);
      errorEl.textContent = `Error rendering chapters: ${err.message}`;
    }
  }

  async function loadChapter(novelId, chapterId) {
    try {
      loadingEl.className = 'text-gray-500';
      errorEl.textContent = '';
      const { web3, contract } = await initWeb3();
      const purchased = await contract.methods.hasPurchasedChapter(account, novelId, chapterId).call();
      console.log('Has Purchased:', purchased);
      purchaseBtn.className = purchased ? 'hidden' : 'bg-blue-500 text-white px-4 py-2 rounded mt-4';

      if (purchased) {
        let content = '';
        try {
          const chunkCount = Number(await contract.methods.getChunkCount(novelId, chapterId).call());
          console.log('Chunk Count:', chunkCount);
          if (chunkCount === 0) throw new Error('No chunks found for chapter');

          for (let i = 0; i < chunkCount; i++) {
            let chunk;
            let attempts = 3;
            while (attempts > 0) {
              try {
                chunk = await contract.methods.getChapterChunk(novelId, chapterId, i).call();
                break;
              } catch (chunkErr) {
                console.error(`Attempt ${4 - attempts} failed for chunk ${i}:`, chunkErr);
                attempts--;
                if (attempts === 0) {
                  throw new Error(`Failed to load chunk ${i} after 3 attempts: ${chunkErr.message}`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
              }
            }
            const chunkString = Buffer.from(chunk).toString();
            console.log(`Chunk ${i} Length:`, chunkString.length);
            console.log(`Chunk ${i} Content:`, chunkString.slice(0, 50)); // Log first 50 chars
            content += chunkString;
          }
          console.log('Chapter Content Length:', content.length);
          console.log('Chapter Content Preview:', content.slice(0, 100));
        } catch (contentErr) {
          console.error('Get Chapter Content Error:', contentErr);
          throw new Error(`Failed to load chapter content: ${contentErr.message}`);
        }
        chapterContentEl.innerHTML = '';
        if (!content) {
          chapterContentEl.innerHTML = '<p class="text-gray-500">Chapter content is empty.</p>';
        } else if (content.startsWith('data:application/pdf;base64,')) {
          try {
            const base64Data = content.split(',')[1];
            atob(base64Data);
            const iframe = document.createElement('iframe');
            iframe.src = content;
            iframe.width = '100%';
            iframe.height = '600px';
            iframe.title = `Chapter ${chapterId}`;
            iframe.className = 'border';
            chapterContentEl.appendChild(iframe);
          } catch (base64Err) {
            console.error('Base64 Decode Error:', base64Err);
            chapterContentEl.innerHTML = '<p class="text-gray-500">Invalid PDF content.</p>';
          }
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
      console.error('Load Chapter Error:', err);
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
      const tx = await contract.methods.purchaseChapter(Number(id), selectedChapter).send({
        from: account,
        value: valueInWei,
        gas: 300000
      });
      console.log('Transaction Receipt:', tx);

      const receipt = await waitForConfirmation(web3, tx.transactionHash);
      console.log('Transaction Confirmed:', receipt);
      purchaseBtn.className = 'hidden';
      await loadChapter(Number(id), selectedChapter);
      await renderChapters(Number(chapterCountEl.textContent.split(' ')[1]));
    } catch (err) {
      console.error('Purchase Error:', err);
      errorEl.textContent = `Purchase failed: ${err.message}`;
    } finally {
      loadingEl.className = 'hidden';
    }
  });

  async function waitForConfirmation(web3, txHash, maxAttempts = 10, interval = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
      const receipt = await web3.eth.getTransactionReceipt(txHash);
      if (receipt) return receipt;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Transaction not confirmed');
  }

  try {
    if (id && window.ethereum) {
      await connectWallet();
    } else {
      connectWalletBtn.className = 'bg-purple-500 text-white px-4 py-2 rounded mb-4';
      contentEl.className = 'hidden';
      errorEl.textContent = id ? 'Please install MetaMask' : 'Invalid novel ID';
    }
  } catch (err) {
    console.error('Initialization Error:', err);
    errorEl.textContent = `Initialization failed: ${err.message}`;
  } finally {
    loadingEl.className = 'hidden';
  }
});
