import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
                <Route path="/" element={<Dashboard />} />
                <Route path="/weight" element={<Weight />} />
                <Route path="/cardio" element={<Cardio />} />
                <Route path="/strength" element={<Training />} />
                <Route path="/bodyweight" element={<Bodyweight />} />
                <Route path="/food" element={<Food />} />
            </Routes>
        </Router>
    );
}

export default App;
