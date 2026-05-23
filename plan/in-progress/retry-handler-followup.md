---
worktree: multiturn-error-preserve
started: 2026-05-23
owner: project-planner
---

# Plan — retry_last_turn 백엔드 핸들러 follow-up (Phase D)

> 본 plan 은 `d109dbd3` commit body 에 명시된 follow-up PR 스코프 — WS `execution.retry_last_turn` 서버 핸들러 / `_retryState` DB 영속 정책 정밀화 / 새 NodeExecution spawn.

이 plan 은 코드 리뷰 (review/code/2026/05/23/18_30_48/SUMMARY.md) 의 다음 항목을 추적한다:

## 추적 항목 (SUMMARY WARNING #1~#5, #7, #8)

### WARNING #1 — `_retryState` 소비 원자성 (spec + 구현)

`_retryState` 소비 4단계(lookup → expiresAt 검증 → 신규 NodeExecution spawn → 무효화)가 단일 트랜잭션으로 묶여야 한다는 명시 없음. 동시 retry 시 중복 NodeExecution row 생성 race condition 가능.

**제안**: `SELECT FOR UPDATE` 또는 `UPDATE ... WHERE consumed_at IS NULL RETURNING *` 패턴을 spec에 단일 트랜잭션 의무 요건으로 추가. `project-planner` 에서 `spec/5-system/4-execution-engine.md` 보존 예외 섹션과 `spec/5-system/6-websocket-protocol.md` §4.2 에 명시.

### WARNING #2 — `execution.retry_last_turn` Continuation Bus 경유 여부

`execution.retry_last_turn`이 Continuation Bus(`execution:continuation` 채널) 경유 여부가 미명시. 기존 명령들의 레이어 분리 패턴(WS 게이트웨이 사전 검증 → 엔진 실행)이 이 명령에도 적용되는지 불명확.

**제안**: Continuation Bus 경유 여부와 `FAILED` 상태 검증 주체(게이트웨이 vs 엔진)를 `spec/5-system/6-websocket-protocol.md` §4.2 에 명시. `project-planner` 위임.

### WARNING #3 — `INVALID_EXECUTION_STATE` 사전 검증 요건

`execution.retry_last_turn` 처리 시 Execution 이 `failed` 상태임을 사전 검증해야 한다는 요건 미명시.

**제안**: 에러 코드 표에 `INVALID_EXECUTION_STATE`(또는 `EXECUTION_NOT_FAILED`) 추가 또는 소비 설명에 문구 명시. `project-planner` 위임.

### WARNING #4 — `_retryState` 단일 소비 마킹 방법 정의

`_retryState` 단일 소비 마킹 방법(DB row에서 키 삭제 vs consumed 플래그 vs null-set) 미정의.

**제안**: `_retryState` 소비 시 `NodeExecution.outputData`에서 해당 키를 null-set하거나 제거하는 정책을 spec에 명시. `project-planner` 위임.

### WARNING #5 — `_retryState.expiresAt` TTL SoT 및 cleanup 정책

`_retryState.expiresAt` TTL 기본값(60분)의 단일 진실 위치 미지정. 환경변수 오버라이드 가능 여부 불명확. 만료 row의 DB cleanup 주체·시점 미정의.

**제안**: TTL 기본값과 환경변수 키를 `spec/5-system/4-execution-engine.md` §8 또는 §7에 단일 진실로 명시. cleanup 정책 별도 추가. `project-planner` 위임.

### WARNING #7 — `_retryState` 보존 동작 백엔드 단위 테스트

`_retryState` 보존 동작 백엔드 단위 테스트 부재. `stripControlFields()`가 `_retryState`를 downstream에서 제거하지 않는지, DB에 실제 보존되는지 검증 없음.

**작업**: (a) `_retryState` downstream 보존 검증, (b) retryable error 종결 시 `outputData._retryState` 저장 회귀 가드 추가. `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 에 추가.

### WARNING #8 — `_retryState.expiresAt` TTL 검증 로직 백엔드 테스트

`_retryState.expiresAt` TTL 검증 로직 백엔드 테스트 전무. WS 명령 서버 측 처리 경로 테스트 없음.

**작업**: (a) TTL 미만 → 정상 spawn, (b) TTL 초과 → `RETRY_STATE_NOT_FOUND`, (c) 이미 소비 → `RETRY_STATE_NOT_FOUND`, (d) `retryAfterSec` 미경과 → `RETRY_TOO_EARLY` 케이스 추가. 백엔드 WS 게이트웨이 / execution-engine 서비스 spec 파일에 추가.

## 의존 관계

WARNING #1~#5 는 `project-planner` 에서 spec 명시 후 → 개발자가 구현·테스트.
WARNING #7, #8 는 Phase D 구현 완료 후 테스트 작성.

## 참고 커밋

- `d109dbd3` — docs(spec): multi-turn AI 에러 시 대화 보존 + retryable 분기 + retry_last_turn (follow-up 명시)
- `de73e3ab` — feat(backend/engine): extractAiTurnErrorPayload — details.retryable 자동 분류 (Phase C-min)
