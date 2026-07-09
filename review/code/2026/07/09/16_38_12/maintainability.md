# 유지보수성(Maintainability) Review

대상 커밋: `24eaf91694741e1c9dcf87d7eca199b54a0efc2d` (test(e2e): Playwright 스위트 flakiness 안정화)
대상 파일: `codebase/frontend/e2e/profile/profile-edit.spec.ts`, `codebase/frontend/playwright.config.ts`
변경 규모: 2 files changed, 18 insertions(+), 7 deletions(-) — 함수 신설 없음, config 객체 리터럴 + 주석 + 타임아웃 값 조정.

## 발견사항

- **[INFO]** 동일 파일 내 타임아웃 리터럴이 파편화됨
  - 위치: `codebase/frontend/e2e/profile/profile-edit.spec.ts:221, 246, 271` (`{ timeout: 10_000 }` 3곳) vs `:325` (신규 `{ timeout: 15_000 }`)
  - 상세: 같은 파일에 반복되던 `10_000` 중 리다이렉트 대기 한 곳만 이번 diff 로 `15_000` 이 되면서, "왜 이 대기만 5초 더 긴가"가 인라인 주석(Tier 3 언급)에만 의존하게 됐다. 코드베이스에는 이미 `codebase/frontend/e2e/helpers/mock-auth.ts` 의 `PAGE_READY_TIMEOUT`, `codebase/frontend/e2e/web-chat/console.spec.ts` 의 `DIALOG_TIMEOUT` 처럼 이름 붙인 타임아웃 상수 패턴이 존재해, 이 파일의 인라인 리터럴 방식과 스타일이 갈린다. 다만 주석 자체는 근거를 설명하고 있어 "의미 불명 매직 넘버"는 아니다.
  - 제안: 필수 조치는 아님. 후속 정리 시 `const REDIRECT_TIMEOUT = 15_000` 등으로 추출하거나, 남은 `10_000` 들과의 관계를 짧게 교차 언급하면 향후 값 재조정 추적이 쉬워진다.

- **[INFO]** "Tier 1/2/3" 라벨이 커밋 메시지 서사 + 파일 간 교차 참조에 의존
  - 위치: `codebase/frontend/playwright.config.ts:15-33`(Tier 1/2/3 주석 정의), `codebase/frontend/e2e/profile/profile-edit.spec.ts:59`(`Tier 3` 언급만 있고 정의 없음)
  - 상세: `playwright.config.ts` 쪽은 각 옵션 위 주석이 자기완결적이라 문제없으나, `profile-edit.spec.ts` 의 `(client-side navigation — 부하 시 여유 필요, Tier 3)` 주석은 `Tier 3`가 무엇을 가리키는지 `playwright.config.ts` 를 함께 봐야 드러난다. 실질적으로 두 파일이 하나의 SoT(커밋 메시지의 3-tier 분류)를 공유하지만 코드 자체에는 명시적 포인터가 없다.
  - 제안: `profile-edit.spec.ts` 주석에 `playwright.config.ts` 참조를 짧게 덧붙이면(`// Tier 3 — playwright.config.ts 전역 timeout 참고`) 파일 단독으로도 맥락이 완결된다. 사소한 사항으로 즉시 수정 요구 수준은 아님.

## 요약
이번 변경은 테스트 인프라(Playwright 설정 3개 옵션 조정 + e2e 스펙 타임아웃 1줄) 범위로 한정되어 있고, 각 변경 지점(`retries`, `timeout`/`expect.timeout`, `webServer.command`)에 "왜 바꿨는지"를 설명하는 Tier 1/2/3 주석이 상세히 달려 있어 가독성과 향후 유지보수에 필요한 맥락이 잘 보존된다. 기존 코드 스타일(`process.env.CI ? A : B` 삼항 패턴이 바로 아래 `workers` 필드에서 이미 쓰이던 관용구)과도 일관되며, 함수 신설이 없어 함수 길이·중첩 깊이·순환 복잡도 관점의 새 리스크는 없다. 발견된 사항은 모두 사소한 INFO 수준(파일 간 타임아웃 값 분산, Tier 라벨의 교차 파일 의존)으로, 즉각적인 조치 없이 병합해도 무방하다.

## 위험도

NONE
