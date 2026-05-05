import {
  isButtonNodeType,
  labelToSlug,
  normalizeNodeButtonIds,
  uniqueSlug,
} from './button-slug.util';

describe('labelToSlug', () => {
  it('영문 단어 → kebab-case 소문자', () => {
    expect(labelToSlug('Confirm')).toBe('confirm');
    expect(labelToSlug('Confirm Order')).toBe('confirm-order');
  });

  it('연속 공백·특수문자 → 단일 하이픈', () => {
    expect(labelToSlug('Add  to  cart')).toBe('add-to-cart');
    expect(labelToSlug('Save & Close')).toBe('save-close');
    expect(labelToSlug('100% Off!')).toBe('100-off');
  });

  it('앞·뒤 하이픈 제거', () => {
    expect(labelToSlug('-leading')).toBe('leading');
    expect(labelToSlug('trailing-')).toBe('trailing');
    expect(labelToSlug('!!Hello!!')).toBe('hello');
  });

  it('한글·이모지·기호 → 모두 제거되어 빈 문자열 fallback', () => {
    expect(labelToSlug('확인')).toBe('');
    expect(labelToSlug('🚀')).toBe('');
    expect(labelToSlug('---')).toBe('');
  });

  it('빈/whitespace 입력 → 빈 문자열', () => {
    expect(labelToSlug('')).toBe('');
    expect(labelToSlug('   ')).toBe('');
  });

  it('64자 상한 — 초과분 절단', () => {
    const long = 'a'.repeat(80);
    expect(labelToSlug(long)).toHaveLength(64);
  });

  it('숫자·영문 혼합 보존', () => {
    expect(labelToSlug('Page 2 of 10')).toBe('page-2-of-10');
  });
});

describe('uniqueSlug', () => {
  it('충돌 없으면 base 그대로', () => {
    expect(uniqueSlug('confirm', new Set())).toBe('confirm');
  });

  it('충돌 시 -2 접미사 부여', () => {
    expect(uniqueSlug('confirm', new Set(['confirm']))).toBe('confirm-2');
  });

  it('연쇄 충돌 — 다음 사용 가능 번호 사용', () => {
    expect(
      uniqueSlug('confirm', new Set(['confirm', 'confirm-2', 'confirm-3'])),
    ).toBe('confirm-4');
  });

  it('충돌 후 길이가 64자 넘으면 절단', () => {
    const long = 'a'.repeat(64);
    const result = uniqueSlug(long, new Set([long]));
    expect(result.length).toBeLessThanOrEqual(64);
  });
});

