# 부작용(Side Effect) 리뷰

## 발견사항

---

### 1. NestFactory rawBody 옵션 활성화 — 전역 HTTP 요청 파싱 동작 변경

- **[WARNING]** `NestFactory.create(AppModule, { rawBody: true })` 적용이 Express 미들웨어 전체 스택의 요청 파싱 방식을 변경한다.
  - 위치: `backend/src/main.ts` (diff 라인 +709)
  - 상세: `rawBody: true` 는 NestJS 내부적으로 `bodyParser` 의 `verify` 콜백을 통해 `req.rawBody` 를 Buffer 로 보존하도록 설정한다. 이 옵션은 JSON/urlencoded 파싱을 포함한 **전체 Express bodyParser 미들웨어 체인**에 영향을 준다. HMAC 검증 경로 이외의 컨트롤러(대용량 JSON body, multipart 제외 경로 등)에서 메모리 이중 보유(raw + parsed) 가 발생할 수 있다. 특히 고빈도 API 엔드포인트에서 GC pressure 가 증가할 수 있다.
  - 제안: `rawBody` 를 webhook 엔드포인트에만 선택적으로 적용하는 커스텀 미들웨어를 고려하거나, 현재 구조 그대로 유지한다면 메모리 프로파일링으로 영향을 측정할 것.

---

### 2. 모듈 수준 Logger 인스턴스 도입 — 모듈 초기화 순서 의존 생성

- **[INFO]** `credentials-transformer.ts` 와 `integration-oauth.service.ts` 에 모듈 최상위(`const logger = new Logger(...)`) 로 NestJS Logger 를 생성하고 있다.
  - 위치: `backend/src/modules/integrations/services/credentials-transformer.ts` (+418), `backend/src/modules/integrations/integration-oauth.service.ts` (+1278)
  - 상세: 두 파일은 클래스가 아닌 모듈-스코프 함수(`getKey`, `normalizeRawPreviewRow`)에서 로깅이 필요하여 모듈 수준 인스턴스를 생성했다. NestJS `Logger` 는 DI 컨테이너 외부에서도 인스턴스화 가능하나, 로거 설정(커스텀 LoggerService 주입, `app.useLogger(...)`)이 bootstrap 이전에 이루어지지 않은 경우 이 인스턴스들은 기본 구현을 사용하게 되어 앱 전체 로거 설정과 불일치가 생길 수 있다. 전역 상태는 아니나 모듈 로드 시점의 사이드이펙트다.
  - 제안: 테스트 환경에서 `jest.spyOn(Logger.prototype, 'warn')` 같은 형태로 스파이를 붙여야 할 때 인스턴스 접근이 불편할 수 있다. 테스트에서 `moduleLogger` 나 `logger` const 를 직접 접근하거나 DI 기반 Logger 로 전환을 고려.

---

### 3. `sanitizePayloadForWs` 반환값 동작 변경 — 원본 참조 반환으로 호출자 불변성 의존 증가

- **[WARNING]** `sanitizePayloadForWs` 가 mutation 이 없는 경우 원본 객체 참조를 그대로 반환하도록 변경되었다.
  - 위치: `backend/src/modules/websocket/websocket.service.ts` (diff 라인 +1679~+1706)
  - 상세: 기존 구현은 항상 새 객체를 반환하여 호출자가 반환값을 수정해도 입력 객체에 영향을 주지 않았다. 변경 후 mutation 이 없는 경우 원본 참조가 반환되므로, 호출자가 반환된 객체를 수정하면 **원본 데이터가 변경되는 의도치 않은 상태 변경**이 발생할 수 있다. WebSocket 이벤트 발송 로직이 반환값을 emit 전에 변형하지 않는다는 가정에 의존하게 된다. 현재 emit 경로에서 직접 변형하지 않는 것으로 보이나, 향후 호출자가 추가·변경될 때 취약점이 될 수 있다.
  - 제안: 함수 doc-comment 에 "mutation 없을 때 원본 참조 반환" 동작을 명시하거나, 반환 타입에 `readonly` 를 선언하여 호출자가 실수로 변형하지 않도록 가이드할 것.

---

