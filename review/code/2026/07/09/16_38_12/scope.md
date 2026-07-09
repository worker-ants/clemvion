# 변경 범위(Scope) 리뷰 결과

대상 커밋: `24eaf9169` — test(e2e): Playwright 스위트 flakiness 안정화 (retries·prod 빌드·timeout)
`git show --stat` 로 커밋 전체를 재확인한 결과 변경 파일은 review payload 에 제시된 2개(`profile-edit.spec.ts`, `playwright.config.ts`)뿐이며, 은닉된 추가 파일 변경은 없다. 커밋 의도(Tier 1 retries · Tier 2 CI prod 빌드 webServer · Tier 3 timeout slack)와 실제 diff 를 1:1 대조했다.

### 발견사항

- **[INFO]** 각 설정 변경에 "Tier 1/2/3" 주석이 커밋 메시지 서술과 대응해 삽입됨
  - 위치: `codebase/frontend/playwright.config.ts` retries/timeout·expect/webServer 블록 주석
  - 상세: 커밋 메시지 설명을 코드 주석으로도 남긴 형태지만, 각 설정값이 왜 그 값인지(예: prod 빌드가 dev 온디맨드 컴파일의 비결정적 hydration/chunk timing 을 제거한다는 근거)를 설명해 유지보수에 유용하다. 무관한 주석 첨삭이 아니라 이번 diff 가 만든 동작 변화를 정확히 설명하는 근거 문서화로 판단.
  - 제안: 조치 불필요(정보성).

- **[INFO]** `webServer.timeout` 180_000 → 240_000 변경은 커밋 메시지 3-tier 목록에 별도 항목으로 명시되지 않았으나 Tier 2 에 종속된 필연적 동반 조정
  - 위치: `playwright.config.ts` webServer 블록
  - 상세: `next build && next start` 전환(Tier 2)은 dev 서버 기동보다 오래 걸리므로 webServer 기동 타임아웃 확장이 뒤따르는 것이 자연스럽다. 별도 관심사 도입이 아니라 Tier 2 변경의 직접 파생 효과.
  - 제안: 조치 불필요. 원한다면 커밋 본문에 한 줄 추가해 명시하면 추적성이 더 좋아짐(optional, 비차단).

- **[INFO]** `expect: { timeout: 10_000 }` 전역 기본값 추가로 `profile-edit.spec.ts` 등 기존 스펙이 이미 개별 지정한 `{ timeout: 10_000 }` assertion 들이 redundant 해짐
  - 위치: `playwright.config.ts` `expect` 옵션, `profile-edit.spec.ts` 내 여러 개별 `{ timeout: 10_000 }` 인자(예: 221, 246, 280 라인)
  - 상세: 회귀나 오류는 아니며(중복 지정이 기존 동작을 바꾸지 않음), 스코프 위반도 아니다. 이번 커밋이 그 정리를 시도하지 않은 것은 범위를 좁게 지킨 타당한 판단(별도 관심사 혼입 회피)으로 본다.
  - 제안: 이번 변경 범위 밖이므로 조치 불필요. 필요 시 후속 cleanup PR 후보로만 기록.

- **[INFO]** `profile-edit.spec.ts` 변경은 커밋이 지목한 정확히 그 한 지점만 수정
  - 위치: `codebase/frontend/e2e/profile/profile-edit.spec.ts:57-60`
  - 상세: `waitForURL` timeout 을 10_000→15_000 으로 올리고 주석에 근거(Tier 3)를 추가한 것 외에, mock 셋업(`setupProfileMocks`)·다른 3개 테스트 블록·docblock 헤더는 전혀 손대지 않았다.
  - 제안: 없음.

임포트 변경, 기능 확장(over-engineering), 무관 파일 수정, 포맷팅-only 변경, 의도치 않은 설정 변경(예: `package.json`, CI workflow yaml, `tsconfig`, ESLint 설정 등)은 발견되지 않았다.

### 요약

이번 커밋은 커밋 메시지가 서술한 "retries·prod 빌드·timeout" 3-tier 정확히 그 항목들로만 구성되어 있다. `profile-edit.spec.ts` 는 change-password 리다이렉트 `waitForURL` 타임아웃 10s→15s 한 줄과 이를 설명하는 주석만 변경했고 파일의 나머지는 그대로다. `playwright.config.ts` 도 retries/timeout/expect.timeout/webServer.command/webServer.timeout 등 flakiness 안정화와 직결된 설정만 수정했고, `projects`(chromium 단일 구성)·`use`(baseURL/trace/screenshot)·`testDir`/`testMatch`/`fullyParallel`/`forbidOnly` 등 무관한 설정은 그대로 유지됐다. 불필요한 리팩토링, 기능 확장, 무관한 파일·임포트 변경, 포맷팅과 실질 변경의 혼재는 발견되지 않았으며 추가된 주석도 설정값의 근거를 설명하는 용도로 스코프를 벗어나지 않는다.

### 위험도
NONE
