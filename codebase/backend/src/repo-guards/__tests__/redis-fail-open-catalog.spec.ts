import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  RECORDER_FN,
  UNION_SOURCE,
  componentsOf,
  findUndeclaredPairs,
  findUnwiredPairs,
  findWiredCalls,
  parseReasonMap,
  readReasonMap,
  stringLiteralsOf,
  wiredCallsInSource,
  wiredPairsOf,
} from './redis-fail-open-catalog-guard';

/**
 * `clemvion.redis.fail_open` 의 (`component`, `reason`) 라벨 쌍 — **코드 선언 · 실배선 정합 가드**.
 * 파일 이름의 `catalog` 는 스펙 카탈로그 행까지 대조하던 시절의 이름이다.
 *
 * NERV `CLE-OBS-LOGGING` 의 Rationale «`clemvion.redis.fail_open` 의 `component` 는 실제로 연결한
 * 값만 둔다» 가 이 가드의 근거다: 라벨 집합이 구현보다 넓으면 카운터의 `0` 이
 * **"정상(장애 없음)"** 인지 **"미계측(아무도 안 부름)"** 인지 구분되지 않는다. 그래서 두 집합이
 * 같아야 한다.
 *
 * 1. `RedisFailOpenReasonMap` 의 (component, reason) 쌍 (`business-metrics.service.ts`)
 * 2. 프로덕션 코드가 실제로 `recordRedisFailOpen(<component>, <reason>)` 에 넘기는 쌍
 *
 * 2026-11-12 (NERV Task `CLE-T-7ER0Y0` · `CLE-T-DM3AXQ` 항목 14) 에 대조 단위를 component 에서
 * (component, reason) 쌍으로 넓혔다. component 만 보면 reason 하나를 빼먹은 배선이 통과한다.
 *
 * **스펙 카탈로그 표는 대조하지 않는다.** 표의 정본은 NERV `CLE-OBS-LOGGING` 「비즈니스
 * 메트릭 카탈로그」 다. 사람이 고치는 문서라 저장소가 표기를 정하지 못하고, 저장소 미러는
 * 구현 PR 이 받은 스냅샷이다. 표와 코드의 정합은 일관성 검토가 본다. 그 문서의
 * 「구현 위치」 가 `business-metrics.service.ts` 를 덮으므로 쌍을 바꾼 변경에
 * `--impl-done` 을 돌리면 그 문서가 검토 대상에 든다. 강제는 아니다. 자동 대조를 되살리지
 * 않기로 한 것은 NERV Task `CLE-T-DM3AXQ` 항목 14 의 사람 결정(2026-11-12)이다.
 *
 * **왜 이 가드가 필요한가 — 이것도 "부재 주장" 이다.** 새 소비자를 배선하면서 선언 확장을
 * 잊으면 타입이 막는다. 반대로 선언만 넓히고 배선을 잊으면 **조용히 통과**한다. 그 경우가
 * 특히 나쁘다 — 대시보드에 라벨이 있는데 값이 영원히 0이면 운영자는 "그 경로는 건강하다"
 * 고 읽는다.
 *
 * **배선 범위.** 2026-08-29 실측으로 Redis 를 만지며 fail-open 하는 서비스 중 배선된 것은
 * EIA 멱등 인터셉터 하나였다. 2026-11-12 (NERV Task `CLE-T-7ER0Y0`) 에 Redis 명령이 실패하면
 * 잡고 계속 진행하는 서비스 13곳을 더 배선했다. Redis 미설정(클라이언트 `null`)으로 기능을
 * 끄는 경로와 초기화 실패는 세지 않는다. 장애가 아니라 구성 상태이기 때문이다. 새 fail-open
 * 서비스를 배선하지 않고 두는 것을 이 가드가 막지는 않는다. 이 가드가 막는 것은
 * **"선언을 넓히면서 배선을 빠뜨리는 것"** 이다.
 */
