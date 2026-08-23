# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

실질 코드 변경은 파일 1(`codebase/backend/test/terminal-duration-sql.e2e-spec.ts`, 신규 183줄)
하나뿐이다. 나머지(파일 2·3 은 plan/트래커 문서, 파일 4~22 는 직전(11:15/10:48) `/ai-review`·
`/consistency-check` 라운드의 산출물)는 코드가 아니므로 "가독성/네이밍/함수 길이/중첩/매직넘버/
중복/복잡도" 기준이 적용되지 않는다. 코드 파일은 전문을 직접 `Read` 로 확인했다(183줄, diff 와
줄 번호 일치 — 신규 파일이라 게이트=실제 소스 줄 번호).

## 발견사항

- **[INFO]** `toPgSql()` 과 `paramOccurrences()` 가 동일한 `.split(`:${TERMINAL_FINISHED_AT_PARAM}`)`
  호출을 각각 독립 수행한다 — 직전 라운드(`11_15_39`)의 INFO #2("`.split()` 중복 호출")를 "두
  함수로 분리"해 반영했다고 기록됐지만, 분리 후에도 **같은 split 키 계산이 두 곳에 중복**된다.
  - 위치: `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:57`(`toPgSql`), `:65`(`paramOccurrences`)
  - 상세: 두 함수 모두 `` TERMINAL_DURATION_MS_SQL.split(`:${TERMINAL_FINISHED_AT_PARAM}`) `` 를
    독립적으로 호출한다. 함수를 분리해 각각 단일 책임(치환 vs 개수)을 갖게 한 것은 가독성 면에서
    개선이지만, "치환 대상 문자열을 어떻게 자르는가"라는 지식 자체는 여전히 두 곳에 있다 —
    `TERMINAL_FINISHED_AT_PARAM` 앞에 붙는 구분자(`:`)를 바꾸거나 이스케이프 처리가 필요해지면
    두 곳을 함께 고쳐야 하고, 한쪽만 고치면 `paramOccurrences()` 의 vacuous-guard 가 실제 치환
    로직과 어긋난 채로 계속 통과할 수 있다. 실행 빈도(스위트당 1회)상 성능 문제는 아니며 순수한
    지식 중복 이슈다.
  - 제안: 분리 구조는 유지하되, split 결과 자체를 한 곳(예: 모듈 스코프의 `const PARTS = …split(…)`
    또는 `toPgSql()` 이 내부적으로 계산한 배열을 `paramOccurrences()` 에 재사용)에서만 계산하도록
    한 단계 더 좁힐 수 있다. 우선순위 낮음 — 두 함수가 각각 짧고 명확해 당장 위험은 낮다.

- **[INFO]** 중첩 `describe('스키마 전제', …)` 안의 로컬 헬퍼 `column()` 이름이 반환값의 성격을
  드러내지 않는다.
  - 위치: `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:159`(함수 선언부)
  - 상세: `column(name)` 은 컬럼 자체가 아니라 `information_schema.columns` 조회 결과 중
    `{ data_type: string } | null` 을 반환한다. 파일 상단의 `entityColumn()`(컬럼 **이름**을
    반환)과 이름이 유사해 나란히 읽을 때 "엔티티에서 이름을 얻고 → 실 스키마에서 그 컬럼(의 무엇)을
    얻는다"는 관계가 함수명만으로는 즉시 구분되지 않는다(둘 다 `it` 안에서 `entityColumn(...)` →
    `column(...)` 순으로 호출돼 혼동 가능성은 크지 않지만, 스코프가 좁아 발견 시점이 늦어질 수
    있다).
  - 제안: `columnDataType()` 또는 `schemaColumnType()` 처럼 반환값이 타입 정보임을 드러내는
    이름으로 바꾸면 `entityColumn()` 과의 역할 대비가 더 분명해진다. 지역 스코프(하위 `describe`
    내부)라 실질 위험은 낮음.

## 요약

유일한 실코드 변경(`terminal-duration-sql.e2e-spec.ts`)은 함수가 모두 짧고 단일 책임(엔티티
메타데이터 조회 2개, SQL 파라미터 치환/개수 2개, 쿼리 실행 헬퍼 2개)이며, 중첩은 최대 2단계
(`describe` 안 `describe` 안 `it`)로 얕고 순환 복잡도도 낮다. `PG_INT4_MAX * 4`, 클램프 컷오프
`it.each` 케이스 등 값에는 "왜 이 값인가"를 설명하는 JSDoc/인라인 주석이 충실히 붙어 있어 매직
넘버 문제가 실질적으로 없다. 기존 e2e 컨벤션(`@jest/globals`, `createDbClient()`, `[태그] 설명`
형식의 `it` 이름)과도 일관된다. 직전 리뷰 라운드의 INFO 지적 다수가 실제로 반영됐음을 확인했으나,
그중 "`.split()` 중복"은 함수 분리로 형태만 바뀌었을 뿐 지식 중복 자체는 남아 있다 — 다만 영향은
경미해 INFO 수준을 유지한다. 이번 라운드에서 새로 발견된 사항은 모두 INFO 급 사소한 명명·중복
이슈이며, 동작이나 향후 유지보수에 실질적 장애가 되지 않는다.

## 위험도

LOW
