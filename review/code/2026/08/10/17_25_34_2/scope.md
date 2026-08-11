# 변경 범위(Scope) Review

대상: `claude/webchat-reload-rest-branches` 브랜치. 이번 라운드 changeset 13개 파일 — 이전
라운드(`17_15_33`·`17_15_33_2`) 산출물 11개(`_retry_state.json`·`meta.json`·`SUMMARY.md`·
`RESOLUTION.md`·개별 reviewer `.md` 8건) + `spec/7-channel-web-chat/3-auth-session.md` 1건.
지시대로 SUMMARY/RESOLUTION 의 주장을 `git show`로 실제 커밋과 대조했다(이 브랜치에서 그
불일치가 한 번 CRITICAL 이었던 이력이 있음).

## 검증 절차

- `git log --oneline -20` 로 커밋 계보 확인, `git show d03deb339` 로 RESOLUTION.md(파일3)·
  SUMMARY.md(파일4)가 서술하는 3개 항목(testing CRITICAL 반영·maintainability WARNING 반영·
  side_effect CRITICAL plan 등재)이 실제로 그 커밋에 실렸는지 대조.
- `git grep -n "shouldAbortAfterSeed" HEAD -- codebase/` 로 maintainability 추출물이 HEAD 에
  존재하는지, `git log -S "shouldAbortAfterSeed"` 로 어느 커밋에서 도입됐는지 확인.
- `git show d03deb339 -- codebase/.../use-widget-eager-start.test.ts` 로 "500 케이스에도 같은
  보강 적용" 주장을 diff 로 직접 대조.
- `git show d03deb339 -- plan/in-progress/webchat-auth-session-status-reconcile.md` 로
  "refresh_deferred 잔여 3택 plan 등재" 주장을 diff 로 대조.
- `git show 3d0cec69b -- review/code/2026/08/10/16_42_07/RESOLUTION.md` 로, 파일9(이전 라운드
  자신의 scope.md)가 주장하는 "직전 scope CRITICAL(산출물 거짓 완료 주장) 정정"이 실제 커밋에
  있는지 재대조.
- `git merge-base HEAD origin/main` + `git show <merge-base>:spec/.../3-auth-session.md` 로
  파일13 diff 의 좌변 blob(`facc62fcb`)이 실제 fork-point 임을, `git show
  origin/main:spec/.../3-auth-session.md` 로 origin/main 쪽 frontmatter 가 `partial`(별도
  PR #1130 산물)임을, 이 브랜치 HEAD 는 `status: implemented`(fork-point 와 동일, 이 PR 이
  건드리지 않음)임을 직접 대조.

## 발견사항

- **[INFO]** 이번 라운드 diff 는 리뷰 파이프라인 산출물(`review/code/**`)과 그 파이프라인이
  검토한 spec 문서 1건뿐이며, `codebase/**` 실제 소스 변경은 이번 changeset 에 없다(직전
  커밋 `d03deb339`에서 이미 커밋됨). `review/code/**` 산출물이 저장소에 커밋되는 것은
  `CLAUDE.md` "코드 리뷰 산출물" 규약이 명시하는 정상 워크플로우이므로 무관한 파일 혼입이
  아니다.
  - 위치: 파일 1·2·5·6·7·8·10·11·12 (모두 `review/code/2026/08/10/17_15_33[_2]/*`)
  - 제안: 없음.

- **[INFO]** RESOLUTION.md(파일3)·SUMMARY.md(파일4)의 3개 처분 주장이 실제 커밋과 정확히
  일치함을 재검증했다.
  - 위치: `review/code/2026/08/10/17_15_33_2/RESOLUTION.md` 1-46 (파일3 게이트 전체)
  - 상세: (1) "뮤테이션 2건 RED(이전 1건)" — `git show d03deb339`의
    `use-widget-eager-start.test.ts` diff 에 `vi.useFakeTimers`+`advanceTimersByTimeAsync`+
    `expect(after).toBeGreaterThan(before)` 보강이 500 케이스 테스트에 실제로 추가됨을 확인.
    (2) "`shouldAbortAfterSeed` 로 뽑았다" — `git log -S shouldAbortAfterSeed`가 정확히
    `d03deb339` 하나만 반환하고, `git grep`으로 HEAD 의 `use-widget.ts:120,716,1073` 세 곳에
    실재함을 확인. (3) "plan 등재 + 범위 명시" — `git show d03deb339`의 plan diff 에
    "## 미해결 — `refresh_deferred` 는 고착의 절반만 닫는다" 절과 (a)/(b)/(c) 3택 체크리스트가
    실제로 추가됨을 확인. 세 주장 모두 diff 내용과 1:1 대응한다.
  - 제안: 없음 — 추가 조치 불요.

- **[INFO]** 파일9(이전 라운드 자신의 scope.md)가 주장한 "직전 CRITICAL(커밋된 산출물이 자기
  diff 보다 넓은 완료를 주장) 정정이 실제 커밋과 일치" 도 재대조 결과 정확했다.
  - 위치: `review/code/2026/08/10/17_15_33_2/scope.md` 30-48 (파일9 게이트)
  - 상세: `git show 3d0cec69b -- review/code/2026/08/10/16_42_07/RESOLUTION.md` 에서 원 절이
    "**조치(정정)**: 아래 서술은 **이 라운드 커밋에 실리지 않았다**"로 고쳐지고 원 문장은
    `_(원 서술)_`로 격리·보존됐음을 diff 로 직접 확인 — 파일9의 서술과 정확히 일치한다.
  - 제안: 없음.

