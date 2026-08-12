# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능·보안·범위는 전부 clean(CRITICAL 0). 유일한 위험은 testing 리뷰가 지적한 두 커버리지 갭(신규 `storeEntry` 직렬화 방어 미검증, 410 자매 케이스가 e2e 미커버) — 코드 결함이 아니라 회귀 안전망 갭이라 병합 차단 사유는 아니다. forced reviewer 7명 전원 결과 확보(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `storeEntry()` 의 직렬화 실패 방어(`try/catch`)가 어떤 테스트로도 검증되지 않는다. docstring 이 "안 지키면 원 409/410 예외가 500 으로 대체된다"고 명시하는데도 순환 참조 등으로 이 분기를 행사하는 테스트가 0건. 2xx 성공 채널에도 이번에 신규 추가된 방어라 동일 갭 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:214-241` (catch 블록 228-233) | `idempotency.interceptor.spec.ts` 에 순환 참조 payload 로 `makeThrowingHandler(new ConflictException(circular))` 테스트 추가 — 원 예외 그대로 전파 + `redis.set` 미호출 단언. 2xx 채널도 동일 계약 추가 |
| 2 | testing | 신규 e2e(`I-1`/`I-2`)가 409 캐싱만 실 파이프라인에서 검증하고, 같은 `isErrorStatusCacheable()` 분기를 공유하는 410(GoneException/EXECUTION_TERMINATED)은 e2e 레벨에서 전혀 행사되지 않음. 이 e2e 도입 취지("mock 상태 ≠ 실제 상태" 방지)가 410 자리에는 적용 안 됨 | `codebase/backend/test/external-interaction.e2e-spec.ts:371` (I-1) 이후 대칭 410 케이스 부재 | `I-1` 과 대칭인 `I-3` e2e 추가(종료된 execution + Idempotency-Key → 410 캐시 재현 확인), 또는 후속 항목으로 plan 백로그에 명시 |
| 3 | maintainability | 신규 e2e 테스트 ID `I-2`(400 미적재 검증)가 같은 파일의 기존 테스트 ID `I-2`(617행, getStatus wire — 무관 기능)와 충돌. 파일의 순차 ID(A→…→J) 관행도 중간 삽입으로 깨짐. plan 문서(`:548`)가 이미 이 충돌 ID를 영구 인용 | `codebase/backend/test/external-interaction.e2e-spec.ts:446` vs `:617` | 겹치지 않는 자체 ID(예: `K`/`K-2`, `IDEM-1`/`IDEM-2`)로 변경 + plan 문서의 `I-1`/`I-2` 인용도 동반 갱신 |
| 4 | security | `Idempotency-Key` 캐시 키가 `executionId`/인증 컨텍스트로 스코프되지 않는 선재 설계 결함 — 이번 diff 로 409/410 캐싱이 dead code 에서 실제 도달 가능한 경로가 되며 노출 표면이 실질적으로 넓어짐. 서로 다른 execution 에 대해 동일한 `Idempotency-Key`+동일 `body`(→ 동일 bodyHash)를 우연히/의도적으로 사용하면 캐시된 409 응답(내부 상태 enum 포함)이 교차 재생될 수 있음 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:95` (`redisKey` 구성), 적재부 `:186-201`, 재현부 `:135-140` | 이번 PR 스코프 밖(§R8 정합화이지 키 스코핑 재설계 아님). `redisKey` 에 `executionId`(또는 인증 scope)를 포함시키는 후속 작업 우선순위 재확인 권고. plan 백로그(INFO 7·8)에 이미 등재돼 있어 신규 항목 불요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 캐시된 error 엔트리의 내부 `responseJson` 자체가 손상된 JSON 이면 무방비로 throw(선재 갭, 이번 diff 회귀 아님. 신규 137행도 동일 갭 물려받음) | `idempotency.interceptor.ts:137,143` | 이번 PR 스코프 밖. plan 백로그에 "캐시 엔트리 내부 responseJson 손상" 케이스 기록 권고 |
| 2 | testing | `storeEntry()` 의 Redis SET 이 fire-and-forget 이라, 신규 e2e(`I-1`)가 응답 직후 바로 `redis.get` 확인하는 방식과 이론적 레이스 가능성(실 flaky 관측 가능성은 낮음, 선재 패턴을 error 채널로 확장한 것뿐) | `idempotency.interceptor.ts:234-240`, `external-interaction.e2e-spec.ts:371-444` | 현재 조치 불요. CI 간헐 실패 시 폴링/재시도 고려 |
| 3 | security | 캐시 적재 실패 시 원 예외를 삼키던 잠재 결함이 `try/catch` 로 정확히 격리되어 있음을 확인(직전 라운드 WARNING 해소 확인, 신규 결함 아님) | `idempotency.interceptor.ts:214-233` | 없음 — 확인 완료 |
| 4 | security | 409/410 dead-code CRITICAL(직전 라운드)이 `catchError` 기반 아키텍처로 최종 해소됨, 인증/인가 순서(`InteractionGuard`→Interceptor) 불변 확인 | `idempotency.interceptor.ts:163-203`, `interaction.controller.ts:58,65-66` | 없음 |
| 5 | security | 신규 e2e 의 Redis 접속정보/JWT 시크릿은 기존 테스트 fixture 패턴 재사용, 신규 노출 아님 | `external-interaction.e2e-spec.ts:134-138` | 없음 |
| 6 | security | 인젝션/암호화 약화/에러 메시지 민감정보 노출/의존성 관련 신규 결함 없음(전체 diff 대상 확인) | 전체 diff | 없음 |
| 7 | requirement | `isErrorStatusCacheable` docstring 의 "spec 에 회귀 테스트가 있다"는 문구가 "spec 문서"와 "`*.spec.ts` 테스트"를 혼동할 여지(경미, 기능 영향 없음) | `idempotency.interceptor.ts:253` | 문구를 "이 파일의 회귀 테스트로 고정돼 있다"로 다듬기(선택) |
| 8 | requirement | CHANGELOG 가 4라운드 재설계 서사를 요약하며 `storeEntry` 직렬화 방어·e2e 추가는 명시 언급 안 함(SoT 아니므로 차단 사유 아님) | `CHANGELOG.md:3-29` | 여유 시 "적재 실패가 원 예외를 대체하지 않도록 방어" 한 줄 추가 |
| 9 | requirement | §R8 닫힌 목록과 구현 line-level 일치 확인, RxJS 채널 분리·캐시 재현 정확성·신규 e2e 판별력 확인(문제 없음) | `idempotency.interceptor.ts` 전반, `external-interaction.e2e-spec.ts:371-510` | 없음 |
| 10 | scope | 핵심 런타임/테스트/e2e/CHANGELOG/plan/spec 변경 전부가 "§R8 캐시 대상 정합화" 단일 의도에 정확히 대응. 무관한 리팩토링·드라이브바이 없음. review/** 아티팩트는 표준 워크플로 산출물 | 5개 커밋 전체 | 없음 |
| 11 | side_effect | 직전 라운드 WARNING(`storeEntry` 직렬화 실패가 원 예외 대체)이 이번 diff 에서 실제로 해소됨을 코드로 확인(신규 결함 아님) | `idempotency.interceptor.ts:214-241` | 없음 |
| 12 | side_effect | 위 방어를 행사하는 회귀 테스트 없음(= testing WARNING #1 과 동일 사안, 여기서는 side-effect 관점으로 관측) | `idempotency.interceptor.spec.ts` 전체 | testing #1 제안과 동일 |
| 13 | side_effect | 신규 e2e 가 실 Redis 연결을 열지만 기존 컨벤션(env var 패턴)과 동일, 새 부작용 패턴 아님 | `external-interaction.e2e-spec.ts:136-149` | 없음 |
| 14 | side_effect | I-1/I-2 e2e 가 24h TTL 캐시 엔트리를 남기지만 `randomUUID()` 스코프라 충돌 위험 낮고, 기존 파일의 미정리 관행과 동형 | `external-interaction.e2e-spec.ts:371-509` | 없음 |
| 15 | side_effect | 함수 시그니처/공개 인터페이스/전역 변수/환경 변수/파일시스템 변화 없음 확인 | `idempotency.interceptor.ts` | 없음 |
| 16 | maintainability | 캐시 히트 분기에서 `JSON.parse(cached.responseJson)` 중복 호출(상호 배타적이라 실행상 무해, 이전 라운드부터 유예된 항목) | `idempotency.interceptor.ts:137,143` | 필수 아님. 파싱을 한 번으로 끌어올리는 리팩토링 선택적 |
| 17 | maintainability | `intercept()` 가 5개 분기를 한 메서드(~63줄)에 담음(가독성 크게 훼손 안 됨, 유예 항목) | `idempotency.interceptor.ts:88-150` | 필수 아님. `replayCached()` 추출 선택적 |
| 18 | maintainability | 신규 e2e 의 raw SQL 셋업 블록이 파일 내 기존 8곳 넘는 반복 패턴을 그대로 따름(신규 중복 아님) | `external-interaction.e2e-spec.ts:371-510` | 조치 불요. 셋업이 더 늘면 공유 헬퍼 고려 |
| 19 | maintainability | `review/code/**` 신규 파일들은 이전 라운드 산출물이며 통상 유지보수성 기준 적용 대상 아님 | 해당 디렉터리 | 조치 불요 |
| 20 | documentation | plan 백로그의 미착수 항목(`:562`)이 이번 diff 로 이미 해소된 "R8 선재 결함"을 여전히 미해결 전제로 참조(diff 범위 밖 context, 실질 영향 낮음) | `plan/in-progress/backend-lint-gate-broken-on-main.md:562` | 필수 아님. 여유 시 과거형으로 문구 정정 |
| 21 | documentation | CHANGELOG·구현 docstring·테스트 docstring·spec 미러·plan·e2e 코멘트 전체 상호 정합 확인. README/API 문서/env 변수 문서화 필요한 새 표면 없음 | 다수 파일(문서 본문 참조) | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | idempotency 캐시 키 미스코프(선재, WARNING) 외 신규 결함 없음. 이전 라운드 WARNING(직렬화 실패 삼킴) 해소 확인 |
| requirement | NONE | §R8 닫힌 목록과 구현 line-level 완전 일치. 경미한 문서 문구 2건만 INFO |
| scope | NONE | 전 변경이 단일 의도(§R8 정합화)에 대응, 범위 이탈 없음 |
| side_effect | LOW | 이전 WARNING 해소 확인. 새 방어 로직 테스트 미검증(INFO), 그 외 안전 |
| maintainability | LOW | 신규 e2e 테스트 ID `I-2` 충돌(WARNING). 그 외 유예된 경미 항목들 |
| testing | MEDIUM | `storeEntry` 직렬화 방어 미검증(WARNING), 410 자매 케이스 e2e 미커버(WARNING) |
| documentation | NONE | 전 문서 상호 정합. plan 잔재 문구 1건만 INFO |

## 발견 없는 에이전트

없음 (전원 최소 1건 이상 INFO 이상 발견 보고).

## 권장 조치사항

1. **(testing WARNING #1)** `storeEntry()` 직렬화 실패 방어를 검증하는 회귀 테스트 추가 — 순환 참조 payload 로 원 예외 그대로 전파 + `redis.set` 미호출을 단언(가능하면 2xx/error 채널 양쪽).
2. **(testing WARNING #2)** 410(GoneException/EXECUTION_TERMINATED) 캐싱·재현을 실 파이프라인에서 검증하는 `I-3` e2e 추가, 또는 후속 항목으로 plan 백로그에 명시적으로 남길 것.
3. **(maintainability WARNING #3)** 신규 e2e 테스트 ID `I-2` 를 파일 내 기존 `I-2`(getStatus wire)와 겹치지 않는 식별자로 변경하고 plan 문서 인용도 동반 갱신.
4. **(security WARNING #4)** idempotency 캐시 키를 `executionId`/인증 컨텍스트로 스코프하는 후속 작업 — 이번 PR 스코프 밖이나 plan 백로그 우선순위 재확인.
5. 그 외 INFO 항목은 필수 조치 아님 — 여유 있을 때 문서 문구 정정(#7·#8·#20) 및 선택적 리팩토링(#16·#17) 고려.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (forced 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 무관 (스킵) |
  | architecture | router 판단상 이번 diff 와 무관 (스킵) |
  | dependency | router 판단상 이번 diff 와 무관 (스킵) |
  | database | router 판단상 이번 diff 와 무관 (스킵) |
  | concurrency | router 판단상 이번 diff 와 무관 (스킵) |
  | api_contract | router 판단상 이번 diff 와 무관 (스킵) |
  | user_guide_sync | router 판단상 이번 diff 와 무관 (스킵) |
