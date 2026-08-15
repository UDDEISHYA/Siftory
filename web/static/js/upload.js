const Upload = {
  _uploading: false,

  init() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');

    if (!uploadZone || !fileInput) {
      console.error('Upload: missing DOM elements');
      return;
    }

    // The "+" button is now a <label for="fileInput"> — clicking it natively
    // opens the file picker without needing JavaScript. Same for the upload
    // zone's <label> interior. No .click() hacks required.

    // File selected → upload
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        this.upload(fileInput.files[0]);
      }
    });

    // Drag & drop on the upload zone
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this.upload(file);
    });
  },

  _resetUI() {
    const progress = document.getElementById('uploadProgress');
    const uploadContent = document.querySelector('.upload-content');
    const progressFill = document.getElementById('progressFill');
    const fileInput = document.getElementById('fileInput');

    if (progress)       progress.style.display = 'none';
    if (uploadContent)  uploadContent.style.display = 'flex';
    if (progressFill)   progressFill.style.width = '0%';
    if (fileInput)      fileInput.value = '';
    this._uploading = false;
  },

  async upload(file) {
    if (this._uploading) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Only CSV files are supported.');
      return;
    }

    this._uploading = true;

    const uploadZone = document.getElementById('uploadZone');
    const progress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const uploadContent = document.querySelector('.upload-content');

    uploadZone.style.display = 'block';
    uploadContent.style.display = 'none';
    progress.style.display = 'block';
    progressFill.style.width = '30%';
    progressText.textContent = `Uploading ${file.name}...`;

    const formData = new FormData();
    formData.append('file', file);

    try {
      progressFill.style.width = '60%';
      progressText.textContent = 'Processing...';

      const res = await fetch('/api/datasets/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let detail = 'Upload failed';
        try {
          const err = await res.json();
          detail = err.detail || detail;
        } catch (_) {
          detail = `Server error (${res.status})`;
        }
        throw new Error(detail);
      }

      const data = await res.json();
      progressFill.style.width = '100%';
      progressText.textContent = `Done — ${data.table_name} (${data.row_count.toLocaleString()} rows)`;

      await App.loadDatasets();
      App.selectDataset(data.table_name, 'upload');

      setTimeout(() => {
        this._resetUI();
        uploadZone.style.display = 'none';
      }, 1500);

    } catch (e) {
      console.error('Upload failed:', e);
      progressFill.style.width = '0%';
      progressText.textContent = `Failed: ${e.message}`;
      setTimeout(() => this._resetUI(), 3000);
    }
  },
};

document.addEventListener('DOMContentLoaded', () => Upload.init());
