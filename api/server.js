import { createVercelApiHandler, vercelFunctionConfig } from '../server/vercelHandler.js';

export default createVercelApiHandler();
export const config = vercelFunctionConfig;
