import {describe,it,expect} from 'vitest';
import {createRequestId} from './random-id';
import {uuidSchema} from './validation';
describe('LAN request IDs',()=>{
  it('uses native UUID support when available',()=>expect(createRequestId({getRandomValues:crypto.getRandomValues.bind(crypto),randomUUID:()=> '12345678-1234-4123-8123-123456789012'})).toBe('12345678-1234-4123-8123-123456789012'));
  it('creates unique valid version-4 UUIDs without secure-context randomUUID',()=>{
    const api={getRandomValues:crypto.getRandomValues.bind(crypto)};
    const ids=Array.from({length:100},()=>createRequestId(api));
    expect(new Set(ids).size).toBe(100);for(const id of ids){expect(uuidSchema.safeParse(id).success).toBe(true);expect(id[14]).toBe('4');expect('89ab').toContain(id[19]);}
  });
});
