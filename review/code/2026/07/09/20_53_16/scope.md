# 변경 범위(Scope) 리뷰 결과

## 발견사항

- **[INFO]** 코드 fix 커밋에 이전 리뷰 세션 산출물(11개 파일) 신규 커밋이 동반됨
  - 위치: `review/code/2026/07/09/20_26_00/{SUMMARY.md,RESOLUTION.md,meta.json,_retry_state.json,documentation.md,maintainability.md,requirement.md,scope.md,security.md,side_effect.md,testing.md}`
  - 상세: 이번 커밋(`54b466defab`)의 diff 529줄 중 실제 코드 변경은 `PROJECT.md` 1줄 + `e2e-no-sub-global-timeout.test.ts` 43줄뿐이고, 나머지 대부분(11개 파일, 약 470줄)은 직전 리뷰 세션(20_26_00)의 SUMMARY/RESOLUTION 및 개별 reviewer 출력 파일을 새로 추가하는 것이다. 커밋 메시지 본문에 "SUMMARY/RESOLUTION 기록 + write-isolation 부재 4 reviewer 파일 journal 복원"이라고 명시적으로 disclose 돼 있고, 프로젝트 컨벤션(`review/` 는 gitignored 아님 — SUMMARY/RESOLUTION 도 커밋)에 정확히 부합한다. 즉 "의도 이상의 변경"이 아니라 표준 워크플로 산출물 커밋이다.
  - 제안: 조치 불필요. 커밋 메시지가 이미 두 관심사(코드 fix vs 리뷰 기록)를 명확히 구분해 disclose 하고 있어 리뷰어 혼선 우려가 없다.

- **[INFO]** `PROJECT.md` 1줄 추가가 이번 커밋의 핵심 코드 변경(test refactor)과 직접적 인과관계 없이 보임
  - 위치: `PROJECT.md` §자동 가드(build-time 차단) 목록
  - 상세: 추가된 줄은 신규 가드 테스트 파일 자체(`e2e-no-sub-global-timeout.test.ts`)를 목록에 등록하는 것으로, 그 테스트 파일은 이번 커밋 이전(별도 커밋)에 이미 존재했다. 이번 커밋은 그 파일의 **내부 로직**을 리팩터링할 뿐인데 `PROJECT.md` 항목 추가가 같이 묶여 있다. 다만 이는 커밋 메시지의 "INFO 3/4(PROJECT.md 가드 목록 등록·매직넘버 주석) 반영"이라는 명시적 언급과 정확히 일치하며, 직전 리뷰 세션의 INFO 3 발견사항(목록 미등록)에 대한 조치이므로 임의 확장이 아니다.
  - 제안: 조치 불필요. 리뷰가 요청한 항목을 그대로 반영한 것으로 범위 내.

## 무관한 수정 없음 확인

- `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` 의 diff 43줄은 전부 커밋 메시지가 명시한 3가지 조치(W1: `subGlobalTimeoutsInLine` 공유 헬퍼 추출, W2: `it()` 타이틀 `${GLOBAL}` 실값 보간, INFO4: 매직넘버 근거 주석)로만 구성되어 있다. 로직 변경(`v < global` 비교) 없이 순수 중복 제거·주석 추가·타이틀 문자열 정정뿐이며, 새 기능·API 확장·불필요한 임포트 변경은 없다.
- W3(regex word-boundary 미변경)는 코드 변경이 없는 항목이라 diff 에도 나타나지 않는다 — "정당한 미변경"이 실제로 지켜졌다.
- `git show --stat`으로 확인한 커밋 전체 파일 목록(13개)이 리뷰 payload 의 파일 목록과 정확히 일치하며, 이전 리뷰(`20_26_00`)가 지적했던 무관 파일(`execution-engine.service.spec.ts` 의 `service`→`svcMetrics`)은 **이미 별도 커밋(`7887bfb93`)으로 분리**되어 이번 커밋에는 포함돼 있지 않다. 이는 오히려 scope 분리 규율이 잘 지켜진 사례다.
- 포맷팅 전용 변경(공백/줄바꿈만)이나 사용하지 않는 임포트 추가/정리는 diff 상 발견되지 않았다.

## 요약

이번 커밋은 직전 코드 리뷰 세션(20_26_00)이 지적한 WARNING 3건 중 조치 대상 2건(W1 self-test/프로덕션 로직 이중구현, W2 타이틀 보간 버그)과 INFO 2건(가드 목록 등록, 매직넘버 주석)만 정확히 반영했고, 비조치 결정(W3)도 코드 변경 없이 그대로 유지되어 커밋 메시지와 실제 diff 가 1:1로 일치한다. 함께 커밋된 11개 `review/**` 산출물 파일은 요청 범위를 벗어난 임의 추가가 아니라, 프로젝트가 표준으로 규정한 "review 결과물도 같은 PR 에 커밋" 컨벤션의 이행이며 커밋 메시지에 명시적으로 disclose 돼 있다. 무관한 리팩토링·기능 확장·설정 변경·불필요한 주석/임포트 변경은 발견되지 않았으며, 이전 리뷰가 지적한 무관 파일(`execution-engine.service.spec.ts`)도 이미 별도 커밋으로 분리돼 이번 diff 에서 제외된 상태다.

## 위험도

NONE
