# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 3건(동시성/유지보수성/문서화, 모두 개별 reviewer 도 LOW 로 판정) 외에는 전부 INFO. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 | `finalizeCancelledExecution` (a)분기 — guarded UPDATE 0행 후 재조회해 `live.status===CANCELLED` 이면 emit 하도록 고쳤지만, 동시에 여러 finalizer 가 같은 CANCELLED 전이를 각자 재조회로 관측하면 각자 독립적으로 `EXECUTION_CANCELLED` 를 emit — 단일 emit 관문(single-flight guard) 부재. 이번 diff 가 새로 만든 문제는 아니고(구 코드는 더 넓은 범위에서 중복 가능) "DB 와 모순되는" 중복만 닫혔을 뿐, "DB 와 일치하지만 여전히 중복" 케이스는 범위 밖으로 남았다. 실제 재현 가능성은 execution 당 동시 워커 수(BullMQ concurrency/stalled 재배달)에 좌우됨 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4884` (`finalizeCancelledExecution`), 분기 `:4938`, 되쓰기 `:4947`, emit `:4950` | 이미 job/advisory lock 으로 execution 당 단일 finalizer 만 이 경로에 도달함이 보장된다면 그 근거를 주석/spec 에 명시. 보장되지 않으면 "이번 호출이 실제로 전이를 커밋했는가"로 emit 을 좁히는 것을 검토하거나, 최소한 EIA spec §6 근처에 "동일 CANCELLED 전이에 최대 N개 독립 emit 가능, payload 값은 동일" 캐비엇 추가 |
| 2 | 유지보수성 | 신규 테스트 `(d)`(재조회 throw 케이스)가 같은 `describe` 블록의 공유 `arrange()` 헬퍼를 쓰지 않고 셋업(`eventEmitter` spy, `query.mockResolvedValueOnce([])`)을 손으로 복제 — `arrange` 가 `liveStatus` 만 받아 "reject" 를 표현 못 해 생긴 우회. 이 PR 이 반복 지적해 온 "불완전/우회 mock 셋업이 다른 테스트를 조용히 vacuous 하게 만드는" 패턴과 같은 결의 회귀 위험 | `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:1143-1156` (vs `arrange()` 정의 `:1074-1096`) | `arrange` 시그니처를 `arrange(liveStatus | 'reject')` 또는 `arrange({liveStatus} \| {rejects})` 형태로 확장해 `(d)` 도 헬퍼를 통해서만 셋업하도록 통일. 최소 "왜 arrange 를 안 쓰는지" 주석 1줄 |
| 3 | 문서화 | 정본 트래커 `spec-sync-external-interaction-api-gaps.md` 의 "유일한 잔여 위반" 결론 산문(247행)이 바로 위 체크박스 3개(228/241/244행)가 이번 diff 에서 전부 `[x]` 완료로 바뀐 뒤에도 갱신되지 않고, "즉시 고치지 않은 이유는..." 등 현재형·미완료 전제 서술을 그대로 유지 — 이 PR 이 같은 세션에서 이미 두 번(§6.5 취소선 대신 삭제, node-cancellation.md 되돌린 동작 잔존) 겪은 "체크박스/코드는 갱신, 옆 산문은 stale" 결함 클래스의 세 번째 자리 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:247` | 저장소 관행(`~~원문~~` + `**(2026-08-15 해소)**`)대로 문단을 취소선 처리하고 해소 노트 추가. plan/ 이라 developer 쓰기 권한 범위 내, 짧은 정정으로 즉시 처리 가능 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `spec/data-flow/15-external-interaction.md` §1.2 필드 열거가 여전히 `durationMs` 를 반영 못함(원래도 `currentNode`/`context` 를 누락하던 비-망라 요약이라 이번 diff 가 새로 깬 것 아님, 이미 이전 라운드가 INFO 로 등재·보류) | `spec/data-flow/15-external-interaction.md` §1.2 | 여유 있을 때 `durationMs` 추가 또는 "필드 목록은 EIA §5.3 참조"로 교체(비차단) |
| 2 | 동시성/DB | `finalizeCancelledExecution` 재조회(`findOneBy`) 및 `retry-turn.service.ts` 의 `RETURNING` 추가는 SELECT-then-write 형 TOCTOU 를 만들지 않음(terminal 상태는 outgoing 전이 금지 + 같은 UPDATE 문 내 원자적 RETURNING). 4갈래(a/b/c/d) 회귀 테스트로 고정 | `execution-engine.service.ts:4919-4948`, `retry-turn.service.ts:631-663` | 조치 불요 |
| 3 | 부작용 | `finalizeCancelledExecution`/`finalizeGuarded` 두 헬퍼 모두 파라미터로 받은 엔티티 객체를 함수 내부에서 직접 mutate(`durationMs`/`finishedAt` 재대입). 현재 호출 그래프(전부 mutate 직후 같은 스코프에서 emit 후 즉시 return)에서는 안전 확인됨. 반환 타입이 `void`/`boolean` 이라 "파라미터를 되쓴다"는 계약이 타입 수준으로 드러나지 않음 | `execution-engine.service.ts:4947-4948`, `retry-turn.service.ts:664-673` | 재사용 확장 시 JSDoc 에 "호출자는 이 호출 후 같은 참조로 이전 값을 기대하지 말 것" 한 줄 권장(선택) |
| 4 | API 계약 / 보안 | REST `durationMs` 필드(`ExecutionStatusDto`)는 additive·nullable·read-only 로 하위호환 유지, 기존 §5.4 "부재 표현" 규약(null=종결 전, `??` 로 `0` 보존)을 그대로 따름. 인증/인가(§4 interaction token) 표면 변경 없음, 노출값도 이미 webhook/SSE/WS 로 발행되던 비민감 수치 | `execution-status-response.dto.ts`, `interaction.service.ts:78,438` | 조치 불요 |
| 5 | 테스트 | `finalizeGuarded` CANCELLED 재진입의 방어적 fallback(`affected>0` 인데 `raw` 가 비정상이거나 파싱 불가로 로컬 값을 조용히 보존하는 경로)이 3라운드째 테스트 미비 — 이론적·저확률(현재 pg/TypeORM 조합에서 도달 불가)로 이미 두 차례 인지·유예됨 | `retry-turn.service.ts:661-673` | 조치 불요(참고 유지) — 실제 드라이버 관측 생기면 fixture 로 고정 |
| 6 | 테스트 | `it.each([['result'],['error'],['durationMs']])` 목록 기반 nullable 회귀 가드는 "손으로 고른 목록=커버리지" 구조적 한계(자체 주석으로 인지·문서화됨) — 새 nullable 필드 추가 시 수동 등재 필요 | `execution-status-response.dto.spec.ts:122-124` | 장기적으로 스키마 프로퍼티 순회 메타테스트 고려(이번 PR 스코프 밖) |
| 7 | 유지보수성 | 신규 테스트 `(d)` 삽입 위치가 `(b)`/`(c)` 사이라 레이블 순서(a→b→d→c)가 파일 순서와 어긋남(가독성 이슈, 기능 영향 없음). 신규 `try/catch` 의 로그 접두사 템플릿 리터럴이 같은 함수 안에서 2회 문자 그대로 중복 | `execution-engine.service.spec.ts:1123-1158`, `execution-engine.service.ts:4931,4940` | `(d)` 를 `(c)` 아래로 이동 또는 서술형 레이블로 전환. 로그 접두사는 함수 상단 `const logPrefix` 로 단일화(둘 다 비긴급) |
| 8 | 보안 | 재조회 실패 에러는 서버 로그(`logger.warn`)에만 남고 API 응답에 노출 안 됨. `status IN (...)` 리터럴과 QueryBuilder `:name` 바인딩 모두 사용자 입력 결합 없음(SQL 인젝션 표면 없음). 하드코딩 시크릿/자격증명 없음 | 전 diff | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인증/인가·인젝션·시크릿 노출 없음. 신규 REST 필드는 비민감 기존 컬럼 노출뿐 |
| requirement | NONE | 핵심 3항목(guarded UPDATE 소비/RETURNING 되읽기/REST durationMs) 코드·테스트·spec·plan 전부 line-level 일치. 이전 라운드 CRITICAL/WARNING 전부 해소 재확인 |
| scope | NONE | 79개 파일 전량이 plan ①②③ 및 그 상시 의무 리뷰/consistency-check 산출물로 설명됨. 무관한 리팩토링·설정 변경 없음 |
| side_effect | LOW | emit 조건 변경·엔티티 in-place mutation·재조회 라운드트립 3가지 모두 문서화·스코프 내 안전 확인 |
| maintainability | LOW | 신규 테스트(d)가 공유 arrange() 헬퍼 우회(WARNING). 레이블 순서·로그 접두사 중복(INFO) |
| testing | LOW | 이전 3라운드 WARNING 16건 전부 뮤테이션으로 판별력 확인하며 해소. 신규 갭 없음, 이론적 fallback 미검증 재확인(INFO) |
| documentation | LOW | spec-sync 트래커 stale 산문 1건(WARNING). 그 외 CHANGELOG/DTO/spec/KO-EN 문서 정합 재확인 |
| database | NONE | 스키마/마이그레이션 변경 없음, 전 쿼리 파라미터 바인딩, PK 단건 조회만 |
| concurrency | LOW | 동시 finalizer 레이스 시 중복 emit 잔여 표면(WARNING, 신규 아님·범위 축소됨). RETURNING/재조회는 TOCTOU 없음 |
| api_contract | LOW | breaking change 없음, durationMs additive/nullable. emit 조건 변경은 계약상 정합화이며 문서화 완료 |
| user_guide_sync | NONE | doc-sync-matrix 20행 중 `backend-api-change` 1건만 매칭, swagger jsdoc+user-guide 페이지 모두 같은 changeset 안에서 충족 |

## 발견 없는 에이전트

- scope — CRITICAL/WARNING 급 스코프 이탈 없음 (실질 findings 없음, "확인했으나 문제없음" 섹션만)
- user_guide_sync — 문서 동기화 갭 없음

## 권장 조치사항

1. **(문서화 WARNING)** `plan/in-progress/spec-sync-external-interaction-api-gaps.md:247` 의 "유일한 잔여 위반" 산문을 취소선 + 해소 노트로 정정 — 짧고 즉시 처리 가능, plan/ 쓰기 권한 내.
2. **(유지보수성 WARNING)** `execution-engine.service.spec.ts` 신규 테스트 `(d)` 가 공유 `arrange()` 헬퍼를 쓰도록 시그니처 확장(reject 케이스 지원) — 향후 셋업 변경 시 조용한 stale 방지.
3. **(동시성 WARNING)** `finalizeCancelledExecution` (a)분기의 동시 finalizer 중복 emit 가능성에 대해 — 기존 job/advisory lock 보장 여부를 확인해 근거를 주석/spec 에 명시하거나, EIA spec §6 근처에 "동일 CANCELLED 전이에 최대 N개 독립 emit 가능" 캐비엇 추가. 이번 diff 가 새로 만든 문제는 아니므로 긴급도는 낮으나 다음 EIA 관련 작업 시 반드시 재확인.
4. (선택, INFO) 신규 헬퍼의 in-place mutation 계약을 JSDoc 에 명시, 로그 접두사 상수화, 테스트 레이블 순서 정리 — 비긴급.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 changeset 범위에서 성능 영향 표면 낮음 |
  | architecture | router 판단 — 아키텍처 구조 변경 없음(기존 함수 내부 로직 수정) |
  | dependency | router 판단 — 신규/변경 의존성 없음 |