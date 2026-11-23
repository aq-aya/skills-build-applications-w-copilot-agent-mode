import { Activity, Team, User, Workout } from '../models/index.js';
import mongoose from 'mongoose';

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!isRecord(input)) throw httpError(400, 'Activity input is required');

  const { userId, teamId, type, minutes } = input;
  if (
    typeof userId !== 'string'
    || typeof teamId !== 'string'
    || typeof type !== 'string'
    || !type.trim()
    || typeof minutes !== 'number'
    || !Number.isFinite(minutes)
    || minutes < 1
  ) {
    throw httpError(400, 'Valid userId, teamId, type, and minutes are required');
  }
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(teamId)) {
    throw httpError(400, 'Invalid user or team ID');
  }

  const [user, team] = await Promise.all([
    User.findById(userId).lean(),
    Team.findById(teamId).lean(),
  ]);
  if (!user || !team) throw httpError(404, 'User or team not found');
  if (!team.members.some((member) => member.equals(user._id))) {
    throw httpError(400, 'User is not a member of the selected team');
  }

  return Activity.create({
    user: user._id,
    team: team._id,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  const teams = await Team.find().lean();
  const users = await User.find({ _id: { $in: teams.flatMap((team) => team.members) } }).select('name').lean();
  const names = new Map(users.map((user) => [user._id.toString(), user.name]));
  return teams.map((team) => ({
    ...team,
    memberDetails: team.members.map((member) => ({
      id: member.toString(),
      name: names.get(member.toString()) ?? 'Unknown member',
    })),
  }));
}

export async function createTeam(input: unknown) {
  if (!isRecord(input)) throw httpError(400, 'Team input is required');

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const mascot = typeof input.mascot === 'string' ? input.mascot.trim() : '';
  if (!name) throw httpError(400, 'Team name is required');
  if (!mascot) throw httpError(400, 'Team mascot is required');

  const rawMembers = input.members;
  if (rawMembers !== undefined && !Array.isArray(rawMembers)) {
    throw httpError(400, 'Team members must be an array');
  }
  const members: unknown[] = rawMembers ?? [];
  if (!members.every((id): id is string => typeof id === 'string' && mongoose.isValidObjectId(id))) {
    throw httpError(400, 'Invalid team member ID');
  }
  const memberIds = [...new Set(members.map((id) => id.toLowerCase()))];
  const existingMembers = await User.find({ _id: { $in: memberIds } }).select('_id').lean();
  if (existingMembers.length !== memberIds.length) {
    throw httpError(404, 'One or more team members were not found');
  }

  return Team.create({
    name,
    mascot,
    members: existingMembers.map((member) => member._id),
  });
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail.trim().toLowerCase() }).lean();
  if (!user) throw httpError(404, 'User not found');

  const recentActivities = await Activity.find({ user: user._id })
    .sort({ occurredAt: -1 })
    .limit(10)
    .lean();
  const recentType = recentActivities[0]?.type.trim().toLowerCase();
  const goal = user.fitnessGoal.trim().toLowerCase();
  const focus = recentType === 'run' || goal === 'endurance'
    ? 'endurance'
    : recentType === 'cycle'
      ? 'endurance'
      : goal === 'strength' || recentType === 'strength'
        ? 'strength'
        : goal;

  const workouts = await Workout.find().lean();
  const matching = workouts.filter((workout) => workout.focus.toLowerCase() === focus);
  const selected = matching.length > 0 ? matching : workouts;
  return selected.map((workout) => ({
    ...workout,
    reason: matching.length > 0
      ? `Matches your ${focus} focus.`
      : `No ${focus} workouts are available; this is another available workout.`,
  }));
}

export async function getLeaderboard() {
  const activities = await Activity.find().lean();
  const pointsByTeam = new Map<string, number>();
  for (const activity of activities) {
    const teamId = activity.team.toString();
    pointsByTeam.set(teamId, (pointsByTeam.get(teamId) ?? 0) + activity.points);
  }

  const teams = await Team.find({ _id: { $in: [...pointsByTeam.keys()] } }).lean();
  return teams
    .map((team) => ({
      teamName: team.name,
      totalPoints: pointsByTeam.get(team._id.toString()) ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints || a.teamName.localeCompare(b.teamName))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export { User };
