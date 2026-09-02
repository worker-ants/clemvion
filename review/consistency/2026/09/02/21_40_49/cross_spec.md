# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-prep)

## 검토 범위에 대한 안내

`_prompts/cross_spec.md` 번들은 컨텍스트 예산 초과로 `spec/5-system/` 15개 파일(본문)이
생략되어 있었다(`4-execution-engine.md`·`6-websocket-protocol.md` 등). 해당 파일들은 최근
커밋(`cedd34feb`, `--impl-done spec/5-system/` BLOCK:NO, checker 5/5 NONE)에서 이미 검증된
상태이고, 이번 세션의 실제 작업 대상(uncommitted diff)은 `plan/in-progress/spec-draft-change-password-code-alignment.md`
가 구현을 예고하는 **`change-password` 에러 코드 정렬**(`spec/5-system/1-auth.md`·
`spec/5-system/3-error-handling.md`·`spec/conventions/error-codes.md`·
`spec/2-navigation/9-user-profile.md`)이므로, 이 delta 를 중심으로 실제 파일(`Read`/`grep`)을
직접 열어 cross-spec 정합성을 검증했다. 생략된 15개 파일 중 이 delta 와 연결점이 있는 것은
없었다(`INVALID_PASSWORD`/`PASSWORD_REQUIRED`/`PASSWORD_INVALID`/`changePassword` 전수 grep
결과 관련 파일 5개만 매치).

## 검증 방법

- `spec/**` 전수 `grep` 으로 `INVALID_PASSWORD`·`PASSWORD_REQUIRED`·`PASSWORD_INVALID`·
  `PASSWORD_NOT_SET`·`change-password`/`changePassword` 참조를 모두 열거하고 각 위치의
  서술이 서로 모순 없이 한 그림을 그리는지 대조.
- 변경된 4개 파일의 anchor 링크(`#121-2fa--webauthn--...`)가 실제 변경된 heading 슬러그와
  일치하는지, 3곳 모두 새 anchor 로 갱신됐는지 확인.
- `login_history.failure_reason` 감사값 계층(`spec/1-data-model.md §2.18.2`,
  `spec/data-flow/2-auth.md`)이 이번 wire 코드 은퇴와 레이어 충돌 없이 유지되는지 확인.
- `codebase/backend/src/modules/auth/auth.service.ts` 를 열어 draft 의 사실 주장
  ("`PASSWORD_NOT_SET` 은 이미 `login_history.failure_reason` 감사값으로 존재") 을 실측 대조.

## 발견사항

