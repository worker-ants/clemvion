파일 쓰기 권한이 필요합니다. 아래는 13개 리뷰어 에이전트의 결과를 통합한 보고서입니다.

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 핵심 라우팅 로직(`isPortFiltered`, `handler-output.adapter.ts`)의 `string[]` 포트 처리에 대한 테스트가 전혀 없고, `category` 필드 타입 변경(`""` → `null`)이 기존 클라이언트를 깨뜨리는 breaking change에 해당함

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `isPortFiltered` 배열 포트 분기(`Array.isArray`) 및 `handler-output.adapter.ts`의 `string[]` 포트 처리에 대한 테스트 전무. Multi-label 라우팅이 실제로 다운스트림 노드를 올바르게 활성화하는지 확인 불가 | `execution-engine.service.ts:2237-2244`, `handler-output.adapter.ts:35,55` | `isPortFiltered` 단위 테스트 또는 multi-label 포트가 복수 다운스트림을 활성화하는 통합 테스트 추가; `adaptHandlerReturn({ port: ['class_0', 'class_1'], ... })` 케이스 테스트 추가 |
| 2 | API Contract | `processSingleLabelResult`에서 분류 실패 시 `category` 반환값이 `""` → `null`로 변경됨. `if (data.category)` 또는 빈 문자열 비교로 분기하는 기존 클라이언트 코드가 silently 오동작하는 breaking change | `text-classifier.handler.ts` — `processSingleLabelResult()` | 변경 사유를 changelog에 명시하고, 클라이언트에서 `=== null` 체크를 사용하도록 마이그레이션 가이드 제공 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API Contract / Architecture / Requirement | `processSingleLabelResult`의 `config` 반환에 `multiLabel` 필드 누락. `processMultiLabelResult`는 `config: { ..., multiLabel: true }`를 반환하나 단일 라벨 성공 경로는 `multiLabel` 없이 반환 → 다운스트림 `$node["X"].config.multiLabel` 접근 시 성공=`undefined`, 실패=`false` 불일치 | `text-classifier.handler.ts` — `processSingleLabelResult()` | `processSingleLabelResult` 반환에 `multiLabel: false` 명시적 추가 |
| 2 | Dependency / Side Effect / Architecture | `NodeHandlerOutput.port`가 `string \| string[]`로 확장됨에 따라 `isPortFiltered`·어댑터 외 소비자(예: `propagateReachability`, `structuredOutputCache`, WebSocket emit, expression resolver `$node[X].port`)에서 배열 미처리 가능성 잔존 | `execution-engine.service.ts` 전체, `node-handler.interface.ts:69` | `port`를 직접 소비하는 모든 경로를 grep으로 확인; `propagateReachability`에서 `_selectedPort` 직접 읽는 경우 `Array.isArray` 분기 추가 |
| 3 | Security | `instructions` 및 카테고리 `name`/`description`이 시스템 프롬프트에 이스케이프 없이 삽입됨. 설계자가 외부 입력을 해당 필드에 연결할 경우 2차 프롬프트 인젝션 발생 가능 | `text-classifier.handler.ts` — `buildSingleLabelPrompt()`, `buildMultiLabelPrompt()` | `instructions` ≤ 2,000자, category description ≤ 500자 등 최대 길이 제한을 `validate()`에 추가 |
| 4 | Security | JSON 파싱 실패 시 `String.includes(c.name)` 폴백 매칭에서 카테고리명이 짧거나 일반적인 단어이면 오탐 발생. Multi-label에서는 영향 범위 더 넓음 | `text-classifier.handler.ts` — catch 블록들 | 단어 경계 정규식(`\bCategoryName\b`) 매칭으로 교체하거나 JSON 파싱 실패 자체를 `fallback` 포트로 처리하는 엄격 모드 제공 |
| 5 | Security | `execute()` 진입부에서 `config.categories as Category[]` 등 필수 필드를 검증 없이 타입 단언으로 사용. `validate()` 우회 직접 호출 시 런타임 에러 발생 가능 | `text-classifier.handler.ts` — `execute()` | `execute()` 진입부에서 `categories`, `inputField` 존재 여부 최소 확인 후 없으면 `error` 포트로 라우팅 |
| 6 | Testing | 기존 `expect(data.confidence).toBe(0.95)` 어설션이 이유 없이 제거됨. `includeConfidence` 기본값이 `true`이므로 해당 단언은 유지되어야 하며 제거로 regression 탐지 능력 저하 | `text-classifier.handler.spec.ts` — "should classify and route to correct port" | `confidence` 어설션 복원 |
| 7 | Testing | `context` 객체(`nodeOutputCache: {}`)가 모듈 스코프 `const`로 선언되어 전체 테스트에 공유됨. 향후 핸들러가 `nodeOutputCache`를 뮤테이션할 경우 테스트 오염 위험 | `text-classifier.handler.spec.ts:28-34` | `beforeEach`에서 `context`를 새로 생성하거나 `Object.freeze`로 불변성 보장 |
| 8 | Testing | Multi-label JSON 파싱 실패 fallback 테스트가 `categories` 배열 순서 의존 구현에만 의존하며 오탐 케이스 검증 없음 | `text-classifier.handler.spec.ts` | 오탐 케이스 테스트 추가 |
| 9 | Testing | Multi-label에서 `includeConfidence` 기본값(`true`)일 때 confidence 필드 포함 여부를 명시적으로 검증하는 테스트 없음 | `text-classifier.handler.spec.ts` — `execute (multi-label)` | `includeConfidence: true` 명시 설정으로 confidence 검증 테스트 추가 |
| 10 | API Contract | 에러 반환 구조가 레거시 `{ port, data: { config, output, meta } }`에서 신규 `{ config, output, meta, port }`로 변경됨. 프론트엔드 에러 포트 데이터 접근 경로가 달라짐 | `text-classifier.handler.ts` — `execute()` catch 블록 | 에러 포트 출력 구조에 대한 클라이언트 소비 코드 확인 및 통합 테스트 추가 |
| 11 | Requirement | `isPortFiltered`에서 `_selectedPort`가 빈 배열(`[]`)일 경우 모든 엣지가 필터링됨. 현재는 미매칭 시 `'fallback'` 문자열이 사용되어 직접 버그는 아니나, 다른 핸들러가 `[]`를 반환할 경우 silent failure 위험 | `execution-engine.service.ts` — `isPortFiltered()` | `Array.isArray(selectedPort) && selectedPort.length > 0` 조건으로 가드 추가 |
| 12 | Architecture | `propagateReachability`에서 `_selectedPort`를 직접 읽는 코드가 있다면 `Array.isArray` 분기 미적용으로 배열 포트 미처리 가능성 존재 | `execution-engine.service.ts` — `propagateReachability()` | 직접 참조 여부 확인 후 `isPortFiltered`와 동일한 분기 추가 |
| 13 | Maintainability | `isPortFiltered`에서 `Array.isArray(selectedPort)` 후 `.includes()` 호출 시 배열 원소가 `string`임을 보장하는 코드 없음 | `execution-engine.service.ts:2237-2243` | `selectedPort.some((p) => typeof p === 'string' && p === edgeSourcePort)` 패턴으로 교체 |
| 14 | Concurrency | Multi-label 활성화로 복수 브랜치가 동일 수렴 노드에 도달할 때 입력 합산 정책이 스펙에 미명시. 현재 순차 실행에서는 결정적이나 향후 병렬화 시 race condition 우려 | `execution-engine.service.ts` — `reachable` Set | 수렴 노드의 입력 합산 정책("마지막 브랜치 값" 또는 "배열 병합")을 스펙 수준에서 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | `NONE_SENTINEL` 클래스 내부 static 상수, `buildSingleLabelPrompt` 내 `const NONE = TextClassifierHandler.NONE_SENTINEL` 재바인딩 패턴 중복 | `text-classifier.handler.ts:17` | 파일 최상단 `export const`로 분리하거나 재바인딩 패턴 제거 |
| 2 | Maintainability | `processSingleLabelResult` / `processMultiLabelResult` 양쪽에 동일한 `meta` 블록 복사 존재 | `text-classifier.handler.ts` | `private extractMeta(result: ChatResult)` 헬퍼로 추출 |
| 3 | Maintainability | `buildSingleLabelPrompt` / `buildMultiLabelPrompt` 반환 타입 및 `process*` 메서드 반환 타입 암묵적 추론 의존 | `text-classifier.handler.ts:113,148,196,261` | `ClassifierPrompt` 인터페이스 및 `NodeHandlerOutput` 반환 타입 명시 |
| 4 | Maintainability | `handler-output.adapter.ts`에서 `typeof port === 'string' \|\| Array.isArray(port)` 패턴 중복 | `handler-output.adapter.ts:35,53` | `isValidPort` 타입 가드 헬퍼 함수로 추출 |
| 5 | Maintainability | 테스트 내 `(result as any).port` 패턴 약 15회 반복. 타입 변경 시 컴파일 오류 없이 통과 위험 | `text-classifier.handler.spec.ts` | `ClassifierResult` 인터페이스 정의 후 단언 함수로 교체 |
| 6 | API Contract | `includeConfidence` 기본값이 스키마(`false`)와 핸들러(`?? true`) 불일치 | `text-classifier.schema.ts:59`, `text-classifier.handler.ts:51` | 스키마와 핸들러의 기본값을 통일 |
| 7 | Testing | Multi-label `meta` 필드(`model`, `inputTokens` 등) 검증 테스트 없음 | `text-classifier.handler.spec.ts` — `execute (multi-label)` | multi-label `meta` 필드 검증 테스트 추가 |
| 8 | Testing | Frontend `TextClassifierConfig`의 `multiLabel` 체크박스에 대한 컴포넌트 테스트 없음 | `ai-configs.tsx:249-252` | `onChange` 콜백 호출 여부 검증 테스트 추가 |
| 9 | Testing | 동일 이름 카테고리 중복에 대한 `validate` 테스트 없음 | `text-classifier.handler.spec.ts` | `{ name: 'Billing' }, { name: 'Billing' }` 케이스 추가 |
| 10 | Security | LLM API 에러 메시지가 필터링 없이 `output.error`에 포함되어 다운스트림 전달 | `text-classifier.handler.ts` — catch 블록 | 에러 메시지 코드화(`LLM_API_ERROR`), 상세 내용은 서버 로그에만 기록 |
| 11 | Security | `__none__` 예약어 검증이 `validate()`에만 존재 | `text-classifier.handler.ts` | 예약어 필터링 유틸리티 함수로 분리하여 `execute()`에도 호출 |
| 12 | Security | 카테고리 최대 개수 및 description 최대 길이 제한 없음 → Token DoS 가능성 | `text-classifier.schema.ts`, `validate()` | 카테고리 최대 50개, description 최대 500자 등 상한 검증 추가 |
| 13 | Documentation | `TextClassifierHandler` 클래스 및 새 private 메서드들에 JSDoc 전무. 특히 multi-label에서 `__none__` 미사용 설계 의도가 미문서화 | `text-classifier.handler.ts:14,113,148,196,261` | 클래스 수준 JSDoc 및 비대칭 설계 의도 주석 추가 |
| 14 | Documentation | `handler-output.adapter.ts` JSDoc 블록에 `string[]` 포트 지원 내용 미반영 | `handler-output.adapter.ts` 상단 JSDoc | `port`가 `string[]`일 수 있으며 엔진이 처리함을 명시 |
| 15 | Documentation | `NONE_SENTINEL`이 카테고리명으로 금지된 예약어임이 Swagger 문서에 미반영 | `text-classifier.schema.ts` | Swagger decorator에 `__none__` 예약어 주석 추가 |
| 16 | Requirement | Multi-label 스키마에서 `__none__` 센티널 미포함은 스펙과 일치하는 의도적 설계이나 두 모드의 비대칭성이 유지보수 시 혼동 가능 | `text-classifier.handler.ts` — `buildMultiLabelPrompt()` | 코드 주석으로 의도적 비대칭성 명시 |
| 17 | Performance | `processMultiLabelResult`에서 `categories.some()`과 `categories.findIndex()` 이중 선형 탐색 및 3단계 중간 배열 생성. 카테고리 수가 소규모이므로 실질 영향 없음 | `text-classifier.handler.ts` — `processMultiLabelResult()` | `Map` 인덱스로 단일 패스 개선 권장 (코드 명료성 목적) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | HIGH | `isPortFiltered` 배열 포트 및 어댑터 `string[]` 처리 테스트 전무 |
| api_contract | MEDIUM | `category` null 변경 breaking change, config 필드 비일관성, 에러 구조 변경 |
| security | MEDIUM | 프롬프트 인젝션 위험, 폴백 오탐, config 런타임 미검증 |
| architecture | LOW | config 비대칭, `propagateReachability` 배열 처리 미검증 |
| maintainability | LOW | meta 블록 중복, `as any` 남용, 타입 미명시 |
| side_effect | LOW | `port: string[]` 전파 범위 불명확 |
| dependency | LOW | `port` 인터페이스 확장의 하위 소비자 영향 미검증 |
| requirement | LOW | config `multiLabel` 필드 불일치, 빈 배열 엣지 케이스 |
| concurrency | LOW | 복수 브랜치 수렴 정책 미명시 |
| scope | LOW | 신뢰도 어설션 제거, 에러 구조 사전 수정 |
| performance | LOW | `processMultiLabelResult` 이중 탐색 (실질 영향 없음) |
| documentation | LOW | 클래스/메서드 JSDoc 미흡, Swagger 예약어 미반영 |
| database | NONE | DB 영향 없음 |

