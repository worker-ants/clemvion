# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음, WARNING 1건(문서 주석이 spec §R8 을 반대로 인용, 런타임 무영향). forced(router_safety) 화이트리스트 8명 전원 결과 확보 확인됨 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation / requirement (중복 통합) | `idempotency.interceptor.ts` 의 기존 주석 3곳(클래스·필드·`cacheTapped()` docstring)이 캐시 제외 범위를 "4xx 전체" 로 서술해 Spec EIA §R8(`400 VALIDATION_ERROR` 만 제외, 409/410 은 캐시)과 정반대로 말한다. 같은 PR 이 이번 라운드에서 테스트 이름의 동일한 §R8 오귀속은 정확히 고쳤으면서(`4xx 응답은...` → `400 VALIDATION_ERROR 는...`) 소스 주석은 그대로 두어 테스트 파일과 소스 파일이 서로 모순된 이야기를 한다. | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:42`(필드 docstring), `:54-55`(클래스 docstring), `:118`(`cacheTapped()` JSDoc, requirement/documentation 리뷰어 공통 지목) | 주석 텍스트만 §R8 원문(400 VALIDATION_ERROR 한정)에 맞게 정정 + "현재 구현은 `>= 400` 전체를 제외한다(선재 결함, plan §후속·409 캐너리 테스트 참조)" 병기. 런타임 로직·emit 바이트는 변경 없으므로 이 PR 의 "타입 전용" 정체성을 깨지 않고 즉시 반영 가능. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | idempotency 캐시 제외 조건(`statusCode >= 400`)이 Spec EIA §R8 보다 넓어 409/410 응답도 캐시되지 않음 — 선재 결함(2026-05-21 원본부터), 이번 PR 은 타입만 추가해 미접촉. 캐너리 테스트·plan 백로그로 이미 추적 중. WARNING #1 의 근본 원인. | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:131` | 이번 PR 범위 밖. 후속 세션에서 캐시 제외 조건을 `VALIDATION_ERROR` 케이스로 좁히되 `=== 400` 단순 치환은 다른 400 서브코드·5xx 캐시 오류를 유발하니 주의. |
| 2 | security | admission-control 쿼리(`m.query<{ id: string }[]>`)의 SQL 결과 shape 이 런타임 검증 없이 신뢰됨(선재 패턴). 실패 시 fail-closed(거부) 방향이라 위험 방향은 아님. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2911, 2922` | 필수 아님. 원한다면 `Array.isArray(rows)` 런타임 가드 추가 검토(3라운드 연속 유예). |
| 3 | scope | "lint 타입 주석만" 이라는 원 선언 범위를 신규 테스트(누적 7건)가 이번까지 3번째로 넘어섬 — 다만 매 라운드 실측 근거와 함께 자기-disclosure 됐고 PR 이 직접 만든 방어/콜백의 커버리지를 메우는 것뿐, 무관한 기능 확장은 아님. | `idempotency.interceptor.spec.ts`, `migrate-node-output-refs.spec.ts` | 조치 불요. 다음엔 원 커밋 메시지를 "타입 전용 + 그 타입이 지탱하는 회귀 테스트"로 처음부터 넓혀 적는 편을 권장. |
| 4 | scope | 리뷰 산출물 대 실질 코드(`codebase/`+`plan/`) 비율이 라운드를 거듭할수록 산술적으로 커짐(4x → 4.9x → **6.15x**, 495줄 vs 3043줄). CLAUDE.md 워크플로에 부합해 규약 위반은 아님. | `review/code/2026/08/12/{11_06_12,12_05_39,12_24_14}/*` | 코드 조치 불요. 병합 전 브랜치 정리(스쿼시 등) 한 번 고려할 시점이라는 관찰. |
| 5 | maintainability | `IdempotencyInterceptor` 생성자 동일 인라인 호출이 5곳 → 7곳으로 증가(신규 테스트 2건 추가로). | `idempotency.interceptor.spec.ts:169,200,218,247,267,294,328` | 강제 아님. `makeInterceptor(redis)` 헬퍼로 추출하면 7곳→1곳. 다음에 이 블록을 또 만질 때 권장. |
| 6 | maintainability | 신규 테스트 제목 1건에 마크다운 굵게 문법(`**...**`)이 섞여 Jest 리포터/CI 콘솔에 별표가 그대로 출력됨 — 파일 내 유일한 예외. | `idempotency.interceptor.spec.ts:232` | `**R8 위반 상태를 고정하는 캐너리**` → `R8 위반 상태를 고정하는 캐너리` 로 별표 제거. |
| 7 | testing | "손상된 캐시 JSON" 테스트가 재적재 호출 횟수만 확인하고 저장된 값 내용(`bodyHash`/`statusCode`)은 단언하지 않음 — 예: `bodyHash` 가 실수로 빈 문자열이 돼도 그린. | `idempotency.interceptor.spec.ts` (`it('손상된 캐시 JSON → 무시하고 신규 처리 + 정상 적재', ...)`) | `JSON.parse(redis.set.mock.calls[0][1])` 로 `bodyHash` 등 단언 한 줄 추가 권장(강제 아님). |
| 8 | testing | 캐리오버 커버리지 갭 2건 재확인 — `chat-channel.dispatcher.ts` 의 `logFn` 분기, `executions.service.ts` 의 `snapshotCache` evict 로직에 여전히 테스트 없음. 선재 갭이며 이번 PR 은 타입 단언만 추가(emit 불변, side_effect 리뷰 실증), plan 에 이미 등재. | `chat-channel.dispatcher.ts`(`isSubFilterNull`), `executions.service.ts:192-199`(`SNAPSHOT_CACHE_MAX_ENTRIES`) | 이번 PR 책임 범위 밖. 추적 유지. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | INFO 2건(선재 캐시범위 초과, admission-control shape 미검증) — 신규 CRITICAL/WARNING 없음 |
| requirement | LOW | WARNING 1건(§R8 JSDoc 오귀속 잔존, `:118`) — fix 커밋(`b0b57366f`) 을 `git show HEAD:` 로 재검증해 주장대로 반영됨 확인 |
| scope | LOW | INFO 2건("타입 전용" 범위 3번째 초과, 리뷰산출물 비율 증가) — `b0b57366f` diff 가 RESOLUTION 예고와 정확히 일치 확인 |
| side_effect | NONE | 발견사항 없음 — 전역상태/시그니처/공개 인터페이스/env/네트워크/콜백 전 표면 불변 확인 |
| maintainability | NONE | INFO 2건(생성자 인라인 반복 5→7, 테스트명 마크다운 혼입) |
| testing | LOW | INFO 2건(손상JSON 테스트 얕음, 캐리오버 커버리지 갭) — 뮤테이션 2건 직접 재현해 판별력 실증(실패 개수·이름 일치) |
| documentation | LOW | WARNING 1건(소스 주석 3곳이 spec §R8 반대로 서술) |
| dependency | NONE | 발견사항 없음 — 신규 패키지/버전/lockfile 변경 0건, `--max-warnings 0` 게이트만 |

## 발견 없는 에이전트

- side_effect (위험도 NONE)
- dependency (위험도 NONE)

## 권장 조치사항

1. **(WARNING 해소, 우선)** `idempotency.interceptor.ts` 의 기존 주석 3곳(`:42`, `:54-55`, `:118`)을 Spec EIA §R8 원문(400 VALIDATION_ERROR 만 제외)에 맞게 정정하고 현재 구현이 그보다 넓다는 사실(선재 결함)을 병기한다. 런타임 로직·emit 바이트 무영향이라 이 PR 의 "타입 전용" 정체성을 깨지 않고 바로 반영 가능.
2. (선택) "손상된 캐시 JSON" 재적재 테스트에 저장값 내용(`bodyHash` 등) 단언 한 줄 추가.
3. (선택) `IdempotencyInterceptor` 생성자 인라인 호출 7곳을 헬퍼로 추출.
4. (선택) 신규 테스트 제목의 마크다운 굵게 문법(`**...**`) 제거.
5. 선재 백로그 항목(idempotency 캐시 제외 범위 초과, admission-control SQL shape 미검증, `chat-channel.dispatcher`/`executions.service` 커버리지 갭)은 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 등재돼 있으므로 이번 PR 범위 밖으로 유지.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, dependency (8명)
  - **제외**: 표 (6명)
  - **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명 — 실행된 8명 전원과 동일. forced 전원 결과 확보됨, 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이 델타에 해당 없음(개별 사유 텍스트는 prompt 에 미기재) |
  | architecture | 상동 |
  | database | 상동 |
  | concurrency | 상동 |
  | api_contract | 상동 |
  | user_guide_sync | 상동 |

---
