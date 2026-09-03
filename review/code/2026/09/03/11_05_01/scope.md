# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff origin/main...HEAD` (3커밋: `1950e5773` feat → `139115d34` fix(1R) →
`5232a5540` fix(2R+impl-done), 80 files / +5075 -62)를 전체 대상으로 하되, 이미
이전 두 라운드(`review/code/2026/09/02/22_07_21/scope.md`, `review/code/2026/09/03/10_45_22/scope.md`)가
검토·처분한 항목은 재확인만 하고, **이번 라운드(3R, `5232a5540`)가 새로 도입한 diff**
(`git diff 139115d34 5232a5540`, 27 files / +1813 -28)를 중점적으로 봤다.

## 발견사항

- **[INFO]** 3R 의 실제 코드/스펙 변경분은 직전 SUMMARY(2R)의 WARNING 1건("구조적으로
  불가능하다"는 근거가 거짓)·INFO 2건에 **정확히 대응** — 범위 이탈 없음
  - 위치: `codebase/backend/src/common/utils/password.util.ts:21-28`(JSDoc 근거 3종 교체),
    `codebase/backend/src/modules/auth/sessions.service.spec.ts:194-213`(가드 `throw` 를
    `catch` 밖으로),
    `codebase/backend/src/modules/users/users.service.spec.ts`(`rejectionOf` 헬퍼 추가 +
    `changePassword` JSDoc 위임 문구),
    `plan/in-progress/auth-change-password-oauth-only-code-split.md:106-124`
  - 상세: `git diff 139115d34 5232a5540`로 27개 파일을 전수 대조했다. 코드 diff 4개
    파일(`password.util.ts`·`sessions.service.spec.ts`·`users.service.spec.ts`·
    `users.service.ts`)은 RESOLUTION(2R)이 서술한 그 자리만 건드렸고, 새 기능·불필요한
    리팩토링·포맷팅·임포트 변경은 없다(`git diff -w` 결과가 non-`-w`와 동일 — 공백만
    바뀐 줄 0개).
  - 제안: 조치 불필요.

- **[WARNING]** `spec/5-system/1-auth.md` 자기반증형 소정정이 **취소선 보존 조건(조건 4)을
  충족하지 않는다** — 같은 정정을 담은 plan 문서와 처리 방식이 다르다
  - 위치: `spec/5-system/1-auth.md:521`
  - 상세: 3R 은 이 PR 이 스스로 쓴 "`UsersService` 는 `AuthService` 를 주입할 수 없다(순환
    의존)"는 잘못된 근거를 세 곳(spec §5 note·`PASSWORD_VERIFY_CODES` JSDoc·plan)에서
    정정했다. `CLAUDE.md`의 "자기 반증형 소정정" 절은 5개 조건을 **전부** 요구하며,
    조건 4 는 "원문은 취소선으로 **남기고**, 인접 서술은 건드리지 않는다"다.
    `plan/in-progress/auth-change-password-oauth-only-code-split.md:108-110`은 이 조건을
    정확히 지켰다(`~~UsersService 는 AuthService 를 주입할 수 없으므로(순환) …~~` 취소선
    보존 + "이 근거는 틀렸다" 정정문 추가). 그런데 같은 취지의 정정이 들어간
    `spec/5-system/1-auth.md:521`은 "헬퍼는 다르지만(순환 의존으로 재사용 불가) 코드는
    공유한다" 원문을 취소선 없이 통째로 "헬퍼는 다르되 코드는 공유한다. 헬퍼를
    재사용하지 않는 것은 **순환 의존 때문이 아니라**…"로 대체했다(`git diff 139115d34
    5232a5540 -- spec/5-system/1-auth.md`로 확인, 저장소 전체에서 `~~` 취소선 마커
    미검출). `codebase/backend/src/common/utils/password.util.ts`의 JSDoc(21~28줄)도
    같은 방식(취소선 없는 전면 재작성)이지만 그쪽은 `spec/`이 아니라 코드 주석이라 이
    절차 자체가 적용되지 않는다 — `spec/` 파일만 조건 4 대상이다.
  - 제안: 내용 자체는 정확하고(측정 근거 3개 열거, 커밋 메시지에도 실측 기록) 실질
    위험은 낮지만, 절차 문서가 명시한 "다섯 조건 전부" 요구를 `spec/` 파일에서 놓친
    것은 재발 시 다음 사람이 "이 문장이 예전에 뭐라고 돼 있었는지" 추적할 근거를 스펙
    안에서 잃게 만든다. 가능하면 `spec/5-system/1-auth.md`에도 취소선 보존 형태로
    재정정하는 것을 권장한다. 이미 머지 전 단계이고 plan 문서에 원문·정정 이력이
    남아 있어 차단 사유는 아니다(WARNING, 비차단).

## 캐리오버 (1R·2R 에서 이미 지적·처분됨, 3R 에 변화 없음)

- `plan/in-progress/spec-draft-ws-badge-flip-tracker-close.md` → `plan/complete/...` 이동이
  `1950e5773`(feat) 커밋에 여전히 물리적으로 남아 있다. change-password 와 무관하지만
  1R WARNING(W4)이 지적했고, 리뷰어가 제시한 최소 조치(커밋 메시지에 "무관한 정리" 절
  추가)가 이미 이행되어 있음을 재확인했다(`git log -1 --format=%B 1950e5773`). 3R 은
  이 커밋을 건드리지 않았으므로 상태 변화 없음 — 재조치 불요.
- `review/code/2026/09/02/22_07_21/**`, `review/code/2026/09/03/10_45_22/**`,
  `review/consistency/**` 등 리뷰/일관성 산출물이 매 라운드 함께 커밋되는 것은
  `CLAUDE.md` 저장 위치 관례(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)를 따른 것으로
  1R·2R scope 리뷰가 이미 확인했다 — 범위 이탈 아님.
- `scripts/backend-typecheck-baseline.json` 변경은 테스트 픽스처 캐스트 정리에 직접
  연동된 자동 재생성 산출물(1R·2R 확인 완료) — 3R 에서 추가 변경 없음.

## 요약

3라운드(`5232a5540`)는 직전 SUMMARY(2R)가 지적한 WARNING 1건·INFO 2건에 정확히 대응하는
변경만 담고 있어 이번 라운드 자체의 새로운 범위 이탈은 없다. 다만 그 WARNING을 해소하는
과정에서 `plan/`은 CLAUDE.md 가 요구하는 "자기 반증형 소정정" 5조건(취소선 보존 포함)을
정확히 지킨 반면 `spec/5-system/1-auth.md`는 같은 조건 중 취소선 보존만 놓쳤다 — 내용은
정확하고 커밋 메시지·plan 에 근거가 남아 있어 위험은 낮지만, 절차 준수 관점에서 WARNING
1건으로 기록한다. 전체 브랜치 기준으로는 change-password 실패 코드 정렬이라는 단일
목적에 시종 집중되어 있고, 이미 1R·2R 이 지적·처분한 WS 트래커 캐리오버(코드 0줄,
disclosure 완료)를 제외하면 포맷팅·임포트 정리·불필요한 리팩토링·기능 확장 성격의
변경은 발견되지 않았다.

## 위험도

LOW
