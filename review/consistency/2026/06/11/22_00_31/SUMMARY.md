# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 7건 존재하나 모두 차단 수준 아님.

## 전체 위험도
**MEDIUM** — plan 정합성 영역에서 동일 파일의 병렬 브랜치 편집 위험(merge conflict/silent overwrite) 이 발견됨. spec 내용 자체의 직접적 모순은 없음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | Critical 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Plan Coherence | `claude/auth-config-audit` 브랜치가 동일 worktree 에서 `spec/5-system/1-auth.md §4.1` 설정 행을 독립 편집 중 — 병합 순서에 따라 한쪽이 소리 없이 덮어쓸 위험 | `spec/5-system/1-auth.md §4.1` | `claude/auth-config-audit` (plan: auth-config-webhook-followups.md §1) | `audit-coverage-naming` 병합 후 `claude/auth-config-audit` 를 main 에 rebase, §4.1 이 두 변경을 모두 반영하는지 확인 |
| W-2 | Plan Coherence | OPEN PR #545(`claude/unified-model-mgmt-pr4`)가 동일 단락의 `audit-action.const.ts` 링크 경로를 `../../codebase/backend/...` 로 수정 중 — 현 브랜치의 루트 상대 경로와 충돌 가능 | `spec/5-system/1-auth.md §4.1` Action naming 규약 단락 | PR #545 (`unified-model-mgmt-pr4`) | 병합 전 링크를 `../../codebase/backend/src/modules/audit-logs/audit-action.const.ts` 로 수정해 선제 해소. 또는 PR #545 먼저 병합 후 자동 상속 |
| W-3 | Cross-Spec / Convention Compliance (통합) | Planned 감사 액션 `password_change`, `2fa_enable/disable` 이 동일 섹션 선언 `<resource>.<verb>` 규약 미준수 — 구현 시 AUDIT_ACTIONS 에 비규약 이름 추가 위험 | `spec/5-system/1-auth.md §4.1` Planned 표 | `spec/data-flow/1-audit.md §1.1` (동일 이름 전파) | `auth.password_change`, `auth.2fa_enable`, `auth.2fa_disable` 로 재명명. `data-flow/1-audit.md §1.1` 도 동기화. `2fa_enable/disable` 슬래시 병기를 두 행으로 분리 |
| W-4 | Cross-Spec | `spec/2-navigation/4-integration.md §14.3` 감사 로그 목록에서 `integration.updated` 누락 | `spec/5-system/1-auth.md §4.1` / `spec/data-flow/1-audit.md §1.1` (구현됨으로 열거) | `spec/2-navigation/4-integration.md §14.3` | `§14.3` action 목록에 `integration.updated` 추가 |
| W-5 | Naming Collision | `document:graph_error` 이벤트가 `10-graph-rag.md §6` 에서 dead-declared 처리됐으나 nav spec 과 websocket-protocol 두 곳에 정규 이벤트처럼 잔류 — 소비자 코드 혼선 위험 | `spec/5-system/10-graph-rag.md §6` (dead-declared) | `spec/2-navigation/5-knowledge-base.md:182`, `spec/5-system/6-websocket-protocol.md:723` | 두 파일에서 `_error` 를 목록에서 제거하거나 `~~_error~~` deprecated 표기. 정규 이벤트 5종(`_started / _progress / _completed / _retry / _failed`)으로 통일 |
| W-6 | Rationale Continuity | `auth_config` 계열이 과거분사 아닌 현재형을 쓰는 근거가 코드 JSDoc 에만 존재하고 spec Rationale 에 미갱신 | `spec/5-system/1-auth.md §4.1` Action naming 규약 단락 | 코드 `audit-action.const.ts` JSDoc / `spec/data-flow/1-audit.md §Rationale` | §4.1 단락 또는 `data-flow/1-audit.md §Rationale` 에 "auth_config 은 reveal·regenerate 같이 과거분사가 부자연스러운 동사가 섞여 현재형으로 통일" 한 문장 추가 |
| W-7 | Convention Compliance | `spec/5-system/11-mcp-client.md` 에 `## Rationale` 최상위 섹션이 없어 동일 영역 1-auth.md / 10-graph-rag.md 와 구조 불일치 | `spec/5-system/11-mcp-client.md` (전체 구조) | CLAUDE.md 3섹션 구성 규약 / 동일 영역 타 문서 | `## 12. 확장 포인트` 다음에 `## Rationale` 섹션 신설, 본문 인라인 blockquote 근거(stdio 미지원·평탄화 모델·Internal Bridge)를 이관 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `spec/5-system/1-auth.md §1.5.1` 링크에 앵커 누락, `data-flow/12-workspace.md` 최상단으로만 연결 | `spec/5-system/1-auth.md §1.5.1` Rate Limit 행 | 링크에 `#12-멤버-초대-발급` 등 앵커 추가 |
| I-2 | Cross-Spec | `spec/5-system/1-auth.md §4.1` `execution.re_run` 과 `13-replay-rerun.md §11` 간 명시적 cross-ref 없어 미래 동기화 누락 위험 | `spec/5-system/1-auth.md §4.1` | `execution.re_run` 행에 `[§13 Replay/Re-run 상세]` 역참조 각주 추가 |
| I-3 | Cross-Spec | `spec/5-system/1-auth.md §3.2` Audit Log 권한 행이 `spec/2-navigation/9-user-profile.md §4.2` 매트릭스에 없음 (범위 차이로 의도적 가능) | `spec/2-navigation/9-user-profile.md §4.2` | Audit Log 행 추가 또는 두 매트릭스의 scope 차이를 노트로 명시, auth.md §3.2 를 SoT 로 안내 |
| I-4 | Rationale Continuity | `execution.re_run` 레거시 `re_run_initiated` OR 조건 필요성이 `data-flow/1-audit.md §Rationale` 에만 있고 `1-auth.md §4.1` 에 cross-ref 없음 | `spec/5-system/1-auth.md §4.1` | `execution.re_run` 행에 "레거시 row 조회 시 `re_run_initiated` OR 조건 필요 — 상세는 data-flow/1-audit.md §Rationale" footnote 추가 |
| I-5 | Rationale Continuity | `auth_config.reveal` 이 먼저 구현됐고 나머지 4종이 나중에 합류한 순서 설명 없음 | `spec/5-system/1-auth.md §4.1` | §4.1 표 밑에 "(순서는 구현 시점과 무관하며 resource 도메인 기준)" note 추가 |
| I-6 | Convention Compliance | `spec/5-system/10-graph-rag.md` Overview 절이 기술 요구사항·Phase Plan·의존성·미결까지 포함해 Overview / 본문 경계 불명확 | `spec/5-system/10-graph-rag.md` Overview 섹션 | Overview 를 제품 관점 요약으로 압축하고 기술 요구사항은 번호 섹션으로 이동. 또는 현 구조를 의도로 선언하는 Rationale note 추가 |
| I-7 | Convention Compliance | `spec/5-system/1-auth.md` 에 `## Overview` 최상위 섹션 없음 (Rationale 은 있음) | `spec/5-system/1-auth.md` 전체 구조 | `## Overview` 섹션 추가 또는 "기술 명세 중심 문서는 Overview 생략 가능" 을 SKILL.md 에 명시 |
| I-8 | Convention Compliance | `skipReason` `lower_snake_case` 사용이 의도적 구분이나 `error-codes.md §3` 에 미등재 — 외부 검토자 혼동 가능 | `spec/5-system/11-mcp-client.md §6.2` | `error-codes.md §3` 에 "skipReason 은 에러 코드가 아닌 운영 진단 enum" 한 줄 주석 추가 |
| I-9 | Naming Collision | `document:graph_error` dead-declaration 이 data-flow/graph-rag 에는 기록됐으나 nav/websocket-protocol 에 반영 누락 (W-5 와 연동) | `spec/5-system/10-graph-rag.md §6` | W-5 조치와 동일 — websocket-protocol §4.3 표에서도 삭제 또는 strikethrough |
| I-10 | Plan Coherence | `claude/auth-config-audit` 의 `--impl-done` 미완료 상태에서 target 의 spec 변경이 먼저 병합되면 후속 diff-base 가 달라짐 | `plan/in-progress/auth-config-webhook-followups.md §1` | `claude/auth-config-audit` rebase 후 `--impl-done` consistency-check 재실행, plan 체크리스트에 조건 기록 |
| I-11 | Plan Coherence | `spec-code-cross-audit-2026-06-10.md` 잔여 위반 14건(V-04·V-05·V-09~V-14·V-18) 결정 대기 중 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md §후속` | 순차 처리 시 `spec/5-system` 교차 여부 확인 |
| I-12 | Plan Coherence | MERGED stale worktree 4건 cleanup 미완료 | `.claude/worktrees/` | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `integration.updated` §14.3 누락(W-4), Planned 감사 액션 naming 규약 위반(W-3) — 직접 모순 없음 |
| Rationale Continuity | LOW | `auth_config` 동사 시제 근거 spec 미갱신(W-6) — 코드 JSDoc 에는 존재 |
| Convention Compliance | LOW | Planned 감사 액션 `<resource>.<verb>` 불일치(W-3 통합), `11-mcp-client.md` Rationale 섹션 없음(W-7) |
| Plan Coherence | MEDIUM | 동일 파일 병렬 편집(W-1, W-2) — 병합 순서 미조율 시 silent overwrite 위험 |
| Naming Collision | LOW | `document:graph_error` dead-declared 이벤트 nav/websocket-protocol 에 잔류(W-5) |

## 권장 조치사항

1. **(W-1 — 병합 순서 조율, 최우선)** `audit-coverage-naming` 을 main 에 병합한 직후 `claude/auth-config-audit` 브랜치를 main 에 rebase 하고 `spec/5-system/1-auth.md §4.1` 설정 행이 두 변경을 모두 반영하는지 확인한다. `auth-config-webhook-followups.md §1` 체크리스트에 "audit-coverage-naming 병합 완료 확인 후 rebase" 조건 추가.
2. **(W-2 — 링크 경로 선제 정렬)** `spec/5-system/1-auth.md §4.1` 의 `audit-action.const.ts` 링크를 `../../codebase/backend/src/modules/audit-logs/audit-action.const.ts` 로 수정해 PR #545 와 merge conflict 가능성 제거. 또는 PR #545 를 먼저 병합 후 자동 상속.
3. **(W-3 — Planned 감사 액션 재명명)** `spec/5-system/1-auth.md §4.1` Planned 표에서 `password_change` → `auth.password_change`, `2fa_enable/disable` → `auth.2fa_enable` / `auth.2fa_disable` 두 행으로 분리. `spec/data-flow/1-audit.md §1.1` 도 동기화.
4. **(W-4 — integration.updated 추가)** `spec/2-navigation/4-integration.md §14.3` action 목록에 `integration.updated` 추가.
5. **(W-5 — graph_error 잔류 제거)** `spec/2-navigation/5-knowledge-base.md:182` 와 `spec/5-system/6-websocket-protocol.md:723` 에서 `_error` 제거 또는 deprecated 표기, 정규 이벤트 5종으로 통일.
6. **(W-6 — auth_config Rationale 보강)** `spec/5-system/1-auth.md §4.1` 또는 `spec/data-flow/1-audit.md §Rationale` 에 auth_config 현재형 채택 이유 한 문장 추가.
7. **(W-7 — 11-mcp-client.md Rationale 신설)** `spec/5-system/11-mcp-client.md` 끝에 `## Rationale` 섹션 추가, 본문 인라인 blockquote 근거 이관.
8. **(INFO — 낮은 우선순위)** I-1~I-5 링크 앵커·cross-ref·note 보강은 위 7건 처리 후 순차 적용.