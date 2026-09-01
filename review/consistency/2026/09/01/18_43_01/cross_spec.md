# Cross-Spec 일관성 검토 — retry-ie-residuals (impl-done, scope=spec/5-system/)

## 검토 방법 메모

- 프롬프트 번들의 `## 구현 변경 사항` 섹션은 예산 초과로 완전히 누락되어 있었다. 대신
  워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/retry-ie-residuals-c4a1b2`)에서
  `git diff origin/main...HEAD -- codebase/ CHANGELOG.md` 를 직접 실행해 실제 코드 diff
  (8개 코드 파일 + CHANGELOG, 총 612줄)를 확보한 뒤 분석했다.
- `spec/5-system/**` 델타는 0개 파일 — 이번 PR 은 코드 전용(버그 수정 + 테스트 보강)이며,
  이는 정상이다(코드 전용 PR 이면 spec 델타 0이 당연하다).
- 변경 범위: `codebase/backend/src/modules/execution-engine/{retry-turn.service.ts, ai-turn-orchestrator.service.ts, execution-engine.service.ts}` + 대응 `*.spec.ts` 3개, `codebase/backend/src/modules/executions/{entities/execution.entity.ts, executions.service.ts}`.

## 코드 변경 요약 (cross-spec 판단에 필요한 부분만)

1. **`Execution.error` 엔티티 타입 정정**: `Record<string, unknown>` → `Record<string, unknown> | null`. DB 컬럼은 원래 `nullable: true`였고 TS 타입만 그것을 안 적고 있었다.
2. **retry 성공 종결 시 `execution.error` 를 명시적으로 `null` 로 비운다** (`prepareSuccessTermination` 신설, 자연 종결·defensive fallback 두 경로에 적용). retry 는 정의상 FAILED 실행에서 시작하므로 옛 `error` 를 들고 있었고, guarded UPDATE 가 그 값을 그대로 영속시켜 `status='completed'` + `error` non-null 모순 레코드가 생기던 결함을 고쳤다. 취소(CANCELLED) 경로는 반대로 `error` 를 SET 절에서 제외해 stop 이 쓴 값을 보존한다(W16, 변경 없음).
3. **취소 오분류 수정**: `assertLinkedTransitionApplied` 에서 `markNodeCancelled` 가 reject 해도 그 예외를 흡수(로그만 남김)하고 `ExecutionCancelledError` 를 여전히 던지도록 수정 — 종전에는 원본 DB 예외가 그대로 전파돼 상위가 취소를 FAILED 로 오분류했다.
4. **`executeSync` timeout 경로**가 `updateExecutionStatus` 반환값(`persisted`)을 소비해, 동시 cancel 선점(0행 매칭) 시 warn 로그를 남기도록 수정(형제 경로 `failFirstSegmentSetup` 과 관측 대칭).
5. `markSpawnedRowFailed` 헬퍼 추출(중복 4단계 로직 통합) — 동작 불변.
6. 원자 consume SQL(`jsonb_exists` 가드 + JSONB 키 제거) 형태를 고정하는 테스트 추가 — 동작 불변, 커버리지만 보강.

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 확인 과정에서 대조한 근거이며, 모두 "정합" 방향으로 확인됐다(변경이 기존 spec 을 어기지 않고 오히려 기존 spec 과 code 사이의 잠재 불일치를 해소한다).

- **[INFO] `Execution.error` 엔티티 nullable 정정은 기존 데이터 모델 정의와 일치, 오히려 종전 불일치를 해소**
  - target 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts` (diff), `executions.service.ts` 주석 업데이트
  - 대조 spec: `spec/1-data-model.md` §2.13 Execution `error | JSONB?` (474행), §2.14 하단 "Execution.error ↔ NodeExecution.error 관계" 표
  - 상세: 데이터 모델 문서는 `error` 를 `JSONB?`(nullable)로 이미 정의하고 있었다. 엔티티 TS 타입만 `| null` 을 빠뜨리고 있었던 것이 종전 상태였고, 이번 diff 는 그 타입 선언을 spec 정의에 맞게 정정한 것 — 새 충돌이 아니라 기존 code-spec 불일치의 해소다.
  - 제안: 없음(추가 조치 불필요).

- **[INFO] retry 성공 종결 시 `error` 를 비우는 처방은 EIA 응답 계약과 일치**
  - target 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `prepareSuccessTermination`
  - 대조 spec: `spec/5-system/14-external-interaction-api.md` 497행 `"error": { ... } | null, // failed 시`, 591행 `error` 필드 적용 상태 표 (`failed`, `cancelled`(시스템 취소 한정)에만 적용 — `completed` 는 대상 아님)
  - 상세: EIA 스펙은 `error` 필드가 `failed`/시스템-`cancelled` 상태에서만 채워지고 그 외(특히 `completed`)에는 `null` 이어야 한다고 명시한다. 이번 fix 이전에는 retry 가 성공적으로 `completed` 로 종결돼도 이전 시도의 `error` 가 영속돼 이 계약을 어기고 있었을 가능성이 높다(EIA polling 응답에 `status=completed` + `error` non-null 노출). 이번 diff 는 그 위반을 코드 차원에서 닫는다 — cross-spec 충돌이 아니라 기존 EIA 계약을 code 가 뒤늦게 충족시키는 방향.
  - 취소 경로는 반대로 `error` 를 보존하는데, 이는 EIA 표의 "`cancelled`(시스템 취소 한정)" 항목과도 부합한다(사용자 cancel 은 `error` 없음, 시스템 cancel 은 `error` 있음 — 591행).
  - 제안: 없음.

- **[INFO] 취소 오분류 방지 로직은 문서화된 취소 상태 머신·EngineDriver 계층 구조와 상충하지 않음**
  - target 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` `assertLinkedTransitionApplied`
  - 대조 spec: `spec/5-system/4-execution-engine.md` §1.1/§1.2 상태 전이 표, `spec/conventions/node-cancellation.md`
  - 상세: 이 fix 는 `markNodeCancelled` 가 실패해도 `ExecutionCancelledError` 를 던져 취소로 종결시키도록 하는 방어적 수정으로, `spec/5-system/4-execution-engine.md` 에 문서화된 "취소 기록은 지연되지 않는다"·`ExecutionCancelledError` 관측 경로 서술과 일치한다. spec 에 이 구체적 예외-흡수 동작이 명시돼 있지는 않지만(그 정도 세부는 코드 레벨), 문서화된 어떤 계약과도 모순되지 않는다.
  - 제안: 없음.

- **[INFO] 원자 consume SQL(`jsonb_exists` 가드) 테스트 보강은 기존 spec 서술을 그대로 재확인**
  - target 위치: `retry-turn.service.spec.ts` 신규 테스트
  - 대조 spec: `spec/5-system/4-execution-engine.md` 238행, 472행, §Rationale "retry 재진입의 원자 claim" 등에서 이미 이 SQL 형태(`jsonb_exists` 가드 + `output_data - '_retryState'`)를 상세히 문서화하고 있다.
  - 상세: 동작 변경 없이 이미 문서화된 계약을 테스트로 고정한 것 — 신규 conflict 표면 없음.
  - 제안: 없음.

- **[INFO] plan frontmatter `spec_impact` 가 이번 diff 의 실제 spec 델타(0)와 다르지만, 이는 plan 자체가 이미 설명한 의도된 상태**
  - target 위치: `plan/in-progress/retry-turn-terminal-guard.md`, `plan/in-progress/ie-resume-turn-boundary-cancel.md` frontmatter (`spec_impact: spec/5-system/4-execution-engine.md, spec/conventions/node-cancellation.md`)
  - 상세: 두 plan 모두 본문에 "이 PR 자체는 `spec/` 을 1줄도 바꾸지 않았다(코드 전용). 그럼에도 `none` 이 아닌 이유"를 명시적으로 남겨, `complete/` 이동 전 project-planner 위임(잔여 spec 정정)이 남아 있음을 스스로 기록해 두었다. Cross-spec 관점에서 새로 만든 문제가 아니라 이미 알려진, 별도 트래킹 중인 상태다.
  - 제안: 없음(plan 트래커가 이미 처리 중).

## 요약

이번 PR 은 `spec/5-system/` 을 전혀 건드리지 않는 코드 전용 버그 수정(retry 성공 종결의 잔존 `error` 정리, 취소 오분류 방지, timeout 경로 관측성 보강, 중복 spawn 가드 테스트 고정)이다. 변경된 8개 코드 파일을 `spec/1-data-model.md`(Execution.error 필드 정의), `spec/5-system/14-external-interaction-api.md`(응답 `error` 필드 상태별 존재 규칙), `spec/5-system/4-execution-engine.md`(상태 전이·원자 claim·EngineDriver 계층 구조), `spec/conventions/node-cancellation.md` 와 대조한 결과, 새로운 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌은 발견되지 않았다. 오히려 이번 diff 는 기존 spec 이 이미 명시하고 있던 계약(`error` nullable, 성공 종결 시 `error=null`)과 code 사이의 잠재적 불일치를 해소하는 방향이며, plan frontmatter 의 `spec_impact` 델타 0 상태도 plan 자체가 이미 설명·추적 중이다.

## 위험도

NONE