### 4. `HMAC_ALLOWED_ALGORITHMS` 모듈 수준 전역 Set 도입

- **[INFO]** `hooks.service.ts` 최상위에 `HMAC_ALLOWED_ALGORITHMS = new Set(['sha256', 'sha512'])` 가 모듈 상수로 추가되었다.
  - 위치: `backend/src/modules/hooks/hooks.service.ts` (+1198)
  - 상세: 새 전역(모듈 스코프) 상수 도입이다. 이 Set 은 불변(const)이므로 런타임 상태 변경 위험은 없다. 다만 허용 알고리즘을 확장하려면 코드 변경이 필요하며, 설정 주입 방식이 아니므로 테스트에서 재정의가 불가하다. 부작용 측면에서는 낮은 위험이나 상수 관리 측면에서 기록한다.
  - 제안: 보안 정책 상수이므로 변경 주기가 낮아 현행 방식(하드코딩 상수)이 적합하다. 현재 수준에서 INFO 기록만으로 충분.

---

### 5. `MAX_EXECUTION_PATH_ROWS` 전역 상수 + `take` 옵션 — 기존 동작 범위 변경

- **[WARNING]** `executionPath` 조회에 `take: 10_000` 상한이 추가되어 기존 무제한 조회 동작이 변경되었다.
  - 위치: `backend/src/modules/executions/executions.service.ts` (+919, +935)
  - 상세: 기존에는 `execution_node_log` 의 모든 행을 가져왔으나 이제 최대 10,000 행으로 제한된다. 10,000 건을 초과하는 실행의 경우 `executionPath` 가 잘린 채 반환되어 프론트엔드 타임라인이 불완전하게 표시될 수 있다. 이는 의도된 트레이드오프이나, 클라이언트에게 "잘렸다"는 정보가 전달되지 않아(응답 구조에 truncated 플래그 없음) 호출자가 데이터 완전성을 판단할 수 없다.
  - 제안: `executionPath` 응답에 `truncated: boolean` 또는 `totalNodeLogs: number` 필드를 추가하여 프론트엔드가 불완전 타임라인을 사용자에게 알릴 수 있도록 하는 것을 권장.

---

### 6. `PaginationQueryDto.sort` 검증 강화 — 기존 호출자 호환성 영향

