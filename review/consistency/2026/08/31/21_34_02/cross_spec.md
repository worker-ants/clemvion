# Cross-Spec 일관성 검토 — error-codes 레이어 분리 (impl-done, scope=spec/conventions/)

## 검토 방법 메모

`_prompts/cross_spec.md` 번들의 `spec/conventions/error-codes.md` 본문이 컨텍스트 예산으로 절단되어 있어,
해당 spec 은 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/error-codes-layer-split-6aae00`)에서
절대경로로 직접 읽었다. 아울러 diff 가 참조하는 다른 spec 영역(`spec/1-data-model.md`,
`spec/5-system/4-execution-engine.md`, `spec/5-system/3-error-handling.md`,
`spec/5-system/14-external-interaction-api.md`, `spec/data-flow/3-execution.md`,
`spec/conventions/node-output.md`)도 grep/직접 열람으로 대조했다.

이 브랜치는 `spec/conventions/` 델타 0개 파일(코드 전용 PR)이다 — `error-codes.ts` 안에 이미 있던 4개
엔진 레벨 맨 문자열 코드(`EXECUTION_QUEUE_WAIT_TIMEOUT` / `WORKER_HEARTBEAT_TIMEOUT` /
`SERVER_INTERRUPTED` / `WEBCHAT_IDLE_TIMEOUT`)를 같은 파일 안 신설 `EngineErrorCode` const 로
앵커링하고, 앵커 없는 재발을 막는 repo-guard(AST 기반, 5형태 커버리지)를 추가하는 **순수 리팩터**다.
값(wire 상 문자열)은 변경되지 않았다.

## 발견사항

- **[INFO]** `error-codes.md` Overview 가 `EngineErrorCode` 를 대표 surface 로 명명하지 않음
  - target 위치: `codebase/backend/src/nodes/core/error-codes.ts` 신설 `EngineErrorCode` const (line 239~) 및 그 JSDoc
  - 충돌 대상: `spec/conventions/error-codes.md` Overview — "본 규율은 `code:` 의 `ErrorCode` enum(...) — 명명이 중앙화된 **대표 surface**) 뿐 아니라 프로젝트 전체의 에러 코드 문자열에 적용된다" 문장이 대표 surface 로 `ErrorCode` 만 명시하고 신설된 자매 const `EngineErrorCode` 는 이름으로 언급하지 않는다
  - 상세: 모순은 아니다 — "프로젝트 전체 에러 코드 문자열에 적용" 이라는 규율 자체가 이미 `EngineErrorCode` 를 포괄하고, §3 이 `WORKER_HEARTBEAT_TIMEOUT`(신설 값 중 하나)을 이미 historical-artifact 로 등재해 놓았으며, 코드 쪽 JSDoc 이 그 §3 링크를 정확히 인용한다(`SoT: spec/conventions/error-codes.md §3`). 다만 spec 문서만 읽는 독자 입장에서는 파일 안에 `ErrorCode` 외에 또 다른 명명 SoT const 가 있다는 사실을 spec 쪽에서 알 길이 없다 — frontmatter `code:` 는 파일 단위(`error-codes.ts`)라 여전히 매치하므로 `spec-code-paths` 가드는 통과하지만, "대표 surface" 문구가 이제 그 파일 안의 *두* const 중 하나만 가리키는 낡은 서술이 됐다
  - 제안: 필수 아님(코드 전용 PR 이 spec 을 갱신할 권한도, 필요도 없음). 다음에 `error-codes.md` 를 손댈 때 Overview 문장에 "`ErrorCode`(노드 핸들러 `output.error.code`) / `EngineErrorCode`(엔진 `Execution.error`/`NodeExecution.error`)" 두 surface 를 병기하면 코드-스펙 미러가 완전해진다

## 요약

이 diff 는 `spec/conventions/` 를 전혀 변경하지 않는 코드 전용 리팩터이며, 데이터 모델·API 계약·요구사항
ID·상태 전이·RBAC·계층 책임 어느 관점에서도 다른 spec 영역과 충돌하지 않는다. 신설 `EngineErrorCode` 의
네 값은 모두 이미 `spec/1-data-model.md`(`Execution.error`/`NodeExecution.error` 필드 설명), `spec/5-system/
4-execution-engine.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/14-external-interaction-api.md`,
`spec/data-flow/3-execution.md` 등 여러 영역에서 **기존에 이미 문서화된 코드 값**이며, 특히
`WORKER_HEARTBEAT_TIMEOUT` 은 `error-codes.md §3` 의 historical-artifact 레지스트리에 rename-불가 사유까지
등재돼 있고 신설 JSDoc 이 그 텍스트를 그대로 미러링한다. `ErrorCode`(노드 핸들러 `output.error.code`,
`node-output.md §3.2` 관할) vs `EngineErrorCode`(엔진이 직접 싣는 `Execution.error`/`NodeExecution.error`)의
레이어 분리도 `spec/1-data-model.md` 가 이미 서술하던 "노드 핸들러 어휘 + 엔진 인프라 차원의 코드" 구분과
정확히 대응하며, 값 자체는 하나도 바뀌지 않아 wire 계약 파괴 위험이 없다. `ANCHORED_ELSEWHERE` 예외 목록에
오른 다른 코드들(`INVALID_EXECUTION_STATE`·`ERROR_PORT_FALLBACK`·trigger 파라미터 4종·`RESUME_*`)도
`error-codes.md §4.2` 및 관련 spec 문서와 표현이 일치한다. 유일한 관찰은 spec Overview 문구가 신설 const 를
이름으로 언급하지 않는 사소한 서술 갭(INFO)뿐이며, 코드 쪽이 이미 정확한 spec 앵커를 인용하고 있어 실질
위험은 없다.

## 위험도

NONE
