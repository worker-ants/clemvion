# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다

## 전체 위험도
**HIGH** — `4-cafe24.md` 동시 편집 경합(PR #415 미머지) + spec 내 카운트/포트 불일치 다수

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `spec/4-nodes/4-integration/4-cafe24.md` 동시 편집 경합 — branch `claude/cafe24-install-ratelimit-2891d1` (PR #415 `cafe24-followups-bundle`) 가 §9.8 수정 중인 채로 OPEN. `cafe24-allowlist-ui` 가 §8.3 편집 시 merge conflict 확실 | `spec/4-nodes/4-integration/4-cafe24.md §8.3` | PR #415 `cafe24-followups-bundle` (OPEN), branch `claude/cafe24-install-ratelimit-2891d1` (active, 6 commits ahead of main) | PR #415 main 반영 완료 후 `cafe24-allowlist-ui` 에서 rebase 또는 편집 범위를 §8.3 이외로 제한. PR #415 와 직렬화 조율 후 착수 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | Integration 노드 "3종" 표기 — 4-cafe24.md 추가 이후 미갱신 | `spec/4-nodes/_product-overview.md §7`, `spec/4-nodes/0-overview.md §2.4`, `0-common.md` 관련 문서 링크 | `spec/4-nodes/4-integration/4-cafe24.md` 실존 (4종) | `_product-overview.md §7` · `0-overview.md §2.4` 제목을 "4종"으로 수정, Cafe24 행/섹션 추가; `0-common.md` 링크 앵커를 `#7-integration-노드-4종` 으로 갱신 |
| 2 | Cross-Spec | `send_email` 이중 포트(`out`+`error`) vs `node-output.md` Principle 5 (`port: undefined` 단일 출력) 자기 모순 | `spec/4-nodes/4-integration/3-send-email.md §3.2` | `spec/conventions/node-output.md` Principle 5 표; `spec/4-nodes/0-overview.md` 출력 수 열 "1" | `node-output.md` Principle 5 표에서 `send_email`을 `port: string` 행으로 이동; `0-overview.md §2.4` `send_email` 출력 열 → "2 (out/error)"; `_product-overview.md §7.3` 이중 포트 반영 |
| 3 | Cross-Spec | `database_query` 출력 포트 수 불일치 — D4 이후 `success`+`error` 이중 포트인데 `0-overview.md` 는 "1" 표기 | `spec/4-nodes/4-integration/2-database-query.md §3.2` | `spec/4-nodes/0-overview.md` line 173 출력 열 "1" | `0-overview.md §2.4` `database_query` 출력 열 → "2 (success/error)" |
| 4 | Convention Compliance | `4-cafe24.md §4` step 2 가 Principle 7 (D1) 금지 spread 패턴(`{ ...context.rawConfig }`)을 지시 | `spec/4-nodes/4-integration/4-cafe24.md §4 실행 로직 step 2` | `spec/conventions/node-output.md` Principle 7 (D1) — spread 금지, 명시 enumeration 의무 | step 2 를 `integrationId` · `resource` · `operation` · `fields` · `pagination` 명시 enumeration echo 형태로 수정 (spread 금지 주석 포함) |
| 5 | Convention Compliance | `meta.callLimit?` 타입 `string` — 동일 `meta` 블록 내 `callUsage`(number) · `callRemain`(number) 와 타입 이질 | `spec/4-nodes/4-integration/4-cafe24.md §5.1 출력 구조 표` | `spec/conventions/node-output.md` Principle 2 (meta 실행 메트릭 필드 일관성) | `meta.callLimit` 을 `{ current: number; limit: number }` 구조체로 변경하거나, informative/진단 메트릭 주석 명시 및 Principle 2 필드 표에 Cafe24 항목으로 추가 |
| 6 | Convention Compliance | `4-cafe24.md §2` 전방 참조 §9.9 — 독자가 §9.9 없이 §2 를 이해하기 어려운 역전 의존성 | `spec/4-nodes/4-integration/4-cafe24.md §2 설정 UI` | CLAUDE.md 3섹션 구조 권장 (Overview / 본문 / Rationale) | "(배경: §9.9)" → 핵심 이유 1줄 인라인 + "(세부: §9.9)" 형태로 수정 |
| 7 | Plan Coherence | `node-output-redesign` Phase E P2 — `4-cafe24.md §1` `cursor?: string` 잔재 정정과 본 worktree 편집 범위 중복 위험 | `spec/4-nodes/4-integration/4-cafe24.md §1 pagination` | `plan/in-progress/node-output-redesign/README.md` Phase E P2 체크박스 | §1 cursor 잔재를 본 worktree 에서 함께 처리하거나, Phase E 별도 PR 로 예약함을 plan 에 명시 |
| 8 | Plan Coherence | `cafe24-restricted-scopes-followups.md` frontmatter `worktree: TBD` — §1 담당 worktree 미할당 | `plan/in-progress/cafe24-restricted-scopes-followups.md` frontmatter | 병렬 착수 충돌 위험 | frontmatter `worktree` → `cafe24-allowlist-ui`, §1 헤더 아래 담당 worktree 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `node-output.md` Principle 5 `send_email` 성공 포트 `out` vs `undefined` 명명 모호 — 소비자 코드에서 포트 ID 판단 불가 | `spec/conventions/node-output.md` Principle 5 / `3-send-email.md §5.1` | Principle 5 `port: undefined` 범주를 "outputs 1개이며 error 포트도 없는 노드"로 설명 보완; `send_email` 성공 포트를 `'out'` 으로 표에 명시 |
| 2 | Cross-Spec | `0-common.md §4.1 단계 6` Usage 로깅 `api` 인자 책임 위치 — `_product-overview.md` INT-US-05 표와 암묵적 삼중 갱신 의존 | `spec/4-nodes/4-integration/0-common.md §4.1 단계 6` | `0-common.md §4.1 단계 6` 에 "각 노드 api 식별 정보 채우기 정책은 INT-US-05 표가 단일 진실" 명시 |
| 3 | Cross-Spec | `0-common.md §5` 캔버스 요약 표 — Cafe24 포맷과 `4-cafe24.md §7` 간 drift 위험 | `spec/4-nodes/4-integration/0-common.md §5` | `4-cafe24.md §7` 에서 `0-common.md §5` 를 단일 진실로 cross-reference |
| 4 | Rationale Continuity | `enabledTools` materialize-on-first-edit 동작 — 신규 operation 자동 포함 여부 미결정 | `plan/in-progress/cafe24-allowlist-ui.md` / `spec/4-nodes/4-integration/4-cafe24.md §8.3` | 구현 착수 전 "`undefined` 유지 vs 전체 explicit 배열 materialize" 정책 결정 후 `4-cafe24.md §8.3` 또는 `11-mcp-client.md §5.6` 에 명시 |
| 5 | Rationale Continuity | `level='program'` operation 의 AI Agent allowlist UI 처리 방침 미정의 — spec 의 "향후 도입" 유예를 묵시적 선행 구현 | `plan/in-progress/cafe24-allowlist-ui.md` / `spec/4-nodes/4-integration/4-cafe24.md §8.3` | `4-cafe24.md §8.3` 에 `level='program'` 처리 방침 한 줄 추가 (operation 행 ⚠ 적용 여부 또는 현재 구현 범위 외 명시) |
| 6 | Naming Collision | `readCafe24Extras()` — `integration-configs.tsx` 내 비공개 함수, 신설 `cafe24-allowlist-editor.tsx` 에서 직접 import 불가 | `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx:296` | `readCafe24Extras()` 를 export 하거나 공유 helper `cafe24-extras.ts` 로 추출 |
| 7 | Naming Collision | `resolveCafe24OperationLabel()` — 동일하게 비공개 함수, plan 이 "3줄 복제"로 허용하나 drift 위험 | `integration-configs.tsx:399` | 복제 시 `_local` suffix 명시 또는 shared helper 추출 |
| 8 | Naming Collision | `INTEGRATION_SERVICE_UNAVAILABLE` — 공통 에러 코드이나 `0-common.md §4.2` 표에 미등재 | `spec/4-nodes/4-integration/0-common.md §4.2` | `0-common.md §4.2` 공통 에러 코드 표에 추가 (project-planner 위임 사항) |
| 9 | Plan Coherence | stale worktree `ai-agent-emit-facade-277556` — commits ahead 0, PR 없음, 정리 가능 | `.claude/worktrees/ai-agent-emit-facade-277556` | `./cleanup-worktree-all.sh --yes --force` 실행 검토 |
| 10 | Convention Compliance | `4-cafe24.md §6` 에러 코드 표 — prompt 내 truncate. 원본 파일은 정상 | `spec/4-nodes/4-integration/4-cafe24.md §6` | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | Integration 노드 카운트 "3종" 미갱신, `send_email`/`database_query` 이중 포트 불일치, `node-output.md` Principle 5 자기 모순 |
| Rationale Continuity | LOW | `enabledTools` materialize 정책 미결정, `level='program'` UI 처리 방침 미정의 — 구현 전 spec 명시로 해소 가능 |
| Convention Compliance | LOW | `4-cafe24.md §4` spread 패턴 기술 (Principle 7 D1 위반), `meta.callLimit` 타입 이질, `§2` 전방 참조 |
| Plan Coherence | HIGH | `4-cafe24.md` 동시 편집 경합 (PR #415 OPEN, CRITICAL), plan frontmatter `worktree: TBD` 미갱신, Phase E P2 중복 편집 위험 |
| Naming Collision | LOW | `readCafe24Extras()` · `resolveCafe24OperationLabel()` 비공개 함수 재사용 불가, `INTEGRATION_SERVICE_UNAVAILABLE` 공통 표 미등재 |

## 권장 조치사항

1. **(BLOCK 해소 최우선)** PR #415 (`cafe24-followups-bundle`) 머지를 기다린 뒤 `cafe24-allowlist-ui` worktree 에서 `git rebase main` 수행. 또는 PR #415 담당자와 협의해 `4-cafe24.md §8.3` 편집을 직렬화한다.
2. `plan/in-progress/cafe24-restricted-scopes-followups.md` frontmatter `worktree` → `cafe24-allowlist-ui` 로 갱신해 병렬 착수 충돌 방지.
3. `spec/4-nodes/_product-overview.md §7` · `spec/4-nodes/0-overview.md §2.4` Integration 노드 수를 "4종"으로 수정하고 Cafe24 행 추가 (project-planner 위임).
4. `spec/conventions/node-output.md` Principle 5 표에서 `send_email` 을 `port: string` 그룹으로 이동; `0-overview.md §2.4` `send_email`/`database_query` 출력 수 열 정정 (project-planner 위임).
5. `spec/4-nodes/4-integration/4-cafe24.md §4` step 2 를 명시 enumeration echo 형태로 수정 — spread 금지(D1) 위배 제거.
6. `4-cafe24.md §8.3` 에 `enabledTools` materialize 정책 및 `level='program'` UI 처리 방침 명시 후 구현 착수.
7. `readCafe24Extras()` · `resolveCafe24OperationLabel()` export 또는 공유 helper 추출 전략 결정 후 구현.
8. `meta.callLimit` 타입을 `{ current: number; limit: number }` 구조체로 정의하거나 informative 주석으로 명시.