---

## 발견 없는 에이전트
- **database** — 변경이 JSON 컬럼에 backward-compatible하게 저장되며, 별도 마이그레이션 불필요

---

## 권장 조치사항

1. **[CRITICAL] 테스트 추가**: `isPortFiltered` 배열 분기 단위 테스트 및 `adaptHandlerReturn` `string[]` 포트 처리 테스트를 즉시 작성. Multi-label이 실제로 복수 다운스트림을 활성화하는지 통합 테스트로 검증
2. **[CRITICAL] `category` null breaking change 대응**: 클라이언트 코드에서 `if (data.category)` 패턴을 `data.category !== null`로 수정 또는 원래 `''` 반환으로 롤백 여부 결정
3. **[WARNING] `config.multiLabel` 필드 통일**: `processSingleLabelResult`에 `multiLabel: false` 명시적 추가
4. **[WARNING] `propagateReachability` 검증**: `string[]` 포트 미처리 경로가 있는지 grep 확인 후 누락 시 `Array.isArray` 분기 추가
5. **[WARNING] 기본 confidence 어설션 복원**: `expect(data.confidence).toBe(0.95)` 단언 복원
6. **[WARNING] 에러 반환 구조 클라이언트 영향 확인**: 프론트엔드에서 에러 포트 데이터 접근 경로(`data.output.error` vs `output.error`) 확인
7. **[WARNING] `isPortFiltered` 빈 배열 가드 추가**: `selectedPort.length > 0` 조건 추가
8. **[WARNING] 프롬프트 인젝션 제한**: `validate()`에 `instructions` 및 카테고리 필드 최대 길이 제한 추가
9. **[INFO] `includeConfidence` 기본값 통일**: 스키마와 핸들러 기본값 일치화
10. **[INFO] JSDoc 보완**: `TextClassifierHandler` 클래스 및 private 메서드에 `__none__` 센티널의 single/multi 비대칭 설계 의도 문서화