# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 격상 진행 가능 (체크리스트 이행 전제).

## 전체 위험도
**MEDIUM** — 스코프 불명확 WARNING 1건 + 격상 후 SoT 이중 정의 가능성 WARNING 1건이 결합되어 MEDIUM. 나머지 checker 는 LOW.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | draft §1 의 의미 기반 명명 긍정 예시(`INTEGRATION_INCOMPLETE`, `OAUTH_STATE_MISMATCH`)가 `code:` frontmatter 지정 범위(`ErrorCode` enum)와 불일치 — 규약 적용 스코프 불명확 | `## 1. 의미 기반 명명` 예시 블록 | `codebase/backend/src/nodes/core/error-codes.ts` `ErrorCode` enum (두 코드 미포함); `auth-oauth.service.ts` 등 문자열 리터럴로만 사용 | `ErrorCode` enum 에 실존하는 코드(`HTTP_5XX`, `LLM_RATE_LIMIT` 등)로 예시 교체하거나, "이 규약은 `ErrorCode` enum 뿐 아니라 프로젝트 전체 에러 코드 문자열에 적용된다" 라는 스코프 확장 문장 추가 |
| 2 | Cross-Spec | 격상 후 `spec/5-system/3-error-handling.md §3.2` 가 여전히 명명 규율 SoT 처럼 읽혀 이중 진실 발생 가능 | 격상 체크리스트 4번 항 | `spec/5-system/3-error-handling.md §3.2` — "UPPER_SNAKE_CASE 에러 코드" 선언, 명명 규율 위임 문구 없음 | 격상 시 체크리스트 4번 반드시 이행: `3-error-handling.md §3.2` 에 "에러 코드 명명 규율은 `conventions/error-codes.md` 가 SoT" 위임 한 줄 추가. 누락 시 이중 정의 발생 |
| 3 | Convention Compliance | plan frontmatter 필수 필드 `started` · `owner` 누락 | `plan/in-progress/spec-draft-error-codes.md` frontmatter (line 1-5) | `.claude/docs/plan-lifecycle.md §4` — `worktree` / `started` / `owner` 3필드 의무 | frontmatter 에 `started: 2026-06-02`, `owner: project-planner` (또는 실제 역할) 추가 |
| 4 | Plan Coherence | `cafe24-install-ratelimit-2891d1` (active, 6 commits ahead, PR 없음)가 `cafe24-backlog-residual.md` 동일 파일을 병행 수정 중 — 머지 시 경합 가능성 | 격상 체크리스트 5번 (`cafe24-backlog-residual.md` F-3 `[x]`) | `plan/in-progress/cafe24-backlog-residual.md` A-3 행 수정 포함 (`cafe24-install-ratelimit-2891d1` branch) | `cafe24-install-ratelimit-2891d1` 먼저 머지 후 rebase 또는 promotion 시 rebase 수행 |
| 5 | Plan Coherence | `cafe24-backlog-residual.md` F-3 이 main 기준 미결(`[ ]`)인데 target 은 결정 완료 상태 — plan 간 불일치 | `plan/in-progress/spec-draft-error-codes.md` § 결정·맥락 | `plan/in-progress/cafe24-backlog-residual.md` F-3 행 (`[ ]` 미결) | 격상 체크리스트 5번 조기 실행 권장. 사용자 결정(2026-06-02) 명시가 있으므로 BLOCK 수준 아님 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `code:` frontmatter 대상 `error-codes.ts` 가 기존 `3-error-handling.md` `code:` 와 물리적으로 겹치지 않음 확인 | draft "## 결정·맥락" | 현행 유지 |
| 2 | Cross-Spec | `node-output.md §3.2` `UPPER_SNAKE_CASE` 규정과 target 의 "표기 재선언 않음" 방침 일치 확인 | draft Overview 4번째 bullet | 현행 유지 |
| 3 | Cross-Spec | `spec/0-overview.md §8` 문서 맵이 완전 목록 아님 — `error-codes.md` 미등재가 반드시 위반은 아님 | 격상 체크리스트 2번 | `conventions/` 별도 진입 문서가 있으면 추가; 없으면 낮은 우선순위 |
| 4 | Rationale Continuity | `4-integration.md` Rationale (c)가 `conventions/error-codes.md §3` forward 참조 미포함 — SoT 이중 정의 가능 | 격상 체크리스트 3번 | 격상 시 체크리스트 3번 이행: forward 참조 + `§1` 역참조로 인라인 원칙 선언 단축 |
| 5 | Rationale Continuity | `3-error-handling.md` 에 역방향 위임 없음 — 독자가 명명 규율 문서 존재를 모름 | 격상 체크리스트 4번 | 격상 체크리스트 4번 이행으로 해소 |
| 6 | Rationale Continuity | `4-integration.md` (c) 의 "의미 기반 명명 원칙" 인라인 선언이 `§1` 과 중복 — 격상 후 중복 정의 | `4-integration.md` Rationale (c) | 체크리스트 3번 수행 시 (c) 본문을 `§1` 역참조로 단축하여 겸하여 정리 |
| 7 | Convention Compliance | `node-output.md §3.2` 역참조가 정확하지만 표기 구체화 가능 | Overview bullet | `§3.2 (code 필드 표기 — SoT)` 로 구체화 (필수 아님) |
| 8 | Convention Compliance | spec 본문 3섹션 구조 (Overview / 본문 / Rationale) 준수 확인 | 격상 대상 spec 본문 전체 | 위반 없음 |
| 9 | Convention Compliance | `status: implemented` + `code:` frontmatter — `spec-code-paths.test.ts` 검증 필요성 인지됨 | 격상 시 frontmatter | 격상 체크리스트 1번 이행으로 해소 (이미 포함됨) |
| 10 | Plan Coherence | `spec/conventions/error-codes.md` 신설 plan 이 다른 active plan 과 파일 경합 없음 확인 | 격상 체크리스트 1번 | 이상 없음 |
| 11 | Plan Coherence | `cafe24-install-ratelimit-2891d1` RESOLUTION 메모 추가 — target worktree 에서 직접 수정 불가 | 격상 체크리스트 7번 | 해당 branch 머지 전/후 RESOLUTION 에 메모 추가 |
| 12 | Plan Coherence | stale worktree 5건 (`cafe24-followups-decisions-a38f26` 등) 정리되지 않음 | `git worktree list` | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |
| 13 | Naming Collision | `id: error-codes` — `id: error-handling`, `id: error-empty-states` 와 유사하나 영역 명확히 분리 | 격상 시 frontmatter | 충돌 없음 |
| 14 | Naming Collision | `code: .../error-codes.ts` — 기존 `3-error-handling.md` / `node-output.md` `code:` 목록에 미포함 (gap 해소) | 격상 시 frontmatter | 격상 체크리스트 4번 이행으로 이중 소유 인상 해소 |
| 15 | Naming Collision | `F-3` 레이블이 `cafe24-backlog-done.md` 완료 항목(swagger 정합)과 중복 사용 | `plan/in-progress/spec-draft-error-codes.md` frontmatter `task:` | 격상 후 `plan/complete/` 이동 시 레이블을 `F-3b` 또는 `F-3-follow-up` 으로 명확화 권장 |
| 16 | Naming Collision | `spec/conventions/error-codes.md` 파일 경로 — 기존 파일과 충돌 없음, kebab-case 부합 | 신설 파일 경로 | 없음 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | §1 예시 스코프 불일치(WARNING), 격상 후 SoT 이중 정의 가능성(WARNING) |
| Rationale Continuity | LOW | 격상 체크리스트 3·4번 미이행 시 forward/backward 참조 미완성 (INFO 3건) |
| Convention Compliance | LOW | plan frontmatter `started`·`owner` 누락(WARNING 1건), 나머지 INFO |
| Plan Coherence | LOW | active worktree 경합 가능성(WARNING), F-3 미결 불일치(WARNING) — 모두 promotion 시 해소 |
| Naming Collision | LOW | 충돌 없음. `F-3` 레이블 중복은 추적성 혼동 수준 (INFO) |

