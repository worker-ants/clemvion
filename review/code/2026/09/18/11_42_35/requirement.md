# 요구사항(Requirement) 충족 리뷰

## 범위 확인

이 PR(`plan/in-progress/trigger-release-stale-comments.md`)의 명시적 목표는 "**동작은 바꾸지
않는다 — 주석과 메서드 이름 하나**"다. `git diff --stat origin/main -- codebase/` 로 실측한 결과
`codebase/backend/**` 9개 파일이 각 2~22줄만 바뀌었고, 전부 (a) JSDoc/inline 주석 갱신, (b)
`teardownChannelConfig` → `teardownRegisteredChannel` 리네임 + 그 호출부/모킹 동반 수정, (c) bare
리뷰 인용 `18_45_09` → 전체 경로 `review/code/2026/09/17/18_45_09` 정정 세 종류뿐이었다. 로직
변경(`+`/`-` 가 붙은 실행문)은 0건이다 — 요구사항 자체가 "주석 정합" 이므로 이 스코프 확인이
1차 판정이다.

## 발견사항

- **[INFO]** 리네임 완전성 — 정상
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:380`(정의),
    `trigger-resource-releaser.service.ts:123`(프로덕션 호출부),
    `trigger-resource-releaser.service.spec.ts:53`(mock)
  - 상세: `grep -rn teardownChannelConfig codebase/backend/{src,test}` 결과 잔존 1건뿐이며 그
    1건(`chat-channel-binder.service.ts:377`)은 "이전 이름 `teardownChannelConfig` 는 …" 라는
    **의도된 과거형 언급**이라 리네임 누락이 아니다. consistency checker(`plan_coherence`
    INFO#2, `review/consistency/2026/09/18/11_26_25/SUMMARY.md`)가 지적한 "실측표가 콜사이트보다
    좁다"는 이 diff 시점에는 이미 해소돼 있다(실제 코드에 `trigger-resource-releaser.service.ts`·
    `.spec.ts` 두 콜사이트가 반영됨) — 이 항목이 리스크가 아님을 확인하는 근거로 남긴다. (리뷰
    도중 plan 파일 자체에도 "뮤턴트로 확인: releaser 호출부만 옛 이름으로 되돌리면 예측 RED 1 ·
    실측 RED 1" 이라는 동일 결론의 기록이 동시에 추가됐다 — 아래 관측 사항 참고.)

- **[INFO]** 주석-spec 정합 — `secret-resolver.service.ts` `deleteByPrefix` JSDoc
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:161-176`
  - 상세: "워크스페이스 단위 접두는 없다 — 워크스페이스 삭제도 트리거마다 이 함수를 부른다" 및
    "프로덕션 직접 호출부는 `deleteTriggerSecretsAfterCommit` 한 곳" 주장을
    `spec/conventions/secret-store.md §2.1`("트리거 행이 없어질 때(트리거·스케줄·워크플로·
    워크스페이스 삭제) … `deleteByPrefix('secret://triggers/{id}/')`") · `§5.3`("스케줄·워크플로·
    워크스페이스 삭제도 같은 순서") 및 `grep -rn "secrets.deleteByPrefix(" codebase/backend/src`
    (프로덕션 호출 1건, `trigger-resource-release.ts:62`)로 대조 — line-level 일치.

- **[INFO]** 주석-spec 정합 — `trigger-config-lock.ts` `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:118-124`
  - 상세: "그 SoT 는 spec 트리거 목록 §4.3 의 자원 표다" 주장을
    `spec/2-navigation/2-trigger-list.md §4.3` 의 "외부 / `secret_store` 시점 표"와 대조 — 표 구조·
    시점 서술(외부는 행 삭제 전·트랜잭션 밖, 비밀은 커밋 뒤)이 정확히 일치. 종전 주석이 지웠던
    "소비자 목록을 여기 적지 않는다" 원칙과도 부합.

- **[INFO]** 인용 정정 — `workspaces.service.spec.ts:735`
  - 상세: bare `18_45_09` → `review/code/2026/09/17/18_45_09`. 해당 세션 `SUMMARY.md` #2 항목
    ("선검사 뒤 역할이 바뀌어 재검사가 거부 … 외부 해제는 되돌려지지 않는다")과 문맥이 정확히
    일치, `spec/conventions/review-citations.md §2/§3`(코드·테스트 주석은 전체 경로 권장/bare
    금지 대상)이 요구하는 형태로 이동 — 규약 위반을 해소하는 방향의 수정.

- **[INFO]** 인용 재구성 — `chat-channel-binder.service.ts` degraded 경로 주석의 `SUMMARY#24`
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:320-322`
  - 상세: 새 주석이 인용하는 `ad0ea7cdb`(#264)와 `review/code/2026/05/22/11_24_03` #24 를
    `git log --diff-filter=A` + `git show ad0ea7cdb:review/code/2026/05/22/11_24_03/SUMMARY.md`
    로 직접 열어 대조 — "«`setupChatChannel` 실패 시 botTokenRef DB 기록 후 경고 로그 없음»"
    문구가 정확히 일치하고, 그 디렉터리가 이후 `f7c56bf0a`(`refactor(plan,review): delete`)로
    워킹트리에서 제거된 것도 실측 확인됨. "워킹트리에선 정리됐고 이력에 있다"는 서술이 정확하다.

- **[INFO]** TODO/FIXME/HACK/XXX 미발견
  - `git diff origin/main -- codebase/` 전체에서 해당 마커 0건.

- **[INFO]** plan 체크리스트 — 리뷰 도중 세션이 자체 갱신함 (관측 사항, 내가 만든 변경 아님)
  - 위치: `plan/in-progress/trigger-release-stale-comments.md` 체크리스트
  - 상세: 리뷰 시작 시점엔 "1~8 적용"·"lint · unit · build · e2e" 가 미체크였으나, 리뷰 작업
    도중 `git status --short` 로 확인한 결과 이 파일이 워킹트리에서 수정돼 있었다(`M
    plan/in-progress/trigger-release-stale-comments.md`) — 두 항목이 체크되고 "이름 변경은
    뮤턴트로 확인: releaser 호출부만 옛 이름으로 되돌리면 예측 RED 1 · 실측 RED 1" ·
    "build(타입체크 ratchet 포함 — backend 197 · frontend 52, baseline 일치) · e2e backend 321" 근거가
    추가됐다. **이 수정은 본 리뷰(reviewer) 가 만든 것이 아니다** — 이 세션은 해당 파일에 어떤
    Write/Edit 도 수행하지 않았고, 동일 워크트리에서 동작 중인 다른 프로세스(개발 세션의
    체크리스트 갱신으로 추정)가 낸 변경으로 보인다. 병렬 fan-out 리뷰 규약(§검증용 뮤테이션
    규약)에 따라 그대로 보고한다 — 롤백하지 않았다(내가 만들지 않은 변경을 되돌리는 것은
    금지된 `git restore`/`checkout` 없이는 불가능하고, 규약도 "다른 세션의 미커밋 변경을
    되돌리지 말라"는 취지다). 내용 자체는 이 리뷰의 결론(리네임 완전성·동작 미변경)과 상충하지
    않고 오히려 뮤테이션 테스트·타입체크 ratchet·e2e 실행이라는 추가 실측 근거를 제공한다.

## 요약

이 변경은 순수 주석/식별자 정정 PR 로, 실행 로직을 건드리지 않는다. 새로 쓰인 주석 문구를
`spec/conventions/secret-store.md §2.1·§5.3`, `spec/2-navigation/2-trigger-list.md §4.3`,
`spec/conventions/review-citations.md §2·§3` 및 실제 코드(grep·git blame·git show)와 line-level
대조한 결과 CRITICAL/WARNING 급 불일치를 찾지 못했다. 리네임(`teardownChannelConfig` →
`teardownRegisteredChannel`)은 정의부·프로덕션 호출부·spec mock 세 자리 모두 반영돼 완전하며,
plan 이 스스로 지적한 "목록이 좁다"는 자기-검증 항목도 실제 diff 에서는 이미 해소돼 있다. 리뷰
도중 `plan/in-progress/trigger-release-stale-comments.md` 가 (본 리뷰어가 아닌) 다른 프로세스에
의해 체크리스트·검증 근거가 갱신되는 것을 관측했으며, 이는 결론에 영향을 주지 않고 오히려
뮤테이션 테스트·빌드·e2e 통과 근거를 보강한다.

## 위험도

NONE
