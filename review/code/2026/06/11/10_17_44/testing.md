# Testing Review — prod-fail-closed-guards

## 발견사항

### [INFO] 테스트 존재 및 구조 — 양호
- 위치: `/codebase/backend/src/common/config/production-guards.spec.ts`
- 상세: 핵심 변경 대상인 `assertProductionConfig` 순수 함수에 대해 전용 단위 테스트 파일이 신규 추가됐다. 파일 구성은 논리적이며 주요 가드(OAUTH_STUB_MODE, LLM_STUB_MODE, JWT_SECRET, ENCRYPTION_KEY, MCP_ALLOW_INSECURE_URL)에 대한 테스트가 모두 포함돼 있다.
- 제안: 없음.

### [INFO] 의존성 주입을 통한 테스트 용이성 — 탁월
- 위치: `production-guards.ts` L55–57 (`env: NodeJS.ProcessEnv = process.env`)
- 상세: `assertProductionConfig` 가 env 맵을 인자로 받아 `process.env` 글로벌을 직접 참조하지 않으므로, 테스트에서 환경 오염 없이 임의 env 맵을 주입할 수 있다. `prodEnv()` 헬퍼로 베이스라인을 한 곳에서 관리하는 패턴도 가독성이 높다. 이상적인 pure-function 테스트 설계다.

### [INFO] `isFlagOn` 비표준 truthy 값 경계 테스트 — 충분
- 위치: spec 파일 L489–496
- 상세: `'TRUE'`, `'yes'`, `'on'`, `'0'`, `''` 등 비표준 값에 대해 throw 하지 않음을 `it.each` 로 검증한다. `isFlagOn` 내부 로직이 `=== 'true' || === '1'` 의 엄격 비교임을 명시적으로 문서화하는 효과도 있다.

### [WARNING] `main.ts` 의 `ALLOW_PRIVATE_HOST_TARGETS` warn 분기에 대한 테스트 부재
- 위치: `codebase/backend/src/main.ts` L986–993
- 상세: `assertProductionConfig` 자체는 `ALLOW_PRIVATE_HOST_TARGETS=true` 를 throw 하지 않는다는 테스트가 spec 파일에 있다(`does NOT throw for ALLOW_PRIVATE_HOST_TARGETS=true`). 그러나 `main.ts` 에 잔류한 warn 분기 자체(Logger.warn 호출 경로)는 단위 테스트로 검증되지 않는다. `main.ts` 의 bootstrap 함수 특성상 통합/e2e 없이 단위 테스트로 격리하기 어렵다는 점은 인정되나, warn 메시지 내용이 바뀌어도 현재 테스트가 이를 탐지하지 못한다.
- 제안: `main.ts` warn 분기는 중요도가 낮아 단기 필수는 아니지만, 장기적으로 `ALLOW_PRIVATE_HOST_TARGETS` warn 로직을 별도 유틸 함수로 추출하거나, `production-guards.ts` 에 `warnProductionConfig` 같은 선택적 warn 경로를 추가하면 단위 테스트 가능해진다.

### [WARNING] fail-fast 단일 throw 정책 — 다중 위반 시 첫 번째만 노출되는 동작 미검증
- 위치: `production-guards.ts` L60–63, spec 파일 전체
- 상세: 코드 주석에 "첫 위반에서 즉시 throw" 라고 명시하지만, 복수 위반이 동시에 존재할 때(`OAUTH_STUB_MODE=true + JWT_SECRET=''`) 실제로 첫 번째 위반만 throw 되고 두 번째 위반은 억제되는지를 검증하는 테스트가 없다. 현재 구현 순서가 바뀌면(예: JWT_SECRET 검사를 stub 검사 앞으로 이동) 오류 메시지 내용이 달라지며 운영자 경험에 영향을 준다.
- 제안: 아래와 같이 복수 위반 시 첫 번째(OAUTH_STUB_MODE) 메시지가 throw 되고 JWT_SECRET 오류는 포함되지 않는다는 테스트를 추가하면 현재 우선순위 계약을 명시화할 수 있다.
  ```ts
  it('throws on first violation when multiple guards fail', () => {
    expect(() =>
      assertProductionConfig(prodEnv({ OAUTH_STUB_MODE: 'true', JWT_SECRET: '' })),
    ).toThrow(/OAUTH_STUB_MODE/);
  });
  ```

