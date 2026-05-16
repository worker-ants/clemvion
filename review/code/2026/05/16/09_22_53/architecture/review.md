# 아키텍처(Architecture) Review

리뷰 대상: `Makefile`, `backend/src/modules/integrations/third-party-oauth.controller.spec.ts`, `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md`, `review/consistency/2026/05/16/09_13_51/SUMMARY.md`

---

### 발견사항

- **[INFO]** Makefile `e2e-up` 타겟의 책임 일관성
  - 위치: `Makefile` — `e2e-up` 타겟
  - 상세: `e2e-up` 은 "인프라 기동" 단독 책임을 갖는 타겟이다. `--build` 추가는 "소스 반영" 책임도 함께 포함하게 되어 단일 책임 범위가 미미하게 확장된다. 다만 `e2e-test`, `e2e-test-full` 이 `e2e-up` 을 직접 호출하지 않고 각자 `up --build` 를 인라인으로 실행하는 구조이므로, `e2e-up` 의 변경은 독립적으로 `e2e-up` 을 사용하는 개발자(예: 로컬 디버깅 목적 수동 기동) 에 대한 배려로 일관성 있다. 실질적인 SRP 위반은 아님.
  - 제안: 현 구조 유지 가능. 향후 "기동만" / "빌드+기동" 두 시나리오를 구분할 필요가 생기면 `e2e-up-fresh` 같은 별도 타겟을 분리하는 방식으로 확장성 확보 가능.

- **[INFO]** `e2e-test` 와 `e2e-up` 사이의 중복 (DRY / 응집도)
  - 위치: `Makefile` — `e2e-test`, `e2e-test-full`, `e2e-up` 타겟
  - 상세: `e2e-test` / `e2e-test-full` 이 `e2e-up` 을 재사용하지 않고 `$(COMPOSE_E2E) up -d --wait --build backend-e2e` 를 직접 중복 인라인 한다. 이는 기존 설계부터의 패턴이며, plan 문서에 `--abort-on-container-exit` 를 피하기 위한 의도적 분리임이 명시되어 있다. 아키텍처 결함은 아니나, 향후 `up` 인자(예: `--profile`)가 추가될 때 세 곳을 동시에 수정해야 하는 변경 취약점이 된다.
  - 제안: `e2e-up` 에 대해 `$(MAKE) e2e-up` 을 통해 재사용하거나, `COMPOSE_E2E_UP` 같은 Makefile 변수로 `up` 인자를 중앙화하면 변경 지점이 1곳으로 줄어든다.

- **[INFO]** TypeScript 테스트 코드의 타입 레이어 경계
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` L85-88
  - 상세: `Record<string, unknown>` → `Record<string, string>` 으로 타입을 좁힌 변경은 ESLint `@typescript-eslint/no-base-to-string` 규칙을 해소하는 lint-driven fix다. 테스트 코드에서 실제 HTTP 응답 헤더를 `string` 으로 좁히는 것은 현실적이고 적절하다. 아키텍처 레이어 측면에서, 테스트가 `res` 의 내부 구조를 직접 캐스팅(`as { headers?: ... }`)하는 방식은 supertest mock 객체와 강하게 결합되어 있어 타입 안전성이 타입 캐스팅에 의존한다.
  - 제안: 이 패턴은 supertest mock의 타입 한계에 기인하는 허용 가능한 pragmatic cast다. 중요도 낮음. 만약 이 패턴이 반복적으로 사용된다면 테스트 헬퍼 함수(`getContentType(res)`) 를 추출해 캐스팅 로직을 단일화하는 리팩토링을 고려할 수 있다.

- **[INFO]** 빌드 인프라 결정의 문서화 위치
  - 위치: `Makefile` 인라인 주석 (L35-38)
  - 상세: `--build` 누락의 근본 원인·결정 배경이 Makefile 인라인 주석에 직접 기술되어 있다. CLAUDE.md 규약상 아키텍처 결정의 배경·근거는 해당 spec 문서의 `## Rationale` 섹션에 두도록 되어 있다. 다만 Makefile 은 `spec/` 영역이 아닌 인프라 스크립트이며, 해당 내용이 plan 문서에도 충실히 기술되어 있으므로 실질적 정보 손실은 없다.
  - 제안: Makefile 인라인 주석 유지는 합리적이다. e2e 인프라 관련 spec 문서(예: `spec/5-system/` 내 e2e 전략 문서)가 존재한다면 해당 사전 결함 사례를 `## Rationale` 또는 `## 주의사항` 섹션에 추가해두면 향후 유사 실수를 방지하는 guard 역할을 한다.

---

### 요약

이번 변경은 Docker e2e 인프라의 `--build` 플래그 누락이라는 단순하지만 사일런트한 실패를 유발하는 인프라 결함을 수정한 것으로, 아키텍처 관점에서 새로운 구조적 문제를 도입하지 않는다. Makefile 타겟의 책임 구분(`e2e-up` / `e2e-test` / `e2e-test-full`)은 기존 설계 의도(네트워크 race 회피를 위한 분리)를 유지하며, `--build` 추가도 각 타겟에 일관성 있게 적용되었다. TypeScript 테스트의 타입 수정은 lint 준수를 위한 최소 변경으로, 레이어 경계나 의존성 구조에 영향을 주지 않는다. 유일한 관찰 사항은 `up` 인자가 세 타겟에 중복 인라인되어 있어 향후 인자 추가 시 변경 지점이 분산될 수 있다는 점이며, 이는 경미한 DRY 개선 기회다.

---

### 위험도

LOW
