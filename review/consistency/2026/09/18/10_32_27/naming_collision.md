# 신규 식별자 충돌 검토 — spec-draft-deletion-release-current-tense.md

## 점검 범위 요약

target draft(C1~C10)는 새 요구사항 ID·엔티티·API endpoint·이벤트명·ENV/설정키를 **하나도 신설하지 않는다**. 성격상
"이미 머지된 구현(`a9288bf6e`)에 맞춰 기존 spec 문면의 시제·태그(«미구현 (Planned)»)를 정정"하는 문서 정합화이고,
draft 스스로도 "규칙을 새로 더하는 곳은 하나(C10 — R-11)" 라고 명시한다. 아래는 6개 관점 각각에 대해 실제 저장소를
grep/열람해 충돌 여부를 확인한 결과다.

### 1. 요구사항 ID 충돌 — 해당 없음

- draft 가 새 요구사항 ID(`NAV-*`/`CCH-*`/`V-*` 형식)를 부여하는 곳이 없다. C9 이 건드리는 `spec/5-system/15-chat-channel.md:661` 문장은 기존 `CCH-AD-03`(line 66, "Trigger disable/삭제 시 `teardownChannel()` 자동 호출")의 산문 서술만 바꾸고 ID 자체는 그대로다 — 직접 대조 확인.
- C10 이 신설하는 것은 `spec/conventions/spec-impl-evidence.md` 의 **Rationale 절 번호 R-11** 뿐이다. 현재 파일의 Rationale 은 R-1~R-10 까지 있고(직접 열람, `spec/conventions/spec-impl-evidence.md:201-263`) R-11 은 미사용 — 충돌 없음.

### 2. 엔티티/타입명 충돌 — 해당 없음

- draft 본문에 등장하는 `TRIGGER_RESOURCE_RELEASER`·`resolveTriggerResourceReleaser`·`lockParentAndListTriggerIds`·`removeScheduleJobsOrRestore`·`TriggerResourceReleaserService` 는 draft 가 새로 짓는 이름이 아니라 이미 머지된 구현(`codebase/backend/src/modules/triggers/trigger-resource-release.ts`, `trigger-resource-releaser.service.ts`, `workflows.service.ts`, `workspaces.service.ts`)에 존재하는 심볼을 그대로 서술만 하는 것이다 (grep 으로 정의·호출부 확인, 다른 의미로 쓰이는 동명 심볼 없음).
- spec 쪽에 새 DTO/인터페이스명을 선언하는 문장도 없다.

### 3. API endpoint 충돌 — 해당 없음

- C6 이 재서술하는 `DELETE /api/workspaces/:id` 는 `spec/data-flow/12-workspace.md §1.10` 에 이미 있는 기존 endpoint 고, method+path 변경 없이 동작 순서 문장만 재작성한다. 새 endpoint 신설 없음.

### 4. 이벤트/메시지명 충돌 — 해당 없음

- webhook·queue·sse 관련 신규 이벤트명이 draft 에 없다. "schedule job 해제 실패" 등은 기존 BullMQ job 정책 서술이지 새 이벤트 이름이 아니다.

### 5. 환경변수·설정키 충돌 — 해당 없음

- 신규 ENV var·config key 선언 없음.

### 6. 파일 경로 충돌 — 충돌은 없으나 명명 근접성 1건(INFO)

