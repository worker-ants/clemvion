# Code Review 통합 보고서

## 전체 위험도
**NONE** — forced reviewer 7명(security/requirement/scope/side_effect/maintainability/testing/documentation) + database 총 8명 전원이 위험도 NONE 을 보고했고, CRITICAL/WARNING 급 발견은 하나도 없다. forced 화이트리스트 전원 결과 확보됨(누락·미이행 없음 — 다만 `maintainability.md` 는 디스크에 누락돼 있어 이번 통합 시 인라인 전문으로 영속화했다, 아래 §라우터 결정 참고).

이 changeset(`assertRowArray` 런타임 하드닝 + `executions`/`execution-engine` 서비스 4개 raw-SQL 소비 지점 가드 배선 + 관련 spec 보강 + plan/review 문서)은 이미 8라운드(code review 5회 + consistency-check 3회)를 거쳤고, 이번 라운드는 직전 라운드(`18_38_10`) 이후 추가된 유일한 신규 커밋(`ef4ff8d5d` — 주석 정정 + `chat-channel.dispatcher.spec.ts` 순수 스타일 리팩터, 동작 변경 없음)을 8개 관점(security/requirement/scope/side_effect/maintainability/testing/documentation/database)에서 독립 재검증했다. 전 라운드 모두 NONE.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / side_effect | `computeChainDepth` 가 `assertRowArray` 실패 시 정상적인 `RERUN_CHAIN_DEPTH_EXCEEDED`(409) 대신 `GlobalExceptionFilter` 가 마스킹한 500 을 반환한다 — pg 드라이버가 계약(배열 반환)을 어기는 사실상 불가능한 경로에서만 도달. 의도된 트레이드오프로 plan 에 이미 명시. | `codebase/backend/src/modules/executions/executions.service.ts` `computeChainDepth`(라인 325 부근) | 조치 불요(과거 라운드가 이미 같은 판단). 후속으로 더 진단 가능한 구조화 에러로 노출할지는 별건 백로그 |
| 2 | side_effect | `admitExecutionOrDefer` 호출을 감싼 `try/catch` 가 `assertRowArray` 유발 예외뿐 아니라 admission 내부의 **모든** 예외에 대해 `releaseExecutionRouting` 을 무조건 호출하도록 넓어짐 — 호출부 단일·release 가 idempotent 라 안전, 오히려 기존 "routing 영구 잔류" 결함 범위를 넓게 닫는 strict improvement | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `runExecutionFromQueue` | 조치 불요 — 의도된 수정(`17_15_21` WARNING 2 대응) |
| 3 | testing | 정정된 주석이 가리키는 "admission throw → pending 좌초 → orphan-pending backstop 회수" 연결을 명시적으로 잇는 end-to-end 통합 테스트는 없음(각 지점은 개별적으로만 테스트됨). backstop 자체가 원인 불문 범용 스캔이라 이번 diff 가 새로 연 커버리지 갭은 아님 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `runExecutionFromQueue` 주석 | 조치 불요. 향후 전용 통합 테스트 추가 시 가치는 있음 |
| 4 | scope | WARNING 수정 커밋(`ef4ff8d5d`)에 4라운드간 유예돼 온 `chat-channel.dispatcher.spec.ts` 스타일 4건(JSDoc 이동/pass-through 래퍼 제거/네이밍 통일/캐스트 통합)이 함께 번들됨 — 사전에 plan 에 등재되고 커밋 메시지에 근거가 명시된 승인된 부채 정리라 스코프 위반 아님 | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` | 조치 불요. 향후에도 근거를 커밋 메시지·plan 에 남기는 패턴 유지 |
| 5 | maintainability / documentation | `SNAPSHOT_CACHE_MAX_ENTRIES` 는 자매 상수 `MAX_EXECUTION_PATH_ROWS` 와 달리 export 사유 주석이 없음 — 여러 라운드(`14_01_46`/`17_15_21`/`18_19_33`)가 "소비처가 정의부·내부·테스트뿐" 이라는 근거로 이미 의식적으로 유예 | `codebase/backend/src/modules/executions/executions.service.ts` (64행 부근) | 조치 불요 — 새 근거 없이 재상정하지 않음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·시크릿·인가·에러노출 등 전 관점 신규 결함 없음. `computeChainDepth` 가드는 오히려 기존 fail-open(RR-PL-05 우회) 을 닫는 보안 견고성 개선 |
| requirement | NONE | `assertRowArray` 4개 호출부 배선 완전성 확인, spec(§RR-PL-05) 과 line-level 일치, 최신 커밋(`ef4ff8d5d`) 은 동작 무변경(주석 정정+스타일) 검증. INFO 1건 |
| scope | NONE | 코드 변경 파일 집합(8개 backend) 이전 4라운드와 동일. 스타일 4건 번들은 승인된 부채정리. INFO 1건 |
| side_effect | NONE | 신규 부작용 없음. admission catch 확장은 strict improvement, `computeChainDepth` throw 는 부분상태 위험 없음. INFO 2건 + 정보성 다수 |
| maintainability | NONE | 과거 라운드 지적 전항목(캐스트 중복/JSDoc/pass-through/네이밍) 해소 확인. 신규 결함 없음 |
| testing | NONE | 관련 스펙 직접 실행(497+38 passed), typecheck ratchet 199/38 baseline 일치. INFO 1건(통합테스트 갭, 조치불요) |
| documentation | NONE | 세션 ID 인용·상수-주석 일치 재검증, 스타일 4건 코드 반영 확인. CHANGELOG 미등재·export 주석 비대칭은 기유예 |
| database | NONE | 트랜잭션 경계·파라미터 바인딩 불변 확인. 신규 SQL/스키마/인덱스 없음 |

## 발견 없는 에이전트

security, maintainability, database — CRITICAL/WARNING/INFO 모두 없음(또는 신규 항목 전무, 기유예 항목만 재확인).

## 권장 조치사항

1. 없음 — 전 reviewer NONE, 조치가 필요한 CRITICAL/WARNING 미발견. 위 INFO 5건은 전부 "조치 불요" 로 이미 판단됐거나 별건 백로그(admission-throw 전용 통합 테스트, 500 대신 구조화 에러 노출)로 남아 있다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — `maintainability.md` 는 디스크에 파일이 누락돼 있어 이번 통합 과정에서 prompt 인라인 전문을 그대로 `review/code/2026/08/13/19_08_48/maintainability.md` 에 영속화했다. 내용 자체는 확보돼 있었으므로 forced 화이트리스트 미이행은 아니다.)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 changeset 과 무관(런타임 성능 영향 없는 타입 가드/주석 정정) |
  | architecture | 신규 모듈·아키텍처 변경 없음(단일 헬퍼 함수 추출) |
  | dependency | 신규/변경된 외부 의존성 없음 |
  | concurrency | 신규 동시성 로직 변경 없음(기존 락/트랜잭션 경계 불변) |
  | api_contract | 공개 API/REST 계약 변경 없음 |
  | user_guide_sync | 사용자 대상 문서·가이드 영향 없음(내부 하드닝) |
