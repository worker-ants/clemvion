# Testing Review — Cafe24 HMAC raw-value fix + 연관 변경 세트

검토 대상: `cafe24-hmac-raw-fix-b8e2d1` worktree 의 변경 세트  
검토 일시: 2026-05-16  
검토자: testing reviewer

---

## 발견사항

### 핵심 구현 변경 (HMAC 알고리즘 재정정)

- **[WARNING]** `computeTestHmac` 헬퍼가 production `buildHmacMessage` 와 별도로 구현되어 있어 미래 drift 위험이 남음
  - 위치: `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` L29–40
  - 상세: `computeTestHmac` 는 production `buildHmacMessage` 와 동일한 raw-value 보존 알고리즘을 독자적으로 재구현하고 있다. 현재는 두 코드가 일치하나, 향후 production 알고리즘이 변경될 때 테스트 헬퍼가 함께 갱신되지 않으면 다시 self-fulfilling 검증 패턴이 재현될 위험이 있다. JSDoc 주석(L21–28)이 이 주의사항을 명시하고 있어 맥락은 기록됐으나, 기계적 강제가 없다.
  - 제안: (a) `buildHmacMessage` 를 export 해서 테스트가 직접 import 하도록 변경해 헬퍼 이중 구현 자체를 제거하거나, (b) 현행 구조를 유지한다면 `computeTestHmac` 주석에 "반드시 production `buildHmacMessage` 와 동기" 문구를 강조하고, spec `§9.8` 의 코드 예시도 동일하게 관리할 것을 명시한다.

- **[WARNING]** 구버전 SEC H-1 알고리즘 거부 테스트가 `handleInstall` 경로에만 존재하고 `tryRecoverByMallId` 경로에는 없음
  - 위치: `integration-oauth.service.cafe24.spec.ts` L747–767 (거부 테스트가 `handleInstall` describe 블록 안에만 있음)
  - 상세: `tryRecoverByMallId` 는 `buildHmacMessage` 를 공유해 알고리즘이 자동 일치하지만, SEC H-1 회귀(옛 `%20 → +` 변환)를 `tryRecoverByMallId` 경로에서 명시적으로 거부하는 테스트가 없다. 회복 흐름은 workspace 횡단 후보 iteration 이 포함되어 있어 HMAC 검증 결과가 로직에 복잡하게 엮이므로, 회복 경로에서도 옛 알고리즘 hmac 을 명시적으로 거부함을 확인하는 테스트가 있으면 회귀 보호가 완전해진다.
  - 제안: `recovery` describe 블록에 "recovery — HMAC computed by old algorithm is rejected" 케이스를 추가한다. 인자 형식은 기존 `rejects HMAC computed by old SEC H-1 algorithm` 테스트와 동일 패턴.

- **[INFO]** `%20` 케이스 테스트의 `user_name` 값이 실제 사용자 URL 을 정확히 재현하고 있어 회귀 보호 품질이 높음
  - 위치: `integration-oauth.service.cafe24.spec.ts` L706–722
  - 상세: `user_name=%EB%8C%80%ED%91%9C%20%EA%B4%80%EB%A6%AC%EC%9E%90` ("대표 관리자") 는 사용자 보고 URL 과 동일한 형식으로, spec draft 에서 명시한 회귀 보호 요건을 정확히 충족한다. 실제 운영 URL 형식을 raw 그대로 재현한 high-fidelity 테스트이므로 품질은 우수하다.
  - 제안: 없음.

---

### `+` 인코딩 encoder invariant 테스트

- **[INFO]** `accepts HMAC for + space-encoded values` 테스트가 encoder invariant 를 올바르게 커버
  - 위치: `integration-oauth.service.cafe24.spec.ts` L727–742
  - 상세: raw-value 보존 알고리즘이 `%20` 뿐 아니라 `+` 인코딩도 byte 그대로 처리함을 확인하는 테스트가 추가되었다. 이는 spec draft Rationale 에서 "encoder invariant" 로 명명한 설계 결정을 테스트로 검증하고 있어 의도와 구현의 연결이 명확하다.
  - 제안: 없음.

---

### 진단 로그 테스트 (`handleInstall — HMAC 진단 로그`)

