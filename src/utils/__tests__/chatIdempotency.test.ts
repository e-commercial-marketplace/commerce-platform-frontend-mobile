import { generateClientMessageKey } from '../chatIdempotency';

describe('chatIdempotency', () => {
  it('generates non-empty string adhering to 1 to 100 character length limit', () => {
    const key = generateClientMessageKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThanOrEqual(1);
    expect(key.length).toBeLessThanOrEqual(100);
    expect(key.startsWith('msg_')).toBe(true);
  });

  it('generates distinct keys across successive calls', () => {
    const key1 = generateClientMessageKey();
    const key2 = generateClientMessageKey();
    expect(key1).not.toBe(key2);
  });
});