describe('clemvion.redis.fail_open (component, reason) 선언 · 실배선 정합', () => {
  const repoRoot = path.resolve(__dirname, '../../../../..');
  const srcDir = path.resolve(__dirname, '../..');
  // 프로덕션 소스 전수를 한 번만 읽는다.
  const calls = findWiredCalls(srcDir);
  const wired = wiredPairsOf(calls);
  const declared = readReasonMap(repoRoot);

  it('선언한 모든 쌍이 프로덕션 호출부를 가진다 (라벨이 구현보다 넓지 않다)', () => {
    // 선언에만 있고 아무도 안 부르는 쌍이 있으면, 그 라벨의 0 은 "정상" 이 아니라 "미계측" 이다.
    expect(findUnwiredPairs(declared, wired)).toEqual([]);
  });

  it('호출부가 내는 모든 쌍이 선언돼 있다', () => {
    expect(findUndeclaredPairs(declared, wired)).toEqual([]);
  });

  it('모든 호출부의 component · reason 인자가 정적으로 해석된다', () => {
    // 해석 실패(`null`)를 허용하면 위 단언이 조용히 좁아진다 — 못 읽은 호출부는
    // "배선 안 된 것" 과 구분되지 않기 때문이다. 동적 값이 필요해지면 가드를 먼저 고쳐라.
    expect(
      calls.filter((c) => c.component === null || c.reasons === null),
    ).toEqual([]);
  });

  it('현재 배선된 component 는 14개다 (넓어지면 여기서 알린다)', () => {
    // 이 단언은 "고정" 이 아니라 **알림**이다. 새 소비자를 배선하면 여기가 RED 가 되고,
    // 그때 선언을 함께 넓혔는지 위 단언들이 확인한다. `CLE-OBS-LOGGING` 카탈로그 표도
    // 함께 넓힌다(NERV 스펙 초안). 값을 늘릴 때 이 줄을 같이 늘리는 것이 곧 체크리스트다.
    expect(componentsOf(declared)).toEqual([
      'cafe24_install_lockout',
      'cafe24_install_nonce',
      'chat_conversation',
      'chat_dedup',
      'chat_listener_bus',
      'chat_rate_limit',
      'execution_seq',
      'idempotency',
      'integration_cache_bus',
      'interaction_rate_limit',
      'outbound_rate_limit',
      'public_webhook_quota',
      'sse_fanout',
      'token_blacklist',
    ]);
  });

  describe('가드 자체의 판별력', () => {
    it('선언에만 있는 쌍을 미배선으로, 호출부에만 있는 쌍을 미선언으로 낸다 (합성 입력)', () => {
      const a = { component: 'chat_dedup', reason: 'set_failed' };
      const b = { component: 'chat_dedup', reason: 'del_failed' };
      // component 는 배선됐지만 reason 하나가 빠진 경우 — component 단위 대조는 이걸 못 잡았다.
      expect(findUnwiredPairs([a, b], [a])).toEqual([b]);
      expect(findUnwiredPairs([a, b], [a, b])).toEqual([]);
      expect(findUndeclaredPairs([a], [a, b])).toEqual([b]);
      expect(findUndeclaredPairs([a, b], [a])).toEqual([]);
    });

    it('풀지 못한 호출부는 어떤 쌍도 배선한 것으로 치지 않는다', () => {
      expect(
        wiredPairsOf([
          { file: 'a.ts', component: null, reasons: ['get_failed'] },
          { file: 'b.ts', component: 'idempotency', reasons: null },
        ]),
      ).toEqual([]);
    });

    it('선언은 AST 로 읽는다 — 주석 속 예시는 값이 아니다', () => {
      const src = `
        // interface RedisFailOpenReasonMap { fake: 'nope' }
        export interface RedisFailOpenReasonMap {
          /** 예: 'commented' */
          alpha: 'a1' | 'a2';
          beta: 'b1';
        }
        export interface Other { gamma: 'g1' }
      `;
      expect(parseReasonMap('x.ts', src)).toEqual([
        { component: 'alpha', reason: 'a1' },
        { component: 'alpha', reason: 'a2' },
        { component: 'beta', reason: 'b1' },
      ]);
    });

    it('호출부 인자를 리터럴 · const(satisfies) · 삼항으로 푼다', () => {
      const src = `
        const C = 'alpha' satisfies string;
        class S {
          a() { this.m?.${RECORDER_FN}('beta', 'b1'); }
          b(x: boolean) { this.m?.${RECORDER_FN}(C, x ? 'a1' : 'a2'); }
        }
      `;
      expect(wiredCallsInSource('s.ts', src)).toEqual([
        { file: 's.ts', component: 'beta', reasons: ['b1'] },
        { file: 's.ts', component: 'alpha', reasons: ['a1', 'a2'] },
      ]);
    });

    it('helper 의 매개변수로 넘긴 reason 은 같은 파일의 호출부를 한 단계 따라간다', () => {
      const src = `
        class S {
          one() { this.degrade('x', 'r1', e); }
          two() { p.catch((e) => this.degrade('y', 'r2', e)); }
          private degrade(op: string, reason: R, err: unknown) {
            this.m?.${RECORDER_FN}('sse_fanout', reason);
          }
        }
      `;
      expect(wiredCallsInSource('s.ts', src)).toEqual([
        { file: 's.ts', component: 'sse_fanout', reasons: ['r1', 'r2'] },
      ]);
    });

    it('따라간 호출부 중 하나라도 못 풀거나 호출부가 없으면 null 이다', () => {
      const dynamic = `
        class S {
          one() { this.degrade('r1'); }
          two(r: string) { this.degrade(r); }
          private degrade(reason: R) { this.m?.${RECORDER_FN}('c', reason); }
        }
      `;
      expect(wiredCallsInSource('s.ts', dynamic)[0].reasons).toBeNull();
      const orphan = `
        class S {
          private degrade(reason: R) { this.m?.${RECORDER_FN}('c', reason); }
        }
      `;
      expect(wiredCallsInSource('s.ts', orphan)[0].reasons).toBeNull();
    });

    it(`상수를 거쳐 넘기는 ${RECORDER_FN} 호출부도 값을 해석한다`, () => {
      // 정본 호출부(`idempotency.interceptor.ts`)가 문자열 리터럴이 아니라 `METRICS_COMPONENT`
      // 상수를 넘긴다. 상수 추적이 없으면 그 호출부가 통째로 안 보이고, 그 상태에서도 위
      // "모든 쌍이 호출부를 가진다" 가 **거짓 RED** 가 아니라 조용한 오판이 된다.
      const idem = calls.filter((c) =>
        c.file.includes('idempotency.interceptor.ts'),
      );
      expect(idem.length).toBeGreaterThan(0);
      expect(idem.every((c) => c.component === 'idempotency')).toBe(true);
    });

    it(`선언 소스 경로(${UNION_SOURCE}) 가 실재하고 쌍을 읽어 낸다`, () => {
      // 현재 저장소 상태에서 경로가 실재함만 본다 — 옮겨졌을 때의 실패 모드 자체는
      // 아래 별도 케이스가 scratch 경로로 직접 검증한다.
      expect(fs.existsSync(path.join(repoRoot, UNION_SOURCE))).toBe(true);
      expect(declared.length).toBeGreaterThan(componentsOf(declared).length);
    });

    it('선언 소스 파일이 없으면 빈 배열이 아니라 throw 한다 (ENOENT)', () => {
      // 파일이 옮겨진 상태를 scratch 빈 디렉터리로 직접 재현한다 — 빈 배열로 조용히
      // 통과하면 위 정합 단언이 `[] === []` 로 공허해진다.
      const tmp = fs.mkdtempSync(
        path.join(os.tmpdir(), 'redis-failopen-guard-union-'),
      );
      try {
        expect(() => readReasonMap(tmp)).toThrow();
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it('가드 두 파일의 문자열 리터럴에 스펙 트리 경로가 없다', () => {
      // 옛 트리는 전환 단계 5 에서 지운다. 가드가 다시 그 아래 파일을 읽으면 그날 깨진다.
      // 경로는 문자열로만 만들 수 있으므로 두 파일의 문자열 리터럴 전수를 본다. 주석은
      // 리터럴이 아니라서 옛 경로를 이력으로 적어도 걸리지 않는다. 판정은 정규식 리터럴로
      // 한다. 이 파일도 검사 대상이라 비교용 문자열을 두면 자기 자신이 걸린다.
      const files = [
        path.join(__dirname, 'redis-fail-open-catalog-guard.ts'),
        __filename,
      ];
      const literals = files.flatMap((f) =>
        stringLiteralsOf(f, fs.readFileSync(f, 'utf8')),
      );
      expect(literals.length).toBeGreaterThan(10); // 리터럴을 실제로 걷었다
      expect(literals.filter((s) => /^spec$|(^|\/)spec\//.test(s))).toEqual([]);
    });
  });
});
