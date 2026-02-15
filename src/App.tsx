
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sport from './pages/Sport';
import Weight from './pages/Weight';
import Biking from './pages/Biking';
import Running from './pages/Running';
import Strength from './pages/Strength';
import Books from './pages/Books';
import Food from './pages/Food';
import Health from './pages/Health';
import Life from './pages/Life';
import Settings from './pages/Settings';
import Bodyweight from './pages/Bodyweight';
import DailyLog from './pages/DailyLog';
import Budget from './pages/Budget';
import BudgetAnalytics from './pages/BudgetAnalytics';



import LessIsMore from './pages/LessIsMore';


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

    if (loading) return <div className="h-screen flex items-center justify-center text-brand-primary">Loading...</div>;
    if (!user) return <div className="h-screen flex items-center justify-center"><Login /></div>;
    return <>{children}</>;
}

export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<ProtectedRoute><DailyLog /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/sport" element={<ProtectedRoute><Sport /></ProtectedRoute>} />
                <Route path="/health" element={<ProtectedRoute><Health /></ProtectedRoute>} />
                <Route path="/life" element={<ProtectedRoute><Life /></ProtectedRoute>} />
                <Route path="/budget" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
                <Route path="/budget/analytics" element={<ProtectedRoute><BudgetAnalytics /></ProtectedRoute>} />
                <Route path="/weight" element={<ProtectedRoute><Weight /></ProtectedRoute>} />
                <Route path="/books" element={<ProtectedRoute><Books /></ProtectedRoute>} />
                <Route path="/less-is-more" element={<ProtectedRoute><LessIsMore /></ProtectedRoute>} />

                <Route path="/biking" element={<ProtectedRoute><Biking /></ProtectedRoute>} />
                <Route path="/running" element={<ProtectedRoute><Running /></ProtectedRoute>} />
                <Route path="/strength" element={<ProtectedRoute><Strength /></ProtectedRoute>} />
                <Route path="/bodyweight" element={<ProtectedRoute><Bodyweight /></ProtectedRoute>} />
                <Route path="/bodyweight" element={<ProtectedRoute><Bodyweight /></ProtectedRoute>} />
                <Route path="/food" element={<ProtectedRoute><Food /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            </Routes>
        </Router>
    );
}
