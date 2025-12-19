
import { 
    Flame, Zap, Trophy, Medal, Crown, Star, 
    Footprints, Bike, Dumbbell, Wallet, 
    Salad, Droplets, Moon, Sun, Calendar, 
    TrendingUp, Shield, Target, Award, Heart
} from 'lucide-react';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface BadgeDef {
    id: string; // unique id like 'streak_bronze'
    groupId: string; // 'streak'
    name: string;
    description: string;
    tier: BadgeTier;
    icon: any; // Lucide Icon Component
    sortOrder: number; // For sorting strictly by difficulty
    isEarned: boolean;
    progress?: number;
    target?: number;
}

// Logic helpers
const getTier = (i: number): BadgeTier => {
    const tiers: BadgeTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    return tiers[i] || 'diamond';
};

// --- Achievement Definitions ---

// 1. Streak (Days)
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365];
// 2. Total Distance (km)
const DISTANCE_MILESTONES = [42, 100, 500, 1000, 2500, 5000, 10000];
// 3. Strength Sessions (Count)
const WORKOUT_MILESTONES = [10, 25, 50, 100, 250, 500, 1000];
// 4. Clean Eating (Green Logs)
const FOOD_MILESTONES = [10, 50, 100, 200, 365, 500, 1000];
// 5. XP Level (Level 1, 5, etc)
const LEVEL_MILESTONES = [2, 5, 10, 20, 30, 50, 100];
// 6. Bodyweight Reps (Total)
const BW_MILESTONES = [100, 500, 1000, 5000, 10000, 25000, 50000];
// 7. Early Bird (Workouts 4am-9am)
const EARLY_MILESTONES = [5, 20, 50, 100, 200];
// 8. Night Owl (Workouts 8pm-2am)
const NIGHT_MILESTONES = [5, 20, 50, 100, 200];
// 9. Weekend Warrior (Sat/Sun logs)
const WEEKEND_MILESTONES = [10, 50, 100, 250, 500];

export function calculateBadges(stats: {
    streak: number;
    totalDist: number;
    totalWorkouts: number;
    totalGreenFood: number;
    level: number;
    totalBwReps: number;
    earlyBirdCount: number;
    nightOwlCount: number;
    weekendCount: number;
}) {
    const badges: BadgeDef[] = [];

    // Helper to generate a family of badges
    const createFamily = (
        groupId: string, 
        nameBase: string, 
        descTemplate: (val: number) => string, 
        icon: any, 
        milestones: number[], 
        currentValue: number
    ) => {
        milestones.forEach((target, index) => {
            badges.push({
                id: `${groupId}_${index}`,
                groupId,
                name: `${nameBase} ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][index] || 'Max'}`,
                description: descTemplate(target),
                tier: getTier(Math.min(index, 4)), // Map first 5 to tiers, rest stay diamond logic or loop
                icon,
                sortOrder: (index * 100), // Base sort
                isEarned: currentValue >= target,
                progress: currentValue,
                target: target
            });
        });
    };

    createFamily('streak', 'Consistency', (v) => `${v} Day Streak`, Flame, STREAK_MILESTONES, stats.streak);
    createFamily('distance', 'Road Runner', (v) => `${v}km Total Distance`, Footprints, DISTANCE_MILESTONES, stats.totalDist);
    createFamily('workouts', 'Iron Warrior', (v) => `${v} Workouts Completed`, Dumbbell, WORKOUT_MILESTONES, stats.totalWorkouts);
    createFamily('food', 'Clean Eater', (v) => `${v} Healthy Meals`, Salad, FOOD_MILESTONES, stats.totalGreenFood);
    createFamily('level', 'Legend', (v) => `Reach Level ${v}`, Crown, LEVEL_MILESTONES, stats.level);
    createFamily('bodyweight', 'Calisthenics', (v) => `${v} Total Reps`, Zap, BW_MILESTONES, stats.totalBwReps);
    createFamily('early', 'Early Bird', (v) => `${v} Morning Workouts`, Sun, EARLY_MILESTONES, stats.earlyBirdCount);
    createFamily('night', 'Night Owl', (v) => `${v} Late Night Workouts`, Moon, NIGHT_MILESTONES, stats.nightOwlCount);
    createFamily('weekend', 'Weekend Warrior', (v) => `${v} Weekend Activities`, Calendar, WEEKEND_MILESTONES, stats.weekendCount);

    // Sort: Earned first, then by progress %
    return badges.sort((a, b) => {
        if (a.isEarned && !b.isEarned) return -1;
        if (!a.isEarned && b.isEarned) return 1;
        if (a.isEarned) return b.target! - a.target!; // Highest earned first
        const pA = (a.progress || 0) / (a.target || 1);
        const pB = (b.progress || 0) / (b.target || 1);
        return pB - pA; // Closest to completion first
    });
}