- **[INFO]** `error-codes.md §5` rename 표의 `PR` 열이 PR/이슈 번호가 아니라 plan 파일 링크를 담고 있다
  - target 위치: `spec/conventions/error-codes.md` §5 표, `INVALID_PASSWORD` 행 (`PR` 열)
  - 충돌 대상: 같은 표의 다른 행 — `LLM_CONFIG_NOT_FOUND`/`INVALID_INPUT`/`WORKSPACE_REQUIRED` 행은 모두 `PR4b`/`#1193`/`#566` 형식의 실제 PR·이슈 번호를 쓴다
  - 상세: 새 행만 `[auth-change-password-oauth-only-code-split.md](...)` 라는 plan 링크를 쓴다. 표의 열 이름(`PR`)이 암묵적으로 "이 rename 이 반영된 PR" 을 가리키는 관례인데, 이 행은 PR 이 아직 없어 형식이 이질적이다
  - 제안: 이미 draft 자체가 이 편차를 인지하고 있다(item #10, "PR 생성 직후 번호로 갱신"). 새로운 조치는 불필요 — 이 PR 이 머지되는 시점에 실제 PR 번호로 교체하는 후속 작업만 놓치지 않으면 된다. 표에 "PR 미생성 시 임시로 plan 링크 허용" 문구를 §5 머리말에 한 줄 추가해 두면 다음 번 같은 상황에서 형식 근거를 찾을 필요가 없어진다

- **[INFO]** `9-user-profile.md` §2.0 표의 "비밀번호" 행 — 구두점 누락으로 두 문장이 붙어버림
  - target 위치: `spec/2-navigation/9-user-profile.md:94`
  - 충돌 대상: 같은 파일 §2.2(`:147`, 이번 draft 가 지정한 SoT 행)
  - 상세: `...자세한 폼은 §2.2 참조 OAuth-only 계정의 안내 분기는 §2.2 보안 설정 표(비밀번호 변경 행)가 SoT.` — "참조" 와 "OAuth-only" 사이에 마침표/줄바꿈이 빠져 한 문장처럼 읽힌다. §2.2 를 SoT 로 가리키는 포인터 자체는 정확하고 다른 곳(§2.1 `:141`)과도 정합적이지만, 문장 결합 오류가 "이 문장이 §2.0 자체 설명인지 §2.2 포인터 안내인지"를 순간적으로 헷갈리게 한다
  - 제안: `§2.2 참조.` 뒤에 마침표/줄바꿈 삽입. cross-spec 정합성 자체에는 영향 없음(자기 파일 내 오타 수준) — self-consistency 체커 영역과 겹치니 그쪽에서 이미 잡았다면 중복 조치 불필요

## 교차 검증으로 확인된 정합 사항 (참고 — 문제 아님)

다음은 실제로 grep/Read 로 대조해 **모순이 없음을 확인**한 항목들이다(다른 checker 가 이미
같은 결론에 도달했을 수 있으나, cross-spec 관점에서 별도로 재검증했다는 근거로 남긴다):

- `spec/1-data-model.md §2.18.2`(`login_history.failure_reason` enum)와
  `spec/data-flow/2-auth.md`(시퀀스 다이어그램의 `reason=INVALID_PASSWORD`)는 모두 `INVALID_PASSWORD`
  가 **로그인 실패 감사값**으로만 쓰인다는 draft 의 전제와 일치한다 — 다른 스펙 영역이 이 값을
  `changePassword` 발행 코드로 여전히 참조하는 곳은 없다.
  `PASSWORD_NOT_SET`(감사값, `auth.service.ts:330`)이 실제로 존재함을 코드에서 확인해 "새
  wire 코드를 신설하면 감사값과 이름이 충돌했을 것" 이라는 draft 의 근거가 사실임을 검증했다.
- `1-auth.md`(§2.3 note `:339`, §5 note `:521`, §2.3.D `:756`)·`3-error-handling.md`(§1.2.1
  헤더·표·근접명명 주석)·`error-codes.md`(§3 제거·§5 신규 행) 4개 파일 전부가 "wire 3종
  (`PASSWORD_INVALID`/`PASSWORD_REQUIRED`/`REAUTH_REQUIRED`) + 감사값 1종(`INVALID_PASSWORD`)"
  이라는 동일한 최종 상태를 가리킨다 — 어느 한 파일만 구 서술("별개 wire 코드")을 남긴 곳이 없다.
  anchor 링크(`#121-2fa--webauthn--재인증비밀번호-재확인-코드-도메인-spec-참조`)도 3곳 모두
  새 heading 슬러그로 갱신돼 있어 dangling 링크가 없다.
- `9-user-profile.md` §2.1(`:141`)·§2.2(`:147`, SoT)·§6.1 엔드포인트 표(`:355`)가 서로 다른
  레이어(필드 요약/화면 흐름/API 표)에서 각자의 역할만 서술하고 중복 정의를 하지 않는다 —
  §2.2 를 단일 SoT 로 두고 나머지는 포인터만 두는 draft 의 설계(변경안 #12)가 실제로 그렇게
  반영돼 있다.
- `spec/5-system/2-api-convention.md`(target 번들에 전문 포함된 유일한 다른 5-system 파일)는
  API 일반 규칙(URL 구조·워크스페이스 스코핑·HTTP 메서드)만 다루고 이번 delta 의 엔드포인트
  (`POST /users/me/change-password`)와 겹치는 서술이 없어 충돌 표면 자체가 없다.
- RBAC/권한 관점: `change-password` 는 자기 자신에 대한 self-service 액션(JWT 인증만 요구,
  `RolesGuard` 대상 아님)이라는 서술이 전 파일에서 일관되며, 이번 코드 분리가 권한 모델을
  건드리지 않는다.

## 요약

이번 세션에서 실제로 진행 중인 target delta(`change-password` 실패 코드를 형제 흐름
`PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 정렬하고 `INVALID_PASSWORD` wire 코드를 은퇴시키는
변경)는 `spec/5-system/1-auth.md`·`3-error-handling.md`·`spec/conventions/error-codes.md`·
`spec/2-navigation/9-user-profile.md` 4개 파일에 걸쳐 있으나, 전수 grep 대조 결과 데이터
모델(`1-data-model.md`)·data-flow(`2-auth.md`)·API 컨벤션(`2-api-convention.md`)·RBAC 서술
어디와도 직접 모순되지 않는다. 감사값(`login_history.failure_reason`)과 wire 코드 레이어를
명확히 분리해 서술하고 있고, 관련 anchor 링크도 전부 갱신돼 dangling 참조가 없다. 발견된
2건은 모두 INFO 등급의 문서 형식/문장 결합 잡음이며 기능적 충돌이 아니다. 생략된
`spec/5-system/` 15개 파일은 최근 `--impl-done` 세션에서 이미 NONE 판정을 받았고, 이번 delta
와의 grep 교차점도 없었다.

## 위험도

LOW
