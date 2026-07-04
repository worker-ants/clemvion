# 아키텍처(Architecture) Review

이번 라운드(17_26_57)는 직전 ai-review(16_58_32)의 CRITICAL/WARNING fix 커밋에 대한 재검증이다.
아키텍처 관점의 이전 발견(WARNING: workflow-level cap API 부재, raw SQL 경계 이탈, `alreadyRunning`
boolean flag)은 RESOLUTION.md(#8 ACCEPT-보류, #9 ACCEPT)에서 사용자가 명시적으로 accept/defer
처리했으므로 재제기하지 않는다. 본 라운드에서 실제로 바뀐 부분(advisory lock 도입, workspace GET
settings 필드 추가, V105 인덱스, spec 문구 정정)을 중심으로 검토했다.

## 발견사항

- **[INFO]** advisory lock 도입이 레이어 경계·책임 분리를 그대로 유지함
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `admitExecutionOrDefer` (c) 블록 — `this.executionRepository.manager.transaction(async (m) => { await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]); ... })`
  - 상세: CRITICAL 수정이 기존 raw-SQL 패턴(선례: `updateExecutionStatus`) 안에서 `manager.transaction` 캡슐 하나로 lock 획득 + 조건부 UPDATE 를 동봉했다. 서비스 레이어가 이미 SQL 스키마에 결합돼 있던 지점(이전 라운드 WARNING #9, 사용자 ACCEPT)을 벗어나는 새로운 결합을 추가하지 않았고, 트랜잭션 경계가 단일 메서드 내부에 국한되어 호출부(`runExecutionFromQueue`)는 여전히 `admitted`/`cancelled`/`deferred` 3-way 결과만 보고 세부 구현(락 종류, SQL 형태)을 알 필요가 없다 — 캡슐화 관점에서 퇴행 없음.
  - 제안: 없음. 참고 기록.

- **[INFO]** `lockKey` fallback(`workspaceId ?? execution.workflowId`)이 암묵적 정책 분기를 만들지만 스코프가 국지적
  - 위치: `execution-engine.service.ts` `admitExecutionOrDefer` — `const lockKey = `exec-cap:${workspaceId ?? execution.workflowId}`;`
  - 상세: workflow 조회 실패(비정상 edge case)로 `workspaceId`가 `undefined`일 때 lock 스코프가 workflow 단위로 축소된다. 기능적으로는 안전하지만(다른 workspace의 정상 admission과 충돌하지 않음), "workspace cap 보호"라는 이 메서드의 주된 책임과 "workflow cap 보호"라는 fallback 시나리오가 같은 변수(`lockKey`)에 조건부로 섞여 있어 향후 이 메서드를 읽는 사람이 lock 의미를 두 번 해석해야 한다. CRITICAL은 아니며 이례적 edge case 한정이라 별도 분리를 요구할 정도는 아니다.
  - 제안: 현행 유지 가능. 필요 시 주석을 lock 변수 선언부에 한 줄 더(현재도 있음) 유지하는 정도로 충분.

- **[INFO]** `GET /workspaces/:id/settings` ↔ `PATCH` 필드 대칭성 회복 — 계층 간 계약 정합
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `getWorkspaceSettings()` 반환 타입에 `maxConcurrentExecutions?: number` 추가, `workspace-response.dto.ts` `WorkspaceSettingsDto.maxConcurrentExecutions`
  - 상세: 이전 라운드 WARNING(api_contract/documentation, PATCH-only write)이 GET 경로에도 필드를 노출하도록 수정되어, 프레젠테이션(DTO/Swagger)·비즈니스(service 병합/조회)·데이터(Entity settings JSONB) 3레이어가 workspace 스코프에 한해 완전히 대칭을 이뤘다. 레이어 책임 분리 관점에서 개선.
  - 제안: 없음.

- **[INFO]** V105 복합 인덱스는 순수 인프라 계층 변경 — 서비스 로직과 결합 없음
  - 위치: `codebase/backend/migrations/V105__execution_workflow_status_index.sql`, `.conf`
  - 상세: 이전 라운드 database WARNING(hot-path 인덱스 부재)에 대한 순수 데이터 레이어 보강. 애플리케이션 코드 변경 없이 인덱스만 추가해 서비스 레이어의 쿼리 형태·계약을 바꾸지 않는다 — 관심사 분리가 정확히 유지된 수정.
  - 제안: 없음.

- **[INFO]** spec §8 문구 정정이 코드 구현과 재정합됨
  - 위치: `spec/5-system/4-execution-engine.md` §8, §Rationale
  - 상세: "정책 정의 완료, enforcement 후속" → "구현 완료"로 갱신하고 advisory lock 필수 서술로 정정한 것은 spec-코드 drift를 해소하는 조치이며 아키텍처 관점에서는 문서-구현 정합성 회복 그 이상의 구조적 함의는 없다.
  - 제안: 없음.

- **[INFO]** 잔여(이미 RESOLUTION.md에서 defer 처리된) 항목 — 재플래그 아님, 추적 목적 기록
  - workflow-level `maxConcurrentExecutions` 는 여전히 write API(DTO/Controller) 없이 `admitExecutionOrDefer`의 `resolveConcurrencyCap(workflow?.settings, ...)`만 읽는다 — workspace 레이어와 비대칭 유지(RESOLUTION #8, 사용자 보류 확정).
  - `admitExecutionOrDefer`의 raw SQL Repository 우회는 advisory lock 트랜잭션 안에서도 동일하게 유지된다(RESOLUTION #9, ACCEPT).
  - `runExecution(execution, input, true)`의 boolean flag 계약은 이번 라운드에서 변경되지 않았다(이전 라운드 INFO, 차단 아님).
  - 이 세 항목은 이전 라운드에서 이미 평가·처리(ACCEPT 또는 명시적 보류)되었으므로 본 라운드에서는 상태 변화 없음을 확인하는 선에서 기록만 한다.

## 요약

이번 fix 라운드는 아키텍처 관점에서 순수하게 긍정적인 변경이다. CRITICAL 동시성 결함(조건부 UPDATE 단독의 TOCTOU)을 advisory-lock 트랜잭션으로 해소하면서도 기존 레이어 경계(서비스가 admission 세부를 캡슐화하고 호출부는 3-way 결과만 소비)를 그대로 보존했고, workspace GET/PATCH 설정 API의 계약 대칭성 회복, hot-path 인덱스 추가(순수 데이터 레이어), spec 문서 재정합까지 모두 기존 설계를 흔들지 않는 국소적·계층 정합적 수정이다. 순환 의존성이나 레이어 침범, 새로운 결합도 증가는 관찰되지 않았다. 이전 라운드에서 이미 사용자가 accept/defer로 확정한 workflow-level cap API 부재·raw SQL 경계·boolean flag 이슈는 이번 diff에서 상태 변화가 없어 재차 지적하지 않는다.

## 위험도
NONE
