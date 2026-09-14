import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  CANONICAL_CONST,
  CANONICAL_SOURCE,
  MIRROR_CONST,
  MIRROR_SOURCES,
  readAllTriggerSecretColumnLists,
  readStringArrayConst,
} from './trigger-secret-columns-guard';

/**
 * 트리거 응답 **비밀 컬럼 목록**이 세 파일에 독립 사본으로 존재한다 — 그 셋의 동일성 가드.
 *
 * | 자리 | 상수 | 성격 |
 * |---|---|---|
 * | `modules/triggers/triggers.service.ts` | `TRIGGER_RESPONSE_STRIP_COLUMNS` | **정본** — 실제로 응답에서 지운다 |
 * | `shared/testing/schedule-trigger-ref.ts` | `TRIGGER_SECRET_COLUMNS` | 사본 |
 * | `shared/testing/trigger-workflow-ref.ts` | `TRIGGER_SECRET_COLUMNS` | 사본 |
 *
 * ## 왜 런타임 공유가 아니라 정적 가드인가
 *
 * 정본이 `export` 가 아니고, 서비스 모듈을 테스트 헬퍼로 끌어오는 것은 의존 그래프상 과하다
 * (헬퍼는 `shared/testing/` 이고 `modules/` 를 향한 역방향 의존을 만든다). 그래서 값을
 * 공유하는 대신 **세 리터럴이 같다는 사실만** 정적으로 고정한다.
 *
 * ## 왜 필요한가 — 오늘 일치한다는 사실이 내일을 보장하지 않는다
 *
 * 세 목록은 **값·순서가 현재 완전히 일치**한다. 결속 장치가 없다는 것이 문제다: 정본이 네
 * 번째 비밀 컬럼을 추가해도 두 헬퍼는 **조용히 통과**하고, 그 헬퍼를 쓰는 e2e 는 새 컬럼이
 * 응답에 실려도 잡지 못한다. `CREATOR_PROJECTION` 이 이 형태의 가까운 이력이다 — 동일 리터럴
 * 4중 복사가 실제 Critical 로 터진 뒤 단일 상수로 통합됐다.
 *
 * ## self-spec 의 네 번째 사본은 대상이 아니다
 *
 * `trigger-workflow-ref.spec.ts` 가 같은 이름들을 또 적는 것은 **일부러**다. 헬퍼 상수를
 * import 해 순회하면 누가 목록을 줄여도 스펙이 그대로 통과해 대조군이 사라진다.
 * 헬퍼↔프로덕션 중복은 드리프트 위험이지만 **스펙↔헬퍼 중복은 독립 대조군**이다.
 */
describe('트리거 비밀 컬럼 목록 3중 사본 정합', () => {
  const repoRoot = path.resolve(__dirname, '../../../../..');

  it('세 목록이 값·순서까지 같다', () => {
    const lists = readAllTriggerSecretColumnLists(repoRoot);
    const canonical = lists[CANONICAL_SOURCE];
    expect(canonical).not.toBeNull();
    for (const rel of MIRROR_SOURCES) {
      expect(lists[rel]).toEqual(canonical);
    }
  });

  it('[vacuity] 목록이 비어 있지 않다 — 셋 다 읽혔다', () => {
    // 리더가 조용히 `[]`·`null` 을 내면 위 단언이 «세 개가 다 비었으니 같다» 로 통과한다.
    // 그 상태를 여기서 먼저 끊는다.
    const lists = readAllTriggerSecretColumnLists(repoRoot);
    for (const [rel, value] of Object.entries(lists)) {
      expect(value === null ? `${rel}: 못 읽음` : value.length).not.toBe(0);
      expect(value).not.toBeNull();
    }
  });

  it('[대조군] 정본은 `as const satisfies …`, 사본은 `as const` — 둘 다 읽는다', () => {
    // **이 가드의 판별 자리다.** `AsExpression` 하나만 벗기는 리더는 정본에서 `null` 을 낸다
    // (`satisfies` 노드에서 멈춰 배열 리터럴에 도달하지 못한다 — 뮤턴트 실측).
    // 실제 파일이 그 두 형태를 실제로 쓰고 있음을 먼저 고정하고(전제가 바뀌면 여기서 터진다),
    // 그 다음 둘 다 읽히는지 본다.
    const canonicalText = fs.readFileSync(
      path.join(repoRoot, CANONICAL_SOURCE),
      'utf8',
    );
    expect(canonicalText).toContain(`${CANONICAL_CONST} = [`);
    expect(canonicalText).toContain('as const satisfies');

    const mirrorText = fs.readFileSync(
      path.join(repoRoot, MIRROR_SOURCES[0]),
      'utf8',
    );
    expect(mirrorText).toContain(`${MIRROR_CONST} = [`);

    const lists = readAllTriggerSecretColumnLists(repoRoot);
    expect(lists[CANONICAL_SOURCE]?.length).toBeGreaterThan(0);
    expect(lists[MIRROR_SOURCES[0]]?.length).toBeGreaterThan(0);
  });

  describe('[대조군] `readStringArrayConst` 가 무엇을 읽고 무엇을 거절하는가', () => {
    let tmp: string;

    beforeAll(() => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trigger-secret-columns-'));
    });
    afterAll(() => {
      fs.rmSync(tmp, { recursive: true, force: true });
    });

    const write = (name: string, body: string): string => {
      fs.writeFileSync(path.join(tmp, name), body, 'utf8');
      return name;
    };

    it('주석 안의 이름은 값으로 잡지 않는다 (정규식이었다면 잡힌다)', () => {
      const rel = write(
        'commented.ts',
        [
          '// 목록: notificationSecretV2 · chatChannelTokenV2 (산문)',
          "/** 예시: ['ghostColumn'] 이 아니다. */",
          "const X = ['realOnly'] as const;",
          'export default X;',
        ].join('\n'),
      );
      expect(readStringArrayConst(tmp, rel, 'X')).toEqual(['realOnly']);
    });

    it('`as const satisfies …` 도 벗긴다', () => {
      const rel = write(
        'satisfies.ts',
        "const X = ['a', 'b'] as const satisfies readonly string[];\nexport default X;",
      );
      expect(readStringArrayConst(tmp, rel, 'X')).toEqual(['a', 'b']);
    });

    it('래퍼가 없어도 읽는다', () => {
      const rel = write('bare.ts', "const X = ['a'];\nexport default X;");
      expect(readStringArrayConst(tmp, rel, 'X')).toEqual(['a']);
    });

    it('선언이 없으면 `null` — 빈 배열과 가른다', () => {
      const rel = write(
        'missing.ts',
        "const Y = ['a'] as const;\nexport default Y;",
      );
      expect(readStringArrayConst(tmp, rel, 'X')).toBeNull();
    });

    it('빈 배열은 `[]` — «못 읽음» 이 아니다', () => {
      const rel = write(
        'empty.ts',
        'const X = [] as const;\nexport default X;',
      );
      expect(readStringArrayConst(tmp, rel, 'X')).toEqual([]);
    });

    it('문자열이 아닌 원소가 섞이면 `null` — 조용히 짧아지지 않는다', () => {
      // 짧아진 채로 통과하면 세 사본이 "같다" 는 거짓 GREEN 이 나온다.
      const rel = write(
        'spread.ts',
        "const BASE = ['a'] as const;\nconst X = [...BASE, 'b'] as const;\nexport default X;",
      );
      expect(readStringArrayConst(tmp, rel, 'X')).toBeNull();
    });
  });
});
