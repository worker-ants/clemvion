# 신규 식별자 충돌 검토 — spec/conventions/spec-impl-evidence.md

검토 모드: spec draft 검토 (`--spec`)
Target: `spec/conventions/spec-impl-evidence.md` (기존 파일 수정 — `git diff HEAD` 로 실제 신규 도입분을 특정해 검토)

## 진단 방법

target 은 이미 저장소에 존재하는 컨벤션 문서(`status: implemented`)라, "신규 식별자" 는 문서 전체가 아니라 **이번 diff 가 새로 도입한 부분**으로 좁혔다. `git diff HEAD -- spec/conventions/spec-impl-evidence.md` 로 확인한 신규 도입분:

1. frontmatter `code:` 에 `codebase/frontend/src/lib/docs/__tests__/plan-link-integrity.test.ts` 추가
2. §4.2 표에 신규 가드 행 2개 — `spec-plan-completion.test.ts` (**2번째 invariant**), `plan-link-integrity.test.ts` (build 차단, **ratchet**)
3. `## Rationale` 신설 `R-11` 절

이 신규 식별자들이 기존 사용처(`spec/`, `plan/in-progress/`, `.claude/skills/consistency-checker/`, `.claude/docs/plan-lifecycle.md`, `codebase/frontend/src/lib/docs/__tests__/`)와 충돌하는지 대조했다.

## 발견사항

- **[WARNING]** 신규 `plan-link-integrity.test.ts` 가드가 기존 `plan-coherence-checker` sub-agent 의 서술된 책임과 겹친다
  - target 신규 식별자: `plan-link-integrity.test.ts` (build 차단, `plan/**.md` 본문의 in-repo 링크 타깃·앵커 존재 검증)
  - 기존 사용처: 같은 문서 §4.2 `spec-link-integrity.test.ts` 행(수정되지 않은 기존 텍스트, line ~152) — "plan-coherence-checker 가 담당하는 것은 `plan/**` **문서 내부**의 링크 위생이지 spec→plan 링크가 아니다" / `.claude/skills/consistency-checker/SKILL.md:27` 및 `.claude/skills/code-review-agents/lib/role_instructions.py:249-256` (`plan_coherence` 체커의 실제 checklist)
  - 상세: target 문서 자신이 (2026-07-16 정정 각주와 함께) "`plan/**` 문서 내부 링크 위생 = plan-coherence-checker 담당" 이라고 명시하고 있다. 그런데 `plan_coherence` 체커의 실제 정의(role_instructions.py)는 "미해결 결정 충돌·선행 plan 미해소·후속 항목 누락" 세 항목뿐이고 링크 존재성 검증은 전혀 언급되지 않는다. 이번 diff 로 신설된 `plan-link-integrity.test.ts` 가 바로 그 "plan/** 문서 내부 링크 위생"을 결정적(build-time)으로 떠맡는 실제 메커니즘인데, target 은 이 새 가드를 추가하면서도 옆에 남아있는 "plan-coherence-checker 담당" 서술을 갱신·상호 참조하지 않았다. 결과적으로 같은 책임 영역("plan 문서 내부 링크 위생")을 두 개의 이름 있는 메커니즘(LLM 휴리스틱 sub-agent vs 결정적 build 가드)이 각기 다른 자리에서 주장하는 모양이 되어, 다음에 이 문서를 읽는 사람이 "이미 plan-coherence-checker 가 링크를 본다"고 오해하거나 반대로 두 메커니즘이 중복 작업한다고 오해할 수 있다.
  - 제안: §4.2 의 `spec-link-integrity.test.ts` 행에 있는 "plan-coherence-checker 가 담당" 문장을 `plan-link-integrity.test.ts` 신설에 맞춰 갱신 — 예: "plan/** 문서 내부 링크 존재성은 `plan-link-integrity.test.ts`(결정적) 가 담당하고, `plan-coherence-checker`(LLM 휴리스틱) 는 미해결 결정·후속 항목 누락 같은 의미론적 정합만 본다"로 역할을 명시적으로 분리.

