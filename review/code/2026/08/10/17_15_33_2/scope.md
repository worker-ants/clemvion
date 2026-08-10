# 변경 범위(Scope) Review

대상 파일: `spec/7-channel-web-chat/3-auth-session.md` (facc62fcb..7654b00fb, §3.1 배너 갱신 +
§3.1-2 마지막 문장 확장). 이번 라운드는 오케스트레이터 지시대로 "직전 라운드 scope CRITICAL(커밋된
산출물이 자기 diff 보다 넓은 완료를 주장)이 실제로 정정됐는지"를 `git show`로 재판정하는 것이
1차 목표다.

## 검증 절차

- `git log --all --oneline -- spec/7-channel-web-chat/3-auth-session.md`로 이 파일을 건드린 전체
  커밋 계보를 나열하고, `git merge-base --is-ancestor`로 각 커밋이 현재 HEAD(`840c5857a`)의 조상인지
  확인.
- 직전 CRITICAL의 출처를 특정하기 위해 `git log --oneline HEAD -- 'review/code/2026/08/10/*/scope.md'`
  로 이 워크트리 브랜치에 실제로 존재하는 scope 리포트 커밋만 추려 `16_56_39/scope.md`
  (커밋 `3d0cec69b`에 포함)에서 원 CRITICAL 전문을 확인.
- 그 CRITICAL이 지목한 대상(`review/code/2026/08/10/16_42_07/RESOLUTION.md`·`SUMMARY.md`의
  "`"stale"` 반영·뮤테이션 RED 2건" 주장)이 실제로 정정됐는지 `git show 3d0cec69b -- 'review/code/2026/08/10/16_42_07/*'`로
  직접 대조.
- 그 CRITICAL이 요구한 실제 코드 수정(`"refresh_deferred"` 전용 갈래)이 이후 커밋에 실제로
  존재하는지 `git show 3d0cec69b -- codebase/channel-web-chat/src/widget/use-widget.ts`,
  `git show fd1075514`(배선 재작업), `git show HEAD:codebase/channel-web-chat/src/widget/use-widget.ts | grep -n refresh_deferred`로 HEAD 기준 최종 착지를 확인.
- 이번 diff 배너(게이트 66, 89)가 주장하는 404/401/410 분기가 실제 코드에 있는지 `git show deb9b6978 -- codebase/channel-web-chat/src/widget/use-widget.ts`,
  `git show 153791125 -- codebase/channel-web-chat/src/widget/use-widget.ts`로 대조.
- frontmatter 재판정 배너(게이트 67-70)가 서술하는 교차 PR 경합이 실재하는지 `git fetch origin main`
  후 `git show origin/main:spec/7-channel-web-chat/3-auth-session.md | git hash-object --stdin`로
  origin/main 쪽 blob과 대조.

## 발견사항

