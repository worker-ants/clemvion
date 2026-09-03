# 문서화(Documentation) 코드 리뷰 — 3라운드

## 검토 범위와 방법

`change-password` 실패 코드 정렬(`INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID`)
작업의 3번째 리뷰 라운드다. 대상 82개 파일 중 다수(`review/consistency/**`, `review/code/2026/09/02/**`,
`review/code/2026/09/03/10_45_22/**`)는 이 changeset 자신이 이미 실행한 이전 리뷰·컨시스턴시
라운드의 산출물(프로세스 아티팩트)이라, 이 라운드의 "문서화 대상"이 아니다. 이 라운드의 실질
질문은 단 하나다 — **이전 두 라운드가 지적한 문서화 결함들이 실제로 HEAD(`5232a5540`)에서
해소됐는가**, 그리고 **직전 fix 커밋(`5232a5540`)이 새로 만든 문서화 결함이 있는가.

애플리케이션 코드·spec·plan·유저 가이드 파일을 diff 가 아니라 저장소 현재 상태에서 직접
`Read`/`grep` 으로 재대조했다(diff 문맥만으로는 과거 라운드의 "조치 완료" 주장을 검증할 수
없어서다).

## 재검증 결과 — 이전 라운드 지적 사항 전수 해소 확인