- **[WARNING]** 신규 가드가 읽는 plan frontmatter `status:` 값이 §2.2 "의미 도메인 구분(혼동 방지)" 카탈로그에서 빠졌다
  - target 신규 식별자: `spec-plan-completion.test.ts` 의 "2번째 invariant" (및 신설 `R-11(a)`) — `plan/complete/**` frontmatter 의 `status:` 필드 값(`in-progress`/`backlog`/`complete`/`applied`/`implemented`/`superseded`)을 검증
  - 기존 사용처: 같은 문서 §2.2 (line ~109) — "`status:` 키 — `spec/1-data-model.md` 의 엔티티 `status` 컬럼(Integration/Execution 등)과는 레이어가 다름" 문장; `.claude/docs/plan-lifecycle.md:72` — plan frontmatter 의 `status`/`priority`/`title` 은 "추가 필드는 허용"으로 이미 존재하는 필드
  - 상세: 본 컨벤션의 spec frontmatter `status:` 는 5-값 enum(`backlog`/`spec-only`/`partial`/`implemented`/`archived`, §3)이다. plan frontmatter 도 독립적으로 `status:` 키를 쓰며(plan-lifecycle §4, "추가 필드는 허용"), R-11(a) 의 실측치에 따르면 plan 쪽 값 어휘는 `in-progress`/`backlog`(plan/in-progress/) · `complete`/`applied`/`implemented`/`superseded`(plan/complete/) 다. 즉 `backlog` 와 `implemented` 라는 **동일 리터럴 토큰**이 spec frontmatter `status`(제품 surface 의 구현 lifecycle) 와 plan frontmatter `status`(개별 작업 항목의 진행 상태) 라는 **서로 다른 스키마·다른 의미 축**에서 재사용된다 — `backlog` 는 spec 쪽에서 "구현 의도가 아직 결정 안 된 제품 기능", plan 쪽에서 "우선순위가 밀려 보류된 개별 작업"으로 대상 자체가 다르다. §2.2 는 정확히 이런 `status:` 재사용 사례(entity DB 컬럼)를 미리 카탈로그해 혼동을 막는 절인데, 이번 diff 로 새 가드가 plan 쪽 `status:` 값을 직접 소비하게 됐음에도 §2.2 에는 plan frontmatter `status:` 항목이 추가되지 않았다.
  - 제안: §2.2 에 3번째 구분 항목 추가 — "`status:` 키 — plan frontmatter 의 `status`(진행상태, 자유 어휘) 와도 레이어가 다르다. spec `status` 는 5-값 enum 이고 build 가드가 전이를 강제하지만, plan `status` 는 R-11(a) 가 실측한 자유 어휘(`in-progress`/`backlog`/`complete`/…)이며 값 집합이 다르다." 정도의 한 줄이면 R-11(a) 가 이미 확보한 근거를 그대로 재사용할 수 있다.

- **[INFO]** §4.2 표에서 같은 가드 파일명(`spec-plan-completion.test.ts`)이 연속 두 행에 등장
  - target 신규 식별자: `spec-plan-completion.test.ts` (**2번째 invariant**) 행
  - 기존 사용처: 바로 위 `spec-plan-completion.test.ts` (**Gate C**) 행
  - 상세: 두 행 모두 괄호로 invariant 를 구분해 표기 방식 자체는 명확하지만, 표를 훑어볼 때 같은 파일명이 두 번 나오면 "서로 다른 두 파일" 로 오독될 여지가 있다(예: `spec-plan-completion.test.ts` 와 `spec-plan-completion.test.ts` 를 별개 파일로 착각). 실제로는 한 파일이 두 invariant 를 강제하는 구조이며, 이 자체는 문제가 아니다.
  - 제안: 필수는 아니지만, 두 행을 한 행으로 합치고 "(1) Gate C — spec_impact 선언 / (2) 완료 plan 의 미완 status 금지" 처럼 sub-bullet 으로 묶으면 동일 파일이라는 사실이 표 구조에서도 드러난다.

## 검증한 항목 (충돌 없음 확인)

- `plan-link-integrity.test.ts` 파일 자체는 `codebase/frontend/src/lib/docs/__tests__/` 에 실존하며 동명의 다른 목적 파일과 충돌하지 않음(디렉터리 내 유일).
- `Gate C`/`Gate D` 명칭은 `.claude/docs/plan-lifecycle.md` 와 target 양쪽에서 동일 의미(spec_impact 선언 강제 / spec-coverage reverse advisory)로 일관되게 쓰임 — 충돌 없음.
- `ratchet` 용어는 `spec/conventions/i18n-userguide.md`(`hardcoded-korean-ratchet.test.ts`)에서 이미 "baseline 을 늘리지 않는 방식으로만 강제" 라는 동일한 일반 패턴으로 쓰이고 있어 의미 충돌 없음(오히려 관례와 일치).
- `R-11` 앵커·번호는 문서 내 유일(기존 R-1~R-10 과 중복 없음).
- 신규 요구사항 ID·API endpoint·webhook/queue/SSE 이벤트명·ENV var 는 이번 diff 에 없음(본 컨벤션 문서는 build-guard 카탈로그이지 API/이벤트 표면을 정의하지 않음).

## 요약

이번 diff 가 실제로 도입하는 신규 식별자는 `plan-link-integrity.test.ts` 가드 파일 1개와 `spec-plan-completion.test.ts` 의 2번째 invariant, `R-11` Rationale 절로 범위가 좁다. 파일명·앵커·용어 차원에서 저장소 전역과 직접 충돌하는 CRITICAL 은 없었다. 다만 문서 자신이 이미 세워둔 "혼동 방지" 관행(§2.2 의미 도메인 구분, §4.1 다른 가드와의 관계)에 비춰보면, 새 가드가 커버하는 책임 영역(plan 내부 링크 위생, plan `status:` 값)이 기존에 이름 붙은 다른 메커니즘(plan-coherence-checker, spec `status:` enum)의 서술과 겹치는데도 그 절들이 갱신되지 않아 두 건의 WARNING 이 나왔다 — 둘 다 시스템 오동작이 아니라 향후 독자·에이전트가 "누가 이걸 담당하는가" 를 오판할 수 있는 문서 내부 정합성 문제다.

## 위험도

LOW

STATUS=OK