describe('normalizeNodeButtonIds', () => {
  describe('config.buttons (template/chart/table)', () => {
    it('빈 id → label-slug 부여', () => {
      const result = normalizeNodeButtonIds({
        buttons: [{ label: 'Confirm' }, { label: 'Cancel' }],
      });
      expect(
        (result?.buttons as Array<{ id: string }>).map((b) => b.id),
      ).toEqual(['confirm', 'cancel']);
    });

    it('동일 label 중복 → -2 접미사로 충돌 해소', () => {
      const result = normalizeNodeButtonIds({
        buttons: [
          { label: 'Submit' },
          { label: 'Submit' },
          { label: 'Submit' },
        ],
      });
      expect(
        (result?.buttons as Array<{ id: string }>).map((b) => b.id),
      ).toEqual(['submit', 'submit-2', 'submit-3']);
    });

    it('label 빈 entry → btn_${i} fallback', () => {
      const result = normalizeNodeButtonIds({
        buttons: [{}, { label: '' }, { label: '한글만' }],
      });
      expect(
        (result?.buttons as Array<{ id: string }>).map((b) => b.id),
      ).toEqual(['btn_0', 'btn_1', 'btn_2']);
    });

    it('살아있는 id 는 보존 — label 변경에도 slug 불변', () => {
      const result = normalizeNodeButtonIds({
        buttons: [
          { id: 'btn_keep', label: 'Renamed Label' },
          { id: 'btn_keep_2', label: 'Another' },
        ],
      });
      expect(
        (result?.buttons as Array<{ id: string }>).map((b) => b.id),
      ).toEqual(['btn_keep', 'btn_keep_2']);
    });

    it('일부만 살아있고 일부는 비어있을 때 — 살아있는 id 와 충돌 없게 신규 부여', () => {
      const result = normalizeNodeButtonIds({
        buttons: [
          { id: 'confirm', label: 'Confirm' }, // existing
          { label: 'Confirm' }, // new — base "confirm" already taken
          { label: 'Cancel' },
        ],
      });
      expect(
        (result?.buttons as Array<{ id: string }>).map((b) => b.id),
      ).toEqual(['confirm', 'confirm-2', 'cancel']);
    });

    it('invalid id (regex 위반) 은 살아있다고 보지 않고 재부여', () => {
      const result = normalizeNodeButtonIds({
        buttons: [{ id: 'has space', label: 'Confirm' }],
      });
      expect((result?.buttons as Array<{ id: string }>)[0].id).toBe('confirm');
    });

    it('변경 없으면 같은 reference 반환 (caller 가 reference 비교 가능)', () => {
      const input = {
        buttons: [{ id: 'a', label: 'A' }],
      };
      const result = normalizeNodeButtonIds(input);
      expect(result).toBe(input);
    });
  });

  describe('config.itemButtons (carousel)', () => {
    it('itemBtn_${i} fallback prefix 사용', () => {
      const result = normalizeNodeButtonIds({
        itemButtons: [{}, {}],
      });
      expect(
        (result?.itemButtons as Array<{ id: string }>).map((b) => b.id),
      ).toEqual(['itemBtn_0', 'itemBtn_1']);
    });
  });

  describe('config.items[*].buttons (carousel static)', () => {
    it('items_${i}_btn_${j} fallback prefix 사용', () => {
      const result = normalizeNodeButtonIds({
        items: [
          { title: 'A', buttons: [{}, { label: 'X' }] },
          { title: 'B', buttons: [{ label: 'Y' }] },
        ],
      });
      const items = result?.items as Array<{
        buttons: Array<{ id: string }>;
      }>;
      expect(items[0].buttons.map((b) => b.id)).toEqual(['items_0_btn_0', 'x']);
      expect(items[1].buttons.map((b) => b.id)).toEqual(['y']);
    });

    it('item 의 buttons 가 없으면 그 item 은 손대지 않음', () => {
      const input = {
        items: [{ title: 'A' }, { title: 'B' }],
      };
      const result = normalizeNodeButtonIds(input);
      expect(result).toBe(input);
    });
  });

  describe('edge cases', () => {
    it('config 자체가 undefined 이면 undefined 반환', () => {
      expect(normalizeNodeButtonIds(undefined)).toBeUndefined();
    });

    it('buttons 가 배열이 아니면 무시', () => {
      const input = { buttons: 'not-array' as unknown };
      expect(normalizeNodeButtonIds(input)).toBe(input);
    });

    it('3 위치 (buttons, itemButtons, items[*].buttons) 가 모두 함께 있을 때 동시 정규화', () => {
      const result = normalizeNodeButtonIds({
        buttons: [{ label: 'Global' }],
        itemButtons: [{ label: 'PerItem' }],
        items: [{ buttons: [{ label: 'Inline' }] }],
      });
      expect((result?.buttons as Array<{ id: string }>)[0].id).toBe('global');
      expect((result?.itemButtons as Array<{ id: string }>)[0].id).toBe(
        'peritem',
      );
      expect(
        (result?.items as Array<{ buttons: Array<{ id: string }> }>)[0]
          .buttons[0].id,
      ).toBe('inline');
    });
  });
});

describe('isButtonNodeType', () => {
  it('carousel/chart/table/template 만 true', () => {
    expect(isButtonNodeType('carousel')).toBe(true);
    expect(isButtonNodeType('chart')).toBe(true);
    expect(isButtonNodeType('table')).toBe(true);
    expect(isButtonNodeType('template')).toBe(true);
  });

  it('그 외 노드는 false', () => {
    expect(isButtonNodeType('switch')).toBe(false);
    expect(isButtonNodeType('text_classifier')).toBe(false);
    expect(isButtonNodeType('http_request')).toBe(false);
    expect(isButtonNodeType('')).toBe(false);
  });
});
