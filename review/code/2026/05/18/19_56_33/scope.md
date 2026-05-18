# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `makeFakeJwt` 헬퍼가 두 테스트 파일에 중복 정의
  - 위치: `integration-oauth.service.cafe24.spec.ts` 파일 상단, `cafe24-api.client.spec.ts` 파일 상단
  - 상세: 두 파일 모두 동일한 구현(`Buffer.from → base64 → replace → replace` 패턴)의 `makeFakeJwt` 함수를 독립적으로 선언한다. `jwt-exp.spec.ts` 에는 동일 역할의 `makeJwt` 가 별도로 존재한다. 총 3개의 파일에 실질적으로 같은 helper 코드가 존재한다. 이번 버그 픽스와 직접 관련 있는 테스트 인프라이므로 심각한 이슈는 아니나, 향후 JWT 포맷 변경 시 세 곳을 모두 수정해야 하는 유지보수 부담이 생긴다.
  - 제안: 공용 테스트 helper 파일(`test/helpers/jwt.ts` 등)로 추출하거나, 최소한 동일 디렉토리 내 `test-jwt-helper.ts` 로 분리해 두 spec 파일이 임포트하도록 변경하는 것을 고려한다. 단, 이번 PR 범위에서 즉시 필요하지는 않으므로 후속 리팩토링으로 처리 가능.

- **[INFO]** `hasTimezoneDesignator` 함수와 `normalizeCafe24IsoTimezone` 함수의 동일 로직 중복
  - 위치: `integration-oauth.service.ts` 의 `hasTimezoneDesignator` 함수, `cafe24-api.client.ts` 의 `normalizeCafe24IsoTimezone` 함수
  - 상세: 두 함수 모두 `/Z$|[+-]\d{2}:?\d{2}$/` 정규식을 사용해 TZ designator 유무를 판정하고 없으면 `+09:00` 을 붙이는 로직을 수행한다. `integration-oauth.service.ts` 는 `hasTimezoneDesignator` 라는 검사 함수와 인라인 삼항 연산자로 분리하고, `cafe24-api.client.ts` 는 `normalizeCafe24IsoTimezone` 이라는 정규화 함수로 캡슐화하여 구현 방식이 다르다. 버그 픽스의 핵심 로직이 두 위치에서 독립적으로 관리되어야 하는 구조다.
  - 제안: `normalizeCafe24IsoTimezone` 또는 `hasTimezoneDesignator` 를 `jwt-exp.ts` 와 같은 위치에 공유 유틸로 추출하여 단일 구현으로 관리하는 것을 향후 고려한다. 이번 PR 에서 즉시 필요하지는 않다.

- **[INFO]** `review/consistency/2026/05/18/19_29_07/` 하위 파일들이 코드 변경 PR 에 포함
  - 위치: `review/consistency/2026/05/18/19_29_07/_retry_state.json`, `cross_spec.md`, `convention_compliance.md`, `naming_collision.md`, `meta.json` 등
  - 상세: consistency-check 산출물 파일들이 코드 구현 PR 에 함께 포함되어 있다. CLAUDE.md 의 명명 컨벤션에서 consistency 리뷰 산출물은 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 에 두도록 정의되어 있으며, 본 PR 의 작업 흐름상 구현 착수 전 검토 결과물이 동일 worktree 에서 생성된 것이다. 프로젝트 정책상 이 파일들이 PR 에 포함되는 것이 예상 동작이므로 실질적 문제는 없다. 다만 코드 변경과 리뷰 산출물이 하나의 diff 에 혼재되어 코드 리뷰 시 노이즈가 될 수 있다.
  - 제안: 허용 범위 내 동작이며 별도 조치 불필요.

- **[INFO]** `plan/in-progress/spec-update-cafe24-jwt-exp.md` 가 코드 PR 에 포함되어 있으나 spec 갱신이 별도로 적용되어야 함
  - 위치: `plan/in-progress/spec-update-cafe24-jwt-exp.md`
  - 상세: 본 plan 파일은 spec 갱신 계획을 담고 있으며, `owner: developer (사용자 권한 위임으로 본 worktree 안에서 직접 적용)` 로 표기되어 있다. plan 파일 자체는 `plan/` 하위에 있어 developer 의 쓰기 권한 범위 안이다. 코드 변경과 plan 파일이 동일 PR 에 포함되는 것은 CLAUDE.md 의 "plan 이동은 마지막 작업 PR 안에서 처리" 규칙에 부합한다.
  - 제안: 문제 없음.

## 요약

변경 범위는 Cafe24 JWT exp 기반 만료 추출이라는 버그 픽스 의도에 전반적으로 부합한다. 신규 파일(`jwt-exp.ts`, `jwt-exp.spec.ts`)과 기존 파일 수정(`integration-oauth.service.ts`, `cafe24-api.client.ts`, `cafe24-token-refresh.constants.ts`, `cafe24-token-refresh.processor.ts`) 모두 `reactive_401` 소스 도입 및 JWT exp SoT 격상이라는 단일 목적에 집중되어 있다. 테스트 보강 역시 회귀 방지를 위한 직접적 케이스들로만 구성되어 있다. 지적 사항은 모두 INFO 수준으로, `makeFakeJwt` / TZ 정규화 로직의 중복과 consistency-check 산출물의 동일 PR 포함이며 모두 이번 변경의 의도적 결과이거나 향후 리팩토링 대상이다. 의도와 무관한 파일 수정, 불필요한 리팩토링, 기능 확장, 포맷팅 혼입은 발견되지 않았다.

## 위험도

NONE
