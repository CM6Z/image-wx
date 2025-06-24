// 全局变量
let currentCategory = 'images';
let selectedFile = null;

// DOM元素
const tabBtns = document.querySelectorAll('.tab-btn');
const panels = document.querySelectorAll('.panel');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadProgress = document.getElementById('uploadProgress');
const uploadResult = document.getElementById('uploadResult');
const categoryBtns = document.querySelectorAll('.category-btn');
const imageList = document.getElementById('imageList');

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    loadImageList();
});

// 事件监听器
function initEventListeners() {
    // 标签页切换
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });

    // 分类切换
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category;
            switchCategory(category);
        });
    });

    // 文件上传
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', handleDrop);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    
    fileInput.addEventListener('change', handleFileSelect);
    uploadBtn.addEventListener('click', handleUpload);

    // 复制URL
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = e.target.dataset.url;
            copyToClipboard(url);
        });
    });
}

// 标签页切换
function switchTab(tab) {
    tabBtns.forEach(btn => btn.classList.remove('active'));
    panels.forEach(panel => panel.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}-panel`).classList.add('active');
}

// 分类切换
function switchCategory(category) {
    currentCategory = category;
    categoryBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-category="${category}"]`).classList.add('active');
    loadImageList();
}

// 拖拽处理
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect({ target: { files } });
    }
}

// 文件选择处理
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showResult('只能上传图片文件', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showResult('文件大小不能超过 10MB', 'error');
        return;
    }

    selectedFile = file;
    uploadBtn.disabled = false;
    
    // 显示文件信息
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    uploadArea.querySelector('p').textContent = `已选择: ${file.name} (${fileSize}MB)`;
}

// 上传处理
async function handleUpload() {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('image', selectedFile);
    
    const fileName = document.getElementById('fileName').value;
    if (fileName) {
        formData.append('fileName', fileName);
    }
    
    const compress = document.getElementById('compress').checked;
    formData.append('compress', compress);

    const category = document.getElementById('category').value;

    try {
        uploadBtn.disabled = true;
        showProgress(true);
        
        const response = await fetch(`/api/upload/${category}`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.success) {
            showResult(`上传成功！文件URL: ${result.data.url}`, 'success');
            resetUpload();
            if (currentCategory === category) {
                loadImageList();
            }
        } else {
            showResult(`上传失败: ${result.message}`, 'error');
        }
    } catch (error) {
        showResult(`上传失败: ${error.message}`, 'error');
    } finally {
        uploadBtn.disabled = false;
        showProgress(false);
    }
}

// 加载图片列表
async function loadImageList() {
    try {
        const response = await fetch(`/api/list/${currentCategory}`);
        const result = await response.json();
        
        if (result.success) {
            displayImageList(result.data);
        } else {
            console.error('获取图片列表失败:', result.message);
        }
    } catch (error) {
        console.error('加载图片列表失败:', error);
    }
}

// 显示图片列表
function displayImageList(images) {
    imageList.innerHTML = '';
    
    if (images.length === 0) {
        imageList.innerHTML = '<p style="text-align: center; color: #666;">暂无图片</p>';
        return;
    }
    
    images.forEach(image => {
        const imageItem = createImageItem(image);
        imageList.appendChild(imageItem);
    });
}

// 创建图片项
function createImageItem(image) {
    const div = document.createElement('div');
    div.className = 'image-item';
    
    const fileSize = (image.size / 1024).toFixed(2);
    const modifiedDate = new Date(image.modified).toLocaleDateString();
    
    div.innerHTML = `
        <img src="${image.url}" alt="${image.filename}" loading="lazy">
        <div class="image-info">
            <h4>${image.filename}</h4>
            <p>大小: ${fileSize} KB</p>
            <p>修改: ${modifiedDate}</p>
            <div class="image-actions">
                <button class="btn copy-btn" onclick="copyToClipboard('${image.url}')">复制URL</button>
                <button class="btn danger" onclick="deleteImage('${currentCategory}', '${image.filename}')">删除</button>
            </div>
        </div>
    `;
    
    return div;
}

// 删除图片
async function deleteImage(category, filename) {
    if (!confirm(`确定要删除图片 "${filename}" 吗？此操作不可恢复！`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/delete/${category}/${filename}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showResult('删除成功', 'success');
            loadImageList();
        } else {
            showResult(`删除失败: ${result.message}`, 'error');
        }
    } catch (error) {
        showResult(`删除失败: ${error.message}`, 'error');
    }
}

// 复制到剪贴板
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showResult('URL已复制到剪贴板', 'success');
        setTimeout(() => hideResult(), 2000);
    }).catch(err => {
        console.error('复制失败:', err);
        showResult('复制失败，请手动复制', 'error');
    });
}

// 显示结果
function showResult(message, type) {
    uploadResult.textContent = message;
    uploadResult.className = `result ${type}`;
    uploadResult.style.display = 'block';
    
    setTimeout(() => hideResult(), 5000);
}

// 隐藏结果
function hideResult() {
    uploadResult.style.display = 'none';
}

// 显示/隐藏进度条
function showProgress(show) {
    uploadProgress.style.display = show ? 'block' : 'none';
    if (show) {
        uploadProgress.querySelector('.progress-bar').style.width = '100%';
    } else {
        uploadProgress.querySelector('.progress-bar').style.width = '0%';
    }
}

// 重置上传
function resetUpload() {
    selectedFile = null;
    fileInput.value = '';
    document.getElementById('fileName').value = '';
    uploadBtn.disabled = true;
    uploadArea.querySelector('p').textContent = '点击选择图片或拖拽到此处';
}