- **CHANGELOG.md**: `## Unreleased — 비밀번호가 없는 사람에게…` 항목 존재. 코드 쌍
  (`INVALID_PASSWORD`→`PASSWORD_REQUIRED`/`PASSWORD_INVALID`), 영향 엔드포인트, 감사값 존속
  이유, 유저 가이드 정정까지 정확히 기록됨(1R WARNING #3 해소, 직접 대조 확인).
- **`PASSWORD_VERIFY_CODES` JSDoc**(`password.util.ts:10-29`): 소비처 3곳
  (`AuthService.verifyPasswordForUser` · `UsersService.changePassword` ·
  `SessionsService.verifyReauth`) 전부 열거됨(2R INFO #2 해소).
- **"순환 의존이라 헬퍼 공유 불가"라는 반증된 근거**: `password.util.ts` JSDoc,
  `spec/5-system/1-auth.md:521` §5 note, `plan/in-progress/auth-change-password-oauth-only-code-split.md`
  세 곳 모두 원문을 취소선으로 보존한 채 측정된 근거(조회 2회·`!user` 처방 차이·안내 문구 차이)로
  교체됐다(`--impl-done` WARNING 해소, 커밋 `5232a5540` 직접 확인) — CLAUDE.md 의
  "자기-반증형 소정정" 5조건(대상 문장을 본인이 씀·예고/근거 문장·실측 반증·국한된 정정+취소선
  보존·plan 기록)을 모두 충족하는 모범적 처리다.
- **"4중 근접명명" 산수 오류**(`3-error-handling.md:585`): "wire 2종"이었던 것이
  "wire 3종(`PASSWORD_INVALID`·`PASSWORD_REQUIRED`·`REAUTH_REQUIRED`) + 감사값 1종"으로
  정정됐고, `:69` 근접명명 주의 문단도 동일하게 "wire 3종"으로 갱신됨(rationale_continuity
  WARNING 해소).
- **`1-auth.md:337` 재인증 note 발행처 열거 누락**: "**비밀번호 변경의 현재 비밀번호
  재확인**(`UsersService.changePassword`, 아래 note)" 문구가 추가되어 발행처 열거가 완결됨
  (cross_spec WARNING 해소).
- **테스트 제목이 단언 범위보다 넓음**(`users.service.spec.ts`): "OAuth-only 계정(passwordHash
  부재)은 401 로 막고 저장하지 않는다"(클래스 단언 전용) / "OAuth-only 실패 코드는 형제 흐름과
  같은 PASSWORD_REQUIRED 다"(코드값 전용)로 제목이 실제 단언과 정확히 일치하도록 분리됨
  (1R maintainability INFO 해소).
- **`sessions.service.spec.ts` 가드 `throw`가 자기 `catch`에 잡히는 문제**: 가드 단언
  (`expect(thrown).toBeInstanceOf(...)`, `:209`)이 `try/catch` 블록 **밖**에 위치해 실제 회귀
  시 진단이 정확한 메시지를 낸다(2R INFO #3 해소). 다만 `codeOf()`류 헬퍼로 추출되지는 않고
  인라인으로 남아 있다 — 이는 2R maintainability 가 이미 "조치 불요(현재 1회성)"로 판단한 항목과
  동형이라 재지적하지 않는다.
- **mdx 유저 가이드(ko/en)**: "직접 설정하는 기능은 제공되지 않아요"라는 사실 오류가
  "비밀번호를 추가할 수는 있어요… forgot-password → reset-password"로 정정되어 있고,
  `spec/5-system/1-auth.md §1.1.A` 및 구현(reset-password 가 `password_hash` 부재를 전제로
  검사하지 않음)과 일치.

## 발견사항

- **[INFO]** Swagger(OpenAPI) `@ApiUnauthorizedResponse` 설명이 여전히 단일 문구
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` — `changePassword` 핸들러
    데코레이터(`description: '현재 비밀번호 불일치 또는 인증 실패'`). 이 파일은 이번 diff
    대상이 아니라 함수/데코레이터명으로 특정(게이트 줄 번호 인용 안 함)
  - 상세: 컨트롤러는 서비스 예외를 그대로 전파할 뿐이라 기능 결함은 아니다. 다만
    `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 두 코드로 갈린 사실이 OpenAPI 스펙 소비자(자동
    client 생성기 등)에게는 여전히 드러나지 않는다. 1R·2R 리뷰(`api_contract.md`,
    `documentation.md`)가 이미 동일 지점을 INFO 로 지적했고 "`swagger.md` 규약 범위라 이 PR
    에서 넓히지 않는다"는 판단이 두 라운드 연속 유지됐다 — 새로운 결함이 아니라 기존 유예의
    재확인이다.
  - 제안: 조치 불요(스코프 밖 유예 유지). 여유가 있을 때 두 코드로 설명을 세분화하면 API 문서
    소비자에게 더 정확하다는 점만 참고로 남긴다.

- **[INFO]** 소유 plan 2건이 사실상 완료 상태인데 `plan/in-progress/`에 남아 있음
  - 위치: `plan/in-progress/auth-change-password-oauth-only-code-split.md`(`## 할 일` —
    "후속(별개 PR)" 1건을 제외한 전 항목 `[x]`), `plan/in-progress/spec-draft-change-password-code-alignment.md`
  - 상세: 두 plan 모두 이 작업이 실제로 계획한 변경(spec 4곳·codebase 4곳·유저 가이드)을
    전량 이행했음을 본문에서 직접 확인했다. 남은 미체크 항목은 `User.passwordHash` 타입을
    `string | null` 로 넓히는 **명시적으로 별개 PR로 분리된** 후속 작업 하나뿐이다. 이 상태에서
    `plan/complete/` 로 옮기지 않으면 다음 세션이 "아직 진행 중"으로 오독할 여지가 남는다.
  - 제안: 이 저장소의 표준 순서(review → consistency → 마무리 커밋에서 체크박스 동기화 +
    `complete/` 이동 판단, 이미 `plan_coherence` 라운드 3회가 동일하게 권고)대로, 이번 라운드
    통과 후 마무리 커밋에서 두 plan 을 `plan/complete/` 로 이동할 것을 권장한다. Blocking 은
    아니다.

## 요약

3라운드에 걸쳐 지적된 문서화 결함(CHANGELOG 누락·JSDoc 소비처 과소열거·반증된 "순환 의존"
근거 3중 오기·근접명명 산수 오류·재인증 note 발행처 누락·테스트 제목-단언 불일치·가드 진단
오류·mdx 사실 오류)을 저장소 현재 상태에서 전수 재대조했고, **전부 실제로 해소되어 있음을
직접 확인했다.** 특히 반증된 설계 근거를 취소선으로 원문을 보존하며 세 곳(spec·JSDoc·plan)
동시에 측정된 근거로 교체한 처리는 이 저장소의 "자기-반증형 소정정" 규약을 정확히 따른다.
이번 라운드 자체가 새로 만든 문서화 결함은 발견되지 않았다. 남은 항목은 스코프 밖으로
반복 유예된 Swagger 세분화 1건과, 완료된 plan 2건의 `complete/` 이동 타이밍(마무리 커밋에서
처리 예정으로 보임) 뿐이며 둘 다 INFO 로, blocking 사유가 아니다.

## 위험도

NONE
