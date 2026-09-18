# 신규 식별자 충돌 검토 — spec-draft-deletion-release-current-tense.md

## 검토 범위 확인

target plan 은 새로운 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV/설정키·spec 파일 경로를 **신규로 도입하지 않는다**.
성격상 이미 머지된 구현(`a9288bf6e`)에 맞춰 기존 spec 문서의 "미구현 (Planned)" 문구를 현재형으로 정정하는
작업이며, C10 하나만 새 규약 문장을 추가한다. 각 관점별로 실측했다.

## 발견사항

해당 없음 — CRITICAL/WARNING 대상 없음.

아래는 검증 과정에서 확인한 사실이며 충돌은 발견되지 않았다.

- **[INFO]** `R-5` 라벨이 두 문서에 독립적으로 존재하지만 충돌 아님
  - target 신규 식별자: 없음 (C10 은 `spec/conventions/spec-impl-evidence.md` 의 **기존** `### R-5. status: partial 의 pending_plans: 의무화` 섹션 끝에 문단을 append 한다)
  - 기존 사용처: `spec/2-navigation/2-trigger-list.md:361` 에도 별도로 `### R-5. schedule 삭제 confirmation interp 변수: {{cron}}` 가 존재
  - 상세: 두 `R-5` 는 서로 다른 파일의 **로컬 Rationale 번호**(파일 스코프 내 순번)이지 전역 식별자가 아니다. 이 저장소의 기존 컨벤션(각 spec 문서가 자신의 `## Rationale` 하위에 `R-1, R-2...` 를 독립 채번)과 일치하며, target 은 어느 쪽도 새로 만들지 않고 기존 `spec-impl-evidence.md §R-5` 에 이어 쓸 뿐이다. 실제로 grep 결과 `spec-impl-evidence.md` 의 §3.1 "`partial` → `implemented`" 전이 규칙 불릿도 이미 존재해 C10 이 그 아래 하위 불릿을 추가하는 자리와 정확히 일치한다.
  - 제안: 조치 불요.

- **[INFO]** 새로 참조되는 코드 파일 경로 4건은 모두 기존 구현물이며 실제 존재 확인됨
  - target 신규 식별자: `codebase/backend/src/modules/triggers/trigger-resource-release.ts`, `trigger-resource-releaser.service.ts`, `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts`, `codebase/backend/test/schedule-trigger.e2e-spec.ts` — C3 가 이들을 `2-trigger-list.md` frontmatter `code:` 에 추가
  - 기존 사용처: 위 네 파일은 `ls` 로 실존 확인됨(머지 `a9288bf6e` 산출물). `schedule-trigger.e2e-spec.ts` 는 이미 `spec/2-navigation/3-schedule.md:17` 의 `code:` 에도 등재돼 있어 **두 문서가 같은 e2e 파일을 공유 증거로 참조**하는 형태다.
  - 상세: 이 저장소는 하나의 e2e/코드 파일이 여러 spec 문서의 증거로 동시에 등재되는 패턴을 이미 갖고 있다(memory: cafe24/makeshop 미러, 알림 파이프라인 등). `schedule-trigger.e2e-spec.ts` 가 `3-schedule.md`(스케줄 화면 관점)와 `2-trigger-list.md`(§3 `TriggerDto.workflow` 계약 관점, C3 실측 7') 양쪽에서 서로 다른 계약을 검증하는 근거로 쓰이는 것은 의미 충돌이 아니라 의도된 중복 등재다. `TriggerResourceReleaserService`/`resolveTriggerResourceReleaser`/`lockParentAndListTriggerIds`/`removeScheduleJobsOrRestore` 심볼도 grep 결과 저장소 전체에서 각각 정의 1곳 + 소비처(`workflows.service.ts`, `workspaces.service.ts`)로만 나타나 동명이의 충돌이 없다.
  - 제안: 조치 불요.

- **[INFO]** 새로 앵커링되는 섹션 번호(`10-triggers.md §1.4`, `11-workflow.md §2.1`/`§3.1`, `12-workspace.md §1.10`/`§2.1`, `2-trigger-list.md §4.3`/`§4.4`)는 전부 기존 섹션
  - target 신규 식별자: 없음 — 위 섹션 헤더는 모두 대상 문서에 이미 존재함을 `grep -n "^### \|^## "` 로 확인(예: `12-workspace.md:184 ### 1.10 워크스페이스 삭제 / 나가기`, `184행` 표에 `DELETE /api/workspaces/:id` 가 이미 기재).
  - 기존 사용처: 동일 파일·동일 섹션
  - 상세: C4~C6 은 새 섹션을 만들지 않고 기존 섹션의 "미구현 (Planned)" 태그만 제거/재작성한다. `DELETE /api/workspaces/:id` 는 신규 endpoint 가 아니라 이미 spec 에 정의된 endpoint 다.
  - 제안: 조치 불요.

- **[INFO]** "공유 트래커" 라는 새 용어는 이 PR 이 유일한 정의처
  - target 신규 식별자: "공유 트래커" (C10 rationale, 여러 문서의 `pending_plans` 가 같은 plan 파일을 가리키는 상황을 부르는 이름)
  - 기존 사용처: repo 전체 grep 결과 이 target 문서 자신 외에는 등장하지 않음(신규 조어이나 충돌 없음)
  - 상세: 새 용어지만 다른 곳에서 다른 의미로 이미 쓰이고 있지 않으므로 CRITICAL/WARNING 대상이 아니다. 다만 이 용어가 `spec-impl-evidence.md` 규약 본문에 정식으로 자리잡는 첫 사례이므로, 향후 유사 상황(여러 spec 문서가 같은 트래커 plan 을 `pending_plans` 로 공유)을 지칭할 때 이 명칭을 재사용하도록 유지하면 좋다.
  - 제안: 조치 불요(관찰 사항).

- **[INFO]** plan 파일 경로 `plan/in-progress/spec-draft-deletion-release-current-tense.md` 는 기존 명명 컨벤션과 충돌 없음
  - target 신규 식별자: 해당 파일 경로 (신규 생성)
  - 기존 사용처: `ls plan/in-progress/` 결과 트리거 삭제 관련 다른 진행 중 plan 없음, `spec-draft-*` 접두 컨벤션은 `spec-draft-nullable-notation-followups.md` 등 기존 사례와 일치
  - 상세: 경로·이름 모두 유일하며 컨벤션에 부합.
  - 제안: 조치 불요.

## 요약

target 문서는 신규 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV/설정키를 전혀 도입하지 않으며, 유일하게 새로
추가되는 규약 문장(C10)은 `spec-impl-evidence.md` 의 기존 `§3.1` 전이 규칙과 기존 `R-5` 섹션 끝에 정확히 이어 붙는
확장이라 기존 정의와 충돌하지 않는다. 새로 frontmatter 에 등재되는 코드/e2e 파일 경로 4건은 모두 이미 머지된
구현물로 실존이 확인됐고, `schedule-trigger.e2e-spec.ts` 가 두 spec 문서(`3-schedule.md`, `2-trigger-list.md`)의
증거로 공유되는 것도 이 저장소의 기존 공유-증거 패턴과 일치해 의미 충돌이 아니다. 참조되는 모든 섹션 번호·API
endpoint 는 대상 문서에 이미 존재하는 것을 확인했다. 새 식별자 충돌 관점에서 이 target 은 위험이 없다.

## 위험도

NONE
