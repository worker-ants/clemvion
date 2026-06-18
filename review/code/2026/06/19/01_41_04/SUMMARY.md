# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 타입 리팩터링(leaf 모듈 분리 + `@internal` JSDoc 추가)으로 런타임 동작 변경 없음. 주요 주의사항은 export 경로 변경으로 인한 잠재적 컴파일 타임 브레이킹(CI 빌드 확인 필요)과 god-class 미완 분해 및 forwardRef 순환 DI 구조 잔류.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | Critical 발견 없음 | — | — |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | god-class `ExecutionEngineService` 미완 분해 — 6972줄 단일 클래스. `runNodeDispatchLoop`(약 400줄), `rehydrateContext`(약 170줄) 등 대형 메서드 잔류. graph 순회/빌드, 노드 dispatch, 상태 머신, 이벤트 발행이 혼재 | `execution-engine.service.ts` 전체 | PR-H/I 점진적 분해 계획 구체화. 우선순위: `loadAndBuildGraph` → `GraphBuildService` 독립, `runContainer`/`runParallel` 경계 재검토 |
| 2 | Architecture | `forwardRef` 4개 순환 DI — 추출된 서비스 4개(`AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService`)가 모두 `ENGINE_DRIVER`를 역방향 주입받아 구조적 결합 미해소 | `execution-engine.service.ts` L601, L605, L607, L611 | 신규 서비스 추출 시 `forwardRef` 추가를 기준선으로 삼지 말고, 잔류 capability를 독립 서비스로 분리해 단방향 의존 가능한지 먼저 검토 |
| 3 | SideEffect | `execution-engine.service.ts`에서 `ExecutionGraphState`, `NodeDispatchLoopParams` export 제거로 인한 잠재적 컴파일 타임 브레이킹 — 기존 소비자가 `from './execution-engine.service'`로 직접 import 하던 경우 TypeScript 컴파일 오류 발생 가능 | `execution-engine.service.ts` (삭제 영역) | CI 빌드(`tsc --noEmit`) 통과 여부 확인. 외부 소비자 존재 시 해당 파일 갱신 또는 re-export 스텁 추가 |
| 4 | Documentation | 구분선 주석이 `ExecutionEngineService` 클래스 독스트링과 클래스 선언 사이에 삽입되어 JSDoc 파서 입장에서 클래스 독스트링 귀속이 모호해질 수 있음 | `execution-engine.service.ts` 라인 750–752 | 구분선 주석을 삭제된 인터페이스 위치 직후(라인 346 영역)로 이동하거나 클래스 독스트링 내 `@remarks` 섹션에 통합 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/4-execution-engine.md` §Rationale C-1 의 EngineDriver 멤버 목록이 3개만 예시. 실제 구현에는 C-1 step2(7개) + step4(5개) = 총 12개 존재. spec이 "본 분할은 spec 무변"을 선언했으나 예시 목록이 낡음 | `spec/5-system/4-execution-engine.md` line 1464 | 코드 유지 + spec 갱신. Rationale C-1 멤버 목록을 전체 12개(또는 "최소 seam 원칙에 따라 필요한 멤버를 추가해왔다"는 산문)로 갱신. project-planner/spec-update 경로 |
| 2 | Architecture | `@internal` JSDoc과 `public` 접근 제어자의 의미론적 충돌 — `@internal` 메서드들이 `public`으로 선언돼 있어 TypeScript 언어 레벨 접근 제어가 없음 | `execution-engine.service.ts` (rehydrateContext 등 5개 메서드) | 실용적 대안: `ENGINE_DRIVER` 인터페이스만 노출하는 facade 레이어 도입, 또는 별도 class 분리 후 합성 방식. 현 단계는 문서화 정책으로 수용 가능 |
| 3 | Maintainability | `@internal` 태그 부분 적용 불일치 — C-1 step2 구간의 기존 7개 메서드(`updateExecutionStatus`, `stageDurableResumeSnapshot`, `buildRetryReentryState`, `buildResumeCheckpoint`, `isCheckpointEligibleNodeType`, `contextKeyOf`, `applyPortSelection`)에 `@internal` 없음 | `engine-driver.interface.ts` | 기존 7개 메서드에도 `@internal` 추가하거나 인터페이스 클래스 레벨 JSDoc에 "모든 멤버는 ENGINE_DRIVER 토큰을 통해서만 사용" 문구 추가 |
| 4 | Architecture | `dispatchMeta: { startedAt?: string; mode: 'manual' }` 인라인 타입 — `mode`가 `'manual'` 리터럴로 고정, 향후 확장 시 모든 호출자 영향 | `types/graph-dispatch.types.ts` L89 | `DispatchMeta` 타입으로 별도 선언하거나 `'manual' \| 'schedule' \| 'webhook'` 유니온으로 확장 검토. 현재 `manual`이 유일한 진입이라면 주석으로 이유 명시 |
| 5 | Maintainability | 주석 배치 이중화 — 타입 이동 안내 블록 주석이 두 곳에 존재 | `execution-engine.service.ts` 라인 750–752 및 라인 345 | 라인 345 위치의 tombstone 하나만 남기고 중복 제거 |
| 6 | Documentation | 신규 `import type` 추가에 C-1 step 주석 관행 미적용 | `execution-engine.service.ts` 라인 264–267 | `// C-1 후속 — graph-dispatch 타입들을 leaf 모듈로 이동 (engine-driver.interface.ts 타입 순환 해소)` 주석 추가 |
| 7 | Documentation | `engine-driver.interface.ts` import 경로 변경 이유 주석 부재 | `engine-driver.interface.ts` 라인 35–36 | import 블록 위에 한 줄 주석: `// C-1 후속 — engine-driver.interface.ts ↔ execution-engine.service.ts 타입 레벨 순환 해소` 추가 |
| 8 | Documentation | `graph-dispatch.types.ts` 파일 레벨 독스트링에 `@module` 태그 없음 — 부유 독스트링 형태 | `types/graph-dispatch.types.ts` 라인 14–23 | `@module` 태그 추가 또는 일반 행 주석으로 전환. 코드베이스 다른 leaf 파일 관행 참고 |
| 9 | Documentation | `NodeDispatchLoopParams.executionId` 필드 JSDoc 누락 | `types/graph-dispatch.types.ts` 라인 74 | `/** 현재 처리 중인 Execution UUID. */` 추가 |
| 10 | Security | `failFirstSegmentSetup` — 에러 메시지를 DB 저장 및 WebSocket 이벤트 payload로 전파. stack trace·파일 경로·외부 URL 등 민감 정보 노출 가능성 (기존 코드, 이번 diff 범위 외) | `execution-engine.service.ts` `failFirstSegmentSetup` 메서드 | `workflow-errors.ts`의 `serverDetail` 분리 정책을 `failFirstSegmentSetup`에도 적용해 일관성 확보. 후속 PR 대상 |
| 11 | Security | `assertSameWorkspace` fail-open 설계 — `callerWorkspaceId` 없으면 경고 로그만 남기고 통과 (기존 코드, 이번 diff 범위 외) | `execution-engine.service.ts` `assertSameWorkspace` 메서드 | 모든 호출자가 `parentWorkspaceId`를 전달하도록 정착 후 fail-closed 전환 계획 후속 PR에서 이행 |
| 12 | Testing | `ExecutionCancelledError` sentinel 계약(name, message, instanceof Error) 독립 단언 없음 | `workflow-errors.spec.ts` | `workflow-errors.spec.ts`에 `ExecutionCancelledError` 블록 추가 가능하나 필수 아님 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음. 기존 코드의 에러 메시지 WS 전파, fail-open workspace isolation은 diff 외 사항 |
| architecture | LOW | god-class 6972줄 미완 분해, forwardRef 4개 순환 DI — 이번 변경의 타입 순환 해소 방향은 올바름 |
| requirement | NONE | 3가지 목표 모두 달성. spec Rationale C-1 멤버 목록 불완전(SPEC-DRIFT) |
| scope | NONE | 4개 파일 모두 단일 목적 집중. 범위 이탈 없음 |
| side_effect | LOW | export 경로 변경으로 인한 잠재적 컴파일 타임 브레이킹 가능성. 런타임 부작용 없음 |
| maintainability | NONE | `@internal` 부분 적용 불일치, 주석 중복, `dispatchMeta` 인라인 타입 — 모두 INFO 수준 |
| testing | NONE | 순수 타입/JSDoc 변경으로 신규 테스트 불필요. 기존 테스트가 충분히 커버 |
| documentation | LOW | 클래스 독스트링 귀속 모호 가능성(JSDoc 파서 영향), import 주석 관행 미적용 |

