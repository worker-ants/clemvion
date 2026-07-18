# Cross-Spec 일관성 검토 — cross_spec

## 검토 방법 및 스코프 확정

`_prompts/cross_spec.md` 가 번들한 "Target 문서"(`spec/conventions/audit-actions.md`,
`spec/conventions/cafe24-api-catalog/**`)를 근거로 검토를 시작하기 전에, 실제 diff 범위를
워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/interaction-type-guard-followup-bd683a`)에서
직접 확인했다.

- `git log origin/main -5` → origin/main 은 `d25f552b2`(fork 이후 무관한 IE 문서 커밋)까지
  전진해 있어 HEAD 와 **양방향으로 발산**한 상태다.
- `git merge-base HEAD origin/main` → `22cc48ef3`(이미 origin/main 에도 포함된
  `interaction-type-registry.md` grep→AST 정정 커밋). 이 fork-point 가 진짜 diff-base다.
- `git diff 22cc48ef3 HEAD -- spec/` → **0 라인**. 이 브랜치의 실제 커밋
  (`465abf334` "self-test fixture 보강 + 레지스트리 주석 grep→AST 동기화")은
  `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 와
  `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` 의 **주석 용어 정정**
  (`grep 가드` → `AST 가드`) + 테스트 픽스처 보강(정규식 리터럴/유니온 타입/객체 프로퍼티 케이스
  추가)뿐이며 `spec/**` 에는 아무 변경도 없다.
- `git show 463aee139 --stat` (직전 완료 plan `resumable-handler-generic-typing`)도
  `spec/**` 무변경 — `plan/complete/resumable-handler-generic-typing.md` 의
  frontmatter 가 `spec_impact: none` 으로 이미 스스로 선언하고 있어 이 사실과 정합한다.

즉 prompt 가 번들한 `audit-actions.md`/`cafe24-api-catalog/**` 덤프는 **이 changeset 의 diff
가 아니라 pre-existing·무변경 spec 콘텐츠**다 (`git diff 22cc48ef3 HEAD --
spec/conventions/audit-actions.md spec/conventions/cafe24-api-catalog/` 도 0 라인). `spec/conventions/`
디렉토리를 알파벳순으로 전체 덤프하다가 크기 상한에 걸려 실제로 관련된 파일
(`interaction-type-registry.md`, `frontend-layering.md` — 알파벳상 `cafe24-api-catalog` 보다
뒤)에 도달하기 전에 잘린 것으로 보인다(하네스 번들링 스코프 산정 결함 — 이번 세션의 spec
변경 내용과는 무관, 이 checker 의 판정에는 영향 없음).

이에 따라 "target 문서(draft)가 spec/** 다른 영역과 충돌하는가"라는 본연의 질문에 대해서는
**검토 대상 draft 자체가 없다** (diff 가 spec/ 을 전혀 건드리지 않음). 다만 안전을 위해
이번 브랜치가 실제로 다루는 도메인(interaction-type 레지스트리 AST 가드, ResumableNodeHandler
제네릭화)에 대응하는 현재 spec 상태를 직접 열어 잔존 모순이 있는지 별도로 확인했다.

## 보충 확인 (draft 는 없지만 관련 spec 현황 점검)

1. `spec/conventions/interaction-type-registry.md` 전문 확인 — §1.2 규칙3·Rationale 이 이미
   "AST 가드"(`REGISTRY_SITES`/`SOURCE_REGISTRY_SITES`) 용어로 일관 기술돼 있고, 이번
   코드 커밋의 주석 정정(`grep 가드`→`AST 가드`)과 **정확히 정합**한다. `code:` frontmatter
   목록에 `interaction-type-exhaustiveness.test.ts` 가 이미 등재돼 있어 신규 코드 파일
   등록 누락도 없다.
2. `ResumableNodeHandler`/`endReason` 관련 — `spec/4-nodes/0-overview.md`,
   `spec/conventions/execution-context.md`, `spec/conventions/node-output.md`,
   `spec/conventions/node-cancellation.md` 모두 `node-handler.interface.ts` 를 코드 SoT 로만
   참조하고 `endReason`/`ResumableNodeHandler` 제네릭 타입 자체를 서술하지 않는다 —
   `interaction-type-registry.md §4` 가 "endReason 은 `@workflow/ai-end-reason` 패키지가
   SoT" 라고 이미 명시해 이번 리팩터(파라미터를 `TEndReason extends ConversationEndReason`
   으로 잠근 것)와 책임 경계가 충돌하지 않는다. 새 모순 없음.

## 발견사항

없음 — 이번 changeset 은 `spec/**` 을 전혀 변경하지 않았고, 도메인적으로 인접한 기존 spec
(`interaction-type-registry.md` 등)도 코드 변경 내용과 이미 정합 상태다.

## 요약

이번 세션 diff(`465abf334`, fork-point `22cc48ef3` 기준)는 프론트엔드 테스트 픽스처 보강과
주석 용어 정정(`grep 가드`→`AST 가드`)에 한정되며 `spec/**` 을 전혀 건드리지 않는다. prompt
가 번들한 `audit-actions.md`/`cafe24-api-catalog/**` 콘텐츠는 이 changeset 과 무관한
pre-existing spec(0-라인 diff)이라 Cross-Spec 충돌 판단의 대상(draft)이 아니다. 도메인적으로
가장 근접한 `spec/conventions/interaction-type-registry.md` 를 직접 열어 확인한 결과 이번
코드 주석 정정과 이미 일치하는 상태이며, 별도로 확인한 `ResumableNodeHandler` 제네릭화
관련 spec 참조들도 책임 경계 충돌이 없다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·
계층 책임 어느 관점에서도 충돌 소지를 찾지 못했다.

## 위험도

NONE
