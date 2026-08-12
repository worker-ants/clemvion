# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 핵심 fix(Redis `get()` 런타임 실패를 `catchError` 로 캐시 미스 강등)는 spec(`spec/data-flow/15-external-interaction.md`)이 명시적으로 요구한 "전 경로 fail-open" 을 정확히 완성하며, `catchError` 위치(`switchMap` 앞)는 8개 reviewer 전원이 독립적으로 재검증해 정확함을 확인했다(직전 라운드 documentation 리뷰어의 "순서 역전" CRITICAL 은 공유 워크트리 뮤테이션 아티팩트였음이 재확인됨 — 코드 결함 아님). WARNING 2건은 모두 (1) spec 이 이미 승인한 트레이드오프의 잔여 리스크와 (2) 리뷰 처분 기록의 사소한 부정확성으로, 머지를 막을 사안이 아니다.

forced reviewer 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨. router 가 선별한 concurrency 포함 8명 전원 정상 실행·전문 확보 — 재시도 필요 항목 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency | Redis `get()` fail-open 이 선재하는 GET→SET 비원자 구조와 결합해, 종전엔 캐시 응답 왕복 시간(수 ms) 내 동시 도착 시에만 발생하던 "동일 Idempotency-Key 중복 다운스트림 실행" 위험이 이번 fix 이후엔 **Redis 장애 지속 구간 전체**로 넓어진다 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:98-113`(신설 `catchError`), `:174-180`(기존 `cacheTapped()` SET, 미변경) | spec 이 명시적으로 승인한 가용성 우선 트레이드오프이며 이미 클래스 docstring·`CHANGELOG.md`·`plan/in-progress/backend-lint-gate-broken-on-main.md`(관측 지표·`SET NX EX` 검토 백로그)로 문서화·추적됨. 코드 되돌릴 필요 없음 — 다만 관측 지표(Redis GET 실패율 알람)가 실제 구현되기 전까지 운영이 이 구간을 인지할 수단이 없다는 점은 남는 리스크 |
| 2 | documentation | 직전 라운드 `RESOLUTION.md` 의 처분 기록이 실제로 이뤄지지 않은 조치를 "완료"로 적음 — "헤더는 갱신함"이라 기록했으나 실제로 갱신된 것은 `idempotency.interceptor.ts` 클래스 docstring 뿐이고, `idempotency.interceptor.spec.ts` 파일 최상단 헤더 docstring(신규 3번째 describe 블록 미언급)은 그대로다 (maintainability·testing 리뷰어도 동일 사실을 INFO 로 독립 확인) | `review/code/2026/08/12/14_27_02/RESOLUTION.md:92`, `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1-14` (신규 3번째 블록: `:339-349`) | `RESOLUTION.md:92` 문구를 실제 상태에 맞게 정정("헤더 docstring 은 미반영, 각 describe 지역 docstring 으로 충분하다고 판단해 보류")하거나, 지금 헤더에 "세 번째 describe: Redis 런타임 장애 fail-open(조회 실패·적재 실패·non-Error reject)" 한 줄 추가. 후속 세션이 이 기록을 SoT 로 신뢰해 "이미 처리됨"으로 오판하지 않도록 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / side_effect / concurrency (통합) | Redis `get()` fail-open 이 Idempotency-Key 중복 억제를 장애 구간 동안 무력화 — spec 이 명시적으로 요구한 설계이며 CHANGELOG·docstring·plan 백로그에 이미 문서화·유예됨 (WARNING #1 의 근본 원인과 동일, 상세는 그쪽 참고) | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:107-112` | 조치 불요 |
| 2 | security | Redis 에러 메시지는 서버 로그에만 기록, 클라이언트 미노출 — 정보 노출 취약점 아님 | `idempotency.interceptor.ts:108-110`, `:176-179` | 조치 불요 |
| 3 | security / concurrency (선재) | 캐시 제외 범위(`statusCode >= 400`)가 spec R8 보다 넓어 409·410 도 캐시에서 빠짐 — 이번 diff 로 인한 변경 아니며 `plan/in-progress/backend-lint-gate-broken-on-main.md:534-548` 에 미해결로 추적 중 | `idempotency.interceptor.ts:159-161` | 조치 불요(스코프 밖, 추적 중) |
| 4 | scope | `bodyHashOf` 헬퍼를 모듈 최상단으로 옮긴 것은 핵심 fix 대비 소규모 리팩토링이나, 직전 라운드 maintainability WARNING #3 을 그 자리에서 조치한 것으로 CLAUDE.md 가 규정한 "review-fix 는 상시 승인된 강제 단계"에 해당 | `idempotency.interceptor.spec.ts:89-93` | 조치 불요 |
| 5 | scope | `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 체크박스 완료 표시 외 신규 백로그 항목(관측·중복 억제) 추가 — concurrency WARNING #1 을 "되돌리지 않고 유예"한 정상적 후속 조치 | `plan/in-progress/backend-lint-gate-broken-on-main.md:524-530` | 조치 불요 |
| 6 | scope / side_effect | 직전 리뷰 라운드(`14_27_02`) 산출물 12개 파일(RESOLUTION.md·SUMMARY.md·개별 reviewer md·meta.json·_retry_state.json)이 이번 diff 에 신규 파일로 함께 포함 — `review/` 는 SoT 관례상 커밋 대상이라 스코프 이탈 아님, 다만 diff 를 읽는 사람에게는 노이즈 | `review/code/2026/08/12/14_27_02/*` | 조치 불요(참고) |
| 7 | maintainability | GET/SET 캐시 실패 로그 메시지 조립·`instanceof Error` 판별 로직이 두 자리(신규 `catchError`, 기존 `cacheTapped()`)에서 중복 — 직전 라운드에 이미 지적·의도적으로 유예됨, 새로 늘어난 것 아님 | `idempotency.interceptor.ts:107-112`, `:174-180` | 낮은 우선순위. `warnCacheFailure(op, err)` 로 추출 고려(3번째 실패 경로 추가 시 재검토) |
| 8 | maintainability / testing / documentation (통합) | 테스트 파일 헤더 docstring·3번째 describe 블록 지역 docstring 이 신규 테스트 2건(set 실패·non-Error reject)을 반영하지 않음 — WARNING #2 와 동일 근본 원인 | `idempotency.interceptor.spec.ts:1-14`, `:339-349` | 헤더/블록 docstring 에 한 줄 추가(선택) |
| 9 | requirement | 전 라운드 documentation CRITICAL("`catchError` 가 `switchMap` 뒤" 순서 역전)은 이번 라운드 재검증으로도 오탐 확정 — 소스 직접 확인(107행 < 113행) + 16/16 테스트 통과 | `idempotency.interceptor.ts:107,113` | 조치 불요 |
| 10 | requirement | 클래스 docstring "fail-open 세 경로 모두" 주장이 이제 테스트로 전부 뒷받침(생성자 null·조회 실패·적재 실패) — 전 라운드 testing INFO 4·5 해소 확인 | `idempotency.interceptor.spec.ts:414-464` | 조치 불요 |
| 11 | concurrency | GET→SET 비원자 구간 자체는 선재 구조이며 이번 diff 의 신규 결함 아님(정상 동작 시에도 응답 왕복 시간 내 동시 도착이면 발생 가능) | `idempotency.interceptor.ts:98`, `:174-180` | 스코프 밖 유지 가능, 후속으로 `SET NX EX` 검토 권장(이미 backlog) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음. fail-open 은 spec 승인 설계, catchError 위치 재검증 정상 |
| requirement | NONE | spec fidelity 전 항목 일치. 전 라운드 CRITICAL 오탐 재확인, WARNING 3건 전부 해소 확인 |
| scope | NONE | 핵심 diff 는 단일 의도(fail-open fix)에 수렴. 부수 리팩토링·plan 갱신은 사전 승인된 review-fix 산출물 |
| side_effect | LOW | fail-open 에 따른 다운스트림 중복 실행 가능성은 실재하나 이미 문서화·유예됨. 신규 미승인 부작용 없음 |
| maintainability | LOW | 함수 길이·중첩·매직넘버 문제 없음. 로그 포맷 중복(의도적 유예)·헤더 docstring 갱신 누락만 INFO |
| testing | LOW | 신규 테스트 2건 뮤테이션으로 판별력 실측 확인(16/16). 헤더 docstring 갱신 누락만 잔여 |
| documentation | LOW | CHANGELOG·bodyHashOf 정리·plan 체크박스는 정확. RESOLUTION.md 처분 기록 1건이 실제 상태와 불일치(WARNING) |
| concurrency | MEDIUM | catchError 위치는 정상이나, fail-open 이 GET→SET 비원자 구조와 결합해 Redis 장애 구간 동안 중복 실행 위험 창이 넓어짐(spec 승인 트레이드오프, 관측 백로그 존재) |

## 발견 없는 에이전트

없음 (전원 최소 INFO 이상 발견 보고).

## 권장 조치사항

1. `review/code/2026/08/12/14_27_02/RESOLUTION.md:92` 의 처분 기록을 실제 상태에 맞게 정정하거나, `idempotency.interceptor.spec.ts` 헤더/3번째 describe 블록 docstring 에 신규 fail-open 테스트 2건을 반영하는 한 줄을 추가한다 — 이후 세션이 잘못된 "이미 처리됨" 기록을 신뢰하지 않도록.
2. Redis 장애 구간 동안의 Idempotency-Key 중복 억제 무력화는 spec 승인 트레이드오프이므로 코드 변경 불필요. 다만 `plan/in-progress/backend-lint-gate-broken-on-main.md` 백로그의 관측 지표(Redis GET 실패율 알람) 항목을 조속히 구현해 운영이 이 구간을 인지할 수 있게 한다.
3. (선택, 낮은 우선순위) GET/SET 캐시 실패 로그 조립 로직 2곳 중복을 `warnCacheFailure(op, err)` 헬퍼로 통합 — 3번째 실패 경로가 추가되는 시점에 재검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)
  - **제외**: 6명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(RxJS 연산자 1개 추가) 와 낮은 관련성 |
  | architecture | router 판단상 이번 diff 와 낮은 관련성(구조 변경 없음) |
  | dependency | router 판단상 이번 diff 와 낮은 관련성(신규 의존성 없음) |
  | database | router 판단상 이번 diff 와 낮은 관련성(DB 접근 없음) |
  | api_contract | router 판단상 이번 diff 와 낮은 관련성(API 계약 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff 와 낮은 관련성(사용자 가이드 대상 아님) |
