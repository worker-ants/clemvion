# 신규 식별자 충돌 검토 — interaction-type-guard-followup (#972 후속 ②③)

## 사전 확인 — payload 번들러 결함 재현 (기지 이슈, harness 트랙 별도 분기됨)

본 호출의 prompt 는 "구현 대상 spec 영역: `spec/conventions/`" 로 `spec/conventions/audit-actions.md`,
`spec/conventions/cafe24-api-catalog/**`(`_overview.md`/`application.md`/`application/*.md`/`category.md`/
`category/autodisplay.md` 등, 총 222개 field-level 카탈로그 중 다수) 를 통째로 dump 했다. 이는
**실제 target 이 아니다** — `origin/main...HEAD` 실 diff(`git diff origin/main...HEAD --stat`)를
직접 확인한 결과 `spec/conventions/` 하위 파일은 **단 한 줄도 변경되지 않았다.** 이 PR 이 실제로
건드리는 spec 문서는 `spec/conventions/interaction-type-registry.md` 하나(그나마도 이번 diff 에서는
무변경 — 마지막 수정은 이미 `origin/main` 에 merge 된 선행 커밋 `22cc48ef3`)뿐이다.

이 현상은 `plan/in-progress/interaction-type-guard-comment-false-negative.md` (harness 항목,
2026-07-18 갱신분, 본 PR diff 에 포함)에 이미 기록된 **기지(旣知) 번들러 결함**과 정확히 일치한다:

> "번들러가 실 target(`interaction-type-registry.md`)을 '일부 누락' 이 아니라 **100% 치환**
> (`cafe24-api-catalog/**` 222개 field 파일이 예산 소진)하는 더 심한 형태로 재현.
> checker 5/5 가 worktree 파일 직접 조사로 우회해 BLOCK:NO 는 유효. 본 항목은
> interaction-type-guard 작업과 무관한 harness 인프라 결함이라 **별도 harness task 로 분기**"

즉 이 defect 는 이번 호출(본인)에서 재발했지만, 이미 원인·귀속이 확정돼 별도 harness 트랙으로
분기 처리된 known issue 다. 본 checker 는 이를 새로운 발견으로 보고하지 않고(중복 방지), 대신
prompt 지시(§ "현재 구현 코드의 기준")대로 워크트리를 절대경로로 직접 조사해 진짜 diff 를
근거로 검토했다.

## 실제 diff 근거 (절대경로 워크트리 직접 확인)

`git -C /Volumes/project/private/clemvion/.claude/worktrees/interaction-type-guard-followup-bd683a
diff origin/main...HEAD --stat` 기준 변경 파일:

- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` — self-test fixture 보강
- `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` — JSDoc 주석 3곳 "grep 가드"→"AST 가드" 정정 (문자열 리터럴 소스 자체는 무변경)
- `plan/in-progress/interaction-type-guard-comment-false-negative.md` — 체크박스/해소 기록 갱신
- `review/consistency/2026/07/18/12_04_53/**` — 이전 회차 리뷰 산출물(신규 코드 아님)

`spec/conventions/**`, `codebase/backend/**` 는 이번 diff 에 전혀 포함되지 않는다.

## 점검 관점별 결과

1. **요구사항 ID 충돌** — 신규 spec `id:` 미발급(spec/conventions/ 무변경). 해당 없음.
2. **엔티티/타입명 충돌** — 신규 타입·인터페이스·DTO 없음. `interaction-type-registry.ts` 는 코드 변경 없이 주석 문구만 정정.
3. **API endpoint 충돌** — 신규 endpoint 없음.
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/설정키 없음.
6. **파일 경로 충돌** — 신규 spec 파일 없음. 변경된 3개 파일 모두 기존 경로의 기존 파일 수정.

유일하게 diff 로 "새로 생긴" 문자열은 `interaction-type-exhaustiveness.test.ts` 의 self-test fixture
로컬 리터럴 `"real_union_a"` · `"real_union_b"` · `"real_prop"` · `"ghost_regex"` 다. 이들은 AST 수집기
동작을 검증하기 위한 **테스트 파일 내부 스코프 전용 더미 문자열**이며, `codebase/` 전체를 대상으로
grep 한 결과 해당 테스트 파일 밖에서는 전혀 등장하지 않는다(운영 코드·다른 spec·다른 테스트와 무충돌).
`interaction-type-registry.ts` 의 실제 union 값(`"buttons"`/`"form"`/`"ai_form_render"`/`"waiting_for_document_selection"` 등, SoT: `spec/conventions/interaction-type-registry.md`)과도 별개의 fixture 전용
이름이라 명명 공간이 겹치지 않는다.

## 요약

이번 target 스코프(`interaction-type-guard-followup`, #972 후속 ②③)는 self-test fixture 보강과
JSDoc 주석 정정(grep→AST 용어 정정)에 국한된 순수 리팩터/테스트 강화이며, `spec/conventions/` 를
포함해 신규 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로를 **전혀
도입하지 않는다.** prompt 에 dump 된 대용량 `cafe24-api-catalog/**` 콘텐츠는 실 target 이 아니라
harness payload 번들러의 기지 결함(이미 별도 harness task 로 분기 확정)의 재현이며, 실 diff 대비
"신규 식별자 충돌" 관점에서 보고할 CRITICAL/WARNING 은 없다. 유일한 신규 문자열(test fixture 더미
리터럴 4종)은 테스트 파일 스코프에 갇혀 있어 충돌 표면이 없음을 grep 으로 직접 확인했다.

## 위험도

NONE
