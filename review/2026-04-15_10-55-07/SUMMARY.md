# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 신규 아키텍처 핵심 컴포넌트(`NodeComponentRegistry`, `GET /nodes/definitions`)에 테스트가 전무하며, 전체 노드 configSchema가 플레이스홀더 상태로 Zod 도입의 실질적 효과가 없음

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `NodeComponentRegistry` 전용 테스트 파일 없음 — `bootstrap()`, `getComponent()`, `listMetadata()`, `listDefinitions()` 전 메서드가 미검증 상태. 중복 등록 예외 경로, JSON Schema 직렬화 결과 미검증 | `nodes/core/node-component.registry.ts` | `node-component.registry.spec.ts` 작성: 정상 bootstrap, 중복 type Error throw, `listDefinitions()` JSON Schema 구조, `getComponent()` 존재/비존재 케이스 포함 |
| 2 | 테스트 | `GET /nodes/definitions` 엔드포인트 테스트 없음 — HTTP 200 응답 구조, `componentRegistry.listDefinitions()` mock 호출 여부 미검증 | `nodes.controller.ts:33` | `nodes.controller.spec.ts`에 `listDefinitions` 케이스 추가: `NodeComponentRegistry` mock 후 반환값 및 HTTP 상태코드 검증 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `validateWithZod` 유틸리티 테스트 없음 — 성공/실패 케이스, 중첩 path 에러 메시지 포맷 미검증 | `nodes/core/zod-validator.ts` | `zod-validator.spec.ts` 작성: 성공 케이스, 단순/중첩 path 실패 케이스, 빈 path 케이스 포함 |
| 2 | 테스트 | `execution-engine.service.spec.ts`가 리팩터링된 `registerHandlers()` 동작 미검증 — `componentRegistry.bootstrap()` 호출 흐름에 대한 assertion 없음 | `execution-engine.service.spec.ts:188` | `componentRegistry.bootstrap`에 spy 추가, `onModuleInit()` 후 올바른 인자로 호출되는지 검증 |
| 3 | 구현 누락 | 모든 노드 configSchema가 `z.object({}).passthrough()` 플레이스홀더 — 런타임 검증 비활성화, `listDefinitions()` API가 빈 JSON Schema 반환, 프론트엔드 폼 자동 생성 불가 | 전체 `*.schema.ts` (24개 파일) | spec 명시 필드(`model`, `prompt`, `url`, `method`, `query` 등)를 Zod로 정의. 단기적으로는 `// TODO: placeholder` 주석으로 미완성 상태 명시 |
| 4 | 아키텍처 | `NodesModule` ↔ `ExecutionEngineModule` 순환 의존성 — `forwardRef` 사용으로 DI 초기화 순서 예측 불가, 모듈 구조 파악 난이도 증가 | `nodes.module.ts:9` | `NodeComponentRegistry`를 별도 `NodeRegistryModule`(또는 `NodeCoreModule`)로 분리하여 양 모듈에서 import하면 순환 참조 제거 가능 |
| 5 | 아키텍처 | 레이어 경계 위반 — `nodes/core/node-component.interface.ts`의 `HandlerDependencies`가 `LlmService`, `RagSearchService`, `IntegrationsService` 등 응용 서비스를 직접 의존 (DIP 위반) | `node-component.interface.ts` | 각 필드를 추상 인터페이스(`ILlmService` 등)로 정의하고 `modules/` 내에서 구현체 바인딩, 또는 NestJS DI 직접 활용 방식 검토 |
| 6 | 아키텍처 | `NodeComponentRegistry` SRP 위반 — 실행 엔진 부트스트랩(`bootstrap()`)과 API 응답 직렬화(`listDefinitions()`)를 단일 클래스가 담당 | `node-component.registry.ts` | `listDefinitions()` 관련 로직을 `NodeDefinitionService`로 분리 고려 |
| 7 | 보안/API | `GET /nodes/definitions` 인증 적용 여부 불명확 — `@ApiBearerAuth`는 Swagger 전용, 실제 `@UseGuards` 적용 여부 미확인 시 전체 노드 아키텍처 정보 노출 위험 | `nodes.controller.ts:listDefinitions()` | 전역 가드 적용 여부 확인 또는 메서드에 명시적 `@UseGuards(JwtAuthGuard)` 추가 |
| 8 | API 계약 | `bootstrap()` 완료 전 요청 유입 시 빈 배열(`[]`) 정상 반환 — 클라이언트가 "노드 없음" 상태로 오인 가능 | `node-component.registry.ts`, `nodes.controller.ts` | `private bootstrapped = false` 플래그로 완료 여부 추적, 미완료 시 `ServiceUnavailableException` throw 또는 `bootstrap()`을 Registry의 `onModuleInit()`으로 이관 |
| 9 | API 문서 | `GET /nodes/definitions` Swagger 응답 스키마 미정의 — `@ApiOkResponse`에 `type`/`schema` 없어 응답 구조 불투명, `@ApiUnauthorizedResponse` 누락 | `nodes.controller.ts:37` | DTO 클래스 생성 후 `@ApiOkResponse({ type: [NodeDefinitionDto] })` 보강, 다른 엔드포인트와 동일하게 `@ApiUnauthorizedResponse` 추가 |
| 10 | 요구사항 | Integration 노드 3종 누락 — spec §2.4는 7종 정의(`http_request`, `database_query`, `slack`, `google_sheets`, `github`, `send_email`, `google_drive`)이나 `ALL_NODE_COMPONENTS`에 4종만 포함 | `backend/src/nodes/index.ts` | 미구현 노드를 spec에 `🚧 미구현` 명시하거나 스텁 컴포넌트 등록 |
| 11 | 요구사항 | `text_classifier` 출력 포트 빈 배열 — spec §2.3은 "N outputs (카테고리 목록 기반)" 정의이나 `outputs = []`로 실행 엔진 라우팅 불가 | `text-classifier.schema.ts` | 동적 포트(`dynamic: true`) 또는 최소 기본 출력 포트 정의 |
| 12 | 요구사항 | `summaryTemplate` 필드 누락 — spec §1.2 Node Definition 속성에 명시되었으나 `NodeComponentMetadata` 인터페이스에 없음 | `node-component.interface.ts` | `NodeComponentMetadata`에 `summaryTemplate?: string` 추가 |
| 13 | 요구사항 | `validateWithZod`가 어떤 컴포넌트에서도 `NodeHandler.validate()`에 연결되지 않음 — spec §4.3 validate→execute 라이프사이클 미실현 | `nodes/core/zod-validator.ts`, 전체 `*.component.ts` | 각 컴포넌트의 `createHandler` 팩토리에서 핸들러의 `validate`를 `validateWithZod(configSchema)`로 바인딩 |
| 14 | 유지보수 | `NodeComponentMetadata.category` 타입 중복 선언 — `NodeCategory` enum과 리터럴 유니온 타입이 동시 존재, 한쪽만 수정될 위험 | `node-component.interface.ts:37-46` | `NodeCategory` enum을 단일 소스로 사용 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | `listDefinitions()` 호출마다 `z.toJSONSchema()` 재계산 — 스키마는 불변이므로 반복 연산 낭비 | `node-component.registry.ts:listDefinitions()` | `bootstrap()` 완료 시점에 `private definitionsCache`로 캐싱, 이후 호출은 캐시 반환 |
| 2 | 안정성 | `bootstrap()` 중복 호출 방어 로직 부재 — 테스트 환경 재사용 등에서 중간 실패 시 부분 등록 상태 발생 가능 | `node-component.registry.ts:bootstrap()` | `private bootstrapped = false` 플래그로 이중 호출 시 즉시 Error throw |
| 3 | 요구사항 | `parallel` 노드 누락 — spec §2.1 Logic 노드 12종 중 하나이나 `ALL_NODE_COMPONENTS` 미포함, 의도적 누락 표시 없음 | `backend/src/nodes/index.ts` | spec §2.1에 `🚧 미구현` 주석 추가 |
| 4 | 테스트 | 노드 컴포넌트 스키마 메타데이터 일관성 테스트 없음 — 향후 실제 스키마로 교체 시 회귀 감지 불가 | `backend/src/nodes/**/*.schema.ts` | 카테고리별 대표 노드의 metadata 필드 completeness 및 ports 구조 검증 테스트 추가 |
| 5 | 아키텍처 | `src/nodes/` 위치가 NestJS 모듈 관례(`src/modules/`)와 불일치 — 신규 노드 추가 위치 혼동 가능 | `backend/src/nodes/` | spec 문서에 경로 명시 유지로 현재는 허용 가능 |
| 6 | 보안 | `bootstrap()` 내 raw `Error` throw — NestJS 표준 예외 미사용 | `node-component.registry.ts:37` | `throw new InternalServerErrorException(...)` 또는 `logger.error()` 후 프로세스 종료 |
| 7 | 문서 | `validateWithZod` 유틸 사용 패턴 미문서화 — JSDoc에 예제 없음 | `zod-validator.ts` | JSDoc에 `NodeHandler.validate()`와의 연동 예제 추가 |
| 8 | 문서 | `HandlerDependencies` 전체 전달 설계 결정 이유 미문서화 | `node-component.interface.ts:48` | JSDoc에 단순성을 위한 의도적 선택임을 명시 |
| 9 | 의존성 | `package-lock.json`의 `"peer": true` 플래그 대량 제거 — `zod` 추가로 인한 npm 재해소 과정의 정상적 변화 | `package-lock.json` | 조치 불필요 |
| 10 | 의존성 | `zod ^4.3.6` 추가 — MIT 라이선스, `@anthropic-ai/sdk` peer 호환 확인됨 | `package.json` | 조치 불필요 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | **HIGH** | `NodeComponentRegistry`, `/nodes/definitions`, `validateWithZod` 전용 테스트 전무 |
| security | **MEDIUM** | 인증 적용 불명확, `passthrough()` 스키마로 고위험 노드(code, http, db) config 검증 공백 |
| dependency | **MEDIUM** | `forwardRef` 순환 의존성, 전체 configSchema 플레이스홀더 |
| requirement | **MEDIUM** | Integration 노드 3종 누락, `text_classifier` 출력 포트 없음, `summaryTemplate` 미구현 |
| architecture | **MEDIUM** | 레이어 경계 위반(DIP), `forwardRef` 순환, Registry SRP 위반 |
| api_contract | **LOW** | Swagger 응답 타입 미정의, 부트스트랩 전 빈 배열 반환 |
| maintainability | **LOW** | `forwardRef` 설계 냄새, Registry 초기화 책임 모호, 테스트 격리 약화 |
| concurrency | **LOW** | `listDefinitions()` 매 요청마다 JSON Schema 재직렬화 |
| performance | **LOW** | `listDefinitions()` 결과 캐싱 미적용 |
| scope | **LOW** | configSchema 플레이스홀더 상태, lock file 노이즈 |
| side_effect | **LOW** | 불필요한 `forwardRef`, 부트스트랩 전 빈 배열 반환 |
| documentation | **LOW** | Swagger 응답 타입, `parallel` 누락 표시, `validateWithZod` 예제 부재 |
| database | **NONE** | 데이터베이스 레이어 영향 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 비고 |
|----------|------|
| database | 변경사항이 DB 레이어와 무관한 순수 아키텍처 리팩터링으로 판단 |

