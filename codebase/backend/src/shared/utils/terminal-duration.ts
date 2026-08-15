/**
 * 종결 이벤트(`completed`/`failed`/`cancelled`)의 `durationMs` 를 **한 곳에서** 결정한다.
 *
 * SoT: `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표.
 *
 * ## 왜 헬퍼인가 — 값의 출처가 경로마다 다르다
 *
 * 종결 emit 은 16 경로다. 그중
 *
 * - 대부분은 emit 직전에 `durationMs` 를 계산해 엔티티에 얹는다
 * - `finalizeStalledExhausted` 는 **엔티티를 로드하지 않는** raw UPDATE 라 값이 없다
 * - `emitCancellationEvent` 호출부 4곳은 계산도 영속도 하지 않는다
 *
 * 이 갈래를 emit 지점마다 손으로 처리하면 한 곳씩 빠진다 — 이 저장소의 반복 형태이고,
 * 직전 PR(#1170)이 `error` 를 같은 이유로 헬퍼에 묶었다.
 *
 * ## `startedAt` 을 낙관하지 않는다
 *
 * 엔티티상 `started_at` 은 non-nullable + DB default 지만, **부분 select 로 로드된 행**이나
 * 테스트 fixture 는 갖지 않을 수 있다. 실제로 이 필드를 계산하는 코드를 조건 블록 밖으로
 * 옮겼더니 `startedAt.getTime()` 이 throw 해 **종결 emit 자체가 사라지는** 회귀가 났다
 * (catch 가 삼켜 COMPLETED 가 FAILED 로 뒤집혔다). 계산 실패가 종결 흐름을 깨뜨려서는
 * 안 된다 — 여기서 `null` 로 흡수한다.
 *
 * @returns 밀리초. 알 수 없으면 **`null`** — `undefined` 를 돌려주면 JSON 직렬화에서
 *   키가 사라져 "필드가 없는 것" 과 "값을 모르는 것" 이 구분되지 않는다.
 */
export function resolveTerminalDurationMs(row: {
  durationMs?: number | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}): number | null {
  if (typeof row.durationMs === 'number' && Number.isFinite(row.durationMs)) {
    return row.durationMs;
  }
  const started = toMillis(row.startedAt);
  const finished = toMillis(row.finishedAt);
  if (started === null || finished === null) return null;
  const span = finished - started;
  // 음수는 시계 역행·잘못된 fixture 의 신호다. 그대로 실으면 수신자의 산술이 깨진다.
  return span >= 0 ? span : null;
}

function toMillis(v: Date | null | undefined): number | null {
  if (!(v instanceof Date)) return null;
  const t = v.getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * `RETURNING` 원본 행에서 온 값을 밀리초 숫자로 좁힌다.
 *
 * pg 드라이버는 `bigint`/`numeric` 을 **문자열**로 준다. `::int` 캐스팅을 했더라도
 * 드라이버·컬럼 타입 조합에 따라 형태가 갈리므로, 숫자로 좁히는 책임을 한 곳에 둔다.
 */
export function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * 엔티티를 로드하지 않는 raw UPDATE 에서 `duration_ms` 를 **같은 문장 안에서** 계산하는
 * SQL 식. `RETURNING` 으로 되받아 emit 에 실으면 DB 와 wire 가 같은 값을 쓴다.
 *
 * 손으로 5곳에 반복하면 갈린다 — 이 브랜치가 `error` 메시지에서 실제로 겪은 형태다
 * (DB 는 "attempts 소진", emit 은 "소진" 이었다).
 *
 * ## 두 가지 방어가 **필수**다 — 둘 다 실측으로 필요성이 드러났다
 *
 * 1. **`LEAST(2147483647, …)` 상한** — `duration_ms` 는 `INTEGER`(int4, 최대 ≈**24.8일**)다
 *    (`V001__initial_schema.sql:223`). 클램프가 없으면 `::int` 캐스팅이
 *    `integer out of range` 로 **UPDATE 문 전체를 실패시킨다.** 그런데 이 SQL 을 쓰는
 *    5경로는 하필 **오래 대기한 실행**(park·공개 위젯 idle-wait)을 취소·마감하는 자리라
 *    24.8일 초과가 정상 시나리오다. 실패는 catch 에 삼켜지고 실행은 그 상태에 **영구
 *    고착**된다 — "값이 부정확" 보다 훨씬 나쁘다. **saturate 시키고 취소는 성공시킨다.**
 * 2. **음수는 `NULL`** — 시계 역행 시 JS 경로({@link resolveTerminalDurationMs})가 `null` 을
 *    돌려주므로 SQL 도 같은 sentinel 을 내야 한다. 종전엔 `GREATEST(0, …)` 로 **`0`** 을
 *    내서, 같은 이상 상황에 수신자가 "알 수 없음" 과 "0ms 만에 끝남" 중 무엇을 받을지가
 *    경로에 따라 갈렸다.
 *
 * 바인딩할 파라미터 이름은 {@link TERMINAL_FINISHED_AT_PARAM}.
 */
export const TERMINAL_DURATION_MS_SQL =
  'CASE WHEN :terminalFinishedAt::timestamptz < started_at THEN NULL ' +
  'ELSE LEAST(2147483647, (EXTRACT(EPOCH FROM (:terminalFinishedAt::timestamptz - started_at)) * 1000)::bigint)::int ' +
  'END';

/** {@link TERMINAL_DURATION_MS_SQL} 이 기대하는 파라미터 이름. */
export const TERMINAL_FINISHED_AT_PARAM = 'terminalFinishedAt';
