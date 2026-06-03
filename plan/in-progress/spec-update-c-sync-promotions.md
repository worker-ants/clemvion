---
worktree: spec-sync-audit
started: 2026-06-03
owner: developer→planner
---

# spec 승격 위임 — spec-sync §C 코드 갭 구현 완료 후속

> developer 가 `plan/in-progress/spec-sync-structural-followups.md §C` 19건을 모두 구현했다
> (커밋: f72732cc / 87d26c96 / 7f413725 / 50eaec3c / 3450b6ce / 7a324a89). developer 는
> `spec/` read-only 라 frontmatter `status` 승격·본문 정정을 직접 못 한다. **project-planner 가
> 아래를 처리**한다. `/consistency-check --spec` 통과 후 적용.

## 1. frontmatter status: partial → implemented 검토 대상

각 C 항목의 대응 spec. 구현이 spec 본문의 surface 를 충족했으면 `status` 를 `implemented` 로 승격하고
`pending_plans` 에서 해당 gaps 스텁 제거. (gaps 스텁 자체도 complete 처리 후 정리.)

| C | spec 문서 | gaps 스텁 | 비고 |
| --- | --- | --- | --- |
| C-1 | `2-navigation/1-workflow-list.md` | `spec-sync-workflow-list-gaps.md` | status 필터 e2e 동작 |
| C-2 | `5-system/15-chat-channel.md`, `5-system/12-webhook.md` | `spec-sync-chat-channel-gaps.md`, `spec-sync-webhook-gaps.md` | 비활성 chatChannel 202 |
| C-3 | `4-nodes/1-logic/5-variable-modification.md` | — | UI 옵션 정합 |
| C-4 | `4-nodes/1-logic/1-if-else.md` | — | **§6 본문 정정 필요 (아래 §2)** |
| C-5 | `4-nodes/7-trigger/providers/telegram.md` | `spec-sync-telegram-gaps.md` | /help 정적 안내 |
| C-6 | `data-flow/8-notifications.md` | `spec-sync-data-flow-8-notifications-gaps.md` | V070 로 CHECK 정합 |
| C-7 | `2-navigation/14-execution-history.md` | `spec-sync-execution-history-gaps.md` | Nodes 열 카운트 |
| C-8 | `2-navigation/0-dashboard.md` | — | 변수명 명확화(코드 로직 기정합) |
| C-9 | `2-navigation/7-statistics.md` | `spec-sync-statistics-gaps.md` | 1d 프리셋 |
| C-10 | `2-navigation/3-schedule.md` | `spec-sync-schedule-gaps.md` | sort/order |
| C-13 | `4-nodes/7-trigger/1-manual-trigger.md` | — | meta.source schema 선언 |
| C-14 | `5-system/13-replay-rerun.md` | — | DTO 설명(코드 주석) |
| C-15 | `2-navigation/7-statistics.md` | `spec-sync-statistics-gaps.md` | LLM 토큰 DTO 필드 |
| C-16 | `conventions/cafe24-api-metadata.md`, `conventions/migrations.md` | — | dead code 제거 완료 |
| C-19 | `data-flow/4-file-storage.md` | — | KB 삭제 workspace 필터 |
| C-11 | `4-nodes/7-trigger/providers/discord.md` | `spec-sync-discord-gaps.md` | reply modal + verify_key 구현 → "Planned" 표기 해제 검토 |
| C-12 | `4-nodes/7-trigger/providers/slack.md` | `spec-sync-slack-gaps.md` | file_shared/filesUploadV2/response_url 구현 → "Planned" 표기 해제 검토 |

> ⚠ C-11/C-12 는 외부 Discord/Slack 프로토콜 정확성을 mock 기반 e2e 로 검증 못 한다. spec 의
> "Planned" 해제는 실 provider 검증 또는 통합 테스트 확보 후가 안전 — planner 판단.

## 2. 본문 정정 (status 무관 필수)

- **`4-nodes/1-logic/1-if-else.md §6 "regex 연산자 주의"** — "If/Else (와 Switch expression mode)
  핸들러는 컴파일된 정규식을 평가기에 전달하지 않으므로 regex는 현재 항상 false를 반환하는 no-op"
  문단이 **If/Else 에 한해 stale**. If/Else 는 `compileRegexCache` + `options.regex` 로 정상 평가하도록
  고쳤다(C-4). 본문을 "If/Else 는 regex 를 정상 평가한다. Switch expression mode 는 아직 no-op"
  로 정정. 근거: `if-else.handler.ts` execute() + `condition-evaluator.util.ts`.

## 3. 후속 plan 후보 (planner 판단)

- **Switch expression mode regex no-op** — C-4 는 If/Else 만 고쳤다. Switch 도 동일 패턴으로 고칠지
  별도 plan 으로 추적할지 결정 필요.

## 4. ai-review full-branch 발견 (planner triage)

> 가드 충족을 위해 `--branch main` 전수 ai-review (`review/code/2026/06/03/16_16_02`) 를 수행했다.
> 실행 reviewer (architecture/requirement/documentation/api_contract) 가 코드-spec 정합성 확인 중
> **spec 문서 자체의 사전 불일치** 를 보고했다. 아래는 모두 **(a) 제 §C diff 밖** (`main..HEAD` 의
> spec 변경 = 0), **(b) 이미 origin/main 에 있는 spec 문서**, **(c) developer read-only 영역** 이라
> planner 가 처리한다. 제 §C **코드** 에 귀속된 critical/warning 은 없다 (scoped 리뷰 16_02_44 = LOW/0).

- **[CRITICAL] finish_reason 교차 spec 불일치** — `spec/data-flow/11-workflow.md §3.3` 이 `stop/tool_calls/error` 3종만 기재하나 `spec/3-workflow-editor/4-ai-assistant.md §8` 은 사용자 Stop 시 `aborted` 를 명시. §3.3 을 `stop/tool_calls/error/aborted` 로 확장(+ `auto_resume_pending` 중간 마커 주석).
- **[WARNING] auth/integration/workspace/execution API 계약 spec** (`data-flow/2-auth.md §1.1~1.5`, `5-integration.md §1.2`, `12-workspace.md §1.3/1.6`, `3-execution.md §1.3`) — 이미 배포된 breaking change 를 기술한 spec. **프론트엔드 정합성 확인** 권고 (별 작업 — 본 §C 와 무관).
- **[WARNING] 아키텍처/보안 관찰** — `WorkflowsService` SRP, `X-Workspace-Id` 헤더 우선 RBAC, thinking_tokens cost 제외 Rationale 부재 등. spec Rationale 보강 영역.
- **[WARNING] workspace `(owner_id,type)` UNIQUE 마이그레이션 갭** (`12-workspace.md §2.1`) — TypeORM `@Unique` 만 있고 DB 마이그레이션 SQL 부재. (C-16.4 의 node 라벨 케이스와 동류 — planner 가 일괄 결정.)
- **(stale 신호 — 무시 가능)** review 가 `alert_<rule.type>` CHECK 제약 갭(INFO 8)을 플래그했으나 **이미 본 PR C-6/V070 로 해소** 됨. review 가 본 spec 이 갱신 전 상태였던 데서 비롯된 stale 발견.
