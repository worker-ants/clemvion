# 부작용(Side Effect) 리뷰 — password 오류 코드 정렬 (`INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID`)

## 검토 방법

diff 에 등장하는 실제 소스(`password.util.ts`/`auth.service.ts`/`sessions.service.ts`/`users.service.ts`)를
저장소에서 직접 열어 게이트 번호와 대조했고, `grep -rn` 으로 `INVALID_PASSWORD`/`PASSWORD_VERIFY_CODES`/
`PASSWORD_NOT_SET` 의 backend·frontend 전체 참조처를 전수 확인했다. 저장소 트리는 읽기만 했고 아무것도
쓰거나 고치지 않았다(`git status --short` 로 확인 — 이 세션이 만든 변경 없음, `review/code/**` 산출물
디렉터리만 untracked로 신규).

## 발견사항

- **[INFO]** 공개 API 오류 코드(wire contract) 변경 — `INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID`
  - 위치: `codebase/backend/src/modules/users/users.service.ts:291`, `:300` (`changePassword`)
  - 상세: `POST /users/me/change-password` 가 OAuth-only(비밀번호 미설정) 조건과 비밀번호 불일치 조건을 종전엔
    둘 다 `INVALID_PASSWORD` 하나로 응답했는데, 이 diff 로 두 조건이 서로 다른 코드(`PASSWORD_REQUIRED`/
    `PASSWORD_INVALID`)를 응답하도록 바뀐다. 이 엔드포인트는 plan(`auth-change-password-oauth-only-code-split.md`
    §B등급 판정)이 스스로 명시하듯 "워크스페이스 JWT 로 호출 가능한 내부 REST 라 저장소 밖 호출자를
    원리적으로 배제할 수 없다" — 즉 이 코드값에 의존하는 외부/미지 호출자가 있다면 이번 변경으로 깨진다.
    실제 영향 범위는 `frontend/src` 전수 grep 으로 `INVALID_PASSWORD`/`PASSWORD_INVALID`/`PASSWORD_REQUIRED`
    참조 0건임을 확인했고(코드 기반 분기 없음, `axiosMessage()` 로 서버 `message` 를 그대로 노출), Swagger
    데코레이터(`users.controller.ts:213`)도 코드별이 아니라 일반 설명이라 저장소 내부 계약은 깨지지 않는다.
    다만 이는 이 PR 이 사용자 승인(2026-09-02, grade B 위험 인수)을 받아 의도적으로 감수한 변경이라 코드
    자체의 결함은 아니다 — **저장소 밖 호출자 존재를 배제할 수 없다는 전제가 그 승인 안에 이미 반영돼
    있는지**만 재확인 대상으로 남긴다.
  - 제안: 조치 불필요(설계상 의도된 breaking change, 근거 문서화됨). 배포 시 API 변경 로그/버전 고지 여부만
    운영 관점에서 확인.

- **[INFO]** `sessions.service.ts`/`auth.service.ts` 는 문자열 값 변경이 아니라 리터럴→공유 상수 치환뿐
  - 위치: `codebase/backend/src/modules/auth/sessions.service.ts:270`, `codebase/backend/src/modules/auth/auth.service.ts:75`, `:82`
  - 상세: 이 두 파일은 이미 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 리터럴을 쓰고 있었고, diff 는 그 리터럴을
    `PASSWORD_VERIFY_CODES.REQUIRED`/`.INVALID` 로 치환할 뿐이라 **런타임 응답 값은 이 두 파일에서는 변하지
    않는다**(실측: 문자열 값 동일). 실제 응답 값이 바뀌는 곳은 `users.service.ts` 뿐이다(위 항목). side effect
    없음 — 확인 목적의 기록.