---

## 권장 조치사항

1. **[격상 전 필수]** draft `## 1. 의미 기반 명명` 예시를 `ErrorCode` enum 실존 코드로 교체하거나 "규약 적용 스코프 = 프로젝트 전체 에러 코드 문자열" 명시 (WARNING #1 해소)
2. **[격상 전 필수]** plan frontmatter 에 `started: 2026-06-02`, `owner: project-planner` 추가 (WARNING #3 해소)
3. **[격상 시 필수]** 체크리스트 4번 이행: `spec/5-system/3-error-handling.md §3.2` 에 명명 규율 위임 한 줄 추가 — 누락 시 이중 SoT (WARNING #2 해소)
4. **[격상 시 필수]** 체크리스트 3번 이행: `4-integration.md` Rationale (c) 에 `conventions/error-codes.md §1` forward 참조 추가 및 인라인 원칙 선언 단축 (INFO #4, #6 해소)
5. **[격상 시 권장]** `cafe24-install-ratelimit-2891d1` 머지 타이밍 확인 후 rebase 또는 먼저 머지 — `cafe24-backlog-residual.md` 경합 방지 (WARNING #4 해소)
6. **[격상 후 권장]** `plan/complete/` 이동 시 task 레이블을 `F-3b` 또는 `F-3-follow-up` 으로 명확화 (INFO #15)
7. **[비긴급]** stale worktree 5건 정리: `./cleanup-worktree-all.sh --yes --force` (INFO #12)