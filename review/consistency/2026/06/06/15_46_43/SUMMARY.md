# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**MEDIUM** — spec 구현 자체는 정합하나 연관 spec 3개 파일이 PR-B2b 완료 이전의 "잠정 단계" 서술을 미갱신한 채 잔류. 코드 충돌은 없고 후속 개발자 오해 가능성이 있는 수준.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/data-flow/3-execution.md` §1.3 시퀀스 다이어그램에 구 in-memory fast-path(`pendingContinuations` alt 분기 + `detached drive` + `setTimeout resolver fire`) 서술 잔류 — full B3 완료 후 해당 분기는 코드에서 완전 제거됨 | `spec/5-system/4-execution-engine.md` §4.x / §Rationale | `spec/data-flow/3-execution.md` lines 52, 111-115 | 해당 `alt 멀티턴 AI …` 분기 제거, note를 "full B3 완료 — 모든 재개 = §7.5 rehydration 단일 경로"로 갱신, `detached drive` / `setTimeout` 서술도 제거 |
| 2 | Cross-Spec | `spec/4-nodes/6-presentation/0-common.md` §10.9에 `waitForAiConversation` 장수 루프 기반 서술, `resolvePending` forward 참조, `pendingContinuations` 등록 표 잔류 — 해당 함수·Map 전부 full B3에서 제거됨 | `spec/5-system/4-execution-engine.md` §4.x / §Rationale | `spec/4-nodes/6-presentation/0-common.md` lines 393-427 | §10.9 서술을 `processAiResumeTurn` 단발 turn 처리기 모델로 갱신; `resolvePending` → `rehydrateAndResume`; "단계 주" 조건부 서술 제거 후 확정 서술 교체 |
| 3 | Cross-Spec | `spec/5-system/6-websocket-protocol.md` §4.2에 `retry_last_turn` 재진입 서술이 `waitForAiConversation` 참조를 유지 — PR-B2a에서 `processAiResumeTurn`으로 교체됨 | `spec/5-system/4-execution-engine.md` | `spec/5-system/6-websocket-protocol.md` line 352 | 해당 문장에서 `waitForAiConversation` → `processAiResumeTurn(단발 turn 처리기)`로 교체 |
| 4 | Plan Coherence | `claude/impl-concurrency-cap-pr2b` worktree가 동일 spec 파일(`spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`)을 Phase B 이전 모델로 보유한 채 미rebase 상태 — target PR-B2b 머지 후 해당 브랜치가 rebase 없이 push되면 완료형 서술·V087 컬럼 행이 덮어써질 위험 | `spec/5-system/4-execution-engine.md`, `spec/1-data-model.md` | `plan/in-progress/exec-intake-queue-impl.md` PR2b 착수조건 | PR-B2b 머지 직후 `impl-concurrency-cap-pr2b` worktree에 rebase 명시 지시; `exec-intake-queue-impl.md` 착수조건 체크박스 이행 여부 능동 모니터링 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/4-nodes/6-presentation/0-common.md` §10.9 line 426: SoT 참조가 `registerContinuationHandlers`의 `'continue'` listener로 되어 있으나 full B3에서 `applyContinuation → rehydrateAndResume` 일원화됨 | `spec/4-nodes/6-presentation/0-common.md` line 426 | 4-layer SSOT 목록에서 listener 참조를 `ContinuationExecutionProcessor.applyContinuation → rehydrateAndResume`으로 교체 |
| 2 | Cross-Spec | `spec/data-flow/3-execution.md` line 115: `waitForX 직접 invoke(detached drive) + setTimeout 로 resolver fire` — `driveResumeDetached`는 now await됨, setTimeout 스케줄러 삭제됨 | `spec/data-flow/3-execution.md` line 115 | line 115를 `Eng->>Eng: rehydrateAndResume → driveResumeDetached (await) → 처리기 직접 dispatch`로 교체 |
| 3 | Rationale Continuity | detached 드라이브 → awaited 드라이브 전환(`makeDeadlockGuard` → `makeCompletionGuard`): Rationale에 근거가 기록돼 있어 무근거 번복 아님 | `execution-engine.service.spec.ts` | 현행 상태 적합 |
| 4 | Rationale Continuity | `pendingContinuations` Map 테스트 제거, `firstSegmentBarriers`/`runAiConversationLoop` 테스트 제거, `processAiResumeTurn`·`driveCallStackResume`·`driveResumeFrame` 신규 테스트 추가 — 모두 Rationale 결정과 정합 | `execution-engine.service.spec.ts` | 현행 상태 적합 |
| 5 | Convention Compliance | `makeDeadlockGuard` → `makeCompletionGuard` 리네임: error-codes.md 의미 기반 명명 원칙에 더 잘 부합하는 방향의 개선 | `execution-engine.service.spec.ts` | 현행 상태 유지 |
| 6 | Convention Compliance | 테스트 describe 블록 레이블 내 `CRITICAL #1`, `WARNING #8` 등 ai-review 식별자 인라인 노출 — 재실행 시 번호 변경 시 추적성 끊길 수 있음 | `execution-engine.service.spec.ts` | 시간이 지나면 기능 설명만 남기고 접미사는 주석으로 이동 권장 (필수 아님) |
| 7 | Convention Compliance | `CALL_STACK_SCHEMA_VERSION` 상수 참조 전환(구 하드코딩 `1` 대체) — 규약 준수 방향 개선 | `execution-engine.service.spec.ts` | 현행 상태 유지 |
| 8 | Plan Coherence | PR-B2b 완료형 spec 전환(C5) — 코드+spec 동일 브랜치 포함으로 전제 충족, 머지 시점 역전 없음 | `spec/5-system/4-execution-engine.md` | 이상 없음 |
| 9 | Plan Coherence | `exec-park-durable-resume.md` Phase 0 미체크 항목(PR3 rehydration 일반화) — target 범위와 직접 충돌 없으나 PR-B2b 완료 후 검토 필요 | `plan/in-progress/exec-park-durable-resume.md` §Phase 0 | PR-B2b 완료 후 구현됐으면 체크, 미구현이면 후속 plan에 이관 표기 |
| 10 | Plan Coherence | `spec-draft-exec-park-b2-durable.md` frontmatter `worktree: exec-park-durable-resume`와 실제 구현 worktree `exec-park-b2b-04a2f8` 불일치 | `plan/in-progress/spec-draft-exec-park-b2-durable.md` | `plan/complete/` 이동 시 worktree 필드를 `exec-park-b2b-04a2f8`로 정정 또는 note 추가 |
| 11 | Naming Collision | 신규 식별자(`AiSubject`, `DriveSubject`, `ResumeFromCpSubject`, `makeCompletionGuard`, `driveResumeTurn`) — 모두 test-local 스코프, 기존 코드베이스와 충돌 없음 | `execution-engine.service.spec.ts` | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | 연관 spec 3개 파일(`spec/data-flow/3-execution.md`, `spec/4-nodes/6-presentation/0-common.md`, `spec/5-system/6-websocket-protocol.md`)에 PR-B2b 이전 "잠정 단계" 서술 잔류 — WARNING 3건, INFO 2건 |
| Rationale Continuity | NONE | 테스트 변경 전체가 Rationale 결정과 정합. 기각된 대안 재도입 없음 |
| Convention Compliance | NONE | 명명·출력포맷·문서구조 규약 모두 준수. 리네임·상수화는 규약 방향 개선 사례 |
| Plan Coherence | LOW | `impl-concurrency-cap-pr2b` rebase 미이행 시 오버라이트 위험(plan에 이미 착수조건 등재). Phase 0 미체크 항목·frontmatter 불일치 추적 메모 |
| Naming Collision | NONE | 신규 식별자 전부 test-local 스코프, 기존 코드베이스·spec과 충돌 없음 |

