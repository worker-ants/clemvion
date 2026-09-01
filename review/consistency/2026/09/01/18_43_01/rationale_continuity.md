# Rationale 연속성 검토 결과

## 검토 범위 재확인

이 프롬프트의 `## 구현 변경 사항` 섹션은 컨텍스트 예산으로 완전히 절단되어 있었다(diff 본문
0줄). 프롬프트 지시에 따라 target worktree
(`/Volumes/project/private/clemvion/.claude/worktrees/retry-ie-residuals-c4a1b2`)에서
`git diff origin/main...HEAD -- codebase/`를 직접 실행해 실제 8파일 diff를 확보하고 이를
근거로 분석했다. 대상 diff는 `retry-turn.service.ts`, `ai-turn-orchestrator.service.ts`,
`execution-engine.service.ts`, `execution.entity.ts`, `executions.service.ts` 및 대응
`.spec.ts` 4개, 관련 plan 문서(`retry-turn-terminal-guard.md`,
`ie-resume-turn-boundary-cancel.md`) 갱신, `CHANGELOG.md`를 포함한다.
`spec/5-system/` 자체는 이 브랜치에서 변경되지 않았다(0 델타 — 정상, 코드 전용 PR).

## 발견사항

이 diff는 기각된 대안을 재도입하거나 합의 원칙을 위반하는 지점을 찾지 못했다. 오히려
기존 Rationale을 정확히 인용하며 그와 **구분되는 새 결정**을 명시적으로 문서화한, Rationale
연속성 관점에서 모범적인 사례에 가깝다. 아래는 확인한 근거다 (CRITICAL/WARNING 없음).

- **[INFO] `prepareSuccessTermination`의 `error=null` 은 W16(취소 시 `error` 미저장) 결정과
  충돌하지 않고 명시적으로 구분된다**
  - target 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
    `prepareSuccessTermination()` (신규 private 메서드), 호출부
    `completeRetryExecution()`·`resumeGraphAfterRetry()` 자연 종결 블록.
  - 과거 결정 출처: `spec/conventions/node-cancellation.md` `## Rationale` §"왜 취소 시각
    보존 메커니즘이 두 가지인가" — "취소 시 `error` 를 저장하지 않는 것도 양쪽 공통이다 —
    REST 로 내부 예외 메시지가 노출되는 것을 막고, 취소를 실패와 구분하기 위함이다." 코드
    쪽 대응 원문은 `retry-turn.service.ts` `finalizeGuarded()`의 CANCELLED 분기 JSDoc —
    "`error` 는 SET 절에서 아예 제외한다 — W16(취소 시 error 미저장)과 동일 원칙".
  - 상세: 신규 `prepareSuccessTermination()`은 COMPLETED(성공) 종결 두 경로에만 적용되고
    `execution.error = null`을 명시적으로 쓴다. 이는 W16이 다루는 CANCELLED 경로(그대로
    `finalizeGuarded`의 SET 절 제외 유지, diff 미변경)와는 다른 상태 전이이며, 코드 JSDoc이
    "취소(CANCELLED) 경로와는 처방이 다르다... 이번 시도가 성공했다는 사실이 최신 진실이라
    옛 값을 지우는 것이 맞다"고 W16을 인용하며 정확히 구분한다. `finalizeGuarded`의 CANCELLED
    분기 자체는 diff에서 손대지 않았다(grep 확인 — 해당 블록은 변경 라인에 없음).
  - 제안: 없음. 관측한 그대로 유지 — 새 결정(성공 경로의 stale error 청소)이 기존 원칙(취소
    경로의 error 미저장)의 적용 범위를 침범하지 않고 병존한다.

