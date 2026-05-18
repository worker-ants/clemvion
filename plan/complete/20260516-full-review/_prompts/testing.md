# 테스트(Testing) Full-Project Review Payload

## 미션

main 브랜치(`bbd838ef`) 기준 코드베이스 **전체** 의 테스트 자산을 면밀히 검토한다.

## 사용자 강조 관점

병렬 작업으로 인한 테스트 누락 위험:

1. **일관성** — 같은 패턴은 같은 식으로 테스트되는가
2. **스펙 준수** — spec 본문이 정의한 시나리오가 테스트에 반영되었는가
3. **보안** — 보안 회귀 안전망(HMAC, replay, 권한 우회) 테스트
4. **리팩토링** — 테스트 가독성·중복·flaky 가능성

## 최근 병렬 작업 컨텍스트

- B-5-8: cafe24 install endpoint e2e 추가 (callback/refresh 는 보류)
- B-1-3: timestamp replay nonce 테스트
- mall-dup-followup-b: W9/W11/INFO 처리 후 회귀 안전망
- `66920aeb chore(plan): B-5-8 partial — e2e 보류, unit/integration 보강으로 대체 결정` — e2e 누락 결정 영역

## 검토 범위

- `codebase/backend/src/**/*.spec.ts`, `codebase/backend/test/`
- `codebase/frontend/src/**/__tests__/**`, `codebase/frontend/e2e/`
- `codebase/packages/*/src/__tests__/`
- `spec/` (특히 conventions 에서 정의된 테스트 규약)

## 작업 지침

1. **존재**: spec 의 핵심 시나리오마다 unit/integration/e2e 중 어떤 계층이라도 테스트가 있는가
2. **커버리지 갭**: 에러 경로·엣지·권한 경계 미테스트
3. **mock 적절성**: 외부 의존(DB, Redis, HTTP)을 mock 으로 갈음했을 때 회귀 안전망 깨지지 않는가
4. **격리**: 테스트 간 상태 공유 (DB 미정리, 전역 변수)
5. **회귀**: 최근 fix 가 회귀 테스트로 보호되는지 (W1·W2·W3·W4, B-3, B-4 등)
6. **flaky 신호**: setTimeout, Date.now(), Math.random 등 비결정성
7. **e2e 정책**: 보류된 e2e (callback/refresh) 가 향후 회귀를 놓칠 위험
8. **테스트 용이성**: 코드 자체가 테스트하기 어려운 구조 (DI 없음, 강결합)

## 출력 형식

```
### 발견사항
- **[CRITICAL/WARNING/INFO]** 짧은 제목
  - 위치: <path>:<line>
  - 상세
  - 제안

### 요약
1 문단 — 전반 테스트 건강도

### 위험도
NONE / LOW / MEDIUM / HIGH / CRITICAL
```

CRITICAL: 핵심 회복/보안 시나리오 무방어. WARNING: 부분 누락. INFO: 보강 권고.
