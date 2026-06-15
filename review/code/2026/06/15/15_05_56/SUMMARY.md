# Code Review 통합 보고서

**대상**: execution §1.3 single-node execution
**리뷰 세션**: 2026-06-15 15:05:56
**리뷰어 수**: 13명 실행

---

## 전체 위험도

**MEDIUM** — 아키텍처 레이어 위반(Controller-Repository 직결, 모듈 경계 약화)과 테스트 공백(outputData 어설션 누락, 비-canonical seed 경로 미검증, predecessor seeding e2e 미커버)이 주요 위험. 핵심 기능 흐름과 보안 검증은 정상 구현됨.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | 아키텍처 | `WorkflowsController`가 `ExecutionRepository`를 직접 주입받아 비즈니스 유효성 검사를 Controller 레이어에서 수행 | `workflows.controller.ts`, `workflows.module.ts` | 검증을 service 레이어로 이동 |
| W-2 | 아키텍처 | `WorkflowsModule`이 `Execution` 엔티티를 직접 `forFeature` 등록 — 모듈 경계 약화 | `workflows.module.ts` | ExecutionEngineModule 검증 메서드 export |
| W-3 | 아키텍처 | `ExecutionEngineService` SRP 누적 위반(god-class에 단일 노드 분기 추가) | `execution-engine.service.ts` | 중기 분리, v1 범위 외면 TODO/plan 기록 |
| W-4 | 아키텍처 | `handleRunThisNode`에서 `useExecutionStore.getState()` 직접 호출 — stale closure 위험 | `workflow-canvas.tsx` | selector 구독 또는 주석 명시 |
| W-5 | 보안 | engine 레이어에서 previousExecutionId 워크스페이스 소속 재검증 없음(defense in depth) | `execution-engine.service.ts` | seed 시 workflowId 일치 2차 assertion |
| W-6 | 테스트 | engine 단위 테스트에 `outputData` 최종값 검증 없음 | `execution-engine.service.spec.ts` | save outputData 어설션 추가 |
| W-7 | 테스트 | 비-canonical(bare) outputData seed 분기 단위 테스트 전무 | `execution-engine.service.spec.ts` | bare object seed 케이스 추가 |
| W-8 | 테스트 | e2e가 predecessor seeding(previousExecutionId DB seed) 흐름 미검증 | `workflow-execution.e2e-spec.ts` | F2 케이스 추가 |
| W-9 | 테스트 | controller workflow 404 케이스 없음 | `workflows.controller.spec.ts` | findById throw 케이스 추가 |
| W-10 | 테스트 | `handleRunThisNode`/`InfoTab` 프론트엔드 테스트 전무 | `workflow-canvas.tsx`, `node-settings-panel.tsx` | RTL 컴포넌트 테스트 추가 |
| W-11 | 요구사항 | disabled 노드를 singleNodeId 로 지정 시 동작 미정의(빈 COMPLETED) | `execution-engine.service.ts` | controller 400 또는 spec 범위한계 명시 |
| W-12 | 요구사항 | 비-canonical scalar outputData 처리 견고성 미확인 | `execution-engine.service.ts` | scalar 입력 방어/테스트 |
| W-13 | 유지보수성 | canonical 판별 로직 인라인 중복(adapter 외부) | `execution-engine.service.ts` | `isCanonicalHandlerOutput` 가드 export |
| W-14 | 동시성 | `handleRunThisNode` status 가드 후 save await 사이 TOCTOU | `workflow-canvas.tsx` | 락 플래그 또는 await 후 재확인 |
| W-15 | 문서화 | catch 블록 silent fail 의도 미문서화 | `workflow-canvas.tsx` | TODO 주석 |
| W-16 | 문서화 | InfoTab nodeId prop 추가 배경 주석 없음 | `node-settings-panel.tsx` | 주석 추가 |
| W-17 | 유저 가이드 | 단일 노드 실행 유저 가이드(05-run-and-debug/) 갱신 누락 | `content/docs/05-run-and-debug/` | ko/en 안내 추가 |
| W-18 | 성능 | `getLatestPredecessorOutputs` LIMIT 없이 전체 행 적재 후 앱 레벨 dedup | `execution-engine.service.ts` | DISTINCT ON 쿼리(디버그 전용 저위험) |

---

## 참고 (INFO) — 발췌

- I-1~I-7 보안: IDOR/인가/입력검증/XSS/SQLi 정상.
- I-8~I-10 API 계약: additive·202 패턴 일관·UUID 검증 완비.
- I-13~I-14 DB: V098 무중단 안전, FK 미추가 선례 일관.
- I-20 요구사항: §1.3 핵심(트리거·진입점·범위·입력·출력) 전체 구현.
- I-21 [SPEC-DRIFT]: spec §1.3 출력 행에 "단일 노드만 타임라인 표시" 미기술 → spec 갱신 경로.
- I-31 동시성: `getLatestPredecessorOutputs` finishedAt 동점 tie-break 미보장 → `{finishedAt:DESC, id:DESC}`.
- I-33 변경 범위: 전 파일 plan 범위 내, 범위 외 수정 없음.

---

## 라우터 결정

- **실행(13)**: security, api_contract, architecture, database, side_effect, requirement, testing, scope, maintainability, documentation, concurrency, performance, user_guide_sync
- **제외**: dependency (changeset 무관)
- **강제 포함(router_safety, 8)**: database, documentation, maintainability, requirement, scope, security, side_effect, testing

**Critical 0 / Warning 18.**
