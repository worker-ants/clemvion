# Code Review 통합 보고서

## 전체 위험도
**LOW** — 프로덕션 코드(security/requirement/scope/side_effect/maintainability/testing 6개 관점 전부 NONE) 자체는 안전하고 plan 요구사항과 정확히 일치. 유일한 결함은 documentation 관점의 WARNING 1건(테스트 파일 모듈 docstring 문단 오삽입 — 정보 오귀속, 런타임 영향 없음). forced whitelist(7개 reviewer) 전원 결과 확보됨 — 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 테스트 파일 모듈 docstring 에 새로 삽입된 "다섯 번째 describe" 문단이 "두 번째 describe" 설명 문장 하나를 물리적으로 갈라놓아, 그 문장("`409`·`410` 은 error 채널로 행사한다…")이 이제 다섯 번째 블록을 설명하는 것처럼 잘못 읽힌다. 다섯 번째 블록(`readKey`/`hashBody` 경계값)에는 실제로 409/410 error 채널 테스트가 없어 순수 misattachment. 파일이 확립한 "블록을 물리적 등장 순서대로 순번 요약" 관행에서 벗어남 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:11-45`(docstring 전체), 삽입부 `:22-28`, 재귀속된 문장 `:27-28` | "다섯 번째 describe" 문단(`:22-28`)을 "네 번째 describe" 문단(`:40-45`) 뒤로 옮기고, "`409`·`410` 은 error 채널로…" 문장(`:27-28`)을 원래 자리인 "두 번째" 설명(`:11-20`) 바로 뒤로 되돌린다 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 캐시 엔트리 `statusCode` 범위 검사(100–599)가 1xx 정보성 코드까지 "손상 아님"으로 허용 — 다만 이 값의 유일한 출처는 서버 자신이 2xx/409/410 만 적재하는 `storeEntry()`라 공격자 제어 불가능한 입력 경로 | `idempotency.interceptor.ts:397-403`(`isHttpStatusCode`), `:25-26`(상수) | 조치 불요 — `isErrorStatusCacheable()` 이 실제 화이트리스트를 별도로 담당 |
| 2 | security | 손상 캐시 엔트리 로그가 `describeShape()`(형태만)를 사용해 원본 값을 찍지 않음 — 긍정 관찰, 변경 없음 | `idempotency.interceptor.ts:406-410` | 조치 불요 |
| 3 | requirement | `statusCode` 유효성 검사가 `bodyHash` 비교보다 먼저 개입 — 동작은 합리적이나 "손상+불일치 동시 발생" 우선순위가 테스트로 명시 고정돼 있지 않음 | `idempotency.interceptor.ts` `intercept()`, 테스트 `spec.ts:1385-1430` | 급하지 않음. 추후 이 영역 재작업 시 조합 케이스 1건 추가해 캐너리로 고정 |
| 4 | requirement | (회색지대, SPEC-DRIFT 아님) `isHttpStatusCode()` 유효 범위(100~599)가 spec §R8 캐시 대상 닫힌 목록(2xx/409/410)보다 넓음 — R8 은 쓰기 경로를 규율하고 이 함수는 읽기 경로의 형태 방어(별개 관심사)라 spec 이 침묵하는 영역 | `idempotency.interceptor.ts:397-402`, spec `spec/5-system/14-external-interaction-api.md:1059`(R8) | 조치 불요 |
| 5 | side_effect | `isIdempotencyEntry()` 강화로 손상 `statusCode` 엔트리가 캐시 miss 로 강등돼 `logger.warn()` 신규 emit + 재처리 경로 발생 — CHANGELOG 에 명시된 의도된 변경 | `idempotency.interceptor.ts:383, 397-403` | 조치 불요 |
| 6 | side_effect | `rawKey === null` 전환이 `readKey()`의 "빈 문자열 미반환" 암묵적 계약에 새로 의존 — 현재는 안전, JSDoc 이 계약 명시 | `idempotency.interceptor.ts:112-113, 423-428` | 향후 `readKey` 수정 시 이 불변식 유지 확인 |
| 7 | side_effect | 공유 테스트 헬퍼 `makeContext()` 의 `body` 정규화 규약 변경(`opts.body ?? {}` → `'body' in opts ? opts.body : {}`) — 전 호출부 대조 결과 회귀 없음 확인 | `idempotency.interceptor.spec.ts` `makeContext()` | 향후 신규 호출부에서 "키 생략" vs "명시적 undefined" 혼동 주의 |
| 8 | maintainability | `err instanceof Error ? err.message : String(err)` 삼항식이 파일 내 4회 반복 — 기존 라운드부터 유예된 항목, 이번 diff 로 반복 횟수 증가 없음 | `idempotency.interceptor.ts:152, 247, 330, 338` | 조치 불요(기존 유예 유지), 5번째 호출부 생기면 헬퍼 추출 재검토 |
| 9 | maintainability | `intercept()` 가 여전히 ~120줄·7개 분기 — `resolveCacheHit()` 추출 리팩터는 의도적으로 이번 PR 범위에서 제외(백로그 항목화됨) | `idempotency.interceptor.ts` `intercept()` (:106-226) | 조치 불요 — 다음에 이 메서드를 만질 때 착수 |
| 10 | maintainability | 스펙 파일 1,467줄로 계속 증가 중, `key200`/`key201` 리터럴이 `MAX_KEY_LENGTH` 상수를 참조 못함(module-private) | `idempotency.interceptor.spec.ts:1224-1467, 1225-1226` | 조치 불요 — 구조적 제약, 유예 유지 |
| 11 | testing | 경계값 테스트 구조·spy 격리(11곳 `try/finally`)가 일관되게 적용됨 — 긍정 관찰 | `idempotency.interceptor.spec.ts:1224-1467` | 조치 불요 |
| 12 | testing | 뮤테이션 테스트 결과가 이번 라운드에서 재실행되지 않고 자기보고 기반 — 다만 두 차례 독립 라운드가 이미 재현/반증 완료 | `plan/in-progress/backend-lint-gate-broken-on-main.md:687-715` | 조치 불요 |
| 13 | testing | `readKey`/`hashBody` 가 module-private 라 전부 `intercept()` 경유로만 테스트 — 의도된 설계 | `idempotency.interceptor.spec.ts:25-26` | 조치 불요 |
| 14 | documentation | 이전 세 라운드의 documentation WARNING/INFO 전부 실제로 반영·정합 유지 확인(CHANGELOG, fail-open 5-path 표, JSDoc) | `CHANGELOG.md:3-19`, `idempotency.interceptor.ts:412-422, 66-74` | 없음 |
| 15 | scope | 이번 diff 는 plan 이 사전 명시한 단일 체크리스트 항목 + 선행 리뷰 라운드 WARNING fix 로 정확히 구성 — 범위 이탈 없음 | `git diff origin/main...HEAD --stat` 전체 | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `isHttpStatusCode()`/`rawKey === null` 모두 검증을 좁히는 방향, 신규 공격 표면 없음 |
| requirement | NONE | spec §R8 준수, 경계값 테스트 15건 실행 확인(56/56 pass), 회색지대 2건 모두 INFO |
| scope | NONE | plan 체크리스트 항목과 정확히 대응, 무관 변경 없음 |
| side_effect | NONE | 공개 인터페이스 불변, FS/네트워크/env 신규 부작용 없음 |
| maintainability | NONE | 신규 결함 없음, 기존 유예 항목만 잔존 |
| testing | NONE | 경계값 커버리지 촘촘, 테스트 격리 양호, 뮤테이션 재검증 완료 |
| documentation | LOW | 테스트 파일 docstring 문단 오삽입 1건(WARNING) |

## 발견 없는 에이전트

없음 (전 reviewer 가 최소 INFO 이상 기록, documentation 만 WARNING 보유).

## 권장 조치사항
1. `idempotency.interceptor.spec.ts` 모듈 docstring 의 "다섯 번째 describe" 문단(`:22-28`)을 파일 끝(네 번째 문단 뒤)으로 옮기고, "409/410 은 error 채널로…" 문장을 원래 위치(두 번째 설명 문단 뒤)로 되돌린다 (documentation WARNING #1).
2. 그 외 INFO 항목은 전부 조치 불요(기존 유예 유지 또는 의도된 설계) — 추가 조치 없이 병합 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — forced whitelist 전원 결과 확보됨(미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위 밖 (해당 없음) |
  | architecture | router 판단상 이번 diff 범위 밖 (해당 없음) |
  | dependency | package.json/lockfile 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | 공개 API 계약/DTO 변경 없음 |
  | user_guide_sync | 사용자 대면 문서 변경 없음 |
