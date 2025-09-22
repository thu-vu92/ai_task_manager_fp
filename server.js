import express from 'express';
import multer from 'multer';
import Tesseract from 'tesseract.js';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: path.join(__dirname, 'uploads/') });
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// OCR endpoint for screenshots
app.post('/api/ocr-extract', upload.single('screenshot'), async (req, res) => {
  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }
  try {
    const imagePath = path.resolve(req.file.path);
    console.log('Uploaded file path:', imagePath);
    if (!fs.existsSync(imagePath)) {
      console.error('File does not exist:', imagePath);
      return res.status(500).json({ error: 'Uploaded file not found on server' });
    }
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
    // Clean up uploaded file
    fs.unlinkSync(imagePath);
    res.json({ text });
  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ error: 'OCR failed', details: err.message, stack: err.stack });
  }
});

// --- Project Endpoints ---
// Get all projects
app.get('/api/projects', async (req, res) => {
  const projects = await prisma.project.findMany({ include: { tasks: true } });
  res.json(projects);
});

// Create a new project
app.post('/api/projects', async (req, res) => {
  const { name, description, priority } = req.body;
  const project = await prisma.project.create({
    data: { name, description, priority }
  });
  res.json(project);
});

// Update a project
app.put('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, priority } = req.body;
  const project = await prisma.project.update({
    where: { id: Number(id) },
    data: { name, description, priority }
  });
  res.json(project);
});

// Delete a project
app.delete('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.project.delete({ where: { id: Number(id) } });
  res.json({ success: true });
});

// --- Task Endpoints ---
// Get all tasks
app.get('/api/tasks', async (req, res) => {
  const tasks = await prisma.task.findMany();
  res.json(tasks);
});

// Create a new task
app.post('/api/tasks', async (req, res) => {
  const { title, description, priority, estimatedTime, deadline, source, completed, projectId } = req.body;
  const task = await prisma.task.create({
    data: { title, description, priority, estimatedTime, deadline, source, completed, projectId }
  });
  res.json(task);
});

// Update a task
app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, priority, estimatedTime, deadline, source, completed, projectId } = req.body;
  const task = await prisma.task.update({
    where: { id: Number(id) },
    data: { title, description, priority, estimatedTime, deadline, source, completed, projectId }
  });
  res.json(task);
});

// Delete a task
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.task.delete({ where: { id: Number(id) } });
  res.json({ success: true });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
