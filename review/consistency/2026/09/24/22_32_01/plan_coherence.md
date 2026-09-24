# Plan 정합성 검토 — spec/2-navigation/ (removeMember 판정 순서 커버리지)

## 검토 요약

이번 diff(`workspaces.service.spec.ts`, +58줄, 테스트 전용, `spec_impact: none`)는
`plan/in-progress/remove-member-order-coverage.md` 가 닫으려는 항목 그 자체이며, 상위 트래커
`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목(라인 4974
「`removeMember` 판정 순서 커버리지의 비대칭 두 칸」, 낮음, 2026-09-24 등재)과 1:1로 대응한다.
target spec 영역(`spec/2-navigation/`)의 실제 델타는 0개 파일이며 이는 정상이다 — 이 PR 은 spec
을 바꾸지 않고 기존 문서화된 동작(`removeMember` 판정 순서)을 테스트로 고정할 뿐이다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 동일 트래커의 인접 planner 항목과의 경계 확인
  - target 위치: 없음 (target spec 델타 0 — `spec/2-navigation/9-user-profile.md` §4.1 "제거"
    행은 구현 세부 순서를 서술하지 않는다)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 4993
    「`removeMember` 리팩터로 낡은 spec 서술 세 줄」(planner, 낮음, 미해결)
  - 상세: 이 planner 항목은 `plan/complete/member-auth-order.md` 가 `removeMember` 의 인가
    호출 경로를 바꾼 뒤 `spec/5-system/3-error-handling.md`(2곳)·`spec/5-system/1-auth.md`(1곳)에
    남은 "`assertAdmin()` 을 호출한다" 류의 낡은 서술을 가리킨다. 이번 리뷰 대상인
    `spec/2-navigation/` 이 아니라 `spec/5-system/` 소관이라 **이번 PR 의 스코프 밖**이고,
    이번 diff(테스트 전용, 소스 변경 없음)도 그 서술을 더 낡게 만들지 않는다. 두 항목(developer
    §4974 / planner §4993)은 트래커에서 이미 분리 등재되어 있어 혼동 소지가 없다.
  - 제안: 조치 불요. `remove-member-order-coverage.md` 의 "트래커 항목 닫기" 체크리스트 항목을
    처리할 때 §4974 만 닫고 §4993 은 별도 planner 턴으로 남겨 둘 것 — plan 자체가 이미 그렇게
    적혀 있으므로 확인 메모로만 남긴다.

## 확인한 정합성 항목 (문제 없음)

- **미해결 결정과의 충돌**: 없음. diff 의 새 테스트 주석("이것은 보안 불변이 아니라 문서화된
  순서다… 그쪽에 맞추기로 한다면 `removeMember` 머리 주석의 판정 순서와 이 블록을 함께 바꿀
  것")은 순서를 바꾸는 결정을 일방적으로 내리지 않고, 오히려 바꾸려면 무엇을 함께 바꿔야
  하는지를 남겨 둔다.
- **선행 plan 미해소**: 이 PR 이 가정하는 선행 조건("`removeMember` 인가가 대상 조회보다 앞으로
  이동했다")은 `plan/complete/member-auth-order.md` 로 이미 완료돼 있다(`plan/complete/`
  디렉터리에 실재 확인). `spec/2-navigation/9-user-profile.md` 의 `pending_plans`
  (`spec-sync-user-profile-gaps.md`)에도 `removeMember` 판정 순서와 충돌하는 미해결 항목 없음.
  다른 `plan/in-progress/**` 전체에서 `removeMember`/`MEMBER_NOT_FOUND`/`ADMIN_REQUIRED` 를
  참조하는 파일은 `remove-member-order-coverage.md` 와 `spec-draft-nullable-notation-followups.md`
  둘뿐이며 서로 충돌하지 않는다.
- **후속 항목 누락**: target spec 델타가 0이므로 target 변경으로 인한 후속 무효화·신규 필요
  항목이 발생할 여지가 없다. 코드 diff 도 테스트 전용이라 다른 plan 의 후속 항목을 무효화하지
  않는다.

## 요약

`remove-member-order-coverage.md` 는 상위 트래커의 정확한 항목 하나를 닫는 테스트 전용
PR 이며, target spec(`spec/2-navigation/`)과 충돌하는 미해결 결정이나 미해소 선행 조건이
없다. 인접한 planner 소관 항목(낡은 spec 서술 세 줄, `spec/5-system/`)은 스코프·owner 가
분리되어 있고 이번 diff 로 인해 더 나빠지지 않는다. Plan 정합성 관점에서 차단 사유 없음.

## 위험도

NONE
