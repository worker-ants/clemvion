# 보안(Security) 리뷰

## 발견사항

### 파일 1: codebase/backend/README.md

- **[INFO]** 배포 주의 문서 추가 — 보안 관점에서 적절함
  - 위치: 추가된 blockquote 줄 (line 55 diff / line 100 전체 파일)
  - 상세: `assertProductionConfig` 의 부팅 거부 조건을 문서화하여, 운영자가 `.env.example` 기본값을 그대로 사용하는 실수를 방지한다. `openssl rand -hex 32` 명령을 직접 제시하는 것도 올바른 지침이다.
  - 제안: 없음. 내용이 구현 로직과 일치하며 적절히 간결하다.

---

### 파일 2: codebase/backend/src/common/config/production-guards.spec.ts

- **[INFO]** `process.env` 직접 조작 — 테스트 격리 경계 내에서 안전
  - 위치: `blacklist Set sync` describe 블록, `INSECURE_JWT_SECRETS contains the jwt.config.ts dev fallback` it 블록 (lines 222–231)
  - 상세: 테스트가 `delete process.env.JWT_SECRET` 후 `finally` 에서 원래 값을 복원한다. `process.env` 전역 조작은 병렬 테스트 실행 시 경합 조건을 일으킬 수 있으나, Jest 의 기본 동작(단일 프로세스 내 직렬 실행)이므로 현 컨텍스트에서는 실질적 위협이 아니다. `jest --runInBand` 또는 기본 설정이 유지되는 한 안전하다.
  - 제안: 중대하지 않으나, Jest 설정에서 `--maxWorkers=1` 또는 `testEnvironment: 'node'` + `isolateModules` 환경이 보장된다면 더 견고해진다. 단위 테스트 목적상 현재 패턴은 허용 수준이다.

- **[INFO]** `parseEnvExampleValue` 의 정규식 — ReDoS 위험 없음
  - 위치: lines 201–206 (테스트 내부 헬퍼 함수)
  - 상세: 패턴은 `^KEY=(.+)$` (multiline), `.+` 는 비역추적 선형 패턴이다. 입력은 저장소 내 `.env.example` 파일(신뢰된 소스)이므로 ReDoS 공격 표면이 없다.
  - 제안: 없음.

- **[INFO]** `fs.readFileSync` 호출 위치 — describe 블록 최상위(동기 실행)
  - 위치: line 210 (`const envExampleContent = fs.readFileSync(envExamplePath, 'utf-8')`)
  - 상세: describe 최상위에서 동기 파일 읽기를 수행한다. 파일이 존재하지 않으면 Jest 가 모듈 수집 단계에서 throw 하여 이 describe 내 다른 테스트도 모두 실패한다. 보안 자체 문제는 아니지만, CI 환경에서 경로 이슈로 방어선 전체가 무력화될 가능성이 있다.
  - 제안: 테스트 실패 메시지가 충분히 명확하고, `path.resolve(__dirname, '../../../.env.example')` 경로가 저장소 레이아웃상 고정적이므로 실용적 위험은 낮다. 필요 시 `beforeAll` 으로 이동하고 파일 미존재 시 `test.skip` 처리를 추가할 수 있다.

---

### 파일 3: codebase/backend/src/common/config/production-guards.ts

- **[INFO]** JSDoc `@throws`/`@param`/`@returns` 태그 추가 — 보안 관점에서 긍정적
  - 위치: lines 512–514 (isFlagOn), lines 522–523 (assertProductionConfig)
  - 상세: 함수 계약이 명시적으로 문서화되어, 미래 기여자가 실수로 throw 정책을 약화시키거나 fail-open 으로 변경하는 위험을 줄인다.
  - 제안: 없음.

- **[WARNING]** `INTEGRATION_ENCRYPTION_KEY` 는 production fail-closed 에서 미검증
  - 위치: `production-guards.ts` 전체 파일 컨텍스트 (변경 범위 외, 기존 로직)
  - 상세: `.env.example` 에 `INTEGRATION_ENCRYPTION_KEY=change-me-to-a-32-byte-secret` 가 있고 주석에 "REQUIRED for production. Without it, credentials are stored in plaintext" 라고 명시되어 있다. 그러나 `assertProductionConfig` 는 `INTEGRATION_ENCRYPTION_KEY` 를 검사하지 않는다. 이 값이 example 기본값인 채로 production 에 배포되면 Integration OAuth 크레덴셜이 평문으로 저장된다. `ENCRYPTION_KEY` 와 동등한 보호가 없다.
  - 제안: `KNOWN_EXAMPLE_INTEGRATION_ENCRYPTION_KEYS` Set 을 추가하고 `assertProductionConfig` 에 `INTEGRATION_ENCRYPTION_KEY` 검사 블록을 추가하는 것을 권장한다. 최소한 미설정 시 throw 하거나, `ENCRYPTION_KEY` 와 동일한 빈 값/예시 값 차단 로직을 적용해야 한다. 이번 PR 범위 외이므로 WARNING으로 분류하며, 별도 이슈로 추적 권장.

- **[INFO]** `MIN_JWT_SECRET_LENGTH = 32` — NIST SP 800-107 권고 대비 최솟값 수준
  - 위치: line 594 (전체 파일)
  - 상세: 32 바이트(hex 문자열이면 64자)는 HS256/HS512 HMAC 키로 충분하나, `MIN_JWT_SECRET_LENGTH` 는 문자열 길이를 바이트로 취급한다 (`jwtSecret.length`). UTF-8 기반 영문 ASCII 시크릿의 경우 32자는 256비트가 아닌 256비트 엔트로피가 아닐 수 있다. `openssl rand -hex 32` 는 64 ASCII 문자(32바이트 hex)를 생성하며, 이 경우 `length=64 >= 32` 를 통과한다. 실제 엔트로피는 hex 인코딩 때문에 256비트이므로 안전하다. 다만 임의의 32자 영문 패스프레이즈(엔트로피 낮음)도 통과할 수 있다는 점은 잠재적 약점이다.
  - 제안: 현재 검사는 OWASP 기준의 최소 조건을 충족한다. 더 강화하려면 최솟값을 48 이상으로 올리거나, hex 형식 검증을 추가할 수 있다. 필수 수정 사항은 아님.

---

## 요약

이번 변경의 핵심은 production fail-closed 가드의 테스트 강화 및 문서 보완이며, 보안 관점에서 전반적으로 올바른 방향이다. `INSECURE_JWT_SECRETS`와 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 블랙리스트가 `.env.example` 및 `jwt.config.ts` 의 실제 값과 일치하는지 CI 회귀 방어선으로 고정한 것은 특히 가치 있는 개선이다. 코드 자체에 하드코딩된 시크릿은 없으며, 인젝션·XSS·경로 탐색 등 인젝션 계열 취약점도 해당 없다. 유일한 WARNING 은 이번 diff 외의 기존 로직(`INTEGRATION_ENCRYPTION_KEY` 미검증)으로, 이번 PR 범위 밖의 잠재적 개선 사항이다.

## 위험도

LOW