## 권장 조치사항

1. **(WARNING 해소 — spec 갱신)** `spec/data-flow/3-execution.md` §1.3 시퀀스 다이어그램에서 `alt 멀티턴 AI pendingContinuations hit` 분기 제거 + `detached drive` / `setTimeout resolver fire` 서술 제거, note를 full B3 완료 확정 서술로 교체.
2. **(WARNING 해소 — spec 갱신)** `spec/4-nodes/6-presentation/0-common.md` §10.9의 `waitForAiConversation` 루프 기반 서술 전체를 `processAiResumeTurn` 단발 turn 처리기 모델로 교체. `resolvePending` → `rehydrateAndResume`, `registerContinuationHandlers` SoT 참조 → `ContinuationExecutionProcessor.applyContinuation → rehydrateAndResume`.
3. **(WARNING 해소 — spec 갱신)** `spec/5-system/6-websocket-protocol.md` §4.2 line 352의 `waitForAiConversation` → `processAiResumeTurn(단발 turn 처리기)` 교체.
4. **(WARNING 해소 — plan 이행 모니터링)** PR-B2b 머지 직후 `impl-concurrency-cap-pr2b` worktree에 main rebase 명시 지시. `plan/in-progress/exec-intake-queue-impl.md` PR2b 착수조건 체크박스 이행 확인.
5. **(INFO — plan 정리)** PR-B2b 완료 후 `exec-park-durable-resume.md` Phase 0 미체크 항목 검토, `spec-draft-exec-park-b2-durable.md` `plan/complete/` 이동 시 frontmatter worktree 필드 정정.