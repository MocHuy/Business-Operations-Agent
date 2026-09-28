import * as data from '../data/mockData.js';
Object.assign(globalThis, data);
import ProcuraStore from './storeSource.js';
export async function getStore() { return ProcuraStore; }
