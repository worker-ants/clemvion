# 신규 식별자 충돌 검토 — spec-draft-deletion-release-current-tense

## 검토 범위

target(`plan/in-progress/spec-draft-deletion-release-current-tense.md`)이 실제로 도입하는 신규
식별자 후보를 전수 열거했다:

1. frontmatter `code:` 에 새로 등재되는 파일 경로 3개 (C3):
   - `codebase/backend/src/modules/triggers/trigger-resource-release.ts`
   - `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts`
   - `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts`
2. `secret-store.md` frontmatter `status: implemented` 전환 + `pending_plans` 블록 삭제 (C7)
3. `1-workflow-list.md` frontmatter `pending_plans` 에서 항목 1건 제거 (C8)
4. 본문 신규 서술 용어 — "선검사"(권한 선검사), "잔여 창" 확장 문구 (C1/C6)
5. 기존 섹션(§4.3, §4.4, §1.4, §2.1, §3.1, §1.10) 본문 재작성 — 새 섹션/앵커 신설 없음
6. 요구사항 ID·API endpoint·이벤트명·ENV var 신규 도입 — **없음**(전부 기존 계약 재서술)

## 검증 커맨드 및 결과

- `find codebase/backend -iname "*trigger-resource-release*"` → 4개 파일(구현 2 + spec 2) 모두
  `a9288bf6e`(#1346, 이미 머지)로 존재. target 이 새로 발급하는 이름이 아니라 기존 구현 파일을
  spec `code:` 로 뒤늦게 등재하는 것.
- `grep -rn "TriggerResourceReleaserService"` → 정의처 1곳(`trigger-resource-releaser.service.ts`),
  소비처는 `triggers.module.ts`/`triggers.service.ts`/스펙 파일들. 클래스명 중복 정의 없음.
- `grep -rn "TriggerResourceReleasePort"` → 인터페이스 정의 1곳, 구현체 1곳. 충돌 없음.
- `releaseSecretsAfterCommit` / `removeScheduleJobsOrRestore` / `lockParentAndListTriggerIds` →
  각각 정의 1곳 + 소비처(triggers/workflows/workspaces service)만. 동명이의 없음.
- `grep -rln "trigger-resource-release.ts\|trigger-resource-releaser.service.ts\|trigger-deletion-releases-resources.e2e-spec.ts" spec/`
  → 현재 **어느 spec 문서도** 이 세 파일을 아직 참조하지 않음 → C3 의 등재가 기존 `code:` 항목과
  중복되지 않는다(신규 추가이지 재등록이 아님).
- `spec/2-navigation/2-trigger-list.md` 현재 frontmatter `code:` 목록(라인 6~34)을 직접 열어 대조 →
  두 신규 파일 경로가 목록에 **없음**을 확인(중복 등재 아님).
- 앵커 검증: `2-trigger-list.md:273` `### 4.3 cascade 동작` 존재 → target 이 링크하는
  `#43-cascade-동작` 정상 참조. 신규 앵커 발급 없음(기존 섹션 재사용).
- 절 번호 대조: `10-triggers.md §1.4`("Schedule ↔ Trigger 동기화", L129) · `11-workflow.md §2.1`
  ("Postgres — 편집 흐름", L145)·`§3.1`("workflow.is_active", L180) · `12-workspace.md §1.10`
  ("워크스페이스 삭제 / 나가기", L184)·`§2.1`("Postgres", L195) — target 이 인용하는 절 번호가
  실제 문서의 해당 절과 전부 일치. 절 번호 오버로드(다른 의미의 절을 잘못 지목)는 없음.
- `grep -rln "선검사" spec/` → 0건. "권한 선검사"는 이 draft 가 처음 쓰는 표현이지만, 기존 문서
  어디에도 다른 의미로 쓰인 동일 문자열이 없어 충돌이 아니다(신규 용어의 최초 도입).
- `1-workflow-list.md`/`2-trigger-list.md`/`secret-store.md` 세 곳 모두
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 를 `pending_plans` 에 공유 참조 중 —
  target 은 이 중 `1-workflow-list.md` 한 곳에서만 **다른 항목**(트리거 삭제 자원 정리 트래커, #1345 가
  추가한 것)을 제거하는 것이라 이 공유 참조와는 무관.

## 발견사항

없음 — CRITICAL/WARNING/INFO 등급의 신규 식별자 충돌을 찾지 못했다. target 은 새 요구사항 ID·
엔티티/DTO·API endpoint·이벤트명·ENV var·설정키를 전혀 도입하지 않으며, 유일한 "신규 등재"는
이미 머지된 기존 구현 파일 3개를 spec frontmatter `code:` 에 뒤늦게 반영하는 것으로, 기존
frontmatter 항목과 중복되지 않음을 직접 열어 확인했다. 재작성 대상 섹션(§4.3/§4.4/§1.4/§2.1/§3.1/§1.10)
은 모두 기존 절 번호·앵커를 그대로 재사용하며 새 절을 신설하지 않는다.

## 요약

target 문서는 "계약은 그대로, 서술만 현재형으로" 라는 스스로의 범위 선언대로 신규 식별자를
발급하지 않는 순수 현재형 정정 draft다. frontmatter 에 새로 오르는 파일 경로 3개는 이미
`a9288bf6e`(#1346)로 머지된 기존 구현체이며 다른 spec 문서의 `code:` 목록과 겹치지 않는다.
인용하는 절 번호·앵커는 실측(grep+직접 열람)으로 전부 대상 문서의 해당 절과 일치했고, 본문에서
처음 쓰는 "권한 선검사" 류 용어도 기존 문서에서 다른 의미로 쓰인 사례가 없다. 신규 식별자
충돌 관점에서 이 target 을 막을 근거가 없다.

## 위험도

NONE