- **[INFO]** 신규 공유 모듈 상수 `PASSWORD_VERIFY_CODES` 도입 — 3개 서비스가 import
  - 위치: `codebase/backend/src/common/utils/password.util.ts:23-28`
  - 상세: `AuthService`·`SessionsService`·`UsersService` 세 곳이 같은 모듈 레벨 객체를 import 한다. `as const`
    로 TS 타입 레벨 불변이지만 `Object.freeze()` 는 적용돼 있지 않아 이론상 런타임에 `PASSWORD_VERIFY_CODES.INVALID = '...'` 로
    재할당하면 세 서비스가 동시에 오염될 수 있다. 다만 같은 파일의 기존 `BCRYPT_ROUNDS` 도 동일 패턴(비
    freeze `export const`)이라 이 PR 이 새로 도입한 위험 유형은 아니고, 실제로 그런 재할당 코드는 발견되지
    않았다. 전역 변수 신설이라기보다는 읽기 전용 공유 상수 도입으로, 기존 컨벤션과 일치.
  - 제안: 조치 불필요. 이 저장소 컨벤션상 우려 대상 아님.

- **[INFO]** `scripts/backend-typecheck-baseline.json` 변경 — `total: 199 → 198`, `users.service.spec.ts` 항목 제거
  - 위치: `scripts/backend-typecheck-baseline.json:2` (total), 삭제된 `"src/modules/users/users.service.spec.ts": 1` 행
  - 상세: 이 파일 자신의 주석이 "손으로 고치지 말고 `check-backend-typecheck-ratchet.py --update` 로
    재생성할 것" 이라 명시한다. diff 는 `users.service.spec.ts` 에 신설된 `oauthOnlyUser()` 팩토리로 캐스트를
    한 곳에 모은 것과 정확히 대응하는 방향(오류 1건 감소)이라 내용상 타당하지만, 이 리뷰 범위(diff 대조)만으로는
    실제로 스크립트를 돌려 재생성한 것인지 수기 편집인지 구분할 수 없었다(재현하려면 backend 전체
    `tsc --noEmit` 을 다시 돌려야 하는데, 이는 저장소 뮤테이션 회피 원칙과 별개로 이 세션의 시간 예산을
    넘는 별도 검증이라 수행하지 않았다). 값이 낮아지는 방향(더 엄격해짐)이라 위험도는 낮다.
  - 제안: 병합 전 `python3 scripts/check-backend-typecheck-ratchet.py`(비-update 모드, 존재한다면)로 현재
    diff 파일 상태와 baseline 이 실제로 일치하는지 1회 확인 권장. Blocking 은 아님.

- **[정보/확인 완료]** `review/consistency/**`·`plan/complete/**` 다수 신규·이동 파일은 예상된 산출물
  - 상세: 이 diff 에 포함된 `review/consistency/2026/09/02/{21_12_35,21_26_05,21_40_49}/**`(SUMMARY·5개 checker·
    meta.json·_retry_state.json 등)와 `plan/complete/spec-draft-*.md` 이동은 CLAUDE.md 가 규정하는
    consistency-checker(`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)·plan lifecycle(`plan/complete/`)
    표준 산출 경로와 정확히 일치한다. 예기치 못한 파일시스템 부작용이 아니라 정규 워크플로 산출물로 판단.

## 요약

핵심 부작용은 `UsersService.changePassword` 가 응답하는 오류 코드가 `INVALID_PASSWORD` 단일값에서
`PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 분리되는 **의도된 API 계약 변경(breaking change)** 하나뿐이다.
저장소 내부(FE 코드·Swagger 문서)에는 이 값에 의존하는 곳이 없음을 전수 확인했고, 이 변경 자체는 plan
문서에서 grade B 위험으로 명시적으로 인수·승인된 것이라 코드 결함이 아니라 문서화된 트레이드오프다.
`sessions.service.ts`/`auth.service.ts` 는 실제 응답 값 변경 없이 상수 치환만 일어나 부작용이 없고, 신규
공유 상수 `PASSWORD_VERIFY_CODES` 도 기존 파일 컨벤션과 일치하는 읽기 전용 도입이다. 유일하게 이 리뷰
범위에서 완전히 재현·확인하지 못한 것은 `backend-typecheck-baseline.json` 이 실제로 재생성 스크립트를 통해
갱신됐는지 여부이나, 그 방향(오류 감소)과 대응 diff(`oauthOnlyUser()` 캐스트 통합)가 서로 정합적이라 위험은
낮다. 전역 상태·환경 변수·네트워크 호출·이벤트/콜백 변경은 발견되지 않았다.

## 위험도

LOW