- **C3 이 추가하는 `code:` 4개 항목**(`trigger-resource-release.ts` · `trigger-resource-releaser.service.ts` · `trigger-deletion-releases-resources.e2e-spec.ts` · `schedule-trigger.e2e-spec.ts`)은 현재 `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 목록(직접 열람, 1~33행)에 **아직 없다** — 중복 등재 아님.
  - `schedule-trigger.e2e-spec.ts` 는 이미 `spec/2-navigation/3-schedule.md` 의 `code:` 에 등재돼 있다(같은 파일을 두 spec 이 서로 다른 근거로 인용). 그러나 `3-schedule.md` 자신의 인접 주석이 "트리거 축(`2-trigger-list.md`)과 같은 규칙이며, glob 이 self-spec 까지 무는 것도 의도다" 라고 이미 이 이중 인용 패턴을 선언해 뒀고, `spec-impl-evidence.md` R-1/R-6 도 같은 파일을 여러 spec 이 서로 다른 계약의 증거로 공유하는 것을 허용한다 — **충돌이 아니라 기 확립된 컨벤션의 재사용**이다.
  - 이 네 경로 문자열이 spec/ 나 plan/ 다른 어느 문서에서도 지금과 다른 의미로 쓰이고 있지 않음을 grep 으로 확인.
- **INFO** — 새 plan 파일 `plan/in-progress/spec-draft-deletion-release-current-tense.md` 이름이 기존 완료 plan `plan/complete/spec-draft-deletion-releases-trigger-resources.md`(#1345)·`plan/complete/trigger-deletion-release.md`(#1346) 와 접두어(`spec-draft-deletion-release`)를 공유한다. 정확히 같은 문자열은 아니고(단수 "release" vs 복수 "releases", 그리고 "current-tense" 접미), draft 본문이 두 선행 plan 을 명시적으로 인용해 계보를 밝히므로 실질적 오인 위험은 낮다. 다만 향후 `grep -l "deletion-release"` 같은 넓은 검색에서 세 파일이 한꺼번에 걸릴 수 있으니, 참고용으로만 남긴다 — 이름 변경을 요구할 정도는 아니다.
  - 저장소의 `spec-draft-*` plan 명명 컨벤션 자체는 준수한다(기존 `spec-draft-nullable-notation-followups.md`·`spec-draft-schedule-trigger-ref-nav.md` 등과 같은 패턴).

## 발견사항

- **[INFO]** plan 파일명 근접성 — `spec-draft-deletion-release-current-tense.md` vs `spec-draft-deletion-releases-trigger-resources.md`
  - target 신규 식별자: `plan/in-progress/spec-draft-deletion-release-current-tense.md` (파일 경로)
  - 기존 사용처: `plan/complete/spec-draft-deletion-releases-trigger-resources.md`(#1345), `plan/complete/trigger-deletion-release.md`(#1346)
  - 상세: 접두어 `spec-draft-deletion-release(s)` 를 공유해 단수/복수 한 글자 차이로만 구분된다. 세 문서 모두 같은 기능 계보(계약 수립 → 구현 → 시제 정정)라 의미적으로는 자연스러운 연쇄지만, 문자열 검색 시 함께 걸려 혼동 여지가 있다.
  - 제안: 이름을 바꿀 필요는 없다(계보 관계가 본문에 명시돼 있고 `spec-draft-*` 컨벤션도 지킴) — 향후 이 계열 문서를 추가로 늘릴 경우에만 더 구분되는 접미어를 권장.

## 요약

target draft 는 신규 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·ENV/설정키를 전혀 신설하지 않으며, 유일하게 신설하는
식별자인 `spec/conventions/spec-impl-evidence.md` 의 Rationale `R-11` 은 기존 R-1~R-10 과 겹치지 않는다. `code:`
frontmatter 에 추가되는 4개 파일 경로도 대상 문서에 중복 등재되어 있지 않고, 그중 하나(`schedule-trigger.e2e-spec.ts`)가
다른 spec(`3-schedule.md`)에 이미 등재돼 있는 것은 그 문서 스스로 예고한 "같은 파일을 서로 다른 근거로 공유" 패턴과
정확히 일치해 충돌이 아니다. 유일한 지적은 새 plan 파일명이 계보상 관련된 두 기존 plan 파일명과 접두어를 공유해
검색 시 근접 혼동 가능성이 있다는 INFO 수준 관찰뿐이다.

## 위험도

NONE
