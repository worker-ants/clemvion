파일 쓰기 권한이 필요합니다. 권한을 승인해 주시면 `SUMMARY.md`를 저장하겠습니다. 아니면 아래 보고서 내용을 직접 확인하실 수 있습니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 테스트 누락(CRITICAL 2건)과 사이드이펙트/아키텍처 구조 문제가 존재하나, 즉각적 장애 위험은 낮음. 핵심 이슈 해결 후 배포 권장.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `enrichInfoExtractorOutputSchema` 직접 단위 테스트 누락 — 6개 이상의 분기를 가진 순수 함수임에도 간접 경로로만 검증됨 | `use-expression-context.ts:54–100` | undefined baseSchema, 빈 fields, name 없는 field, output.properties 없는 schema 등 각 분기 직접 테스트 추가 |
| 2 | Testing | `getSchemaKeys` / `resolveSchemaNode` / `schemaTypeLabel` 직접 단위 테스트 누락 — 배열 index 경로, MAX_DEPTH 초과, type이 배열인 케이스 등 미검증 | `resolve-nested-path.ts:142–220` | `resolve-nested-path.test.ts`에 `getSchemaKeys` 전용 describe 블록 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect / Architecture | `dropStaleEdges`가 사용자 인지 없이 엣지를 묵시적으로 삭제 — 이후 저장 시 DB에서 비가역적으로 손실 | `editor-loader.tsx:60–74` | 토스트/배너로 삭제 사실 알리거나, 삭제를 저장 시점으로 지연 |
| 2 | Side Effect | `insertText` 변경이 `isExpandable` 미구현 소비자에서 자동완성 회귀 유발 가능 | `use-expression-suggestions.ts:207` | `handleSelect`에서 `isExpandable` 처리 여부 확인 및 추가 |
| 3 | Architecture | IE 전용 enricher 로직이 범용 훅에 직접 임베딩 — OCP/SRP 위반 | `use-expression-context.ts:54–105` | `NodeDefinition`에 `enrichOutputSchema?` 함수 추가, 훅은 위임만 |
| 4 | Requirement / Security | `dropStaleEdges` 빈 Set 와일드카드 의미론 모호성 — "포트 없음"과 "알 수 없는 타입" 동일 처리 | `edge-utils.ts:119–140` | `null` 반환으로 "알 수 없음" 명시 |
| 5 | Requirement / Security | `getExpressionToken`에서 `i=0`일 때 `between[-1]`이 `undefined` — 이스케이프 체크 부정확 | `use-expression-suggestions.ts:65,75` | `i > 0 && between[i - 1] !== "\\"` 조건으로 수정 |
| 6 | Performance | `enrichInfoExtractorOutputSchema` 내 `JSON.parse(JSON.stringify(...))` 반복 호출 | `use-expression-context.ts:88` | `structuredClone()` 또는 얕은 스프레드로 교체 |
| 7 | Testing | 백엔드 Zod 출력 스키마 `safeParse` 단위 테스트 없음 | `*.schema.ts` (3개 파일) | 핸들러 실제 출력 픽스처로 성공/실패 케이스 추가 |
| 8 | Testing | `$node["X"].meta.<path>` 폴스루 동작 미검증 | `use-expression-suggestions.ts:150–178` | 지원 여부 명시 + 테스트 추가 |
| 9 | Testing | `dropStaleEdges` `sourceHandle: null` 케이스 미테스트 | `edge-utils.ts:131–140` | 명시적 테스트 추가 |
| 10 | Testing | `dropStaleEdges` 테스트의 중첩 `beforeAll` 상태 의존성 | `edge-utils.test.ts:234–264` | describe 내 독립 store 상태 설정 또는 `beforeEach` 격리 |
| 11 | Testing | 이스케이프 따옴표(`\"`) 포함 노드 키 토큰 파싱 미검증 | `use-expression-suggestions.ts:53–100` | `$node["Node \"Quoted\""]` 테스트 케이스 추가 |
| 12 | Security | 사용자 정의 필드명이 객체 키에 직접 삽입 — `__proto__`, `constructor` 등 위험 키 미처리 | `use-expression-context.ts:74–88` | 식별자 정규식 검증(`/^[a-zA-Z_][a-zA-Z0-9_]*$/`) 추가 |
| 13 | Security / Architecture | `.passthrough()` 과도 적용 — 실행 컨텍스트 재사용 시 임의 필드 전파 위험 | `ai-agent.schema.ts:291` 외 2개 | 자동완성 힌트용 스키마와 런타임 검증 스키마 분리 |
| 14 | API Contract | `ai_agent`(플랫) vs `information_extractor`(중첩) outputSchema 구조 불일치 | `ai-agent.schema.ts` vs `information-extractor.schema.ts` | API 문서에 타입별 구조 명시 또는 공통 래퍼로 통일 검토 |
| 15 | Requirement | `enrichInfoExtractorOutputSchema` silent fail — `output.properties` 없으면 enrichment 무시 | `use-expression-context.ts:93` | 경고 로그 추가 |
| 16 | Performance | `useExpressionContext` 내 `nodes.find()` 선형 탐색 | `use-expression-context.ts:137` | `new Map(nodes.map(n => [n.id, n]))` 사전 구성 후 재사용 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | IE 전용 enricher 로직이 범용 훅 파일에 위치 — 확장 시 비대해짐 | `use-expression-context.ts:54–103` | `node-output-schema-enrichers.ts` 유틸로 분리 |
| 2 | Architecture | 프론트엔드 `INFO_EXTRACTOR_TYPE_MAP`이 백엔드 타입 매핑 중복 | `use-expression-context.ts:54–61` | 백엔드 JSON Schema 직접 활용 검토 |
| 3 | Architecture | `getSchemaKeys`가 `resolve-nested-path.ts`에 혼재 — 두 관심사 혼합 | `resolve-nested-path.ts` 하단 | `json-schema-utils.ts` 분리 검토 |
| 4 | Concurrency | `Promise.all` 4개 중 3개만 구조분해 — 의도 불명확 | `editor-loader.tsx:27–31` | 주석으로 사이드이펙트 목적 명시 |
| 5 | Requirement | `condition` 필드에 `.passthrough()` 누락 — 다른 nested object와 불일치 | `ai-agent.schema.ts:313–319` | `.partial().passthrough()` 적용 |
| 6 | Documentation | TC(플랫) vs IE(중첩) 출력 형태 비대칭 이유 미설명 | `text-classifier.schema.ts`, `information-extractor.schema.ts` | JSDoc에 핸들러 반환 구조 차이 명시 |
| 7 | Documentation | `isExpandable` 주석의 `handleSelect` 위치 미특정 | `use-expression-suggestions.ts:207` | 컴포넌트명 포함하여 명시 |
| 8 | Documentation | `getExpressionToken` `k=0` 이스케이프 동작 미문서화 | `use-expression-suggestions.ts:57–59` | 인라인 주석 추가 |
| 9 | Documentation | `INFO_EXTRACTOR_TYPE_MAP` 목적 불명확 | `use-expression-context.ts:54–61` | 한 줄 주석으로 의도 명시 |
| 10 | Documentation | `dropStaleEdges` 빈 Set 패턴과 `size > 0` 필터 조건 연결 설명 없음 | `edge-utils.ts:108–113` | 필터 직전 주석 추가 |
| 11 | Documentation | 새 공개 API에 대한 `spec/`, `/docs` 미갱신 | `spec/`, `frontend/docs/` | CLAUDE.md 가이드라인 준수하여 갱신 |
| 12 | Documentation | `informationExtractorNodeOutputSchema` JSDoc이 실제 스키마 구조와 불일치 | `information-extractor.schema.ts` | 주석 수정 |
| 13 | Security | `console.warn`으로 내부 워크플로 구조 노출 | `editor-loader.tsx:68–71` | 프로덕션 빌드에서 제거 또는 로그 레벨 제어 |
| 14 | Testing | `WorkflowEditorLoader` dropStaleEdges 통합 미검증 | `editor-loader.tsx:52–76` | 통합 테스트 추가 |
| 15 | Performance | `buildNestedSuggestions` 키스트로크마다 Map 신규 할당 | `use-expression-suggestions.ts:108–131` | 현재 규모 허용, 스키마 키 100개+ 시 의존성 세분화 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | CRITICAL 2건: `enrichInfoExtractorOutputSchema`, `getSchemaKeys`/`resolveSchemaNode` 단위 테스트 누락 |
| architecture | MEDIUM | IE 특수 처리 OCP 위반, outputSchema 검증 부재, dropStaleEdges 서버 미동기화 |
| side_effect | MEDIUM | dropStaleEdges 묵시적 데이터 삭제, insertText 변경으로 소비자 회귀 위험 |
| security | LOW | `.passthrough()` 과도 사용, 사용자 필드명 키 주입, 파서 경계 조건 버그 |
| performance | LOW | JSON.parse/stringify 반복, nodes.find() 선형 탐색 |
| requirement | LOW | wildcard 모호성, silent fail, 경계 인덱스 미검증 |
| maintainability | LOW | IE enricher 범용 훅 하드코딩, wildcard 패턴 인지 비용 |
| dependency | LOW | 빈 포트 노드 검증 우회 논리, JSON 딥클론 |
| api_contract | LOW | ai_agent vs information_extractor 구조 불일치 |
| documentation | LOW | 출력 형태 비대칭 미설명, spec/docs 미갱신 |
| concurrency | LOW | Promise.all 의도 불명확 |
| scope | LOW | dropStaleEdges 관심사 혼재(기술적으로 무해) |
| database | NONE | 해당 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| database | 변경사항에 데이터베이스 관련 코드 없음 |

