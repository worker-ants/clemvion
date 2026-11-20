import { getMetadataArgsStorage } from 'typeorm';

import { Trigger } from './entities/trigger.entity';
import { CONFIG_INTERNAL_FIELDS } from './trigger-config-internal-fields';
import {
  CHAT_CHANNEL_CONFIG_KEY_RESPONSE,
  CHAT_CHANNEL_RESPONSE_STRIP_KEYS,
  INTERACTION_CONFIG_KEY_RESPONSE,
  INTERACTION_RESPONSE_STRIP_KEYS,
  NOTIFICATION_SIGNING_KEY_RESPONSE,
  NOTIFICATION_SIGNING_STRIP_KEYS,
  TRIGGER_COLUMN_RESPONSE,
  TRIGGER_RESPONSE_REDACT_COLUMNS,
  TRIGGER_RESPONSE_STRIP_COLUMNS,
} from './trigger-response-strip';

// 분류 표가 빠짐없는지는 `satisfies` 가 컴파일 단계에서 본다. 이 파일은 타입이 보지 못하는 두 자리를 본다.
// - 엔티티 표의 키와 TypeORM 이 실제로 매핑한 컬럼 · 관계가 같은가(타입에만 있고 DB 에 없는 필드, 그 반대).
// - 원시 `config` 로 받지 않는 서버 소유 키(`CONFIG_INTERNAL_FIELDS`)가 JSONB 표에서 `strip` 인가.
//   서버가 DTO 밖의 키를 JSONB 에 쓰면 표의 키 타입에 나타나지 않으므로 이 대조가 그 빈자리를 메운다.

const CONFIG_KEY_TABLES: Record<
  string,
  { prefix: readonly string[]; table: Readonly<Record<string, string>> }
> = {
  chatChannel: {
    prefix: ['chatChannel'],
    table: CHAT_CHANNEL_CONFIG_KEY_RESPONSE,
  },
  notificationSigning: {
    prefix: ['notification', 'signing'],
    table: NOTIFICATION_SIGNING_KEY_RESPONSE,
  },
  interaction: {
    prefix: ['interaction'],
    table: INTERACTION_CONFIG_KEY_RESPONSE,
  },
};

/** 경로가 어느 JSONB 표에 속하는지 찾고 그 표에서의 분류를 돌려준다. 맞는 표가 없으면 `undefined`. */
function classifyConfigPath(path: readonly string[]): string | undefined {
  for (const { prefix, table } of Object.values(CONFIG_KEY_TABLES)) {
    if (path.length !== prefix.length + 1) continue;
    if (!prefix.every((segment, i) => path[i] === segment)) continue;
    const key = path[prefix.length];
    return Object.hasOwn(table, key) ? table[key] : undefined;
  }
  return undefined;
}

describe('트리거 응답 분류 표', () => {
  it('엔티티 표의 키는 TypeORM 이 매핑한 컬럼 · 관계와 같다', () => {
    const storage = getMetadataArgsStorage();
    const mapped = [
      ...storage.columns
        .filter((column) => column.target === Trigger)
        .map((column) => column.propertyName),
      ...storage.relations
        .filter((relation) => relation.target === Trigger)
        .map((relation) => relation.propertyName),
    ].sort();

    expect(mapped.length).toBeGreaterThan(0);
    expect(Object.keys(TRIGGER_COLUMN_RESPONSE).sort()).toEqual(mapped);
  });

  it.each(CONFIG_INTERNAL_FIELDS.map(({ path }) => [path.join('.'), path]))(
    '원시 config 로 받지 않는 %s 는 JSONB 표에서 strip 이다',
    (_label, path) => {
      expect(classifyConfigPath(path)).toBe('strip');
    },
  );

  it('[대조군] 표에 없는 경로는 strip 으로 판정하지 않는다', () => {
    expect(classifyConfigPath(['chatChannel', 'noSuchKey'])).toBeUndefined();
    expect(classifyConfigPath(['chatChannel', 'provider'])).toBe('expose');
    expect(classifyConfigPath(['webhook', 'botTokenRef'])).toBeUndefined();
    expect(
      classifyConfigPath(['notification', 'signing', 'secretRef', 'x']),
    ).toBeUndefined();
  });

  // 손으로 적던 목록에서 표로 옮겼다. 응답 모양이 바뀌지 않았다는 것을 값으로 고정한다.
  // 표에서 import 한 값과 비교하면 표를 고쳐도 통과하므로 기대값은 리터럴로 적는다.
  it('지우는 엔티티 컬럼과 가리는 진단 컬럼', () => {
    expect([...TRIGGER_RESPONSE_STRIP_COLUMNS].sort()).toEqual([
      'chatChannelTokenV2',
      'notificationSecretV2',
    ]);
    expect([...TRIGGER_RESPONSE_REDACT_COLUMNS].sort()).toEqual([
      'chatChannelLastError',
      'notificationLastError',
    ]);
  });

  it('JSONB 안에서 지우는 키', () => {
    expect([...CHAT_CHANNEL_RESPONSE_STRIP_KEYS].sort()).toEqual([
      'botToken',
      'botTokenRef',
      'inboundSigning',
      'inboundSigningPlaintext',
      'inboundSigningRef',
    ]);
    expect([...NOTIFICATION_SIGNING_STRIP_KEYS].sort()).toEqual([
      'secret',
      'secretRef',
    ]);
    expect([...INTERACTION_RESPONSE_STRIP_KEYS]).toEqual(['triggerToken']);
  });
});