## 발견 없는 에이전트

없음 (모든 에이전트가 발견사항 보고. 단, security·requirement·scope·maintainability·testing은 NONE 위험도)

## 권장 조치사항
1. **[즉시]** CI 빌드(`tsc --noEmit`) 통과 확인 — `ExecutionGraphState`/`NodeDispatchLoopParams` export 경로 변경으로 외부 소비자 컴파일 오류 가능. 소비자 있으면 import 경로 갱신 (WARNING #3)
2. **[후속 PR]** `execution-engine.service.ts` 클래스 독스트링과 클래스 선언 사이의 구분선 주석 위치 교정 — JSDoc 파서 귀속 모호성 해소 (WARNING #4)
3. **[후속 PR]** spec 갱신: `spec/5-system/4-execution-engine.md` §Rationale C-1 EngineDriver 멤버 목록을 전체 12개로 갱신 (SPEC-DRIFT — project-planner 경로)
4. **[백로그]** god-class `ExecutionEngineService` 점진적 분해 계획 구체화 (PR-H/I 예정) — `GraphBuildService` 독립 우선 (WARNING #1)
5. **[백로그]** `forwardRef` 4개 순환 DI 구조 개선 — 신규 서비스 추출 시 단방향 의존 검토 먼저 (WARNING #2)
6. **[소규모]** `engine-driver.interface.ts` 기존 7개 메서드 `@internal` 태그 추가 또는 인터페이스 레벨 문서화로 일관성 확보 (INFO #3)
7. **[소규모]** `DispatchMeta` 타입을 별도 선언으로 분리하거나 `mode` 리터럴 이유 주석 추가 (INFO #4)

## 라우터 결정

routing_status=done (router가 선별):

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명)
- **강제 포함(router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외**: `performance`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (6명)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 타입/JSDoc 전용 변경으로 런타임 성능 영향 없음 |
| dependency | 외부 패키지 추가/변경 없음 |
| database | DB 스키마/쿼리 변경 없음 |
| concurrency | 비동기 흐름/락 변경 없음 |
| api_contract | 공개 API 엔드포인트 변경 없음 |
| user_guide_sync | 사용자 가이드 영향 없음 |
