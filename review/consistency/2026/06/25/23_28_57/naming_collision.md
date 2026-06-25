# 신규 식별자 충돌 검토 결과

## 발견사항

이 리팩터(refactor 03 m-1)가 도입하는 신규 식별자는 다음 범주로 분류된다.

**클래스 레벨 `private readonly logger` 필드 추가 (2곳)**
- `NodeHandlerRegistry` (`nodes/core/node-handler.registry.ts:89`)
- `McpTestConnectionService` (`modules/mcp/mcp-test-connection.service.ts:153`)

**모듈 레벨 `const logger = new Logger(...)` 추가 (2곳, 함수형 모듈)**
- `telegram-message.renderer.ts:427`
- `language-hint-defaults.ts:75`

**ESLint 규칙 키 추가**
- `eslint.config.mjs` 에 `no-console` 룰

---

### 요구사항 ID 충돌

목표 문서는 새로운 요구사항 ID를 부여하지 않는다. 충돌 없음.

### 엔티티/타입명 충돌

- **[INFO]** `logger` 필드명은 코드베이스 전반의 표준 컨벤션
  - target 신규 식별자: `NodeHandlerRegistry.logger`, `McpTestConnectionService.logger`
  - 기존 사용처: 동일 파일 내 충돌 없음. 코드베이스 내 `private readonly logger = new Logger(...)` 패턴은 이미 `McpClientService` (`mcp-client.service.ts:231`), `TelegramAdapter` (`telegram.adapter.ts:40`), `TelegramClient` (`telegram-client.ts:128`), `NodeComponentRegistry` (`node-component.registry.ts:40`) 등 다수에서 동일 필드명으로 사용 중
  - 상세: 충돌이 아닌 일관성 준수. 기존 패턴과 완전히 동형이며 의미 차이 없음
  - 제안: 없음

- **[INFO]** 함수형 모듈의 모듈 레벨 `const logger` 변수명
  - target 신규 식별자: `telegram-message.renderer.ts` 내 모듈 레벨 `const logger`, `language-hint-defaults.ts` 내 모듈 레벨 `const logger`
  - 기존 사용처: `chat-channel/shared/execution-failure-classifier.ts:20` 에 이미 `const logger = new Logger('ChatChannelFailureClassifier')` 패턴 선례 존재. `nodes/integration/_base/integration-handler-base.ts`, `nodes/integration/database-query/database-query.handler.ts` 도 동일 패턴 사용
  - 상세: 모듈 레벨 `const logger` 는 같은 chat-channel 디렉토리의 인접 파일에서 이미 확립된 패턴. 동일 변수명이지만 각 파일의 독립 스코프이므로 충돌 없음
  - 제안: 없음

### API endpoint 충돌

본 리팩터는 신규 API endpoint를 도입하지 않는다. 충돌 없음.

### 이벤트/메시지명 충돌

본 리팩터는 새 webhook·queue·SSE 이벤트 이름을 도입하지 않는다. 충돌 없음.

### 환경변수·설정키 충돌

본 리팩터는 새 환경변수나 설정 키를 도입하지 않는다. 충돌 없음.

### 파일 경로 충돌

본 리팩터는 새 파일을 생성하지 않는다. 수정 대상 파일들(`node-handler.registry.ts`, `mcp-test-connection.service.ts`, `telegram-message.renderer.ts`, `language-hint-defaults.ts`, `eslint.config.mjs`)은 기존 경로에 이미 존재하며 경로 충돌 없음.

### ESLint 규칙 키 충돌

- **[INFO]** `no-console` 규칙 키 신규 추가
  - target 신규 식별자: `eslint.config.mjs` 내 `no-console` 규칙
  - 기존 사용처: `eslint.config.mjs` 에 현재 `no-console` 항목 없음 (grep 결과 0건)
  - 상세: 기존 설정과 키 충돌 없음. `scripts/`, `instrumentation.ts`, `*.spec` override 구역을 별도 블록으로 면제하는 것은 기존 ESLint 설정의 `files: ['**/*.spec.ts', ...]` 오버라이드 패턴과 동형
  - 제안: 없음

---

## 요약

이 리팩터가 도입하는 신규 식별자는 `logger` 필드(클래스/모듈 레벨)와 `no-console` ESLint 규칙 키로 제한된다. `logger` 필드명은 코드베이스 전반에서 이미 확립된 NestJS Logger 컨벤션과 완전히 일치하며, 동일 클래스 내 기존 필드와 이름이 겹치지 않는다. 함수형 모듈에서의 모듈 레벨 `const logger`도 같은 chat-channel 영역(`execution-failure-classifier.ts`)에 선례가 있어 일관성을 준수한다. 새 API 엔드포인트, 요구사항 ID, 이벤트명, 환경변수, 파일 경로 추가는 없다. 식별자 충돌 관점에서 실질적인 위험 요소가 없다.

## 위험도

NONE
