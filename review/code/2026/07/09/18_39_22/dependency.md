# 의존성(Dependency) Review

## 리뷰 대상 요약

본 changeset(commit d4a188eb)은 e2e Playwright 스펙 6개의 하드코딩 sub-global
`toBeVisible({ timeout: ... })` 제거(전역 `expect.timeout` 상속), `playwright.config.ts`·
`docker-compose.e2e.yml` 주석 정합화, 그리고 `plan/`·`review/` 하위 문서(md/json)
추가·갱신으로 구성된다. `package.json`, lockfile(`pnpm-lock.yaml`), `Dockerfile`,
CI workflow yaml 등 의존성 선언 파일은 diff 에 전혀 등장하지 않는다.

### 발견사항

- **[INFO]** 신규/변경 외부 의존성 없음
  - 위치: 전체 changeset (`codebase/frontend/e2e/**/*.spec.ts`, `playwright.config.ts`, `docker-compose.e2e.yml`, `plan/**`, `review/**`)
  - 상세: diff 전체를 grep 한 결과 `package.json`·`pnpm-lock.yaml`·Dockerfile base image·CI action 버전 등 의존성 관련 파일 변경이 0건이다. 변경은 (1) 테스트 코드에서 `toBeVisible()` 호출부의 인라인 `timeout` 옵션 제거, (2) `playwright.config.ts`/`docker-compose.e2e.yml` 주석 텍스트 정정, (3) plan/review 산출물 markdown·json 추가뿐이다. `@playwright/test` 는 이미 존재하던 의존성이며 버전 변경 없음(단순 주석에서 "frontend package.json 의 @playwright/test ^1.59" 를 언급할 뿐).
  - 제안: 조치 불필요. 의존성 관점에서는 risk-free changeset.

- **[INFO]** 내부 의존성(설정 SoT) 집중화 — 개선 방향
  - 위치: `codebase/frontend/playwright.config.ts:1137` (`expect: { timeout: 10_000 }`), 6개 spec 파일의 `toBeVisible({ timeout: 5_000 })` → `toBeVisible()` 변경
  - 상세: 각 spec 파일이 개별적으로 하드코딩하던 `timeout: 5_000`/`3_000` 리터럴을 제거하고 `playwright.config.ts` 의 전역 `expect.timeout(10_000)` 한 곳으로 값의 출처를 수렴시켰다. 이는 "여러 파일에 흩어진 매직 넘버"라는 내부 의존성 분산 문제를 줄이는 방향이며, 새로운 외부 패키지 의존은 아니다. 다만 각 spec 은 이제 global config 값에 암묵적으로 의존하므로, 향후 `playwright.config.ts` 의 `expect.timeout` 값을 낮추면 이번에 override 를 제거한 6곳 모두가 동시에 영향받는다(의도된 결합).
  - 제안: 조치 불필요 — 오히려 바람직한 SoT 집중화. 참고 사항으로만 기록.

- **[INFO]** 라이선스·취약점·번들 크기·버전 고정·호환성 항목 해당 없음
  - 위치: N/A
  - 상세: 신규 패키지 추가가 없으므로 라이선스 호환성 검토, CVE/취약점 스캔, 번들 크기·빌드 시간 영향, 기존 의존성과의 버전 충돌 여부는 모두 해당 사항 없음(변경 전과 동일한 의존성 그래프 유지).
  - 제안: 조치 불필요.

### 요약

이번 changeset 은 e2e 테스트 코드의 하드코딩 timeout 제거, 설정 파일 주석 정합화, 그리고 plan/review 문서 추가로만 구성되어 있으며 `package.json`/lockfile/Dockerfile 등 의존성 선언 파일은 전혀 변경되지 않았다. 새 외부 패키지 도입, 버전 변경, 라이선스·취약점·번들 크기·호환성 이슈가 발생할 여지가 없는 dependency-risk-free changeset이다. 굳이 언급할 점이 있다면 6개 spec 의 개별 timeout override 제거로 `playwright.config.ts` 의 전역 `expect.timeout` 값에 대한 암묵적 결합이 늘었다는 것뿐이며, 이는 의존성 분산을 줄이는 바람직한 방향이라 문제로 볼 수 없다.

### 위험도

NONE
