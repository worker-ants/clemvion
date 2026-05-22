# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 핵심 기능 구현은 spec 과 정확히 일치하며 보안 취약점 없음. 그러나 테스트 커버리지에 복수의 WARNING 이 존재해 향후 유사 operation 추가 시 회귀 위험이 있음.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | 테스트 | `buildToolDescription` / `constraintToSuffixLine` 에 대한 직접 단위 테스트 없음. 두 함수는 `export` 공개 API 이며 3가지 `kind` 별 출력 포맷을 생성하나, `allOrNone`·`implies` suffix 는 간접 경로로도 검증되지 않음 | `cafe24-mcp-tool-provider.spec.ts` | `describe('constraintToSuffixLine')`, `describe('buildToolDescription')` 블록 추가해 kind 별 포맷·섹션 순서 직접 검증 |
| W-2 | 테스트 | `cafe24.handler.spec.ts` 에 `allOrNone` / `implies` 핸들러 경로 테스트 없음. plan §3 "3종 kind × 위반/만족 6케이스" 대비 `oneOf` 2건만 구현됨 | `cafe24.handler.spec.ts` | `allOrNone` 위반(since 제공·until 누락) 및 `implies` 위반 케이스 각 1건 추가 |
| W-3 | 테스트 | MCP execute 경로에서 `allOrNone` / `implies` constraint 위반 시 `CAFE24_MISSING_FIELDS` 반환 검증 없음 | `cafe24-mcp-tool-provider.spec.ts` — `execute` describe 블록 | fake operation stub 으로 `allOrNone` 위반 케이스 1건 추가 |
| W-4 | 테스트 | `buildJsonSchema` 에서 `requiredFields=[]` + `oneOf` 조합 브랜치(→ `allOf: [anyOfClause]` 만 구성)가 미커버 | `cafe24-mcp-tool-provider.ts` `buildJsonSchema()` 라인 ~690–693 | `requiredFields: []` + `oneOf` 조합의 schema 를 검증하는 테스트 케이스 추가 |
| W-5 | 유지보수성 | 테스트 파일 내 context literal 이 신규 테스트 2곳에 직접 인라인 중복 | `cafe24-mcp-tool-provider.spec.ts` | `const DEFAULT_EXEC_CTX = { ... }` 상수로 추출 또는 기존 테스트 유틸 활용 |
| W-6 | 문서화 | `spec/conventions/cafe24-api-metadata.md §9 CHANGELOG` 항목(2026-05-22) 존재 확인 필요 (리뷰 페이로드 미포함) | `spec/conventions/cafe24-api-metadata.md §9` | PR merge 전 확인. *현 시점 점검 결과: 2026-05-22 row 가 §9 에 존재 — false alarm* |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | 유지보수성 | `constraintToSuffixLine` / `checkOne` `implies` fall-through. exhaustive check 부재 | `cafe24-mcp-tool-provider.ts`, `constraint-validator.ts` | `else if (c.kind === 'implies')` + `c satisfies never` 또는 throw 추가 |
| I-2 | 유지보수성 | `'CAFE24_MISSING_FIELDS'` 문자열 리터럴 중복 | `cafe24.handler.ts`, `cafe24-mcp-tool-provider.ts` | 공유 상수로 추출 |
| I-3 | 범위 | spec 파일 변경 역할 분리 확인 | `spec/conventions/cafe24-api-metadata.md` | Phase A 잔여 vs Phase B 직접 수정 확인. *실제로 Phase A 마지막 커밋 (`370cc9fd`) 이 impl-prep findings 수정분 — 정상 흐름 (project-planner 역할 위임 없이 main Claude 가 한 권한 — 의도된 위임 통합 처리)* |
| I-4 | 요구사항 | spec §7 pseudo-code vs 실제 구현의 미세 표현 차이 | `spec/conventions/cafe24-api-metadata.md §7` | §7 은 §2 SoT 의 derivative 라고 이미 명시 — 별 처리 불요 |
| I-5 | 요구사항 | `constraint-validator.ts` JSDoc 의 `§6 step 8` 참조가 step 5 와 불일치 | `constraint-validator.ts` JSDoc | `§6 step 5` 로 수정 |
| I-6 | 보안 | `integrationName` 비검증 삽입 — 기존 패턴과 동일, 신규 도입 아님 | `cafe24-mcp-tool-provider.ts buildToolDescription` | 신규 변경 아니므로 본 PR scope 외 |
| I-7 | 보안 | constraint 위반 메시지 중복 노출 | `cafe24-mcp-tool-provider.ts` | 기존 패턴 — `error`/`content` 이중 노출은 다른 에러 경로와 동일 |
| I-8 | 보안 | `isAbsent` falsy 처리 범위 TSDoc 미명시 | `constraint-validator.ts` | "숫자 0·false·빈 배열은 present" 문구 추가 |
| I-9 | 테스트 | handler success 경로의 `apiClient.call` 호출 확인 부재 | `cafe24.handler.spec.ts` | `expect(apiClient.call).toHaveBeenCalled()` 추가 |
| I-10 | 테스트 | `isAbsent` 의 `0`·`false` 테스트 부재 | `constraint-validator.spec.ts` | falsy 케이스 추가 |
| I-11 | 테스트 | constraints 필드 중복 검사 부재 | `metadata.spec.ts` | optional |
| I-12 | 문서화 | `checkOne` 함수 JSDoc 부재 | `constraint-validator.ts` | 2-3줄 JSDoc 추가 |
| I-13 | 문서화 | handler/MCP 에러 메시지 포맷 차이 미기재 | `cafe24.handler.ts` 2b 블록 | 한 줄 주석 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | WARNING 4 — allOrNone/implies 미커버, 공개 헬퍼 직접 단위 테스트 부재, requiredFields=[]+oneOf 브랜치 |
| security | LOW | 5건 모두 INFO |
| requirement | LOW | INFO 4건 |
| scope | LOW | INFO 3건 |
| side_effect | LOW | INFO 5건 |
| maintainability | LOW | WARNING 1, 나머지 INFO |
| documentation | LOW | WARNING 1, 나머지 INFO |

---

## 권장 조치사항

1. **(최우선)** handler + MCP provider 에 `allOrNone` / `implies` 테스트 케이스 추가 (W-1, W-2, W-3)
2. **(권장)** `constraintToSuffixLine` / `buildToolDescription` 직접 단위 테스트 추가
3. **(권장)** `buildJsonSchema` `requiredFields=[]` + `oneOf` 브랜치 테스트
4. **(권장)** `'CAFE24_MISSING_FIELDS'` 상수 추출 (I-2), JSDoc step 번호 수정 (I-5), `checkOne` JSDoc + `isAbsent` falsy 정책 명시 (I-8, I-12)

---

## 라우터 결정

`routing_status=done`:
- **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명, 전원 router_safety 강제 포함)
- **스킵**: performance, architecture, dependency, database, concurrency, api_contract, user_guide_sync (7명, 각각 사유 명시)