- **[WARNING]** `sort` 필드에 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` + `@MaxLength(64)` 가 추가되어 기존에 유효했던 값이 이제 400 오류를 반환할 수 있다.
  - 위치: `backend/src/common/dto/pagination.dto.ts` (+637~+644)
  - 상세: 인터페이스 변경이다. 기존에는 `sort` 에 임의 문자열이 허용되었으나 이제 영문/숫자/밑줄 식별자 패턴만 허용된다. 예를 들어 기존 클라이언트가 `sort=created-at` (하이픈 포함) 또는 `sort=updated_at` 처럼 유효한 PostgreSQL 컬럼명이지만 하이픈을 포함한 값을 보내던 경우 400 으로 거부된다. 또한 숫자로 시작하는 컬럼명도 거부된다. 현재 서비스별 `getSortColumn()` 화이트리스트가 2차 방어를 제공한다고 되어 있으므로, 실제로 하이픈 포함 sort 키를 사용하는 API 소비자가 없는지 확인이 필요하다.
  - 제안: 기존 API 소비자(프론트엔드 코드)에서 `sort` 파라미터로 어떤 값들을 전달하는지 grep 확인 후 패턴이 모두 `[a-zA-Z][a-zA-Z0-9_]*` 에 해당하는지 검증할 것. 특히 `created_at` 기본값은 패턴에 부합하므로 정상.

---

### 7. DB 마이그레이션 파일 신규 생성 — 운영 DB 영구 상태 변경

- **[CRITICAL]** V052, V053 마이그레이션이 운영 데이터베이스에 적용 시 되돌리기 어려운 스키마 변경을 수행한다.
  - 위치: `backend/migrations/V052__notification_type_integration_action_required.sql`, `backend/migrations/V053__notification_workspace_type_resource_idx.sql`
  - 상세: V052 는 `notification` 테이블의 CHECK 제약을 DROP 후 재생성한다. `DROP CONSTRAINT IF EXISTS` 후 새 `ADD CONSTRAINT` 는 제약 재정의 과정에서 짧은 테이블 잠금(lock)이 발생한다. 운영 환경에서 `notification` 에 높은 쓰기 부하가 있다면 잠금 대기가 생길 수 있다. V053 은 `CREATE INDEX CONCURRENTLY` 를 사용해 잠금 없이 인덱스를 생성하고 있으므로 이 부분은 올바르게 처리됨. V052 의 제약 재생성 시점의 잠금 영향 평가가 누락되어 있다.
  - 제안: V052 의 CHECK 재생성을 `ALTER TABLE ... ADD CONSTRAINT ... NOT VALID` 후 `VALIDATE CONSTRAINT` 패턴으로 분리하거나, 배포 창(maintenance window)에서 실행하도록 문서화할 것. 또는 V052 도 `executeInTransaction=false` 로 처리하는 것을 고려.

---

### 8. `package.json` overrides 추가 — 전이 의존성 버전 강제

- **[INFO]** `backend/package.json` 에 `protobufjs ^7.5.6`, `fast-uri ^3.1.2` 가 직접 의존성으로 추가되었다.
  - 위치: `backend/package.json` (+566~+568)
  - 상세: 이 변경으로 npm 이 중첩 패키지 트리를 재구성할 수 있다. `package-lock.json` 변경이 수반되었으므로 잠금 파일과 실제 설치 버전은 동기화되어 있다. 다만 이를 직접 의존성으로 추가하면 명시적 사용처 없이 의존성 목록에 등장하여 의도가 불명확해 보일 수 있다. `overrides` 섹션(npm 7+)으로 처리하는 것이 의미상 더 명확하다.
  - 제안: CVE 해소 목적 강제 업그레이드는 `package.json` 의 `overrides` 필드로 옮겨 "직접 사용하지 않으나 보안 목적으로 버전을 고정"임을 명시할 것.

---

### 9. `credential-transformer.ts` 모듈 로드 시점 환경 변수 읽기

- **[INFO]** `credentials-transformer.ts` 의 `getKey()` 함수는 `process.env.INTEGRATION_ENCRYPTION_KEY` 를 매 호출마다 읽는다. 이는 변경 없이 유지되었으나, 새로 추가된 모듈 수준 `logger` 인스턴스와 함께 이 파일이 정적 분석 또는 테스트 환경에서 import 되는 순간 Logger 가 초기화된다.
  - 위치: `backend/src/modules/integrations/services/credentials-transformer.ts` (+1418)
  - 상세: `INTEGRATION_ENCRYPTION_KEY` 환경 변수 읽기는 함수 호출 시점에 이루어지므로 로드 자체의 환경 변수 부작용은 없다. 그러나 Logger 인스턴스가 모듈 로드 시 초기화되므로, 테스트에서 이 모듈을 import 하면 즉시 Logger 가 생성된다.
  - 제안: 현재 허용 가능한 수준. 별도 조치 불필요.

---

## 요약

이번 변경셋은 22건의 Critical/Warning 조치를 단일 커밋으로 처리한 것으로, 대부분의 변경은 의도가 명확하고 부작용 범위가 제어되어 있다. 부작용 관점에서 가장 유의할 사항은 세 가지다. 첫째, V052 마이그레이션의 CHECK 제약 재생성은 운영 테이블에 짧은 잠금을 유발할 수 있어 배포 방식 검토가 필요하다(CRITICAL). 둘째, `NestFactory rawBody:true` 옵션은 전체 요청 파이프라인에서 raw body Buffer 를 이중 보유하게 하여 메모리에 영향을 준다(WARNING). 셋째, `sanitizePayloadForWs` 의 원본 참조 반환 변경은 호출자가 반환값을 변형하지 않는다는 불변 가정을 도입하며(WARNING), `PaginationQueryDto.sort` 의 패턴 검증 강화는 기존 API 소비자에 대한 호환성 확인이 필요하다(WARNING). 나머지 변경들(Logger 교체, nodeMap 최적화, 패키지 업그레이드, 문서 정비)은 부작용이 없거나 INFO 수준이다.

---

## 위험도

MEDIUM
