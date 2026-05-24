# 변경 범위(Scope) 리뷰

리뷰 대상: `form-resubmit-fix` — render_form submit 후 동일 form 재호출 회귀 차단
리뷰 일시: 2026-05-24

---

## 발견사항

### [INFO] 파일 3·4 (e2e spec): `user` 테이블 schema drift 보정 — 범위 내
- 위치: `codebase/backend/test/chat-channel-discord.e2e-spec.ts`, `codebase/backend/test/chat-channel-slack.e2e-spec.ts`
- 상세: `role` 컬럼 제거 + `email_verified` 컬럼 추가, `workflow` INSERT 에 `is_active / current_version / created_by` 추가, `trigger` INSERT 에 `name` 컬럼 추가. 이 변경들은 PR #300 (chat-channel Slack·Discord) 에서 도입된 DB schema 변경을 e2e fixture SQL 에 반영하는 것으로, form-resubmit-fix 의 직접 의도와는 관련이 없다.
- 그러나 이 두 e2e 파일은 해당 fixtures 없이는 테스트 자체가 실패하고, `form-resubmit-fix` worktree 가 main(`f9fdd97f`) 위에서 branched 된 시점에 이미 PR #300 이 merge 되어 있는 상태다. 즉 main 의 실제 schema 와 e2e fixture SQL 이 어긋난 상태를 수정하는 필수 정합화 조치이며 scope drift 가 아니다.
- 제안: 별도 커밋으로 분리하거나 커밋 메시지에 "chore: e2e fixture SQL schema 정합화 (PR #300 이후)" 식의 명시를 추가하면 리뷰어가 의도를 쉽게 구분할 수 있다.

### [INFO] 파일 5 (`plan/in-progress/form-resubmit-fix.md`): plan 파일 신규 생성 — 범위 내
- 위치: `plan/in-progress/form-resubmit-fix.md`
- 상세: 진행 중 작업 plan 파일 생성은 프로젝트 관행(CLAUDE.md §정보 저장 위치)에 따른 정상 산출물이다. scope 이탈 없음.
- 제안: 없음.

### [INFO] 파일 6–19 (consistency review 산출물): `review/consistency/` 하위 신규 파일들 — 범위 내
- 위치: `review/consistency/2026/05/24/16_37_48/` 및 `review/consistency/2026/05/24/16_47_37/` 하위 전체
- 상세: consistency-check 프로세스가 생성하는 메타데이터·산출물 파일이다. CLAUDE.md §정보 저장 위치에 지정된 `review/consistency/**` 경로에 정확히 위치한다. 개발자가 직접 작성한 수정이 아닌 워크플로 산출물이므로 scope 이탈에 해당하지 않는다.
- 제안: 없음.

### [INFO] 파일 20–22 (spec 파일 3종): spec 동반 갱신 — 범위 내
- 위치:
  - `spec/4-nodes/3-ai/1-ai-agent.md` (파일 20, diff 는 파일 목록에서 확인됨)
  - `spec/4-nodes/6-presentation/0-common.md` (파일 21)
  - `spec/4-nodes/6-presentation/4-form.md` (파일 22)
- 상세: plan 의 "Spec (spec/) — project-planner 위임 영역" 체크리스트에 명시된 변경이며, 사용자 결정 (2026-05-24, plan 체크리스트 항목 2)으로 spec 동반 갱신을 본 PR 에 포함하기로 확정된 범위다. `§10.9 (4) layer`, `§Rationale`, `§Changelog`, `§4.1 도구 카탈로그 표`, `§6.1.d.ii`, `§6.2 step 2.c`, `§12.6` 신설, `spec/4-nodes/6-presentation/4-form.md` line 128 인라인 예시 모두 plan 에 명시된 갱신 대상이다. scope 이탈 없음.
- 제안: 없음.

---

## 요약

이번 변경은 6개 파일 카테고리로 구성된다. (1) `ai-agent.handler.ts` — `form_submitted` tool_result content 에 `ok:true` + `message` 가드 필드 추가 및 `PRESENTATION_TOOLS_GUIDANCE` 보강: 핵심 버그 수정 범위에 완전히 부합한다. (2) `ai-agent.handler.spec.ts` — 두 기존 테스트 케이스에 가드 필드 단언 추가 + 신규 `systemPrompt` 포함 여부 테스트 1건: 코드 변경과 직접 대응하는 테스트이며 over-engineering 없다. (3) Discord·Slack e2e fixture SQL: PR #300 이후 main schema 와의 정합화이며 필수 수정이다. (4) plan 파일 신규 생성, (5) review/consistency 산출물, (6) spec 3종 동반 갱신 모두 프로젝트 관행과 사용자 결정에 따른 정당한 범위다. 불필요한 리팩토링·포맷팅 변경·무관 파일 수정·임포트 정리·설정 변경은 발견되지 않았다. 전체 변경이 의도된 fix 범위 안에 위치한다.

---

## 위험도

NONE
