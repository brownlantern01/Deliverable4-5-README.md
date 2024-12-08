import React, { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "./components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";


const AuthContext = createContext(null);


const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const login = async (username, password) => {
    try {
      const response = await api.post('/login', { username, password });
      const data = response.data;
      setUser(data);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
      return data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await api.post('/register', { username, email, password });
      const data = response.data;
      setUser(data);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
      return data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}


function AccountSection() {
  const { user, logout } = useContext(AuthContext);

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="p-4">
      <Card className="w-full max-w-md mx-auto mt-10">
        <CardHeader>
          <CardTitle>Welcome, {user.username}!</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={logout} className="w-full">Logout</Button>
        </CardContent>
      </Card>
    </div>
  );
}


function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const { login, register } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, email, password);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto mt-10">
      <CardHeader>
        <CardTitle>{isLogin ? 'Login' : 'Register'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          {!isLogin && (
            <Input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          )}
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
          />
          <Button type="submit" className="w-full">
            {isLogin ? 'Login' : 'Register'}
          </Button>
        </form>
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <p className="text-center mt-4">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <Button 
            variant="link" 
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Register' : 'Login'}
          </Button>
        </p>
      </CardContent>
    </Card>
  );
}


function RecipeSearchByIngredient() {
  const [ingredients, setIngredients] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [error, setError] = useState(null);
  const { user } = useContext(AuthContext);

  const handleSearch = async () => {
    try {
      const response = await api.get('/recipes/ingredients', {
        params: { ingredients }
      });
      setRecipes(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to search recipes');
      setRecipes([]);
    }
  };

  const handleSaveRecipe = async (recipe, event) => {
    event.stopPropagation(); 
    try {
      await api.post('/recipes/save', { recipe });
      alert('Recipe saved successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save recipe');
    }
  };

  const handleRecipeClick = async (recipeId) => {
    try {
      const response = await api.get(`/recipes/${recipeId}`);
      window.open(response.data.sourceUrl, '_blank');
    } catch (err) {
      setError('Failed to get recipe details');
    }
  };

  return (
    <div className="p-4">
      <div className="flex mb-4">
        <Input 
          placeholder="Enter ingredients (comma-separated)" 
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          className="mr-2"
        />
        <Button onClick={handleSearch}>Search</Button>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {recipes.map((recipe) => (
          <Card 
            key={recipe.id}
            onClick={() => handleRecipeClick(recipe.id)}
            className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
          >
            <CardHeader>
              <CardTitle>{recipe.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <img 
                src={recipe.image} 
                alt={recipe.title} 
                className="w-full h-48 object-cover mb-2"
              />
              <Button 
                variant="secondary" 
                onClick={(e) => handleSaveRecipe(recipe, e)}
                className="w-full"
              >
                Save Recipe
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RecipeSearchByCalorie() {
  const [maxCalorie, setMaxCalorie] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [error, setError] = useState(null);
  const { user } = useContext(AuthContext);

  const handleSearch = async () => {
    try {
      const response = await api.get('/recipes/calories', {
        params: { maxCalories: maxCalorie }
      });
      setRecipes(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to search recipes');
      setRecipes([]);
    }
  };

  const handleSaveRecipe = async (recipe, event) => {
    event.stopPropagation(); 
    try {
      await api.post('/recipes/save', { recipe });
      alert('Recipe saved successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save recipe');
    }
  };

  const handleRecipeClick = async (recipeId) => {
    try {
      const response = await api.get(`/recipes/${recipeId}`);
      window.open(response.data.sourceUrl, '_blank');
    } catch (err) {
      setError('Failed to get recipe details');
    }
  };

  return (
    <div className="p-4">
      <div className="flex mb-4">
        <Input 
          type="number"
          placeholder="Maximum calories" 
          value={maxCalorie}
          onChange={(e) => setMaxCalorie(e.target.value)}
          className="mr-2"
        />
        <Button onClick={handleSearch}>Search</Button>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {recipes.map((recipe) => (
          <Card 
            key={recipe.id}
            onClick={() => handleRecipeClick(recipe.id)}
            className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
          >
            <CardHeader>
              <CardTitle>{recipe.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Calories: {recipe.calories}</p>
              {recipe.image && (
                <img 
                  src={recipe.image} 
                  alt={recipe.title} 
                  className="w-full h-48 object-cover mb-2"
                />
              )}
              <Button 
                variant="secondary" 
                onClick={(e) => handleSaveRecipe(recipe, e)}
                className="w-full"
              >
                Save Recipe
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SavedRecipes() {
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [error, setError] = useState(null);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const fetchSavedRecipes = async () => {
      if (user) {
        try {
          const response = await api.get('/recipes/saved');
          setSavedRecipes(response.data);
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to fetch saved recipes');
        }
      }
    };

    fetchSavedRecipes();
  }, [user]);

  const handleRecipeClick = async (recipeId) => {
    try {
      const response = await api.get(`/recipes/${recipeId}`);
      window.open(response.data.sourceUrl, '_blank');
    } catch (err) {
      setError('Failed to get recipe details');
    }
  };

  if (!user) {
    return (
      <Alert>
        <AlertTitle>Please Log In</AlertTitle>
        <AlertDescription>Log in to view your saved recipes</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl mb-4">{user.username}'s Saved Recipes</h2>
      
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {savedRecipes.length === 0 ? (
        <p>No recipes saved yet</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {savedRecipes.map((recipe) => (
            <Card 
              key={recipe.id}
              onClick={() => handleRecipeClick(recipe.id)}
              className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
            >
              <CardHeader>
                <CardTitle>{recipe.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {recipe.image && (
                  <img 
                    src={recipe.image} 
                    alt={recipe.title} 
                    className="w-full h-48 object-cover mb-2"
                  />
                )}
                {recipe.calories && (
                  <p>Calories: {recipe.calories}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


function App() {
  return (
    <AuthProvider>
      <div className="container mx-auto p-4">
        <Tabs defaultValue="account">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="ingredient-search">Search by Ingredient</TabsTrigger>
            <TabsTrigger value="calorie-search">Search by Calorie</TabsTrigger>
            <TabsTrigger value="saved-recipes">Saved Recipes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="account">
            <AccountSection />
          </TabsContent>
          
          <TabsContent value="ingredient-search">
            <RecipeSearchByIngredient />
          </TabsContent>
          
          <TabsContent value="calorie-search">
            <RecipeSearchByCalorie />
          </TabsContent>
          
          <TabsContent value="saved-recipes">
            <SavedRecipes />
          </TabsContent>
        </Tabs>
      </div>
    </AuthProvider>
  );
}

export default App;