- **[INFO]** 로그 테스트가 `cafe24-install-hmac-fail` 마커만 확인하고 있어 분기별 로그 내용의 충분성은 미검증
  - 위치: `integration-oauth.service.cafe24.spec.ts` L938 이하 (describe block)
  - 상세: spec Rationale "Cafe24 App URL 상세 페이지 표시" 의 "HMAC 검증 진단 로그 보강" 단락이 "어느 분기인지·URL mall_id 와 DB mall_id 의 일치 여부·DB app_type/status/status_reason·install_token prefix+suffix 4자" 를 로그에 기록하도록 명시하고 있다. 현재 테스트는 `cafe24-install-hmac-fail` 마커의 존재만 검증하므로 각 진단 필드가 실제로 로그에 포함되는지는 테스트로 보장되지 않는다.
  - 제안: 최소한 `reason=hmac_verify_failed`, `urlMallId=`, `dbMallId=` 등 주요 진단 필드가 로그에 포함됨을 추가 `expect` 로 검증하거나, 위험 수용 시 주석으로 "진단 필드 내용은 수동 검증" 을 명시한다.

---

### 기존 테스트 회귀 안전성

- **[INFO]** 옛 `accepts HMAC for queries containing space-encoded values (URLEncoder compat)` 테스트가 새 테스트로 교체됨을 확인
  - 위치: `integration-oauth.service.cafe24.spec.ts` 전체
  - 상세: 이전에 존재하던 `John+Doe` 기반 self-fulfilling 테스트가 파일에서 제거되었고, 대신 `%20` 형식의 회귀 보호 테스트 (`L706`)와 `+` 형식 encoder invariant 테스트 (`L727`), 그리고 옛 SEC H-1 알고리즘 거부 테스트 (`L747`) 세 개가 추가되었다. self-fulfilling 검증 패턴이 제거된 점이 가장 중요한 품질 개선이다. 기존 테스트 구조(describe/it 계층, mock 패턴)도 유지된다.
  - 제안: 없음.

---

### `cafe24-config.test.tsx` (Phase 3 프론트엔드 테스트)

- **[INFO]** `fireEvent` 사용이 `userEvent` 대비 실제 사용자 인터랙션 시뮬레이션 정확도가 낮음 (기존 관행과 일치)
  - 위치: `frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx` (consistency 검토에서 참조됨)
  - 상세: convention_compliance checker 가 `fireEvent` 사용이 기존 파일 (`integration-selector.test.tsx`, `trigger-configs.test.tsx`)과 일치함을 확인했다. `userEvent` 대비 실 인터랙션 재현 정확도는 낮으나, 이 프로젝트의 표준 관행이므로 현 시점에서 이슈가 아니다. 14개 케이스가 plan Phase 3 체크리스트 14항과 1:1 대응하고 있어 커버리지 추적이 명확하다.
  - 제안: 프로젝트 전반 테스트 관행 개선 시 `userEvent` 마이그레이션 함께 고려 가능.

- **[WARNING]** `readFieldValues` 함수가 JSDoc 에서 "Exported so unit tests can exercise directly" 라고 명시했으나 실제 export 가 없고 테스트는 컴포넌트를 통한 간접 검증만 수행
  - 위치: `integration-configs.tsx` L320–322 (convention_compliance 검토 발견사항 2)
  - 상세: spec 에 따라 `readFieldValues` 는 fields 파싱 로직의 핵심 함수임에도 불구하고, export 없이 컴포넌트 렌더링을 통해서만 검증된다. field 파싱 엣지 케이스 (빈 fields, 알 수 없는 키, null 값, enum 타입 처리)를 컴포넌트 E2E 없이 단독 단위 테스트로 빠르게 검증할 수 없다.
  - 제안: (a) `readFieldValues` 를 export 하고 직접 단위 테스트를 추가해 파싱 엣지 케이스를 커버하거나, (b) export 를 포기하고 JSDoc 의 "Exported so…" 문구를 제거한다. 옵션 (a) 가 장기 유지보수 측면에서 권장.

---

### 커버리지 갭 분석

