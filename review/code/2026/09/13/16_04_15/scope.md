# 변경 범위(Scope) 리뷰 — guide-identifier-existence (라운드 5, `15_42_54` 이후)

## 검증 방법

`git log --oneline -15` 로 이번 changeset 의 커밋 이력을 확인하고, `git diff origin/main...HEAD --stat -- 'codebase/**' 'CHANGELOG.md' 'PROJECT.md' 'plan/**'` 로 **실 코드·문서 델타만** 추려 재확인했다(9개 파일). 라운드 3(`15_24_12`) 이후 새로 추가된 두 커밋(`2253d27a4` plan 체크박스 정정, `6b4c03af6` 라운드 4 fix)을 `git show --stat`/`git show`로 단독 대조했다. 저장소는 뮤테이션하지 않았다 — `git status --short` 는 이 세션이 만든 `review/code/2026/09/13/16_04_15/`·`review/consistency/2026/09/13/16_04_45/` 두 untracked 산출물 외 변경이 없음을 보였고, `find . -name "*.bak*"` 결과도 0건이다.

## 발견사항

- **[INFO]** 라운드 4 이후 실 코드 변경은 커밋 `6b4c03af6` 뿐이며, 직전 라운드(`15_42_54`) 리뷰어 WARNING#2 에 1:1로 결속돼 있음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(`CODE_FIELD` 정규식에 왼쪽 경계 `(?<![A-Za-z])` 추가) / `guide-identifier-existence.test.ts`(음성 판별 fixture 1건 추가 — `mycode`/`statusCode` 비대상, `code`/bare `code:` 대상)
  - 상세: `git show 6b4c03af6`로 diff 전문을 직접 대조했다. 변경은 지적된 정규식 경계 한 곳과 그 경계를 겨눈 fixture 하나로 국한되며, 다른 축(`FIELD_TABLE_NAME`·`BACKTICK`·`collectEnvDeclarations`)이나 무관 로직은 건드리지 않았다. 커밋 메시지 자체가 "리뷰어 예시(`statusCode`)는 재현되지 않았지만 지적한 오매칭 형태(`mycode`)는 실재한다"는 실측을 근거로 수정 범위를 정확히 그 지점에 고정하고 있다.
  - 제안: 없음. 스코프 이탈 아님.

- **[INFO]** `2253d27a4`(plan 체크박스 정정)은 `plan/in-progress/guide-identifier-existence.md` 한 파일만 건드리며, 체크박스 상태를 실제 진행 상태와 일치시키는 하우스키핑에 국한됨
  - 위치: `plan/in-progress/guide-identifier-existence.md`(34줄 변경 — 24 추가/10 삭제)
  - 상세: 커밋 메시지는 "라운드 3 fix 가 `codebase/`를 만졌으므로 아직 수렴이 아닌데 완료로 체크했다"는 자기 지적을 담고 있고, `git show --stat`로 확인한 결과 diff 대상은 이 plan 파일 하나뿐이다. 완료 판정 기준을 "마지막 라운드가 `codebase/**` 수정 0으로 끝날 것"이라는 관측 가능한 조건으로 바꾸고 라운드 표에 열을 추가한 것도 이번 PR 자체의 fix→리뷰 루프를 정확하게 추적하려는 목적에 국한되며, 다른 트래커 항목이나 무관 서술을 건드리지 않았다.
  - 제안: 없음.

- **[INFO]** (재확인, 신규 아님) `plan/in-progress/spec-draft-nullable-notation-followups.md`의 무관 백로그 신규 등재(`cafe24-api-metadata.md §4` Principle 오인용)가 이번 누적 diff에도 그대로 남아 있음
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(`cafe24-api-metadata.md §4` 항목, `--impl-prep` `12_33_41` convention_compliance WARNING#4 등재분)
  - 상세: 라운드 1·3 scope 리뷰가 이미 이 항목을 검토해 "이번 PR 목적과 무관하지만 `developer`가 `spec/` 쓰기 권한이 없어 발견 즉시 `plan/` 백로그로 등재해야 하는 프로젝트 관례를 따른 것이고, 항목 자체가 스스로 '무관'임을 명시해 은폐가 없다"로 처분했다. 이번 라운드에서 diff 내용이 추가로 바뀌지 않았음을 `git diff`로 재확인했다 — 새로운 위반이 아니라 기존 처분이 유지되는 상태다.
  - 제안: 조치 불요(재확인).

- **[INFO]** (재확인, 신규 아님) 가드 파일 교체가 `git mv`가 아닌 delete+create로 기록돼 이력이 끊긴 상태가 유지됨
  - 위치: `guide-error-code-scan.ts`/`guide-error-code-existence.test.ts`(삭제) → `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`(신규)
  - 상세: 라운드 1·2 scope 리뷰가 `--find-renames=25%`로도 git이 D+A로 기록함을 실측하고 "축 구조·기준집합·허용목록이 전부 재설계돼 순수 리네임이 아니었고, 회고적 이력 재작성은 비용 > 이익"으로 조치 불요 처리했다. 이번 누적 diff에서도 파일 구성은 동일하며 새로 뒤집을 근거가 없다.
  - 제안: 조치 불요(재확인).

## 요약

라운드 5 시점 실 코드·문서 델타(`git diff origin/main...HEAD -- 'codebase/**' 'CHANGELOG.md' 'PROJECT.md' 'plan/**'`, 9개 파일)는 라운드 1~3 scope 리뷰가 이미 LOW로 판정한 범위와 동일하며, 라운드 3 이후 새로 추가된 두 커밋은 각각 (1) 직전 라운드 WARNING에 1:1로 결속된 최소 정규식 수정 + fixture 1건, (2) plan 체크박스 상태를 실제 완료 조건에 맞춰 정정하는 단일 파일 하우스키핑으로, 둘 다 요청된 작업(가이드 식별자 실재성 가드 확장) 범위를 벗어나지 않는다. 이전 라운드가 이미 검토·처분한 두 경계 사례(무관 백로그 등재, delete+create 이력 단절)는 이번 라운드 diff에서 내용 변화가 없어 재검토 결과도 동일하게 유지된다. 포맷팅·주석·임포트·설정 파일 관점에서 새로 관찰된 불필요한 변경은 없다.

## 위험도

LOW
