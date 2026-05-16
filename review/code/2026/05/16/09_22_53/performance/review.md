# 성능(Performance) 코드 리뷰

세션: `review/code/2026/05/16/09_22_53`
대상 파일: `Makefile`, `backend/src/modules/integrations/third-party-oauth.controller.spec.ts`, `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md`, `review/consistency/2026/05/16/09_13_51/SUMMARY.md`

---

### 발견사항

- **[INFO]** `--build` 플래그 추가로 인한 e2e-test 실행 시간 증가 (캐시 미스 시)
  - 위치: `Makefile` lines 41, 52, 59–61 (`e2e-up`, `e2e-test`, `e2e-test-full` 타겟)
  - 상세: `--build` 플래그를 항상 전달하면 Docker BuildKit 이 매 실행마다 레이어 체크섬 비교를 수행한다. 소스가 변경되지 않은 경우 모든 레이어가 캐시 히트하여 오버헤드는 수백 ms 수준이므로 실용적으로 문제없다. 다만 `backend-e2e-runner` 와 `playwright-runner` 에 `run --rm --build` 를 적용하면, `run` 서비스는 `up` 과 달리 BuildKit 가 빌드 컨텍스트를 다시 해시하는 비용이 추가로 발생한다. CI 환경처럼 layer cache 가 없는 경우에는 빌드 오버헤드가 상당할 수 있다.
  - 제안: `backend-e2e-runner` 와 `playwright-runner` 가 `backend-e2e` 와 동일한 이미지를 공유하거나 별도 Dockerfile 을 갖는지 확인한다. 이미 `up --build backend-e2e` 로 서버 이미지를 빌드한 뒤 runner 가 그 이미지를 단순 실행만 한다면 `run --rm` 에서 `--build` 를 제거해도 stale 이미지 문제가 해소된다. 구조상 필요한 경우에만 runner 에도 `--build` 를 유지한다.

- **[INFO]** `e2e-test-full` 의 `playwright-runner` 는 `backend-e2e-runner` 성공 시에만 실행되지만 (`&&` 연결), `STATUS=$$?` 가 마지막 명령(`$(MAKE) e2e-down`)의 exit code 가 아닌 `playwright-runner` 의 exit code 를 보존한다는 점에서 타이밍 의미론이 변경 전과 동일함 — 성능 문제는 아니지만 `e2e-down` 자체 실패 시 STATUS 가 0 으로 오염될 수 있음. 변경 diff 범위 밖이므로 INFO 로 기록.
  - 위치: `Makefile` lines 59–62
  - 상세: 기존 로직 그대로이나, `--build` 추가로 runner 빌드가 실패하면 `STATUS` 가 runner 빌드 실패 코드를 받아 이후 스텝에서 혼동될 수 있다.
  - 제안: runner 이미지가 서버 이미지와 독립적으로 빌드된다면 빌드 단계를 `e2e-up` 에 통합하고 `run` 단계에서는 `--build` 를 제거하는 것이 오버헤드와 오류 격리 모두에 유리하다.

- **[INFO]** `third-party-oauth.controller.spec.ts` 의 타입 narrowing 변경은 성능 무관
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` lines 85–88
  - 상세: `Record<string, unknown>` → `Record<string, string>` 타입 좁히기 + `String(contentType ?? '')` → `contentType ?? ''` 의 불필요한 `String()` 래핑 제거는 런타임에서 객체 래핑을 한 단계 줄인다. 효과는 마이크로초 단위로 테스트 전체 성능에 실질 영향은 없으나 코드 명확성 측면에서 올바른 방향이다.
  - 제안: 유지. 변경 자체가 성능·정확성 모두에 긍정적이다.

---

### 요약

이번 변경은 Docker BuildKit `--build` 플래그 추가와 소규모 TypeScript 타입 수정으로 구성된다. 성능 측면의 핵심 고려점은 `--build` 플래그가 매 e2e 실행마다 레이어 체크섬 비교 비용을 수반한다는 점이다. 소스 변경이 없는 경우 BuildKit layer cache 가 모든 레이어를 재사용하므로 로컬 개발 환경에서의 오버헤드는 미미하고, stale 이미지로 인한 사일런트 404 실패를 방지하는 정확성 이득이 훨씬 크다. 다만 `run --rm --build` 로 runner 서비스까지 매번 빌드하는 구조가 필요한지 재검토할 여지가 있으며, runner 가 독립 이미지를 갖지 않는다면 `up` 단계에서의 단일 `--build` 만으로 충분하다. TypeScript 변경은 불필요한 `String()` 래핑을 제거한 미세한 개선으로 성능 관점에서 특이사항 없다. 전체적으로 성능 위험도가 낮은 변경이다.

### 위험도

LOW