---

## 권장 조치사항

1. **[즉시] 테스트 작성** — `node-component.registry.spec.ts`, `zod-validator.spec.ts` 신규 작성 및 `nodes.controller.spec.ts`에 `listDefinitions` 케이스 추가 (CRITICAL 2건 해소)
2. **[즉시] `execution-engine.service.spec.ts` 보강** — `componentRegistry.bootstrap` spy 추가로 리팩터링 회귀 방지
3. **[단기] configSchema 구체화** — 최우선으로 `code`, `http_request`, `database_query` 등 고위험 노드부터 실제 필드 정의, `passthrough()` 제거
4. **[단기] `text_classifier` 출력 포트 수정** — 빈 배열을 동적 포트 또는 기본 출력 포트로 교체
5. **[단기] `summaryTemplate` 필드 추가** — `NodeComponentMetadata`에 `summaryTemplate?: string` 추가
6. **[단기] `validateWithZod` 연결** — 각 컴포넌트의 `createHandler`에서 `validate` 메서드를 `validateWithZod(configSchema)`로 바인딩
7. **[단기] 인증 가드 명시화** — `listDefinitions()`에 전역 가드 적용 여부 확인 또는 `@UseGuards` 명시, `@ApiUnauthorizedResponse` 추가
8. **[중기] 순환 의존성 제거** — `NodeComponentRegistry`를 `NodeRegistryModule`로 분리하여 `forwardRef` 없이 양 모듈에서 공유
9. **[중기] 부트스트랩 상태 가드** — `bootstrapped` 플래그로 미완료 시 503 반환 또는 Registry 자체 `OnModuleInit` 구현
10. **[중기] Integration 노드 누락 관리** — `google_sheets`, `github`, `google_drive` 및 `parallel` 노드를 spec에 `🚧 미구현` 명시
11. **[중기] `listDefinitions()` 캐싱** — `bootstrap()` 완료 후 JSON Schema 직렬화 결과 캐싱
12. **[장기] 레이어 경계 정비** — `HandlerDependencies`를 추상 인터페이스로 교체하여 DIP 준수