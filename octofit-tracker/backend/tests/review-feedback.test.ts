import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Activity, Team, User, Workout } from '../src/models/index.js';

let mongo: MongoMemoryServer;
const app = createApp();

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([Activity.deleteMany({}), Team.deleteMany({}), User.deleteMany({}), Workout.deleteMany({})]);
});

describe('team and workout behavior', () => {
  it('deduplicates member IDs and returns their names', async () => {
    const user = await User.create({ name: 'Mona', email: 'mona@example.com', fitnessGoal: 'endurance' });
    const id = user._id.toString();
    const created = await request(app).post('/api/teams').send({ name: 'Octocats', mascot: 'Mona', members: [id, id.toUpperCase()] });
    expect(created.status).toBe(201);
    expect(created.body.team.members).toEqual([id]);
    const listed = await request(app).get('/api/teams');
    expect(listed.body.teams[0]).toMatchObject({ members: [id], memberDetails: [{ id, name: 'Mona' }] });
  });

  it('rejects an activity for a team the user does not belong to', async () => {
    const user = await User.create({ name: 'Mona', email: 'mona@example.com', fitnessGoal: 'endurance' });
    const team = await Team.create({ name: 'Octocats', mascot: 'Cat' });
    const response = await request(app).post('/api/activities').send({ userId: user._id.toString(), teamId: team._id.toString(), type: 'run', minutes: 30 });
    expect(response.status).toBe(400);
    expect(await Activity.countDocuments()).toBe(0);
  });

  it('explains fallback workouts without claiming they match the chosen focus', async () => {
    const user = await User.create({ name: 'Mona', email: 'mona@example.com', fitnessGoal: 'endurance' });
    const team = await Team.create({ name: 'Octocats', mascot: 'Cat', members: [user._id] });
    await Activity.create({ user: user._id, team: team._id, type: 'run', minutes: 30, points: 30, occurredAt: new Date() });
    await Workout.create({ title: 'Strength Circuit', focus: 'strength', minutes: 30, difficulty: 'moderate' });
    const response = await request(app).get('/api/workouts/suggestions/mona%40example.com');
    expect(response.body.suggestions[0].reason).toMatch(/no .*endurance.*available/i);
    expect(response.body.suggestions[0].reason).not.toMatch(/matches/i);
  });

  it('explains the focus used when activity and goal conflict', async () => {
    const user = await User.create({ name: 'Mona', email: 'mona@example.com', fitnessGoal: 'endurance' });
    const team = await Team.create({ name: 'Octocats', mascot: 'Cat', members: [user._id] });
    await Activity.create({ user: user._id, team: team._id, type: 'strength', minutes: 30, points: 30, occurredAt: new Date() });
    await Workout.create({ title: 'Intervals', focus: 'endurance', minutes: 30, difficulty: 'moderate' });
    const response = await request(app).get('/api/workouts/suggestions/mona%40example.com');
    expect(response.body.suggestions[0].reason).toMatch(/endurance/i);
    expect(response.body.suggestions[0].reason).not.toMatch(/strength/i);
  });
});
