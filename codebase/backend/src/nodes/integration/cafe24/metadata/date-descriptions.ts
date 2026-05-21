/**
 * Cafe24 metadata 의 date/time 필드 description 공통 상수.
 *
 * Spec: spec/conventions/cafe24-api-metadata.md §5.2.
 *
 * 도구 단위로는 `CAFE24_TIMEZONE_SUFFIX` 자동 suffix 가 KST 한 줄을 보강하지만,
 * field 단위 description 에도 §5.2 컨벤션 (`'ISO8601 date (KST, UTC+9) — ...'`)
 * 을 적용해 LLM 이 파라미터별로도 timezone semantics 를 인지하게 한다.
 *
 * 본 모듈의 상수들은 30+ 동일 패턴 row 의 description 을 한 곳에서 관리해
 * 표현 일관성을 보장한다. 의미상 동일한 두 표현 (start_date / since,
 * end_date / until) 은 별도 키로 두지 않고 같은 상수를 공유한다.
 */

const KST_NOTE = 'Naive ISO 도 Cafe24 가 KST 로 해석.';

/** since / start_date — date range 시작 (절대 시각). */
export const CAFE24_DATE_FIELD_SINCE = `ISO8601 date (KST, UTC+9) — range start (inclusive). e.g. "2026-05-18". ${KST_NOTE}`;

/** until / end_date — date range 종료 (절대 시각). */
export const CAFE24_DATE_FIELD_UNTIL = `ISO8601 date (KST, UTC+9) — range end (inclusive). e.g. "2026-05-31". ${KST_NOTE}`;

/** Promotion / event 의 시작 시각 (datetime, body 입력). */
export const CAFE24_DATETIME_FIELD_START = `ISO8601 datetime (KST, UTC+9) — promotion/event start time. e.g. "2026-05-18T00:00:00+09:00". ${KST_NOTE}`;

/** Promotion / event 의 종료 시각 (datetime, body 입력). */
export const CAFE24_DATETIME_FIELD_END = `ISO8601 datetime (KST, UTC+9) — promotion/event end time. e.g. "2026-05-31T23:59:59+09:00". ${KST_NOTE}`;
