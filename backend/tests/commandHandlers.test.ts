import {
  createWatchlist,
  addAssetToWatchlist,
  removeAssetFromWatchlist,
  setAssetAlertTrigger,
  validateSymbol,
  validatePriceTarget,
} from '../src/command/commandHandlers';

describe('Command side validation & handlers', () => {
  test('validateSymbol accepts valid NSE-style tickers', () => {
    expect(() => validateSymbol('RELIANCE')).not.toThrow();
    expect(() => validateSymbol('TCS')).not.toThrow();
  });

  test('validateSymbol rejects invalid/alpha-numeric symbols', () => {
    expect(() => validateSymbol('')).toThrow();
    expect(() => validateSymbol('123')).toThrow();
    expect(() => validateSymbol('AB@CD')).toThrow();
  });

  test('validatePriceTarget rejects negative, zero, and non-numeric values', () => {
    expect(() => validatePriceTarget(-5)).toThrow();
    expect(() => validatePriceTarget(0)).toThrow();
    expect(() => validatePriceTarget('abc')).toThrow();
    expect(() => validatePriceTarget(NaN)).toThrow();
  });

  test('validatePriceTarget accepts a positive numeric string', () => {
    expect(validatePriceTarget('2950.50')).toBeCloseTo(2950.5);
  });

  test('createWatchlist requires a non-empty name', () => {
    expect(() => createWatchlist('user-1', '   ')).toThrow(/required/i);
  });

  test('createWatchlist + addAssetToWatchlist end-to-end happy path', () => {
    const wl = createWatchlist('user-cmd-1', 'Test List');
    const asset = addAssetToWatchlist(wl.id, 'reliance', 'user-cmd-1');
    expect(asset.symbol).toBe('RELIANCE');
    expect(asset.watchlistId).toBe(wl.id);
  });

  test('addAssetToWatchlist throws for an unknown watchlist', () => {
    expect(() => addAssetToWatchlist('non-existent-id', 'TCS', 'user-cmd-1')).toThrow(/not found/i);
  });

  test('addAssetToWatchlist throws when the watchlist belongs to another user', () => {
    const wl = createWatchlist('user-cmd-owner', 'Owned List');
    expect(() => addAssetToWatchlist(wl.id, 'TCS', 'user-cmd-intruder')).toThrow(/not found/i);
  });

  test('removeAssetFromWatchlist throws if asset does not belong to the watchlist', () => {
    const wl1 = createWatchlist('user-cmd-2', 'List A');
    const wl2 = createWatchlist('user-cmd-2', 'List B');
    const asset = addAssetToWatchlist(wl1.id, 'INFY', 'user-cmd-2');
    expect(() => removeAssetFromWatchlist(wl2.id, asset.id, 'user-cmd-2')).toThrow(/not found/i);
  });

  test('setAssetAlertTrigger rejects an invalid direction', () => {
    const wl = createWatchlist('user-cmd-3', 'List C');
    const asset = addAssetToWatchlist(wl.id, 'SBIN', 'user-cmd-3');
    expect(() => setAssetAlertTrigger(asset.id, 900, 'sideways' as any, 'user-cmd-3')).toThrow(/direction/i);
  });

  test('setAssetAlertTrigger throws when the asset\'s watchlist belongs to another user', () => {
    const wl = createWatchlist('user-cmd-owner2', 'List D');
    const asset = addAssetToWatchlist(wl.id, 'ITC', 'user-cmd-owner2');
    expect(() => setAssetAlertTrigger(asset.id, 900, 'above', 'user-cmd-intruder')).toThrow(/not found/i);
  });

  test('setAssetAlertTrigger sanitizes invalid target prices', () => {
    const wl = createWatchlist('user-cmd-4', 'List D');
    const asset = addAssetToWatchlist(wl.id, 'ITC', 'user-cmd-4');
    expect(() => setAssetAlertTrigger(asset.id, -100, 'above', 'user-cmd-4')).toThrow();
    expect(() => setAssetAlertTrigger(asset.id, 'not-a-number', 'above', 'user-cmd-4')).toThrow();
  });

  test('setAssetAlertTrigger succeeds with a valid positive target price', () => {
    const wl = createWatchlist('user-cmd-5', 'List E');
    const asset = addAssetToWatchlist(wl.id, 'WIPRO', 'user-cmd-5');
    const trigger = setAssetAlertTrigger(asset.id, 550, 'above', 'user-cmd-5');
    expect(trigger.targetPrice).toBe(550);
    expect(trigger.direction).toBe('above');
    expect(trigger.active).toBe(true);
  });
});