- **[INFO]** 재판정 결과: 직전 라운드 scope CRITICAL("커밋된 산출물이 자기 diff 보다 넓은 완료를
  주장")은 이번 라운드까지 이어지는 후속 커밋에서 실제로 해소됐다 — 주장과 실제 커밋이 일치한다.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:66` (신규 배너 "**`404`·복구불가 `401` REST
    분기와 `401 → 낙관적 refresh 1회` 도 구현됐다**(2026-08-10)")
  - 상세: 원 CRITICAL은 `review/code/2026/08/10/16_56_39/scope.md`(커밋 `3d0cec69b`에 포함)가 낸
    것으로, "`16_42_07` RESOLUTION.md/SUMMARY.md가 `"stale"` 반환 수정을 '반영·뮤테이션 RED 2건'으로
    기록해 커밋됐지만 `git show`상 그 커밋들(`153791125`, `08bd668a5`)에는 `return "continue"` →
    `"stale"` 치환이 없었다"는 내용이었다. 같은 커밋 `3d0cec69b`의 diff를 직접 열어 대조한 결과,
    (1) `review/code/2026/08/10/16_42_07/RESOLUTION.md`의 해당 절이 "**조치(정정)**: 아래 서술은
    **이 라운드 커밋에 실리지 않았다**"로 고쳐지고 원 문장은 `_(원 서술)_`로 격리·보존됐으며,
    `SUMMARY.md` Critical 표 1행도 "⚠ 이 라운드에서는 반영되지 않았다 — 아래 정정 참조"로 수정됨을
    확인했다. (2) 실제 수정은 그 정정과 같은 커밋(`3d0cec69b`)에서 `"continue"`/`"stale"` 둘 다
    새로운 고착을 만든다는 이유로 전용 갈래 `"refresh_deferred"`를 신설하는 형태로 이루어졌다.
    (3) 그 배선이 공유 워크트리의 뮤테이션 하네스 `cp` 원복에 두 번 덮여 유실됐다가 `fd1075514`에서
    세 번째로 착지했음을 커밋 메시지·diff로 확인했고, `git show HEAD:codebase/channel-web-chat/src/widget/use-widget.ts | grep -n refresh_deferred`
    결과 8곳(타입 선언·두 호출부 게이트·JSDoc)에 일관되게 실재해 HEAD에서 최종 반영됨을 재확인했다.
    즉 "산출물 주장을 사실로 정정하고 실제 처분을 가리키게 했다(원 서술은 이력 보존)"는 이번 라운드
    서술은 `git show` 실측과 정확히 일치한다.
  - 제안: 없음 — 조치가 완료 확인됐으므로 추가 조치 불요.

- **[INFO]** 이번 diff의 두 번째 변경(게이트 89, "재차 `401`·`410` 이면 종료로 간주")도 실제 코드와
  1:1 대응하며, 서술 확장 범위가 코드 변경 범위를 넘지 않는다.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:89`
  - 상세: `git show 153791125 -- codebase/channel-web-chat/src/widget/use-widget.ts`에서
    `refreshErr.status === 401 || refreshErr.status === 410` 조건과 그 커밋 메시지("410 분기가
    뮤테이션 사각지대였다 … requirement 가 백엔드까지 추적해 410(GoneException/EXECUTION_TERMINATED)이
    실제 도달 가능함을 확인 … 코드가 옳고 spec §3.1-2 가 낡았다")를 대조한 결과, 이 게이트 89 수정은
    코드를 스펙에 맞춘 것이 아니라 **먼저 옳았던 코드를 뒤늦게 문서에 반영**한 정정이다. 같은 diff에
    §R3~R8 Rationale·§1~§2·§3.1의 다른 절차 서술은 손대지 않아 무관한 범위 확장이 없다.
  - 제안: 없음.

- **[INFO]** frontmatter 재판정 대기 배너(게이트 67-70)는 실측으로 확인되는 실제 교차-PR 경합을
  사실대로 고지한 것이며, frontmatter 자체는 이번 diff에서 변경하지 않아 스코프 회피 원칙이 지켜졌다.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:67-70`
  - 상세: `git fetch origin main` 후 `git show origin/main:spec/7-channel-web-chat/3-auth-session.md`의
    blob이 `ac8bcf4ec`로, 이는 이 워크트리 브랜치의 조상이 아닌 별도 커밋(`cbc0d3376`, `status: partial`
    + `pending_plans:`로 정정)의 산출물임을 `git merge-base --is-ancestor cbc0d3376 HEAD` (NOT
    ancestor)로 확인했다. 반면 이 브랜치는 `deb9b6978`→`4eb1be379`→`153791125`→…→`fd1075514` 계보로
    같은 파일의 §3.1-2 본문을 실제 구현에 맞춰 갱신하면서도 frontmatter(`status: implemented`)는
    `deb9b6978` 커밋 메시지에서 명시한 대로("frontmatter 는 #1130 소관이라 건드리면 충돌한다")
    의도적으로 건드리지 않았다. 배너가 예고한 "나중에 머지되는 쪽이 재판정" 시나리오는 이미
    `plan/in-progress/webchat-auth-session-status-reconcile.md`가 두 PR의 완료 조건을 독립 항목으로
    분리해 명문화해 두었고, 이번 diff는 그 문서를 가리키기만 할 뿐 절차 자체를 새로 만들지 않았다 —
    기능 확장이 아니라 이미 존재하는 계획 문서로의 최소 포인터다.
  - 제안: 없음 — 참고로만 기록.

## 요약

오케스트레이터가 요청한 재판정 결과, 직전 라운드 scope CRITICAL("커밋된 산출물이 자기 diff 보다
넓은 완료를 주장")은 후속 커밋(`3d0cec69b`가 산출물 서술을 정정하고, `fd1075514`가 그 실제 배선을
세 번째 시도에서 HEAD에 착지)으로 실제로 해소됐음을 `git show`로 직접 확인했다. 이번 라운드의
diff(§3.1 배너 갱신 + §3.1-2 문장 확장) 자체도 각 문장이 가리키는 커밋(`deb9b6978`, `153791125`)의
실제 코드·회귀 테스트와 1:1 대응하며, 무관한 리팩토링·포맷팅·주석/임포트 정리·기능 확장·설정 변경은
발견되지 않았다. frontmatter 재판정 배너는 실측으로 확인되는 실제 교차-PR 경합에 대한 사실 고지이고
frontmatter 자체는 여전히 건드리지 않아 스코프 회피 원칙도 유지된다.

## 위험도

NONE
