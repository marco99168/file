import { initWeb3 } from './web3-config.js';

document.addEventListener('DOMContentLoaded', () => {
  const chapters = document.getElementById('chapters');
  const addChapterBtn = document.getElementById('add-chapter');
  const publishBtn = document.getElementById('publish');
  const errorEl = document.getElementById('error');

  let chapterCount = 1;

  addChapterBtn.addEventListener('click', () => {
    chapterCount++;
    const div = document.createElement('div');
    div.className = 'chapter mb-4';
    div.innerHTML = `
      <input type="file" accept=".txt,.pdf" class="mb-2">
      <textarea placeholder="Chapter ${chapterCount} content (optional)" class="border p-2 w-full"></textarea>
    `;
    chapters.appendChild(div);
  });

  publishBtn.addEventListener('click', async () => {
    errorEl.textContent = '';
    try {
      const title = document.getElementById('title').value;
      if (!title) throw new Error('Title is required');

      const { web3, contract } = await initWeb3();
      const accounts = await web3.eth.getAccounts();
      if (!accounts[0]) throw new Error('Please connect MetaMask');

      await contract.methods.publishNovel(title).send({ from: accounts[0] });
      const novelId = await contract.methods.novelCount().call();

      const chapterEls = document.querySelectorAll('.chapter');
      for (let i = 0; i < chapterEls.length; i++) {
        const fileInput = chapterEls[i].querySelector('input[type="file"]');
        const textarea = chapterEls[i].querySelector('textarea');
        let content = textarea.value;

        if (fileInput.files[0]) {
          const file = fileInput.files[0];
          const reader = new FileReader();
          content = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result);
            if (file.type === 'application/pdf') {
              reader.readAsDataURL(file);
            } else {
              reader.readAsText(file);
            }
          });
        }

        if (content) {
          await contract.methods.addChapter(novelId, content).send({ from: accounts[0] });
        }
      }

      alert('Novel published!');
      window.location.href = `/novel.html?id=${novelId}`;
    } catch (err) {
      errorEl.textContent = `Error: ${err.message}`;
    }
  });
});
