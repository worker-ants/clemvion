# 테스트(Testing) 코드 리뷰

## 발견사항

- **[INFO]** `--build` 플래그 추가로 e2e 테스트 인프라의 신뢰성 근본 향상
  - 위치: `Makefile` — `e2e-up` (L40), `e2e-test` (L51-52), `e2e-test-full` (L59-61)
  - 상세: 기존 `up -d --wait` 만으로는 Docker layer cache 에 묶인 stale 이미지가 재사용되어 새로 추가한 컨트롤러가 컨테이너에 반영되지 않았다. 이는 테스트가 실제 코드 변경을 검증하지 못하는 치명적인 커버리지 허위 보장(false assurance) 구조다. `--build` 추가로 이 구조적 취약점이 해소됐다. plan 문서에 기술된 대로 BuildKit layer cache 가 변경되지 않은 레이어를 재사용하므로 운영 부담은 작다.
  - 제안: 현재 수정이 올바른 방향이다. 추가 개선으로 CI workflow 에서 `make e2e-test` 가 직접 호출되는지 확인해 Makefile 수정이 CI 에도 동일하게 반영되는지 점검 권장 (plan의 선택적 후속 항목과 동일).

- **[INFO]** `e2e-test-full` 의 `playwright-runner` 에도 `--build` 추가 — 일관성 확보
  - 위치: `Makefile` L61
  - 상세: `backend-e2e-runner` 뿐 아니라 `playwright-runner` 에도 `--build` 를 추가해 모든 runner 서비스에 동일한 정책이 적용됐다. 이 일관성은 테스트 유형 간 격차(backend e2e 는 최신 이미지, frontend e2e 는 stale 이미지)를 방지한다.
  - 제안: 적절하다.

- **[INFO]** `third-party-oauth.controller.spec.ts` L428-430 타입 좁히기 — 테스트 의도 표현 정확도 향상
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` L85-88
  - 상세: `Record<string, unknown>` 에서 `Record<string, string>` 으로 타입을 좁히고, `String(contentType ?? '')` 대신 `contentType ?? ''` 을 직접 사용했다. 이 변경은 `@typescript-eslint/no-base-to-string` lint 오류를 해소하는 동시에 테스트 의도("Content-Type 헤더는 string 타입이어야 한다")를 더 명확하게 표현한다. 기존 `String()` 래핑은 실제로는 header 값이 unknown 이어도 테스트가 통과하는 약한 assertion 이었다.
  - 제안: 적절하다. 타입 좁히기로 헤더 값이 실제로 string 이 아닐 경우 TypeScript 컴파일 단계에서 조기 검출이 가능해진다.

- **[WARNING]** stale 이미지 결함에 대한 회귀 방지 테스트 미존재
  - 위치: `Makefile`, `docker-compose.e2e.yml` — e2e 인프라 레벨
  - 상세: 이번 변경의 근본 원인(stale Docker 이미지로 인한 사일런트 404)은 코드 로직 버그가 아닌 빌드 인프라 설정 버그다. 현재 e2e 스위트(66 tests, 12 suites)는 컨트롤러가 정상 등록된 상태를 전제하므로, stale 이미지 상황을 재현하는 테스트는 구조상 작성하기 어렵다. 그러나 `BackgroundRunsController`, `ThirdPartyOAuthController` 같이 이번 결함의 직접 피해를 입은 컨트롤러에 대해, 컨테이너 startup 시 해당 라우트가 실제로 등록됐는지를 헬스체크 수준에서 확인하는 smoke test(예: `GET /background-runs` 가 404 가 아닌 응답을 반환하는지)가 있으면 유사 결함을 조기 검출할 수 있다.
  - 제안: 선택적 개선. e2e 스위트에 각 컨트롤러의 최소 smoke test(단순 라우트 존재 확인)를 추가하면, 향후 stale 이미지나 모듈 등록 누락 시 즉시 실패 시그널을 얻을 수 있다.

- **[INFO]** `make e2e-test` 결과 12/12 suites, 66/66 tests PASS 가 plan 에 기록됨 — 회귀 없음 확인
  - 위치: `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` L156
  - 상세: 수정 후 전체 e2e 스위트를 실행해 모든 테스트가 통과함을 확인했다. 기존 테스트가 변경 후에도 유효하게 동작한다는 근거가 plan 내에 기록되어 있다.
  - 제안: 적절하다.

- **[INFO]** `e2e-test-full` 의 `&&` vs `; STATUS=$$?` 패턴 혼재 — 테스트 실패 전파 일관성 점검
  - 위치: `Makefile` L59-62 (`e2e-test-full` 타겟)
  - 상세: `e2e-test` 타겟은 `run --rm --build backend-e2e-runner; STATUS=$$?; $(MAKE) e2e-down; exit $$STATUS` 패턴을 사용해 테스트 실패 시에도 반드시 `e2e-down` 을 실행한다. 반면 `e2e-test-full` 은 `backend-e2e-runner && playwright-runner` 패턴을 사용해 backend runner 실패 시 playwright runner 가 실행되지 않으나, `STATUS=$$?` 캡처는 playwright runner 결과만 반영한다. 이는 이번 변경 이전부터 존재하던 패턴이며 이번 PR 의 도입 결함은 아니다. `--build` 추가 후에도 동일 패턴이 유지된다.
  - 제안: 이번 PR 범위 밖이나 기록 목적으로 명시. `e2e-test-full` 도 `e2e-test` 와 동일하게 `; STATUS=$$?` 패턴으로 통일하는 것을 향후 개선으로 고려 가능.

## 요약

이번 변경의 핵심은 `Makefile` e2e 타겟에 `--build` 플래그를 추가해 Docker layer cache 로 인한 stale 이미지 문제를 근본적으로 해소한 것이다. 테스트 관점에서 이 수정은 e2e 테스트가 실제 최신 코드를 검증한다는 가장 기본적인 전제를 복원한다 — stale 이미지 상황에서는 테스트 결과가 무의미했으므로, 수정 이후에야 66개 테스트의 green 결과가 유효한 신뢰를 제공한다. 동반된 `third-party-oauth.controller.spec.ts` 타입 좁히기는 테스트 assertion 의 정확성을 높인다. 전체 테스트 스위트(12 suites, 66 tests)의 PASS 는 확인됐으며 회귀 위험은 낮다. 선택적 개선 사항으로 stale 이미지 류의 결함을 조기 검출하기 위한 컨트롤러 smoke test 추가를 고려할 수 있다.

## 위험도

LOW
