const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保上传目录存在
const uploadDirs = ['uploads/images', 'uploads/icons', 'uploads/posters'];
uploadDirs.forEach(dir => {
  fs.ensureDirSync(path.join(__dirname, dir));
});

// 中间件配置
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: ['https://cm6z.cn', 'https://image.cm6z.cn', 'https://servicewechat.com'],
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 管理界面
app.use('/admin', express.static(path.join(__dirname, 'public')));

// 图片静态文件服务
app.use('/images', express.static(path.join(__dirname, 'uploads/images'), {
  maxAge: '30d',
  etag: true,
  lastModified: true
}));

app.use('/icons', express.static(path.join(__dirname, 'uploads/icons'), {
  maxAge: '30d',
  etag: true,
  lastModified: true
}));

app.use('/posters', express.static(path.join(__dirname, 'uploads/posters'), {
  maxAge: '30d',
  etag: true,
  lastModified: true
}));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = req.params.category || 'images';
    const uploadPath = path.join(__dirname, 'uploads', category);
    fs.ensureDirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const fileName = req.body.fileName || file.originalname;
    cb(null, fileName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件格式'));
    }
  }
});

// API路由

// 获取所有图片URL
app.get('/api/images', (req, res) => {
  const baseUrl = `https://image.cm6z.cn`;
  
  const imageUrls = {
    // 用户相关图片
    avatar: `${baseUrl}/images/avatar.png`,
    mahjongBg: `${baseUrl}/images/mahjong-bg.png`,
    vipBg: `${baseUrl}/images/vip-bg.png`,
    
    // 菜单图标
    orderIcon: `${baseUrl}/icons/order.png`,
    walletIcon: `${baseUrl}/icons/wallet.png`,
    couponIcon: `${baseUrl}/icons/coupon.png`,
    favoriteIcon: `${baseUrl}/icons/favorite.png`,
    settingsIcon: `${baseUrl}/icons/settings.png`,
    helpIcon: `${baseUrl}/icons/help.png`,
    aboutIcon: `${baseUrl}/icons/about.png`,
    
    // 轮播图海报
    poster1: `${baseUrl}/posters/poster1.png`,
    poster2: `${baseUrl}/posters/poster2.png`,
    poster3: `${baseUrl}/posters/poster3.png`
  };
  
  res.json({
    success: true,
    message: '获取图片URL成功',
    data: imageUrls
  });
});

// 上传图片
app.post('/api/upload/:category', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '没有上传文件'
      });
    }

    const category = req.params.category;
    const filePath = req.file.path;
    
    // 图片压缩优化
    if (req.body.compress === 'true') {
      await sharp(filePath)
        .resize(800, 800, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ quality: 85 })
        .png({ compressionLevel: 8 })
        .toFile(filePath + '_compressed');
      
      // 替换原文件
      await fs.move(filePath + '_compressed', filePath, { overwrite: true });
    }

    const imageUrl = `https://image.cm6z.cn/${category}/${req.file.filename}`;
    
    res.json({
      success: true,
      message: '上传成功',
      data: {
        filename: req.file.filename,
        url: imageUrl,
        size: req.file.size,
        category: category
      }
    });
  } catch (error) {
    console.error('上传失败:', error);
    res.status(500).json({
      success: false,
      message: '上传失败: ' + error.message
    });
  }
});

// 删除图片
app.delete('/api/delete/:category/:filename', (req, res) => {
  try {
    const { category, filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', category, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({
        success: true,
        message: '删除成功'
      });
    } else {
      res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除失败: ' + error.message
    });
  }
});

// 获取图片列表
app.get('/api/list/:category', (req, res) => {
  try {
    const category = req.params.category;
    const uploadPath = path.join(__dirname, 'uploads', category);
    
    if (!fs.existsSync(uploadPath)) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    const files = fs.readdirSync(uploadPath)
      .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
      .map(file => {
        const filePath = path.join(uploadPath, file);
        const stats = fs.statSync(filePath);
        
        return {
          filename: file,
          url: `https://image.cm6z.cn/${category}/${file}`,
          size: stats.size,
          modified: stats.mtime
        };
      });
    
    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取列表失败: ' + error.message
    });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 首页重定向到管理界面
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// 错误处理中间件
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '文件大小超过限制 (10MB)'
      });
    }
  }
  
  console.error('服务器错误:', error);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '资源不存在'
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 图片服务器已启动！`);
  console.log(`📱 管理界面: https://image.cm6z.cn/admin`);
  console.log(`🖼️  图片服务: https://image.cm6z.cn/`);
  console.log(`⚡ 端口: ${PORT}`);
});