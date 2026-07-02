import serverless from 'serverless-http';
import app from '../server/app.js';

const expressHandler = serverless(app);

export default function handler(req, res) {
  return expressHandler(req, res);
}

export const config = {
  maxDuration: 60,
};
