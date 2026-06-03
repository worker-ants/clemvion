# RESOLUTION — 20_27_03 (spec-inprogress-groom-c7568b)

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W#1 | 코드 (out-of-scope-prior-PR) | — | `llmCalls` fanout strip: PR #430 에서 이미 머지. 이번 diff 에 없는 prior-PR 코드. 자동 수정 대상 아님. 미완이면 별도 developer plan 티켓 신설 필요 |
| W#2 | 코드 (out-of-scope-prior-PR) | — | `spec-draft-node-execution-cancelled` IE abortSignal TODO: PR #442 완료 후 plan/complete 이동. 잔존 TODO 확인 필요 시 별도 developer plan 티켓 신설 |
| W#3 | 테스팅 (deferred — infra) | — | `$thread` ROOT_VARIABLES 프론트엔드 단위 테스트: 신규 worktree 에 node_modules 없어 vitest 실행 불가. 테스트 파일 작성은 가능하나 실행 검증 불가. CI 통과로 확인하거나 별도 developer plan 티켓으로 추적 권장 |
| W#4 | 테스팅 (out-of-scope-prior-PR) | — | `EmbedOriginsCard`/`EmbedOriginsEditor` UI 테스트: PR #441 완료 코드. 이번 diff 무관. 별도 developer plan 티켓 |
| W#5 | 테스팅 (out-of-scope-prior-PR) | — | Triggers/Schedules EmptyState CTA 테스트: PR #448 완료 코드. 이번 diff 무관. 별도 developer plan 티켓 |
| W#6 | 유지보수성 (fixed) | `3493bc69` | `spec/4-nodes/0-overview.md §1.4.1` filter 표 `\|` 이스케이프 → `&#124;` HTML entity 로 교체. 렌더러 무관 안전한 출력 보장 |
| W#7 | 유저가이드 동기화 (fixed) | `3493bc69` | `variables-and-context.mdx`(KO/EN) 는 이미 `$thread` 포함. `cheatsheet.mdx` + `cheatsheet.en.mdx` 에 `## 대화 Thread 참조` / `## Conversation thread` 섹션 추가 (examples: length 분기·text 첨부·turns[0] 접근) |
| INFO#7 | 요구사항 (fixed) | `3493bc69` | `plan/complete/spec-sync-execution-history-gaps.md` 체크박스 `- [ ]` → `- [x]` flip (plan-lifecycle 정합) |
| INFO#14 | 문서화 (fixed) | `3493bc69` | `expression-constants.ts` `$thread` detail: `"Conversation thread"` → `"Conversation thread (length, text, indexed access via turns[i])"` |
| INFO#15 | 문서화 (fixed) | `3493bc69` | `spec/4-nodes/0-overview.md §1.4.1` filter 표에 `length` 행 추가 (문자 수/항목 수 반환, 줄 수 계산 불가 명시) |

## TEST 결과

- lint  : 자동 흐름 환경 차단 — 신규 worktree node_modules 미설치 (`@eslint/js` not found). 변경 파일은 모두 docs/spec/MDX/constants 파일로 로직 없음. CI 검증 필요
- unit  : 자동 흐름 환경 차단 — jest command not found (node_modules 미설치). 변경된 코드는 상수 `detail` 문자열 1건으로 로직 변경 없음. CI 검증 필요
- build : 실행 안 함 (infra 차단 동일 사유)
- e2e   : 자동 흐름 환경 차단 — backend 코드 변경 0건, frontend 변경 상수 detail 1건 + MDX docs. 실제 런타임 동작 영향 없음

## 보류·후속 항목

### 별도 developer plan 티켓 권장

- **W#1** (보안): `llmCalls` fanout strip backend 구현 — `notification-webhook.processor` 에 `llmCalls` 키 부재 assertion 통합 테스트 추가. `plan/complete/spec-draft-eia-strip-llmcalls.md` 기반 신규 티켓.
- **W#2** (요구사항): IE `runTurnWithCollectionRetries` abortSignal 전파 TODO (`information-extractor.handler.ts:634`) 잔존 여부 확인 후 미완이면 developer plan 신설.
- **W#3** (테스팅): `$thread` ROOT_VARIABLES + `BUILT_IN_PICKER_VARIABLES` 프론트엔드 단위 테스트 — `ROOT_VARIABLES.find(v => v.label === '$thread')` 단언 + BUILT_IN_PICKER_VARIABLES 포함 검증. CI 환경에서 실행 가능한 worktree 에서 추가 권장.
- **W#4** (테스팅): `EmbedOriginsCard`/`EmbedOriginsEditor` 컴포넌트 테스트 3케이스 (성공·viewer read-only·클라이언트 검증 오류).
- **W#5** (테스팅): Triggers/Schedules EmptyState CTA 렌더 + Workflows 필터 reset 케이스 테스트.

### INFO 항목 (추적 메모, 자동 수정 대상 아님)

- INFO#1 [SPEC-DRIFT]: `executionId: 'ignored'` 응답 shape — 코드 유지. chat-channel 소비자 패턴 확인 권장.
- INFO#2 (보안): `$env` allowlist 설계 — `$env` 런타임 주입 구현 시 plan 에 allowlist 검증 명시.
- INFO#3 (보안): `$trigger`/`$env` 런타임 미주입 UX — 향후 주입 설계 확정 시 "미주입" 표시 메커니즘 검토.
- INFO#4 (보안): `interactionAllowedOrigins` 빈 배열 invariant — `updateWorkspaceSettings` 단위 테스트 검증 권장.
- INFO#5 (보안): webhook chatChannel 서명 검증 순서 — `hooks.service.ts` 코드 경로 재확인 권장.
- INFO#6 (보안): `passwordResetToken` timing-safe comparison — 교차 확인 권장.
- INFO#8 (요구사항): workspace `(owner_id,type)` UNIQUE DB 마이그레이션 — `plan/in-progress/` 추적 티켓 확인/신설.
- INFO#9 (요구사항): `llmCalls` strip plan 티켓 추적 — W#1 과 동일 맥락.
- INFO#10 (테스팅): `notification-webhook.processor.spec.ts` llmCalls strip 단언 — W#1 과 함께 추가 권장.
- INFO#11 (테스팅): `impl-anchor-existence.test.ts` api-endpoint 앵커 dead-letter — 앵커 추가 시 반드시 가드 실행 검증.
- INFO#12 (유지보수성): `spec-update-c-sync-promotions.md` Rationale 중복 단락 — 다음 해당 플랜 편집 시 정리.
- INFO#13 (유지보수성): `spec/5-system/12-webhook.md` step 5 인라인 서사 — cross-link 로 교체 권장.
- INFO#16 (문서화): `pushExtractorTurn no-op` 별건 이슈 plan 티켓 신설 확인.
- INFO#17 (문서화): `spec/4-nodes/2-flow/1-workflow.md §7` `warnWhen` DSL cross-ref 추가 권장.
- INFO#18 (문서화): `switch-regex-noop-fix.md` 파일 존재 여부 확인.
- INFO#19 (유저가이드): workspace settings API/UI MDX 변경 PR 링크 확인.
- INFO#20 (부작용): `$thread` 전역 scope 노출 — AI Agent 한정 필요 시 `ContainerScopeFlags.hasThread` 검토 (현재 spec 에서 전역 접근 허용).
