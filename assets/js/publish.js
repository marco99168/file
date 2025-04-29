import { initWeb3 } from './web3-config.js';

document.addEventListener('DOMContentLoaded', () => {
  const chapters = document.getElementById('chapters');
  const addChapterBtn = document.getElementById('add-chapter');
  const publishBtn = document.getElementById('publish');
  const errorEl = document.getElementById('error');

  let chapterCount = 1;
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB, matches contract limit (200 chunks * 10KB)

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
      // Validate title
      const title = document.getElementById('title').value;
      if (!title) throw new Error('Title is required');

      // Initialize Web3 and contract
      const { web3, contract } = await initWeb3();
      const accounts = await web3.eth.getAccounts();
      if (!accounts[0]) throw new Error('Please connect MetaMask');

      // Publish novel
      const publishTx = await contract.methods.publishNovel(title).send({
        from: accounts[0],
        gas: 300000 // Reasonable gas limit for publishNovel
      });
      console.log('Publish Transaction:', publishTx);
      const novelId = await contract.methods.novelCount().call();
      console.log('Novel ID:', novelId);

      // Process chapters
      const chapterEls = document.querySelectorAll('.chapter');
      for (let i = 0; i < chapterEls.length; i++) {
        const fileInput = chapterEls[i].querySelector('input[type="file"]');
        const textarea = chapterEls[i].querySelector('textarea');
        let content = textarea.value;

        // Handle file upload
        if (fileInput.files[0]) {
          const file = fileInput.files[0];

          // Validate file size
          if (file.size > MAX_FILE_SIZE) {
            throw new Error(`Chapter ${i + 1}: File size exceeds 2MB limit`);
          }

          // Read file
          const reader = new FileReader();
          content = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error(`Chapter ${i + 1}: Failed to read file`));
            if (file.type === 'application/pdf') {
              reader.readAsDataURL(file);
            } else if (file.type === 'text/plain') {
              reader.readAsText(file);
            } else {
              reject(new Error(`Chapter ${i + 1}: Unsupported file type. Use .txt or .pdf`));
            }
          });
        }

        // Validate content
        if (!content) {
          console.warn(`Chapter ${i + 1}: No content provided, skipping`);
          continue;
        }

        // Validate base64 for PDF
        if (content.startsWith('data:application/pdf;base64,')) {
          try {
            const base64Data = content.split(',')[1];
            atob(base64Data); // Ensure valid base64
          } catch (err) {
            throw new Error(`Chapter ${i + 1}: Invalid PDF base64 content`);
          }
        }

        // Estimate chunk count
        const contentLength = (new TextEncoder().encode(content)).length;
        const chunkCount = Math.ceil(contentLength / 10240); // 10KB per chunk
        console.log(`Chapter ${i + 1}: Content Length=${contentLength} bytes, Chunks=${chunkCount}`);
        if (chunkCount > 200) {
          throw new Error(`Chapter ${i + 1}: Content too large, exceeds 200 chunks`);
        }

        // Add chapter
        try {
          const addChapterTx = await contract.methods.addChapter(novelId, content).send({
            from: accounts[0],
            gas: 500000 + chunkCount * 50000 // Dynamic gas based on chunk count
          });
          console.log(`Chapter ${i + 1} Transaction:`, addChapterTx);
        } catch (err) {
          throw new Error(`Chapter ${i + 1}: Failed to add chapter: ${err.message}`);
        }
      }

      alert('Novel published successfully!');
      window.location.href = `/novel.html?id=${novelId}`;
    } catch (err) {
      console.error('Publish Error:', err);
      errorEl.textContent = `Error: ${err.message}`;
    }
  });
});