- **[INFO] `assertLinkedTransitionApplied`의 `markNodeCancelled` reject 흡수는 기존
  "choke point 예외" 패턴의 확장이지 신규 원칙 도입이 아니다**
  - target 위치: `ai-turn-orchestrator.service.ts` `assertLinkedTransitionApplied()` —
    `markNodeCancelled` 호출을 `try/catch`로 감싸 reject 시 로그만 남기고
    `ExecutionCancelledError`는 그대로 throw.
  - 과거 결정 출처: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:64`
    "choke point 예외 (ai-review WARNING #1, 2026-07-27, 7차 라운드)" — 타임아웃/실패
    경로에서 원 예외가 상위 분류를 가리지 않도록 흡수하고 choke point로 우회 마킹하는
    기존 패턴. `execution-engine.service.ts:652`·`:4306`도 같은 원칙을 "`CoreEngineDriver`
    JSDoc 의 choke point 예외 참조"로 명시 인용한다.
  - 상세: 새 try/catch는 이 기존 패턴을 `markNodeCancelled`(짝 NodeExecution 마킹)라는
    새 호출부에 적용한 것으로, "실패해도 상위 분류(취소)를 관측 가능하게 유지하고 원인은
    로그로 남긴다"는 동일 설계 철학이다. plan 문서(`ie-resume-turn-boundary-cancel.md`
    "8차 라운드" 항목)는 이를 "감사 적재 실패(`#1259`)와 같은 판단"이라고 직접 명시해
    선례를 인용한다.
  - 제안: 없음. 다만 이 흡수로 인해 짝 `NodeExecution`이 non-terminal로 영구 잔류할 수
    있다는 trade-off를 코드·plan 양쪽이 이미 자인하고 있고(로그가 유일한 관측 수단),
    이 잔류에 대한 별도 backstop(재스윕)은 없다 — plan에 "우선순위 판단"으로 열려 있는
    항목(`markExecutionFailed` 공용 헬퍼 승격 미착수)과 같은 계열이므로 재개 신호를
    그 항목에 유지할 것.

- **[INFO] `Execution.error` 엔티티 타입 `| null` 추가는 기존 spec 문서와의 drift를
  줄이는 정정이지 결정 번복이 아니다**
  - target 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts`
    `error: Record<string, unknown> | null`.
  - 과거 결정 출처: `spec/1-data-model.md:325` `Execution.error | JSONB? | 실패 시 에러
    요약 {code, message}` — DB 컬럼은 애초에 nullable로 문서화돼 있었다.
  - 상세: 엔티티 TS 타입만 `| null` 없이 선언돼 있던 것을 DB/spec과 일치시킨 정정이다.
    `executions.service.ts`의 관련 JSDoc도 이전 서술을 취소선 없이 삭제하지 않고
    "그 정정 이전 이력이다"로 남겨 이력을 보존한다 — CLAUDE.md 프로젝트 관례상 요구되는
    "원문은 취소선으로 남기고 인접 서술 건드리지 않는다" 정신에 부합하는 처리 방식이다
    (다만 이 정정은 developer가 자신이 쓴 예고 문장을 고친 자기반증형 소정정 케이스는
    아니고, 실제 nullable 컬럼과의 타입 drift를 바로잡은 일반 버그 수정이다).
  - 제안: 없음.

## 요약

이 diff는 새 결정을 도입할 때마다 그것이 왜 기존 Rationale(특히 W16 — 취소 시 error 미저장,
choke point 예외 패턴, `#1259` 감사 실패 흡수 선례)과 다른 축의 문제인지를 코드 JSDoc·
CHANGELOG·plan 문서 세 곳에서 일관되게 교차 인용하며 설명한다. 기각된 대안을 재도입하거나
합의 원칙을 우회하는 지점은 발견되지 않았고, 상태 전이 종결 시 `error` 필드 처리라는 민감한
영역에서 "성공 경로(비움)"와 "취소 경로(보존, W16)"를 코드 레벨에서 정확히 분리 유지했다.
spec 델타가 0인 것도 이 PR의 성격(내부 버그 수정 + 관측성 보강, 새 API/UX 계약 없음)과
정합한다.

## 위험도
NONE
