# Code Review 통합 보고서

## 전체 위험도
**NONE** — 9명 reviewer(security/architecture/requirement/scope/side_effect/maintainability/testing/documentation/dependency) 전원이 CRITICAL·WARNING 없이 NONE 으로 수렴. 이 델타(누적 5라운드째, `origin/main...HEAD`)는 backend ESLint `no-unsafe-*` warning 전량 처분(46→0) + `--max-warnings 0` 게이트 도입 작업이며, 실질 코드 변경은 12개 소스 파일(타입 주석/제네릭/단언만, 로직·시그니처 무변경)로 국한된다. 이번 라운드가 새로 보는 유일한 커밋(`cec79b004`)은 직전 라운드(`12_40_58`) WARNING 1건 + INFO 3건에 대한 조치이며, 9명 전원이 `git show`/소스 직접 열람으로 그 조치가 정확한지 독립 재검증했다. **forced(router_safety) 화이트리스트 8개(dependency/documentation/maintainability/requirement/scope/security/side_effect/testing) 전원 결과 확보됨, 누락 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

없음. (이전 4라운드에서 발견된 WARNING 4건 — `HttpResponseLike` 미검증 테스트 부재, README 문구 불일치, 테스트명의 §R8 오귀속, 손상 JSON 케이스 값 미단언 — 은 모두 이전 라운드 커밋들에서 조치 완료되었고, 이번 라운드가 이를 독립 재검증함.)

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement/Spec fidelity | Idempotency 캐시 제외 범위가 Spec EIA §R8 보다 넓음 — `statusCode >= 400` 하나로 409/410/5xx 까지 캐시 제외(R8 은 `400 VALIDATION_ERROR` 만 지목). 선재 결함, 데이터 유출·인증 우회 방향 아님(재실행되는 방향) | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (`cacheTapped()`) | 조치 불요 — `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속에 등재, 캐너리 테스트(`409 도 캐시되지 않는다`)로 현재 동작 고정됨. 후속 세션에서 `=== 400` 으로 좁힐 때 5xx 캐싱 여부 재검토 |
| 2 | Requirement | 클래스 상단 docstring 이 R8 선재 결함(409/410 도 함께 캐시 제외됨)의 전모를 반복하지 않음 — private 메서드 docstring 에만 있어 처음 읽는 사람이 오독할 여지 | `idempotency.interceptor.ts:51-62` (클래스 docstring) | 강제 아님. 다음에 이 docstring 을 만질 때 `cacheTapped()` docstring 참조 한 줄 추가 |
| 3 | Requirement/Security | `intercept()` 의 `from(this.redis.get(redisKey))` 가 reject 시 미보호 — 클래스 docstring 의 "Redis 미가용 시 fail-open" 주장이 생성자 시점 null 체크에만 적용되고 런타임 reject 는 보호되지 않을 수 있음. 이번 diff 범위 밖(기존 줄) | `idempotency.interceptor.ts:87` | 이번 PR 범위 밖, 조치 불요. 필요시 plan 백로그에 별도 항목 등재 검토 |
| 4 | Security | admission-control 쿼리(`m.query<{ id: string }[]>`) 결과 shape 런타임 미검증(`Array.isArray` 가드 없음) — fail-closed 방향이라 cap 우회로 이어지지 않음, 선재 | `execution-engine.service.ts` | 조치 불요 — plan 에 하드닝 제안 및 유예 사유 기록됨 |
| 5 | Architecture | `getResponse<T>()` 진입점의 타입 표현 스타일이 파일마다 3갈래(express `Response` 전체 / 인라인 익명 구조 / named `HttpResponseLike`)로 갈림 | `idempotency.interceptor.ts`, `http-exception.filter.ts`, `interaction-rate-limit.guard.ts`, `logging.interceptor.ts` | 조치 불요. 다음에 이 자리를 만질 때 공유 위치로 통일 고려 |
| 6 | Architecture | `migrate-node-output-refs.ts` 의 `current.replace(...)` 콜백 시그니처가 6곳 반복 — 데이터 기반(`{pattern, replacer}[]`) 파이프라인으로 승격 여지 | `migrate-node-output-refs.ts:247-252,292-297,312-317,332-337,437-442,487-492` | 조치 불요. pass 수가 늘어나는 시점에 재고려 |
| 7 | Maintainability | 캐시 저장 JSON 을 파싱해 단언하는 3줄짜리 관용구(`JSON.parse(redis.set.mock.calls[0][1]) as {...}`)가 스펙 파일에 2회 반복 시작 | `idempotency.interceptor.spec.ts:276-283, :307-310` | 조치 불요. 3회 이상으로 늘면 `readStoredEntry(redis)` 헬퍼 추출 고려 |
| 8 | Side Effect | `package.json` `lint` 스크립트 exit code 계약이 정보성→게이팅(`--max-warnings 0`)으로 변경 — 이번 PR 의 의도된 주 효과 | `codebase/backend/package.json:20` | 조치 불요 — README 동기화됨, 호출부(CI/로컬) 2곳 모두 이 게이트 강화의 의도된 대상 |
| 9 | Testing | 캐리오버 커버리지 갭 2건: `chat-channel.dispatcher.ts` 의 `logFn` 삼항식 분기, `executions.service.ts` 의 `snapshotCache` evict 분기 — 이 델타가 만든 갭 아님(타입 단언만 추가, 로직 무변경) | `chat-channel.dispatcher.ts`, `executions.service.ts` | 조치 불요(이 델타 책임 밖) — plan 문서에 위치·재현 방법과 함께 이미 추적 중. 향후 이 로직을 만질 때 함께 테스트 추가 |
| 10 | Testing | `readKey`/`hashBody` 헬퍼의 경계값(키 길이 초과, 공백뿐인 키) 케이스가 spec 에 없음 — 이번 diff 범위 밖 | `idempotency.interceptor.ts` (readKey/hashBody) | 참고용, 강제 아님 |
| 11 | Scope | 손상 JSON 테스트에 저장값 단언(`bodyHash`/`statusCode`/`responseJson`) 추가는 "타입 전용" 선언 범위를 형식적으로 넘는 행위 검증 — 다만 매 라운드 뮤테이션 실측으로 근거가 disclosure 됨(은폐 아님) | `idempotency.interceptor.spec.ts` (손상 JSON 테스트) | 조치 불요. 유사 패턴 반복 시 커밋/PR 설명 범위를 "타입 + 회귀 테스트 보강"으로 넓혀 적을 것 |
| 12 | Scope | 리뷰 세션 산출물(`review/**`, 47파일)이 코드/plan 실질 변경(15파일) 대비 계속 큰 규모로 누적 | `review/code/2026/08/12/{11_06_12,12_05_39,12_24_14,12_40_58}/*` | 조치 불요 — 프로젝트 표준 워크플로(구현 완료 후 자동 review 는 상시 승인된 강제 의무)의 자연스러운 부산물 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | R8 캐시 범위 초과·admission-control shape 미검증 재확인(선재, INFO). Redis 키/해시 인젝션 없음, 신규 위험 없음 |
| architecture | NONE | `getResponse<T>()` 스타일 3분화, migrate 스크립트 pass 반복 6곳(선재, INFO). SOLID/레이어/순환의존 퇴행 없음 |
| requirement | NONE | 클래스 docstring 완결성 갭, `redis.get()` 미보호 reject 가능성(둘 다 INFO, 이번 PR 범위 밖). eslint/typecheck/jest 독립 재실행 전부 일치 |
| scope | NONE | 리뷰 산출물 누적, 저장값 단언이 "타입 전용" 선언을 형식적으로 초과(둘 다 INFO, disclosure 됨). 스코프 이탈 없음 |
| side_effect | NONE | `package.json` lint 게이트 exit code 계약 변경(의도된 주 효과, INFO). 시그니처/상태/네트워크/파일I/O 표면 무변경 |
| maintainability | NONE | 캐시값 파싱 단언 패턴 2회 반복 시작(INFO). 코드 동작 4라운드 연속 무변경 |
| testing | NONE | 캐리오버 커버리지 갭 2건(logFn, snapshotCache evict), readKey/hashBody 경계값 부재(둘 다 INFO, 선재/범위 밖). 뮤테이션 판별력 재확인됨 |
| documentation | NONE | 직전 WARNING 정확히 해소 확인, README/package.json/CI 정합 재확인(전부 INFO, 확인 목적) |
| dependency | NONE | 신규 외부 패키지·lockfile 변경 0건. 유일한 내부 import(`SetupResult`)는 기존 export 소비뿐 |

## 발견 없는 에이전트

dependency (CRITICAL/WARNING/INFO 모두 0건 — "발견사항: 없음"으로 명시)

## 권장 조치사항

1. (선택) `idempotency.interceptor.ts` 클래스 docstring 에 "409/410 도 현재는 함께 제외됨 — 선재 결함, `cacheTapped()` docstring 참조" 한 줄 추가 — 문서 완결성 갭 해소(강제 아님).
2. 이번 PR 은 push 차단 사유 없음 — CRITICAL 0건, WARNING 0건. 병합 가능.
3. 향후 `chat-channel.dispatcher.ts` (`logFn`) / `executions.service.ts` (`snapshotCache` evict) 로직을 만질 때 커버리지 갭을 함께 메울 것(이미 plan 에 위치·재현 방법 등재됨).
4. idempotency 캐시 제외 범위(Spec EIA §R8 대비 과잉)를 정식으로 좁힐 후속 세션에서는 5xx 캐싱 여부를 spec 으로 별도 확인.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency (9명)
  - **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명) — **전원 결과 확보됨, 누락 없음**
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 델타(타입 주석/제네릭/단언 전용)와 무관 |
  | database | router 판단상 이번 델타와 무관(스키마/쿼리 로직 무변경) |
  | concurrency | router 판단상 이번 델타와 무관(동시성 제어 로직 무변경) |
  | api_contract | router 판단상 이번 델타와 무관(공개 API 계약 무변경) |
  | user_guide_sync | router 판단상 이번 델타와 무관(사용자 가이드 문서 대상 변경 없음) |
