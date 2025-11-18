import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';

const app = express();

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pterodactyl_panel'
};

let db: mysql.Connection;

// Initialize database connection
async function initializeDatabase() {
  try {
    db = await mysql.createConnection(dbConfig);
    
    // Create tables if they don't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'user') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS panel_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        user_ip VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP NULL,
        admin_notes TEXT
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_ip VARCHAR(45) NOT NULL,
        masked_ip VARCHAR(15) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create default admin user if not exists
    const [rows]: any = await db.execute('SELECT * FROM users WHERE username = ?', ['admin']);
    if (rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.execute(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        ['admin', hashedPassword, 'admin']
      );
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Auth middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Admin page auth middleware
const authenticateAdminPage = async (req: any, res: any, next: any) => {
  const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.redirect('/admin?error=login_required');
  }

  try {
    const user = jwt.verify(token, JWT_SECRET) as any;
    if (user.role !== 'admin') {
      return res.redirect('/admin?error=admin_required');
    }
    req.user = user;
    next();
  } catch (error) {
    return res.redirect('/admin?error=invalid_token');
  }
};

// Routes
app.get('/', (req, res) => {
  res.render('index', { 
    title: 'Pterodactyl Panel Request',
    page: 'home'
  });
});

app.get('/admin', async (req, res) => {
  const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
  let isAuthenticated = false;
  let user = null;

  if (token) {
    try {
      user = jwt.verify(token, JWT_SECRET) as any;
      isAuthenticated = user.role === 'admin';
    } catch (error) {
      // Token invalid
    }
  }

  if (isAuthenticated) {
    try {
      const [requests]: any = await db.execute(`
        SELECT id, username, status, user_ip, created_at, approved_at, admin_notes 
        FROM panel_requests 
        ORDER BY created_at DESC
      `);

      const panelRequests = requests.map((request: any) => ({
        ...request,
        masked_ip: maskIP(request.user_ip)
      }));

      res.render('admin', {
        title: 'Admin Panel',
        page: 'admin',
        user: user,
        panelRequests: panelRequests,
        stats: {
          total: panelRequests.length,
          pending: panelRequests.filter((r: any) => r.status === 'pending').length,
          approved: panelRequests.filter((r: any) => r.status === 'approved').length,
          rejected: panelRequests.filter((r: any) => r.status === 'rejected').length
        }
      });
    } catch (error) {
      console.error('Error loading admin data:', error);
      res.render('admin', {
        title: 'Admin Panel',
        page: 'admin',
        user: user,
        panelRequests: [],
        stats: { total: 0, pending: 0, approved: 0, rejected: 0 }
      });
    }
  } else {
    res.render('admin', {
      title: 'Admin Login',
      page: 'admin',
      user: null,
      panelRequests: [],
      stats: { total: 0, pending: 0, approved: 0, rejected: 0 }
    });
  }
});

app.get('/chat', (req, res) => {
  res.render('chat', {
    title: 'Chat Room',
    page: 'chat'
  });
});

// API Routes
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const [rows]: any = await db.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set cookie for browser
    res.cookie('token', token, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// Panel request routes
app.post('/api/panel-request', async (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body;
    const userIp = req.ip || req.connection.remoteAddress;

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if username already exists in pending or approved requests
    const [existing]: any = await db.execute(
      'SELECT * FROM panel_requests WHERE username = ? AND status IN ("pending", "approved")',
      [username]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists in pending or approved requests' });
    }

    // Mask IP for display
    const maskedIp = maskIP(userIp);

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.execute(
      'INSERT INTO panel_requests (username, password, user_ip) VALUES (?, ?, ?)',
      [username, hashedPassword, userIp]
    );

    res.json({ message: 'Panel request submitted successfully', maskedIp });
  } catch (error) {
    console.error('Panel request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin API routes - get all panel requests
app.get('/api/admin/panel-requests', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const [rows]: any = await db.execute(`
      SELECT id, username, status, user_ip, created_at, approved_at, admin_notes 
      FROM panel_requests 
      ORDER BY created_at DESC
    `);

    const requests = rows.map((request: any) => ({
      ...request,
      masked_ip: maskIP(request.user_ip)
    }));

    res.json(requests);
  } catch (error) {
    console.error('Get panel requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin routes - update panel request status
app.put('/api/admin/panel-requests/:id', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { status, admin_notes } = req.body;

    await db.execute(
      'UPDATE panel_requests SET status = ?, admin_notes = ?, approved_at = ? WHERE id = ?',
      [status, admin_notes, status !== 'pending' ? new Date() : null, id]
    );

    res.json({ message: 'Panel request updated successfully' });
  } catch (error) {
    console.error('Update panel request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Chat routes
app.get('/api/chat/messages', async (req, res) => {
  try {
    const [rows]: any = await db.execute(`
      SELECT masked_ip, message, created_at 
      FROM chat_messages 
      ORDER BY created_at DESC 
      LIMIT 50
    `);

    res.json(rows.reverse());
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/chat/messages', async (req, res) => {
  try {
    const { message } = req.body;
    const userIp = req.ip || req.connection.remoteAddress;
    const maskedIp = maskIP(userIp);

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    await db.execute(
      'INSERT INTO chat_messages (user_ip, masked_ip, message) VALUES (?, ?, ?)',
      [userIp, maskedIp, message.trim()]
    );

    res.json({ message: 'Message sent successfully', maskedIp });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Utility function to mask IP
function maskIP(ip: string): string {
  if (!ip) return '***.***.***.***';
  
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  
  // Handle IPv6 or other formats
  return ip.length > 8 ? ip.substring(0, 8) + '***' : ip;
}

// Initialize and start server
initializeDatabase().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

export default app;