- **[WARNING]** `buildHmacMessage` 의 엣지 케이스 테스트 부재 — `=` 이 없는 파라미터 / 빈 key / 중복 key
  - 위치: `integration-oauth.service.cafe24.spec.ts` — `buildHmacMessage` 에 대한 직접 단위 테스트 없음
  - 상세: `buildHmacMessage` 는 module-private 함수이므로 현재 테스트는 `handleInstall` 경로를 통한 통합 테스트만 가능하다. 다음 케이스가 커버되지 않는다:
    1. `key=` (value 빈 문자열) — `eqIdx !== -1` 이지만 value 가 빈 경우
    2. `abc` 형식 (등호 없는 파라미터) — `eqIdx === -1` → key = 전체 part, raw = 전체 part
    3. `=value` 형식 (key 가 빈 문자열) — filter 조건 `p.key.length > 0` 으로 제거되어야 함
    4. `hmac=...` 외에 key 가 `hmac` 인 경우가 쿼리 중간에 있을 때의 filter
    5. URL-encoded key (`key%5Bindex%5D=value`) 가 있을 때 sort 의 byte-lexicographic 순서
  - 제안: `buildHmacMessage` 를 export (또는 별도 모듈로 추출)해 직접 단위 테스트를 추가한다. 보안 관련 함수이므로 엣지 케이스 단위 테스트는 필수에 가깝다.

- **[WARNING]** timestamp 검증 로직의 경계값 테스트 불명확 — TTL 경계 (정확히 만료 시각) 케이스 부재
  - 위치: `integration-oauth.service.cafe24.spec.ts` — timestamp 검증 관련 테스트
  - 상세: HMAC 검증 외에 timestamp 유효성 (staleness) 을 검사하는 로직이 서비스에 있을 경우, 정확히 만료 경계 시각 (TTL = 0, TTL = -1ms) 의 경계값 테스트가 있어야 한다. 현재 테스트는 `Math.floor(Date.now() / 1000)` 으로 현재 시각을 사용하고 있어 happy path 만 커버한다. 만료 직전·만료 직후의 경계값 케이스가 명시적으로 테스트되어 있는지 확인이 필요하다.
  - 제안: timestamp 만료 경계값 (예: `now - TTL`, `now - TTL - 1s`) 에 대한 테스트를 추가해 경계 동작을 명시화한다.

---

### Mock 적절성

- **[INFO]** `makeRepo()` mock 이 단순 jest.fn() 체이닝 방식으로 구현되어 있어 실제 DB 제약 조건 (UNIQUE 인덱스, NOT NULL) 은 미반영
  - 위치: `integration-oauth.service.cafe24.spec.ts` L42–53
  - 상세: mock repository 는 단위 테스트 관점에서 적절하다. 서비스 레이어 로직 검증이 목적이므로 DB 제약 조건 검증은 별도 integration 또는 e2e 테스트 계층에서 수행해야 한다. 이는 프로젝트의 3계층 테스트 구조(unit / integration / e2e)와 일치하며 현재 파일의 범위에서 이슈가 아니다.
  - 제안: 없음. 단, `install_token` 의 `UNIQUE` 제약 조건 위반 시나리오는 e2e 또는 integration 테스트에서 커버됨을 별도 확인 권장.

- **[INFO]** `dataSource.transaction` mock 이 실제 트랜잭션 rollback 시나리오를 검증하지 않음
  - 위치: `integration-oauth.service.cafe24.spec.ts` L63–77
  - 상세: 트랜잭션 내에서 예외가 발생했을 때 rollback 이 제대로 일어나는지는 현재 mock 에서 검증 불가하다. 이는 e2e 계층에서 다루어져야 하는 영역이다. 현재 단위 테스트 범위에서는 허용 가능하다.
  - 제안: 없음.

---

### 테스트 격리

- **[INFO]** `beforeEach` 에서 `process.env` 를 직접 설정하고 `afterEach` 에서 정리하지 않음
  - 위치: `integration-oauth.service.cafe24.spec.ts` L79 (`process.env.OAUTH_STUB_MODE = 'true'`)
  - 상세: 파일 내부에서 `afterEach` 에서 `delete process.env.OAUTH_STUB_MODE` 를 호출하는지 확인이 필요하다. 환경변수를 테스트 후 복원하지 않으면 같은 테스트 프로세스에서 실행되는 다른 테스트 파일에 영향을 줄 수 있다. Jest 는 기본적으로 모듈을 격리하지만 `process.env` 는 전역이다.
  - 제안: `afterEach` 또는 `afterAll` 에서 테스트가 설정한 환경변수를 원래 값으로 복원하거나 삭제한다.

