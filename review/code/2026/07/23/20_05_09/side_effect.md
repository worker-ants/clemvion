# 부작용(Side Effect) 리뷰 — presentation-thread-optout-drift

## 스코프 확인

리뷰 대상 12개 파일 전부 **비-실행 산출물**이다: plan 문서 2건(`node-output-redesign/form.md`
각주 추가, 신규 `presentation-thread-optout-drift.md`), consistency-check 세션 아티팩트 8건
(`review/consistency/2026/07/23/19_48_09/**` — SUMMARY.md·`_retry_state.json`·`meta.json`·5개
checker 출력), spec 문서 2건(`spec/4-nodes/6-presentation/0-common.md` §4.6,
`spec/conventions/conversation-thread.md` §2.4). `codebase/**` 실행 코드 변경은 0건이므로 함수
시그니처·전역 변수·환경 변수·네트워크 호출·이벤트/콜백 관점의 부작용은 원천적으로 발생하지 않는다.

## 점검한 항목

1. **파일시스템 부작용** — 신규 파일 8건은 모두 프로젝트 관례(`plan/in-progress/**`,
   `review/consistency/<YYYY>/<MM>/<DD>/<hh_mm_ss>/**`)가 명시적으로 규정한 산출 위치이며, 이
   디렉터리들은 gitignore 대상이 아니라 커밋 대상이다(CLAUDE.md "정보 저장 위치" 표 + 사용자 메모
   "review/ 는 gitignored 아님(SUMMARY·RESOLUTION 도 커밋)"). 의도치 않은 생성이 아니라 워크플로가
   정의한 정상 산출물이다.
   - `review/consistency/2026/07/23/19_48_09/_retry_state.json`·`meta.json` 은 로컬 절대경로
     (`/Volumes/project/private/clemvion/.claude/worktrees/...`)를 담고 있어 다른 머신에서는
     비휴대적이지만, 이는 실행되는 코드가 아니라 감사 기록(audit trail)이며 기존 리뷰 세션들도 동일
     패턴으로 커밋돼 왔다 — 정보성(INFO) 수준.

2. **spec 문서(인터페이스) 변경의 사실 정합성** — `0-common.md §4.6`/`conversation-thread.md §2.4`
   변경은 문서가 서술하는 "런타임 동작"에 대한 주장이므로, 부정확하면 향후 개발자가 오독해 실제
   코드에 부작용을 일으킬 수 있는 간접 리스크가 있다. 직접 코드 대조로 검증:
   - `ConversationThreadService.appendInternal`(`codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts:202`) 첫 줄이 `if (this.isOptedOut(args.node)) return;` — 확인.
   - `isOptedOut`(`:243`)이 노드 종류 검사 없이 `node.config?.excludeFromConversationThread === true` 를 읽음 — 확인.
   - `codebase/backend/src/nodes/presentation/**` 전수 grep 결과 `excludeFromConversationThread`
     선언 0건, `.passthrough()` 37건 — 문서가 주장하는 "schema 미선언 + passthrough 로 수동 설정
     시 게이트 동작" 과 일치.
   - 두 spec 파일 diff는 이 실측과 부합하는 **정정**이며 새로운 동작을 도입하지 않는다. 코드 변경
     없이 문서만 사실에 맞추는 순수 교정.

3. **인터페이스/시그니처 변경** — 없음. `excludeFromConversationThread` 필드 자체는 기존에도
   존재하던 필드고 이번 변경은 그 필드에 대한 **서술**만 조정한다(필드 신설·제거·타입 변경 없음).
   `0-common.md` frontmatter(`code:` 목록)도 diff 범위에서 변경되지 않았다.

4. **동반 문제 인지 여부** — `plan/in-progress/presentation-thread-optout-drift.md` 는 자신이
   유발하지 않은 `form.handler.ts` 의 D1(config echo enumeration) 위반을 `codebase/` 라는 이유로
   developer 범위로 명시 분리하고 있다(§비목표 2항). 이 자체가 부작용 방지 조치 — target 이 spec
   문서만 건드리면서 실 코드(handler) 를 건드리지 않도록 스코프를 명확히 고정했다. 코드 변경을
   동반하지 않은 것은 CLAUDE.md 의 "developer 는 `spec/` read-only / project-planner 는 `spec/`,
   `plan/` 만 쓰기" 규약과도 정확히 일치.

## 발견사항

- **[INFO]** consistency-check 세션 아티팩트(`_retry_state.json`, `meta.json`)에 세션 실행 당시의
  로컬 절대경로가 하드코딩되어 커밋된다
  - 위치: `review/consistency/2026/07/23/19_48_09/_retry_state.json`,
    `review/consistency/2026/07/23/19_48_09/meta.json`
  - 상세: `session_dir`/`prompt_file`/`output_file` 값이 모두
    `/Volumes/project/private/clemvion/.claude/worktrees/presentation-thread-optout-drift-4fc462/...`
    형태의 워커 로컬 절대경로다. 다른 개발자 머신·CI 에서는 이 경로가 존재하지 않으므로 재실행에
    쓸 수 없고 순수 기록용이다. 이는 harness 가 세션마다 동일하게 생성하는 표준 산출물이며 본 PR
    이 새로 도입한 패턴이 아니다(다른 커밋된 review 세션에서도 동일 구조 확인됨).
  - 제안: 조치 불요(기존 harness 관례). 필요 시 harness 차원에서 상대경로화를 별도 backlog 로 고려.

## 요약

12개 파일 전부 markdown/JSON 문서(plan 추적, spec 정정, consistency-check 리뷰 산출물)이며
`codebase/**` 실행 코드 변경이 없어 전역 상태·함수 시그니처·환경 변수·네트워크 호출·이벤트/콜백
관점의 부작용 표면이 존재하지 않는다. 유일하게 부작용 관점에서 의미 있는 축은 "spec 문서가 서술하는
런타임 동작 주장이 실제 코드와 일치하는가" 인데, `appendInternal`/`isOptedOut` 게이트 위치·동작과
5개 presentation schema 의 `excludeFromConversationThread` 미선언 + `.passthrough()` 동작을 코드로
직접 대조해 모두 일치함을 확인했다 — 즉 이번 spec 정정은 실제 동작을 바꾸지 않고 서술만 사실에
맞춘 것이며, 향후 개발자를 오도해 부작용을 유발할 소지가 없다. 신규 파일 8건은 프로젝트가 정의한
정상 산출 경로(`plan/in-progress/`, `review/consistency/**`)에 생성되어 "예상치 못한 파일시스템
부작용"에 해당하지 않는다. Critical/Warning 급 부작용 없음.

## 위험도

NONE
