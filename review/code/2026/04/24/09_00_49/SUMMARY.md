파일 저장 권한이 필요합니다. 아래에 통합 보고서를 출력합니다.

---

# Code Review 통합 보고서

> **대상 변경**: LLM Config 모델 미리보기(preview-models) 기능 추가, Google AI SDK 마이그레이션(`@google/generative-ai` → `@google/genai`), TypeScript 타입 단언 일괄 정리
> **리뷰어**: database, dependency, concurrency, scope, documentation, api_contract, testing, performance, architecture, maintainability, requirement, side_effect, security (13개)
> **일시**: 2026-04-24

---

## 전체 위험도

**MEDIUM** — Google SDK 전면 교체의 런타임 검증 불확실 + `isDefault` race condition의 DB 제약 미비 + SSRF 가드의 URL 스킴 누락이 주요 요인. 기능 자체의 설계(SSRF 가드·rate limit·타임아웃·apiKey 비저장)는 양호하나, 마이그레이션 커버리지와 동시성 방어가 보완 필요.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect | Google SDK 마이그레이션 diff 미확인 — 스트리밍 후반부 처리, `fnCallToToolCall` 정의, 에러 형식 매핑 등 핵심 경로가 잘린 diff로 검증 불가 | `google.client.ts` (diff truncated) | 잘린 diff를 별도 검토하고 툴콜 round-trip·thoughtSignature echo·스트림 에러 경로를 통합 테스트로 명시적 확인 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Concurrency / Database | `isDefault` 트랜잭션만으로는 race condition 미해소 — READ COMMITTED에서 T1·T2가 동시에 `isDefault=true` 저장 시 2건 생성 가능 | `llm-config.service.ts` `create()` / `update()` | `(workspaceId, isDefault) WHERE isDefault = true` partial unique index 추가 또는 SERIALIZABLE 격리 수준 적용 |
| 2 | Security | SSRF 가드 URL 스킴 미검증 — `file:///etc/passwd` 입력 시 hostname이 `''`로 반환되어 `isPrivateHost` 통과 | `llm.service.ts` `isPrivateHost()` | 함수 초입에 `['http:', 'https:'].includes(parsed.protocol)` 화이트리스트 검사 추가 |
| 3 | Architecture / Dependency | Google 스트림 경로 타입 안전성 회귀 — `generateContentStream()` 반환을 `AsyncIterable<unknown>`으로 캐스팅 후 인라인 익명 타입 처리, SDK 업그레이드 시 컴파일 타임 감지 불가 | `google.client.ts` `stream()` | `@google/genai` 공식 타입 사용 또는 `interface GoogleStreamChunk` 명명 타입 선언으로 캐스트 격리 |
| 4 | Architecture / Maintainability / Documentation | Gemini API 제약 설명 주석 일괄 제거 — role alternation 규칙, `functionResponse` 분리 이유, `ObjectSchema` 빈 properties 금지 등 비자명 제약 설명 삭제 | `google.client.ts` `buildContents()`, `sanitizeGeminiSchema()` | SDK 마이그레이션과 무관한 "WHY" 주석(Gemini 스펙 제약)만 복원 |
| 5 | Architecture / Maintainability | `isDefault` 트랜잭션 블록 중복 — `create()`와 `update()`에 동일 패턴 반복, 향후 한 쪽만 수정 시 불일치 위험 | `llm-config.service.ts` | `private clearDefaultAndSave(manager, entity, workspaceId)` 헬퍼로 추출해 단일 구현체 공유 |
| 6 | Performance / API Contract | `AnthropicClient.listModels()` 동작 변경 — 하드코딩 배열 즉시 반환 → 실시간 API 호출로 전환, `testConnection()` 등 기존 호출자의 실패 모드 변경 | `anthropic.client.ts` `listModels()` | `testConnection()` 구현 확인 및 단위 테스트에서 `client.models.list` stub 여부 검토 |
| 7 | Performance / Testing | OpenAI `listModels()` 모델 수 상한 없음 — Anthropic `MAX_MODELS = 100` 상한 있으나 OpenAI는 수백 개 전체 적재 | `openai.client.ts` `listModels()` | Anthropic과 동일하게 `MAX_MODELS = 100` 가드 추가 및 테스트 보강 |
| 8 | Testing | SSRF `192.168.x.x` RFC1918 Class C 테스트 누락 — 10.x, 172.16-31.x는 커버, 192.168.x.x 케이스 없음 | `llm.service.spec.ts` | `rejects RFC1918 Class C (192.168.x.x)` 케이스 추가 |
| 9 | Testing | `172.16-31` 경계값 미검증 — `172.15.0.1`(허용)·`172.32.0.1`(허용) 경계 off-by-one 버그 감지 불가 | `llm.service.spec.ts` | 해당 IP에 대해 `rejects` 미발생을 명시적 검증 |
| 10 | Testing | `LlmConfigService` `isDefault=true` 트랜잭션 경로 미테스트 — 기존 default 해제→새 저장 동작 검증 없음 | `llm-config.service.ts` | 기존 default가 false로 바뀌는 mock transaction 또는 통합 테스트 추가 |
| 11 | Testing | `remove()` 캐시 순서 변경 버그픽스 미테스트 — DB 삭제 실패 시 캐시 불변 보장 케이스 없음 | `llm-config.controller.ts` `remove()` | `llmConfigService.remove` 실패 시 `clearClientCache` 미호출 검증 테스트 추가 |
| 12 | Testing / Requirement | `ModelCombobox` 프론트엔드 컴포넌트 테스트 전무 — 로드 성공·실패·빈 apiKey 비활성화 등 미검증 | `frontend/src/components/llm-config/model-combobox` | 로드 성공 드롭다운 렌더, 실패 시 자유 입력 fallback, 빈 apiKey 비활성화 커버 |
| 13 | Requirement / Security | `PreviewLlmModelsDto` 구현 diff 미포함 — `@IsIn`, `@IsUrl`, 길이 제한 검증 여부 불명확 | `dto/preview-llm-models.dto.ts` | `@IsIn(LLM_PROVIDERS)`, `@IsUrl({ protocols: ['http','https'] })`, `@MaxLength(256)` 적용 확인 |
| 14 | Requirement | `POST :id/test` 엔드포인트 Rate Limit 누락 — 외부 LLM API 실호출 엔드포인트임에도 throttle 미적용 | `llm-config.controller.ts` `@Post(':id/test')` | `@Throttle({ default: { limit: 10, ttl: 60_000 } })` 추가 |
| 15 | API Contract | 기존 `GET :id/models`에 throttle 소급 적용 — 기존 클라이언트에 breaking change | `llm-config.controller.ts` `listModels` 핸들러 | 클라이언트 재시도 로직 및 10회/60s 수치의 정상 UX 충분성 검증 |
| 16 | Side Effect | `previewModels()` factory 에러 메시지 미살균 노출 — provider 에러는 `sanitizeErrorMessage()` 처리, factory 에러는 raw 반환 | `llm.service.ts` `previewModels()` catch 블록 | factory 에러도 `sanitizeErrorMessage()` 적용 또는 factory 계층에서 자격증명 미포함 보장 |
| 17 | Side Effect | `update()` 트랜잭션 전 엔티티 뮤테이션 — `config.isDefault = true` 설정 후 트랜잭션 시작, 실패 시 in-memory 불일치 | `llm-config.service.ts` `update()` | 트랜잭션 내부에서만 `isDefault` 값 설정하도록 순서 조정 |
| 18 | Side Effect | `withTimeout`이 abort 이후 모든 SDK reject 묵살 — `AbortError` 외 커넥션·인증 에러도 삼켜져 원인 파악 불가 | `llm.service.ts` `withTimeout()` | `AbortError` 계열만 catch, 그 외는 logger warn으로 기록 후 무시 |
| 19 | Maintainability | `stream()` 내 인라인 익명 chunk 타입 — SDK 구조 변경 시 수정 난이도 높음 | `google.client.ts` stream for-await 루프 | `type GoogleStreamChunk = { candidates?: ...; usageMetadata?: ... }` 명명 타입으로 추출 |
| 20 | Maintainability / Testing | `as never` 정리 불완전 — `mockUser as never` 잔존 | `jwt.strategy.spec.ts:102` | 잔존 이유 명시(`@ts-expect-error`) 또는 타입 호환 확인 후 제거 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Database | `(workspaceId, isDefault)` 복합 인덱스 부재 — `WHERE isDefault=true` 쿼리 시 풀스캔 가능 | `LlmConfig` 엔티티 | `@Index(['workspaceId', 'isDefault'])` 없으면 마이그레이션 추가 |
| 2 | Architecture | 스펙 주석 참조 오류 — `previewModels()` 주석에 `(spec §5.4)`, 실제 §5.5가 해당 | `llm.service.ts` | `(spec §5.5)`로 수정 |
| 3 | Architecture | 프론트엔드 `data?.data ?? data` 방어 패턴 — Interceptor가 항상 래핑한다면 폴백 불필요, 구조 불일치를 숨길 가능성 | `frontend/src/lib/api/llm-configs.ts` | 응답 구조 확인 후 `data.data`로 단순화 |
| 4 | Architecture | `isPrivateHost()` 재사용성 — 서비스 인라인, 향후 OAuth·HTTP Request 노드에서도 필요 가능 | `llm.service.ts` | `backend/src/common/utils/network.util.ts`로 이동 고려 |
| 5 | Documentation | `fnCallToToolCall` 헬퍼 미문서화 — 정의 위치·시그니처 diff 미포함 | `google.client.ts` `chat()` | 함수에 한 줄 주석("FunctionCall → ToolCall 변환, id 없으면 uuid 생성") 추가 |
| 6 | Maintainability | `package.json` `transformIgnorePatterns` 맥락 설명 없음 — 단순화 시 pnpm 환경 재발 위험 | `backend/package.json` | "pnpm `.pnpm/*/node_modules/` 경로 처리" 맥락 주석 또는 PR 설명에 기록 |
| 7 | Maintainability | `buildToolConfig` 반환 타입 장황 — 멀티라인 인라인 제네릭 시그니처 | `google.client.ts` | 파일 상단 `type GeminiFunctionTool` 선언으로 단순화 |
| 8 | Scope | `isDefault` 버그픽스·캐시 순서 수정이 기능 PR에 번들링 — rollback 시 함께 사라질 위험 | `llm-config.service.ts`, `llm-config.controller.ts` | 별도 커밋 분리 또는 커밋 메시지에 명시 |
| 9 | Security | DNS 리바인딩 미차단 (문서화된 한계) — rate limit + editor 권한으로 완화 중 | `llm.service.ts` | 고보안 환경에서는 egress 방화벽/네트워크 정책으로 보완 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | SSRF URL 스킴 미검증(W), factory 에러 미살균(I) — apiKey 비저장·에러 살균·IPv6 커버리지 양호 |
| performance | LOW | OpenAI 모델 상한 없음(W), previewModels 캐시 없음(I) — withTimeout·AbortController 올바름 |
| architecture | MEDIUM | Google 스트림 타입 우회(W), isDefault 트랜잭션 중복(W), 제약 주석 삭제(W) |
| maintainability | LOW | isDefault 패턴 중복(W), Gemini WHY 주석 삭제(W), 익명 chunk 타입(W) |
| testing | MEDIUM | RFC1918·경계값·트랜잭션·캐시순서·SDK·ModelCombobox 테스트 누락 다수 |
| requirement | LOW | PreviewLlmModelsDto 미확인(W), test 엔드포인트 rate limit 누락(W) |
| side_effect | MEDIUM | Google SDK diff 잘림(C), factory 에러 노출(W), entity 선뮤테이션(W) |
| api_contract | LOW | 기존 listModels throttle 소급(W), live API 전환 실패 모드 변화(W) |
| concurrency | MEDIUM | isDefault partial unique index 미비(W) — withTimeout·캐시 순서 수정 올바름 |
| database | LOW | isDefault 트랜잭션 도입 올바름, 복합 인덱스 부재(I) |
| dependency | MEDIUM | Google SDK 전면 교체·lockfile 검증 불가(W), stream 타입 unknown 캐스팅(W) |
| documentation | LOW | Gemini 제약 주석 삭제(W), fnCallToToolCall 미문서화(W) — spec·i18n·사용자 문서 동기화 양호 |
| scope | LOW | isDefault 버그픽스·타입 정리의 기능 PR 번들링(W) |