---

### 테스트 가독성

- **[INFO]** 회귀 보호 테스트 3개에 상세한 한국어 주석이 달려 있어 의도가 매우 명확함
  - 위치: `integration-oauth.service.cafe24.spec.ts` L700–767
  - 상세: 각 테스트에 "왜 이 테스트가 필요한가", "어떤 결함을 방지하는가", "spec 어느 결정에서 비롯됐는가" 가 모두 기록되어 있다. 보안 관련 알고리즘 테스트에서 이 수준의 문서화는 유지보수성 면에서 매우 좋다.
  - 제안: 없음.

---

### 테스트 용이성 (코드 구조)

- **[WARNING]** `buildHmacMessage` 가 module-private 함수로 남아 있어 독립 단위 테스트 불가
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` L1642
  - 상세: 현재 `buildHmacMessage` 는 파일 내부 private 함수이다. 이 함수는 보안 critical 한 HMAC 메시지 빌드 로직을 담고 있음에도 직접 단위 테스트가 불가능해 `handleInstall` / `tryRecoverByMallId` 라는 상위 경로를 통해 간접적으로만 검증된다. 직접 테스트가 가능하면 `=` 없는 파라미터, 빈 key, `hmac` 키 필터링 등 다양한 엣지 케이스를 서비스 레이어 mock 없이 순수하게 검증할 수 있다.
  - 제안: `buildHmacMessage` 를 별도 헬퍼 모듈 (`hmac-utils.ts` 등)로 추출해 export 하거나, 또는 해당 함수에 `/* @internal - exported for testing */` 주석을 달고 export 해서 단위 테스트를 가능하게 한다.

---

### 회귀 테스트 유효성

- **[INFO]** `rejects HMAC computed by old SEC H-1 algorithm` 테스트가 기존 알고리즘 회귀를 직접 방어하는 가장 강력한 테스트
  - 위치: `integration-oauth.service.cafe24.spec.ts` L747–767
  - 상세: 이 테스트는 `%20` URL 에 대해 옛 SEC H-1 방식 (`+` 로 변환된 메시지)으로 계산된 HMAC 을 명시적으로 거부함을 검증한다. 미래에 누군가 `buildHmacMessage` 를 다시 `URLSearchParams` decode 방식으로 되돌리면 이 테스트가 즉시 실패해 회귀를 포착할 수 있다. 설계가 우수하다.
  - 제안: 없음.

---

## 요약

이번 변경 세트의 핵심인 Cafe24 HMAC raw-value 보존 알고리즘 교체는 테스트 관점에서 전반적으로 잘 설계되었다. 특히 (1) 옛 self-fulfilling `formUrlEncodeForTest` 헬퍼가 제거되고 production 알고리즘과 동일한 raw-value 방식의 `computeTestHmac` 으로 교체된 점, (2) 실제 운영 URL 형식 (`%20`) 과 encoder invariant (`+`) 를 각각 커버하는 회귀 보호 테스트가 추가된 점, (3) 옛 SEC H-1 알고리즘으로 계산된 HMAC 을 명시적으로 거부하는 anti-regression 테스트가 포함된 점이 매우 긍정적이다. 다만 `buildHmacMessage` 가 module-private 함수로 남아 엣지 케이스(빈 key, `=` 없는 파라미터, URL-encoded key sort 순서 등)에 대한 직접 단위 테스트가 불가능하고, 테스트 헬퍼 `computeTestHmac` 이 production 함수와 별도로 구현되어 미래 drift 위험이 잠재하는 구조적 취약점이 있다. 프론트엔드 측에서는 `readFieldValues` JSDoc 과 실제 export 의 불일치로 인해 핵심 파싱 함수에 대한 직접 단위 테스트가 부재하다. 전반적으로 보안 알고리즘 변경에 걸맞은 회귀 보호는 달성했으나, 세부 엣지 케이스 커버리지와 테스트 헬퍼 이중 구현 제거에 추가 개선 여지가 있다.

---

## 위험도

MEDIUM
