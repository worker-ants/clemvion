# Plan 정합성 검토 — `plan/in-progress/spec-draft-avatar-storage-key.md`

## 검토 범위

`plan/in-progress/**` 전수(69개 파일, 컨텍스트 예산으로 57개는 원문 절단)를 대상으로
target 문서(§A~§H, `spec/0-overview.md`·`spec/data-flow/0-overview.md`·
`spec/data-flow/4-file-storage.md`·`spec/2-navigation/9-user-profile.md`·
`spec/5-system/2-api-convention.md`·`spec/5-system/3-error-handling.md` 6개 spec 변경)와
직접 겹치는 plan 을 `grep -rl` 로 선별해 원문을 읽었다: `spec-sync-user-profile-gaps.md`,
`spec-update-avatar-upload-implemented.md`(target 이 이번 턴에 종결하려는 위임 트래커),
`spec-sync-auth-gaps.md`, `auth-guard-reflection-hardening.md`,
`spec-sync-external-interaction-api-gaps.md`, `self-hosting-deployment.md`,
`webchat-auth-session-status-reconcile.md` 등. `avatar`/`workspaceId prefix`/
`S3_PUBLIC_BASE_URL`/`getPublicUrl` 키워드로 전수 재검색해 위 3개 파일(target 포함) 밖에는
겹치는 plan 이 없음을 확인했다.

## 발견사항

- **[WARNING]** 위임 트래커(`spec-update-avatar-upload-implemented.md`) 종결 체크리스트가
  `plan-lifecycle.md §5` 이동 자가점검 3항목을 빠뜨렸다
  - target 위치: `spec-draft-avatar-storage-key.md` §D-4 "대신 **같은 턴에** 트래커를
    종결한다" — 체크리스트가 (1) 본문 체크박스 전항목 체크 (2) `plan/complete/` 이동
    (3) "세 문서" → "6개 문서" 서술 정정, **세 가지만** 나열한다.
  - 관련 plan: `plan/in-progress/spec-update-avatar-upload-implemented.md` (frontmatter),
    `plan/in-progress/spec-sync-user-profile-gaps.md:79`
  - 상세: 실측 결과 target 의 §D-4 체크리스트가 `.claude/docs/plan-lifecycle.md` §5
    "이동 commit 자가 점검" 이 요구하는 세 항목을 반영하지 않는다.
    1. **`spec_impact` (Gate C) 미선언** — `spec-update-avatar-upload-implemented.md`
       frontmatter 에는 `spec_impact` 필드가 아예 없다(`title`/`worktree`/`started`/`owner`/
       `status`/`priority` 뿐). `plan-lifecycle.md §5` 체크리스트 3번째 항목("frontmatter 에
       `spec_impact` 가 선언됐는가")과 `spec-plan-completion.test.ts` 가 `complete/` 이동
       plan 에 이를 강제한다 — 선언 없이 이동하면 그 가드가 fail 한다. 실제로 같은 종류의
       선례(`plan/complete/spec-update-notifications-ws-emit.md`, `notification.new` 배지
       flip — target 이 §D-4 서두에서 직접 인용하는 선례)는 `spec_impact:` 리스트를
       정확히 선언하고 이동했다. target 은 이 필드 추가를 §D-4 목록에 넣지 않았다.
    2. **`status: in-progress` 종결 상태 미갱신** — 같은 frontmatter 가 `status: in-progress`
       를 선언 중이다. `plan-lifecycle.md §4`("`status` 를 선언했다면 이동 시 함께
       갱신한다")에 따라 `complete`/`implemented`/`applied`/`superseded` 중 하나로 바꿔야
       하는데 §D-4 는 이를 언급하지 않는다.
    3. **인입 링크(sibling plan → 이 plan) 미갱신** — `spec-sync-user-profile-gaps.md:79`
       가 마크다운 링크로 `[spec-update-avatar-upload-implemented.md]
       (./spec-update-avatar-upload-implemented.md)` 를 참조한다(같은 아바타 업로드 항목의
       "spec 배지 flip 은 planner 트랙으로 분리" 서술 안). `plan-lifecycle.md §5`
       체크리스트("형제 plan 을 가리키던 상대링크를 `../complete/<name>` 으로 정정했는가
       — **인입 링크도 함께 본다**")가 명시적으로 요구하는 갱신인데 target 의 §D-4 에 없다.
       **이 실패가 가상이 아니라는 증거**: 정확히 같은 클래스의 실패가 이미 저장소에
       남아 있다 — `spec-sync-websocket-protocol-gaps.md:53` 이 지금도
       `` `plan/in-progress/spec-update-notifications-ws-emit.md`(planner) 위임 `` 이라고
       적는데, 그 파일은 2026-07-06 에 이미 `plan/complete/` 로 옮겨졌다(위 §D-4 가 인용한
       바로 그 선례). 다만 그 경우는 마크다운 링크 문법이 아니라 산문 속 경로 언급이라
       빌드 가드가 못 잡았다 — `spec-sync-user-profile-gaps.md:79` 는 진짜 마크다운 링크라
       `plan-in-progress/*.md` 상대링크 가드가 push 시점에 잡아 **막긴 하겠지만**, target
       체크리스트에 없으면 그 실패를 사후에야 발견하고 재작업하게 된다.
  - 제안: target §D-4 체크리스트에 세 항목 추가 — (1) `spec-update-avatar-upload-implemented.md`
    frontmatter 에 `spec_impact:` 로 이번에 실제 갱신한 6개 spec 경로 나열, (2) `status:`
    를 `complete`(또는 저장소 종결 어휘 중 하나)로 갱신, (3)
    `spec-sync-user-profile-gaps.md:79` 의 상대링크를
    `[...](./spec-update-avatar-upload-implemented.md)` → `../complete/spec-update-avatar-upload-implemented.md` 로 정정.

## 요약

target 이 다루는 6개 spec 파일 변경 자체(§A~§H)는 다른 `plan/in-progress/**` 문서의
미해결 결정과 충돌하지 않고, 아바타/S3 키/workspaceId prefix 를 언급하는 in-progress plan
은 target 이 흡수하려는 `spec-sync-user-profile-gaps.md`·`spec-update-avatar-upload-implemented.md`
둘뿐이며 두 문서 모두 target 의 서술과 정합한다. 유일한 실질 갭은 target §D-4 가 계획한
"위임 트래커를 같은 턴에 `complete/` 로 종결" 동작이 이 저장소의 `plan-lifecycle.md §5`
이동 체크리스트 3항목(`spec_impact` 선언·`status` 종결화·인입 상대링크 정정)을 빠뜨린
것이다 — 이는 가상의 리스크가 아니라 같은 클래스의 실패(`spec-sync-websocket-protocol-gaps.md:53`
의 stale 경로)가 이미 저장소에 실재함으로 확인된다. 결정 충돌이나 선행조건 미해소는
발견되지 않았다.

## 위험도

LOW
