import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import { ProtectedRoute } from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Weight from './pages/Weight';
import Training from './pages/Training'; // Strength
import Cardio from './pages/Cardio';
import Food from './pages/Food';
import Bodyweight from './pages/Bodyweight';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/weight" element={<ProtectedRoute><Weight /></ProtectedRoute>} />
                <Route path="/cardio" element={<ProtectedRoute><Cardio /></ProtectedRoute>} />
                <Route path="/strength" element={<ProtectedRoute><Training /></ProtectedRoute>} />
                <Route path="/bodyweight" element={<ProtectedRoute><Bodyweight /></ProtectedRoute>} />
                <Route path="/food" element={<ProtectedRoute><Food /></ProtectedRoute>} />
            </Routes>
        </Router>
    );
}

export default App;
