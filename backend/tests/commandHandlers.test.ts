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
    const asset = addAssetToWatchlist(wl.id, 'reliance');
    expect(asset.symbol).toBe('RELIANCE');
    expect(asset.watchlistId).toBe(wl.id);
  });

  test('addAssetToWatchlist throws for an unknown watchlist', () => {
    expect(() => addAssetToWatchlist('non-existent-id', 'TCS')).toThrow(/not found/i);
  });

  test('removeAssetFromWatchlist throws if asset does not belong to the watchlist', () => {
    const wl1 = createWatchlist('user-cmd-2', 'List A');
    const wl2 = createWatchlist('user-cmd-2', 'List B');
    const asset = addAssetToWatchlist(wl1.id, 'INFY');
    expect(() => removeAssetFromWatchlist(wl2.id, asset.id)).toThrow(/not found/i);
  });

  test('setAssetAlertTrigger rejects an invalid direction', () => {
    const wl = createWatchlist('user-cmd-3', 'List C');
    const asset = addAssetToWatchlist(wl.id, 'SBIN');
    expect(() => setAssetAlertTrigger(asset.id, 900, 'sideways' as any)).toThrow(/direction/i);
  });

  test('setAssetAlertTrigger sanitizes invalid target prices', () => {
    const wl = createWatchlist('user-cmd-4', 'List D');
    const asset = addAssetToWatchlist(wl.id, 'ITC');
    expect(() => setAssetAlertTrigger(asset.id, -100, 'above')).toThrow();
    expect(() => setAssetAlertTrigger(asset.id, 'not-a-number', 'above')).toThrow();
  });

  test('setAssetAlertTrigger succeeds with a valid positive target price', () => {
    const wl = createWatchlist('user-cmd-5', 'List E');
    const asset = addAssetToWatchlist(wl.id, 'WIPRO');
    const trigger = setAssetAlertTrigger(asset.id, 550, 'above');
    expect(trigger.targetPrice).toBe(550);
    expect(trigger.direction).toBe('above');
    expect(trigger.active).toBe(true);
  });
});
