require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const pool = require('./config/database');

const app = express();


app.use(cors());
app.use(express.json());


const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};


pool.connect()
  .then(() => console.log('✅ Connected to PostgreSQL Database'))
  .catch(err => console.error('❌ PostgreSQL connection error:', err));


app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    console.log('Registration attempt for:', username);

    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING user_id',
      [username, email, password]
    );
    
    const token = jwt.sign(
      { userId: result.rows[0].user_id, username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('Registration successful for:', username);
    res.status(201).json({ 
      token, 
      userId: result.rows[0].user_id, 
      username 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt for:', username);
    
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );

    const user = result.rows[0];
    if (!user) {
      console.log('Invalid credentials for:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.user_id, username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('Login successful for:', username);
    res.json({ 
      token, 
      userId: user.user_id, 
      username 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
});


app.get('/api/recipes/ingredients', authenticateToken, async (req, res) => {
  try {
    console.log('Searching recipes by ingredients:', req.query.ingredients);
    const response = await axios.get(
      `https://api.spoonacular.com/recipes/findByIngredients`,
      {
        params: {
          ingredients: req.query.ingredients,
          number: 10,
          apiKey: process.env.SPOONACULAR_API_KEY
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Recipe search error:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/recipes/calories', authenticateToken, async (req, res) => {
  try {
    console.log('Searching recipes by calories:', req.query.maxCalories);
    const response = await axios.get(
      `https://api.spoonacular.com/recipes/findByNutrients`,
      {
        params: {
          maxCalories: req.query.maxCalories,
          number: 10,
          apiKey: process.env.SPOONACULAR_API_KEY
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Calorie search error:', error);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/recipes/save', authenticateToken, async (req, res) => {
  try {
    const { recipe } = req.body;
    const userId = req.user.userId;


    const existing = await pool.query(
      'SELECT * FROM user_recipes WHERE user_id = $1 AND recipe_id = $2',
      [userId, recipe.id]
    );

    if (existing.rows.length === 0) {

      await pool.query(
        `INSERT INTO recipes (recipe_id, recipe_name, image, ingredients, nutrition_info, calories) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (recipe_id) 
         DO UPDATE SET 
           recipe_name = EXCLUDED.recipe_name,
           image = EXCLUDED.image,
           ingredients = EXCLUDED.ingredients,
           nutrition_info = EXCLUDED.nutrition_info,
           calories = EXCLUDED.calories`,
        [
          recipe.id,
          recipe.title,
          recipe.image,
          JSON.stringify(recipe.ingredients || []),
          JSON.stringify(recipe.nutrition || {}),
          recipe.calories
        ]
      );

 
      await pool.query(
        'INSERT INTO user_recipes (user_id, recipe_id) VALUES ($1, $2)',
        [userId, recipe.id]
      );

      console.log('Recipe saved successfully for user:', userId);
      res.json({ message: 'Recipe saved successfully' });
    } else {
      console.log('Recipe already saved for user:', userId);
      res.status(400).json({ message: 'Recipe already saved' });
    }
  } catch (error) {
    console.error('Save recipe error:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/recipes/saved', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.recipe_id as id, r.recipe_name as title, r.image, r.calories, 
              r.ingredients, r.nutrition_info
       FROM recipes r
       JOIN user_recipes ur ON r.recipe_id = ur.recipe_id
       WHERE ur.user_id = $1
       ORDER BY ur.save_date DESC`,
      [req.user.userId]
    );

    console.log('Retrieved saved recipes for user:', req.user.userId);
    const recipes = result.rows.map(recipe => ({
      ...recipe,
      ingredients: typeof recipe.ingredients === 'string' 
        ? JSON.parse(recipe.ingredients) 
        : recipe.ingredients,
      nutrition: typeof recipe.nutrition_info === 'string' 
        ? JSON.parse(recipe.nutrition_info) 
        : recipe.nutrition_info
    }));

    res.json(recipes);
  } catch (error) {
    console.error('Get saved recipes error:', error);
    res.status(500).json({ message: error.message });
  }
});


app.get('/api/recipes/:id', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching recipe details for ID:', req.params.id);
    const response = await axios.get(
      `https://api.spoonacular.com/recipes/${req.params.id}/information`,
      {
        params: {
          apiKey: process.env.SPOONACULAR_API_KEY
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Recipe detail error:', error);
    res.status(500).json({ message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});