---

## 발견 없는 에이전트

없음 — 13개 에이전트 모두 발견사항 보고.

---

## 권장 조치사항

### 즉시 (배포 전)

1. **`isDefault` DB partial unique index 추가** — 트랜잭션만으로는 READ COMMITTED에서 2건 생성 race 잔존. `(workspace_id, is_default) WHERE is_default = true` partial index 마이그레이션 필수.
2. **Google SDK 마이그레이션 통합 테스트 확인** — 잘린 diff 영역(툴콜 round-trip, thoughtSignature echo, 스트림 에러 경로) 커버리지 직접 확인 후 누락 케이스 추가.
3. **SSRF 가드 URL 스킴 검증 추가** — `isPrivateHost()`에 `['http:', 'https:'].includes(parsed.protocol)` 검사 추가하여 `file://`·`ftp://` 우회 차단.
4. **`POST :id/test` Rate Limit 추가** — `@Throttle({ default: { limit: 10, ttl: 60_000 } })` 적용.

### 단기 (다음 PR)

5. **`PreviewLlmModelsDto` 검증 확인** — `@IsIn(LLM_PROVIDERS)`, `@IsUrl()`, `@MaxLength(256)` 미적용 시 보완.
6. **`isDefault` 트랜잭션 헬퍼 추출** — `clearDefaultAndSave()` private 메서드로 `create()`/`update()` 중복 통합.
7. **Google 스트림 타입 명명** — `interface GoogleStreamChunk` 선언으로 `as unknown` 캐스트 격리.
8. **Gemini API 제약 WHY 주석 복원** — `buildContents()` role 분리 이유, `sanitizeGeminiSchema()` null 반환 조건.
9. **OpenAI `listModels()` 100개 상한 추가** — Anthropic과 동일한 `MAX_MODELS` 가드.
10. **`update()` 엔티티 뮤테이션 순서 수정** — 트랜잭션 내부에서만 `isDefault` 값 설정.

### 테스트 보강

11. **RFC1918 누락 케이스 추가** — `192.168.x.x` 차단, `172.15.0.1`·`172.32.0.1` 허용 경계값 검증.
12. **트랜잭션·캐시 순서 테스트 추가** — `isDefault=true` 생성 시 기존 default 해제, `remove()` 실패 시 캐시 불변 보장.
13. **`ModelCombobox` 컴포넌트 테스트** — 로드 성공·실패·apiKey 빈값 케이스 최소 커버.

### 장기 (리팩토링)

14. **`isPrivateHost()` 공통 유틸로 이동** — `backend/src/common/utils/network.util.ts`로 추출.
15. **factory 에러 살균** — `previewModels()` factory 에러 경로에 `sanitizeErrorMessage()` 적용.