### [INFO] ENCRYPTION_KEY 포맷 검증 부재 (의도된 범위 축소)
- 위치: `production-guards.ts` L87–93
- 상세: 현재 가드는 "미설정 or 알려진 예시 키 거부" 만 수행하며, 64자 hex 포맷 유효성(길이, 문자셋)은 검증하지 않는다. 이는 의도된 설계 축소로 보이나(주석: "값이 있고 공개 예시가 아니면 통과"), 실제로 짧거나 잘못된 형식의 키를 설정했을 때 부팅은 성공하고 암호화 라이브러리에서 늦게 실패할 수 있다. 현재 테스트는 이 경계를 커버하지 않는다.
- 제안: 포맷 검증을 이 가드에 추가하지 않기로 결정한 경우, `production-guards.spec.ts` 에 "32자 미만 키도 통과한다(형식 검증은 담당 아님)" 는 명시적 주석·테스트를 추가해 의도를 문서화하는 것이 좋다. 이렇게 하면 향후 유지보수 시 "실수로 누락된 검증인가?" 를 묻지 않아도 된다.

### [INFO] 테스트 격리 — 완전
- 위치: spec 파일 전체
- 상세: 각 테스트는 `prodEnv(overrides)` 를 인자로 함수를 호출하며 `process.env` 를 변경하거나 전역 상태에 의존하지 않는다. `beforeEach`/`afterEach` 설정이 없어도 테스트 간 격리가 보장된다. 순서 독립성 충족.

### [INFO] `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 의 옛 키 차단 정책 테스트 — 명시적으로 커버됨
- 위치: spec 파일 L468–475
- 상세: `for (const bad of KNOWN_EXAMPLE_ENCRYPTION_KEYS)` 루프로 Set 에 있는 모든 값(현재 2개: all-zero 키 + 옛 예시 키)을 일괄 검증한다. `.env.example` 에서 새 placeholder 로 교체할 때 옛 값을 Set 에서 제거하지 말고 추가하라는 정책이 테스트 구조로도 강제되는 좋은 패턴이다.

### [INFO] `MCP_ALLOW_INSECURE_URL` 미설정(undefined) 케이스 테스트 누락
- 위치: spec 파일 L483–487
- 상세: `MCP_ALLOW_INSECURE_URL: 'false'` 는 테스트하지만 `MCP_ALLOW_INSECURE_URL: undefined`(키 자체 없음)를 명시적으로 테스트하지 않는다. `isFlagOn(undefined)` 는 `false` 를 반환하므로 실제로는 통과하지만, 테스트 문서화 차원에서 누락이다. `prodEnv()` 기본 호출에 `MCP_ALLOW_INSECURE_URL` 가 포함돼 있지 않으므로 "passes when all production secrets/flags are valid" 테스트가 간접적으로 커버하긴 하나 이 의도가 명확하지 않다.
- 제안: 기존 `passes when false/unset` 테스트 이름을 유지하되, `it('passes when false/unset', ...)` 내부에 `prodEnv({ MCP_ALLOW_INSECURE_URL: undefined })` 케이스를 추가하거나 설명에 "undefined 포함" 을 명시.

### [INFO] `main.ts` 에서 `assertProductionConfig` 호출 위치에 대한 통합 테스트 부재
- 위치: `codebase/backend/src/main.ts` L981
- 상세: `assertProductionConfig` 가 bootstrap 함수의 첫 번째 단계로 호출되는지 확인하는 통합 레벨 테스트가 없다. 누군가 실수로 호출 순서를 `NestFactory.create` 이후로 이동시켜도 현재 테스트로는 탐지 불가하다. 이 위험은 낮지만 코드 리뷰와 린트 규칙에 의존하는 것보다 테스트로 고정하는 편이 안전하다.
- 제안: `main.ts` 의 `bootstrap` 자체는 테스트하기 어렵지만, 최소한 "assertProductionConfig 가 process.env 를 인자로 전달받아 호출된다" 는 spying 테스트를 `main.spec.ts` (신규 or 기존)에 추가할 수 있다.

---

## 요약

`production-guards.spec.ts` 는 `assertProductionConfig` 순수 함수에 대해 전 분기를 체계적으로 커버하는 잘 설계된 단위 테스트다. 의존성 주입 패턴으로 `process.env` 오염 없이 격리 실행되고, `it.each` 로 비표준 truthy 경계값을 명시적으로 검증한다. 주요 갭은 두 가지다: (1) 복수 위반 시 fail-fast 순서 계약을 고정하는 테스트가 없어 검사 순서가 변경돼도 자동 탐지되지 않으며, (2) `main.ts` 에 잔류한 `ALLOW_PRIVATE_HOST_TARGETS` warn 분기와 `assertProductionConfig` 의 호출 위치는 현재 테스트 범위 밖이다. 이 두 갭 모두 CRITICAL 이 아닌 WARNING/INFO 수준이며, 핵심 보안 가드 경로 자체의 커버리지는 충분하다.

## 위험도

LOW
