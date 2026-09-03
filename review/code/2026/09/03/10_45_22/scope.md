# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff origin/main...HEAD` (커밋 `1950e5773` feat + `139115d34` fix, 2건)와, 이번 라운드에서
새로 실린 fix 커밋(`139115d34`)의 diff(`git diff 1950e5773 139115d34`)를 별도로 대조했다. 후자가
이번 라운드(직전 SUMMARY 의 WARNING 4건에 대한 RESOLUTION)가 실제로 도입한 변경분이다.

## 발견사항

- **[INFO]** fix 커밋(`139115d34`)은 직전 라운드 WARNING 4건(W1~W4) + 조치 대상 INFO 3건에
  **정확히 대응하는 변경만** 담고 있다 — 범위 이탈 없음
  - 위치: `codebase/backend/src/common/utils/password.util.ts`(JSDoc 세 번째 소비처 추가),
    `codebase/backend/src/modules/auth/sessions.service.spec.ts`(리터럴 단언 테스트 1건 추가),
    `codebase/backend/src/modules/users/users.service.spec.ts`(테스트 제목 2건 좁힘),
    `codebase/backend/test/users-change-password.e2e-spec.ts`(OAuth-only e2e 1건 추가),
    `CHANGELOG.md`(Unreleased 항목 추가), `plan/in-progress/auth-change-password-oauth-only-code-split.md`,
    `review/code/2026/09/02/22_07_21/*`(RESOLUTION.md 포함 전 라운드 산출물)
  - 상세: `git diff 1950e5773 139115d34 --stat` 로 19개 파일 변경분을 전수 대조했다. 코드 diff
    (`password.util.ts`·`users.service.spec.ts`)는 RESOLUTION.md 가 서술한 정확히 그 자리만
    건드렸고(테스트 제목 문자열 치환, JSDoc 한 문단 추가), 포맷팅·임포트·무관 리팩토링은 없다.
    `review/code/2026/09/02/22_07_21/**` 커밋은 `CLAUDE.md` 저장 위치 표의 "코드 리뷰 산출물 →
    `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 관례를 그대로 따른 것이고, 과거 744건의
    `_retry_state.json` 커밋 이력(`git log --diff-filter=A -- '**/_retry_state.json'`)이 이 저장소의
    표준 관행임을 뒷받침한다. 범위 이탈 아님.
  - 제안: 조치 불필요.

- **[INFO]** (캐리오버, 이미 라운드 1 에서 W4 로 지적·조치됨) `feat` 커밋(`1950e5773`)에 change-password
  작업과 무관한 plan 이동 1건이 여전히 같은 커밋 안에 남아 있다 — **분리되지 않고 disclosure 로 갈음**
  - 위치: `plan/in-progress/spec-draft-ws-badge-flip-tracker-close.md` →
    `plan/complete/spec-draft-ws-badge-flip-tracker-close.md` (rename, `git diff origin/main...HEAD`
    기준 similarity 96%)
  - 상세: 이 파일은 WS `auth.token_expired` 배지 flip 트래커 종결 문서로, 이번 PR 의 주제(change-password
    실패 코드 정렬)와 무관하다(`git show origin/main:plan/in-progress/spec-draft-ws-badge-flip-tracker-close.md`
    로 대조 확인 — 헤딩이 "WS `auth.token_expired` 배지 flip · 트래커 종결"). 같은 커밋에 있는
    또 다른 plan 이동(`spec-draft-api-convention-status-and-password-codes.md`)은 `error-codes.md`
    §5 `INVALID_PASSWORD` 은퇴 이력과 직접 연결돼 있어 이 PR 과 관련이 있는 반면, WS 트래커 쪽은
    관련이 없다. 이는 라운드 1 SUMMARY 가 이미 WARNING(W4·scope)으로 지적했고, RESOLUTION.md 는
    "별도 커밋으로 갈랐어야 했다. 이미 만든 커밋이라 커밋 메시지에 절을 추가해 명시했다(리뷰어가
    제시한 최소 조치)"고 명시했다. 실측 확인 결과 `git log -1 --format=%B 1950e5773` 에 실제로
    "## 무관한 정리 2건이 함께 들어갔다 (코드 0줄)" 절이 존재하고, `git log -S` 로 WS 이력을 쫓는
    사람이 이 커밋에 걸릴 수 있음을 명시적으로 경고하고 있다 — 합의된 최소 조치가 실제로 이행됐다.
    코드 변경은 0줄(문서 링크 상대경로 보정 1줄 포함 plan 메타뿐)이라 실질 위험은 낮다.
  - 제안: 이미 disclosure 로 완결 처리된 항목이라 추가 조치 불필요. 다만 다음에 유사 상황(`--spec`
    게이트가 여러 draft 를 한 번에 짚어 줄 때)이 생기면, 커밋 전에 무관한 항목만 먼저 별도 커밋으로
    갈라내는 편이 사후 disclosure 보다 싸다는 점을 팀 관례로 남겨 둘 만하다.

- **[INFO]** `scripts/backend-typecheck-baseline.json` 변경(`199/38` → `198/37`)은 이번 PR 이 추가한
  `oauthOnlyUser()` 테스트 픽스처의 캐스트 정리(선재 타입 오류 1건 해소 포함)에 직접 연동된
  자동 산출물이다 — 범위 이탈 아님
  - 위치: `scripts/backend-typecheck-baseline.json`
  - 상세: 커밋 메시지("## ratchet 이 잡은 것 — 타입이 실제보다 좁다")와 RESOLUTION.md INFO #6
    ("비-update 모드로 재확인: OK: backend 198건 / 37파일 — baseline 과 일치")이 일치하고, 파일
    자체가 손 편집이 아니라 스크립트 재생성 산출물이라는 규약을 따른다.
  - 제안: 조치 불필요.

## 요약

Round 2(fix 커밋 `139115d34`)는 직전 SUMMARY 의 WARNING 4건·INFO 3건에 **정확히 대응하는 변경만**
담고 있어 이번 라운드 자체에서 새로 발생한 범위 이탈은 없다. 전체 브랜치 diff(`origin/main...HEAD`)
기준으로는 라운드 1 에서 이미 지적·조치된 캐리오버 1건(WS 배지 트래커 plan 이동, 코드 0줄)이
여전히 같은 `feat` 커밋 안에 물리적으로 남아 있으나, 커밋을 가르는 대신 커밋 메시지에 전용 절을
추가해 명시적으로 disclose 하는 합의된 최소 조치가 실제로 이행돼 있음을 재확인했다. 핵심 코드
변경(`password.util.ts`·`auth.service.ts`·`sessions.service.ts`·`users.service.ts`와 대응 테스트)은
단일 목적(형제 흐름과 실패 코드 정렬)에 시종 집중돼 있고, 포맷팅·임포트 정리·불필요한 리팩토링·
기능 확장 성격의 변경은 발견되지 않았다.

## 위험도

LOW
