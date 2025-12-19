
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Scale, Dumbbell, Utensils, Settings as SettingsIcon, Menu, X, Bike, Footprints } from 'lucide-react';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Weight from './pages/Weight';
import Biking from './pages/Biking';
import Running from './pages/Running';
import Strength from './pages/Strength';
import Food from './pages/Food';
import SettingsP from './pages/Settings';
import Bodyweight from './pages/Bodyweight';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-400">Loading...</div>;
    if (!user) return <Login />;
    return <>{children}</>;
}

export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/weight" element={<ProtectedRoute><Weight /></ProtectedRoute>} />
                <Route path="/biking" element={<ProtectedRoute><Biking /></ProtectedRoute>} />
                <Route path="/running" element={<ProtectedRoute><Running /></ProtectedRoute>} />
                <Route path="/strength" element={<ProtectedRoute><Strength /></ProtectedRoute>} />
                <Route path="/bodyweight" element={<ProtectedRoute><Bodyweight /></ProtectedRoute>} />
                <Route path="/food" element={<ProtectedRoute><Food /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsP /></ProtectedRoute>} />
            </Routes>
        </Router>
    );
}