---

## 권장 조치사항

1. **[CRITICAL]** `enrichInfoExtractorOutputSchema` 및 `getSchemaKeys`/`resolveSchemaNode` 직접 단위 테스트 작성
2. **[WARNING]** `getExpressionToken` 경계 조건 버그 수정: `i > 0 && between[i - 1] !== "\\"`
3. **[WARNING]** `handleSelect`의 `isExpandable` 처리 여부 확인 및 미구현 시 추가
4. **[WARNING]** `dropStaleEdges` 실행 시 토스트/배너로 사용자에게 삭제 사실 알림
5. **[WARNING]** 사용자 정의 필드명(`f.name`) 식별자 정규식 검증 추가
6. **[WARNING]** 백엔드 Zod 출력 스키마 `safeParse` 테스트, null handle 케이스 테스트, beforeAll 격리 개선
7. **[WARNING]** `JSON.parse(JSON.stringify())` → `structuredClone()` 또는 얕은 스프레드로 교체
8. **[INFO]** `dropStaleEdges` 빈 Set 패턴을 `null` 반환으로 명확화
9. **[INFO]** `NodeDefinition`에 `enrichOutputSchema?` 추가로 IE 특수 처리 훅 외부 격리 (다음 노드 추가 전)
10. **[INFO]** `spec/` 문서 및 frontend `/docs` 사용자 설명서 갱신