- **[INFO]** 파일13(`spec/7-channel-web-chat/3-auth-session.md`) 변경은 이 PR 이 실제로
  구현한 404/401/410 REST 분기를 서술로 뒤늦게 따라잡는 것으로, 코드 변경을 동반하지 않고
  같은 PR 의 목적과 1:1 대응한다 — 범위 이탈 없음.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md` (파일13 게이트 63-92)
  - 상세: `git merge-base HEAD origin/main` 결과 fork-point 블롭이 diff 좌변(`facc62fcb`)과
    정확히 일치함을 확인했고, 우변(`7654b00fb`) 은 `git show 153791125:...`(이 브랜치 자신의
    커밋)와 일치한다 — 즉 이 diff 는 origin/main 대비 이 PR 만의 누적 변경이지 다른 PR 의
    간섭이 아니다. §R3~R8 Rationale·§1·§2 등 다른 절은 손대지 않았고, 편집은 §3.1 배너
    갱신(66행)·frontmatter 조율 노트 신설(67-70행)·§3.1-2 "401"→"401·410" 정정(89행) 3곳으로
    한정된다.
  - 제안: 없음.

- **[INFO]** frontmatter 재판정 대기 노트(67-70행)는 실측으로 확인되는 실제 교차-PR 경합에
  대한 사실 고지이며, frontmatter 자체는 이번 diff 가 건드리지 않았다 — 스코프 회피가 지켜졌다.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:67`-`70`
  - 상세: `git show origin/main:spec/.../3-auth-session.md`의 frontmatter 는 `status: partial`
    (PR #1130 산물)인 반면, 이 브랜치 HEAD 의 frontmatter 는 `status: implemented` 로 fork-point
    (`git show <merge-base>:...`)와 동일하다 — 이 PR 은 frontmatter 를 전혀 편집하지 않았다.
    본문만 실제 구현에 맞춰 갱신하면서 frontmatter 충돌은 의도적으로 비켜 간 것이며, 그 조율
    절차는 별도 plan 파일(`plan/in-progress/webchat-auth-session-status-reconcile.md`)로
    분리돼 있어 spec 본문에 임시 로직·기능이 새로 들어가지 않았다.
  - 제안: 없음 — 참고로만 기록.

- **[INFO]** (참고, cross-reference) documentation reviewer(파일6)가 이미 지적한 사항 —
  "frontmatter 재판정 대기" 노트를 제거하는 단계가 조율 plan 의 처리 체크리스트에 없다.
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md` `## 처리 (나중 머지 쪽)`
    절 (`- [ ]` 3항목), 대조 대상은 `spec/7-channel-web-chat/3-auth-session.md:67`-`70`.
  - 상세: `git show HEAD:plan/in-progress/webchat-auth-session-status-reconcile.md`로 직접
    열어 확인한 결과, 체크리스트 3항목은 frontmatter 값·`pending_plans`·plan 자신의 이동만
    다루고 spec 본문에 새로 박아 넣은 이 노트 4줄을 지우는 단계가 없다. 노트 자체는 이번
    diff 범위 안(스코프 위반 아님)이지만, 정리 절차가 불완전하면 조율이 끝난 뒤에도 임시
    메모가 spec 본문에 영구 잔류할 위험이 있다 — 이미 documentation reviewer 가 WARNING 으로
    등재했으므로 여기서는 스코프 관점의 참고 표시로만 남긴다(중복 CRITICAL/WARNING 상향 없음).
  - 제안: (documentation.md 제안과 동일) `webchat-auth-session-status-reconcile.md` 처리
    체크리스트에 이 노트 제거 항목을 추가.

## 요약

이번 라운드 changeset(13개 파일)은 (1) 이 저장소가 명시적으로 허용하는 리뷰 파이프라인
산출물(`review/code/**`) 11건과 (2) 이 PR 이 실제로 구현한 REST 오류 분기를 문서로 동기화하는
spec 1건으로만 구성된다. `codebase/**` 실소스 변경은 이번 changeset 밖(직전 커밋에 이미
반영)이라 별도 코드 리팩토링·기능 확장·포맷팅·주석/임포트 정리·설정 변경 표면 자체가 없다.
지시받은 대로 RESOLUTION.md·SUMMARY.md·이전 scope.md 의 세 가지 핵심 주장(테스트 보강 2건
RED, `shouldAbortAfterSeed` 추출, plan 등재, 직전 scope CRITICAL 정정)을 각각 `git show`로
독립 재검증했고 전부 실제 커밋과 정확히 일치했다 — 산출물-커밋 불일치(이 브랜치의 과거
CRITICAL 패턴)가 이번 라운드에는 재발하지 않았다. spec 파일의 frontmatter 조율 노트는 실측
가능한 교차-PR 경합에 대한 정당한 최소 고지이며 frontmatter 자체를 건드리지 않아 스코프
회피 원칙도 지켜졌다. 유일한 잔여 사항은 documentation reviewer 가 이미 WARNING 으로 등재한
"노트 제거 체크리스트 누락" 으로, 스코프 위반은 아니고 후속 정리 절차의 완결성 문제다.

## 위험도

NONE
