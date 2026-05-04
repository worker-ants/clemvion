파일 쓰기 권한이 없어 여기에 직접 출력합니다.

---

# Code Review 통합 보고서

## 전체 위험도
**LOW** — 버그 수정 자체는 정확하고 안전하며, 발견된 모든 이슈는 주석 품질·테스트 커버리지·문서화 수준의 보완 사항에 국한됨

## Critical 발견사항
없음

## 경고 (WARNING)
없음

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 주석 규약 위반 (Scope + Maintainability) | 소스·테스트 양쪽에 멀티라인 주석 블록 존재. CLAUDE.md "one short line max" 규약 위반 | `llm-call-trace.ts:100-103`, `llm-call-trace.test.ts:124-128` | 1줄로 압축. 예: `// tool loop: same turn can produce multiple assistant items → track index per turn` |
| 2 | 주석 내 예시 오류 (Documentation + Requirement) | `fromConversationMessages` 주석의 레이블 예시가 `"호출 1/N · 2/N"` 형태이나 실제 출력은 `"Turn 1 · 호출 1/2"`. 테스트 주석도 `/` 구분자 사용 | `llm-call-trace.ts:103`, `llm-call-trace.test.ts:124-127` | 실제 출력 포맷(`"Turn 1 · 호출 1/2"`, `"Turn 1 · 호출 2/2"`)으로 교정 |
| 3 | JSDoc 미갱신 (Documentation) | `callIndexInTurn` JSDoc이 fallback 경로 보장을 미기재. `extractLlmCalls` JSDoc이 동일 턴 복수 호출 동작을 미언급 | `llm-call-trace.ts:14`, `55-62` | 각 JSDoc에 tool loop 동작 보장 내용 추가 |
| 4 | callIndexInTurn 소비자 영향 (Side Effect) | fallback 경로에서 `callIndexInTurn === 0`을 가정하던 소비자가 있을 경우 영향 받음 (의도적 수정이나 하위 호환 확인 필요) | `llm-call-trace.ts:108-114` | `LlmCallTrace` 소비 UI 컴포넌트에서 `callIndexInTurn === 0` 하드코딩 가정 grep 확인 |
| 5 | 보안: 페이로드 무검증 (Security) | `requestPayload`/`responsePayload`가 `unknown` 타입으로 구조 검증 없이 통과. 렌더링 레이어 XSS 가능성 | `llm-call-trace.ts:111-118` | 소비 측 컴포넌트가 텍스트 노드로만 출력하는지 확인 |
| 6 | 보안: LLM 원시 데이터 노출 (Security) | LLM 요청/응답 원문(시스템 프롬프트·API 키 포함 가능)이 UI에 노출. 인증 미적용 시 위험 | 전체 파일 | 이 탭이 인증된 내부/개발자 모드에서만 접근 가능한지 상위 컴포넌트 레벨 점검 |
| 7 | 보안: 타입 단언으로 런타임 검증 생략 (Security) | `as RawTurnDebugEntry[]`, `as RawFlatCall[]` 등이 런타임 형태를 보장하지 않음 | `llm-call-trace.ts:72-80` | 외부 입력 경로라면 Zod 등 런타임 스키마 검증 도입 검토 |
| 8 | 테스트: 3+ 호출 tool loop 미커버 (Testing) | 추가된 테스트가 2-call tool loop만 검증. N≥3 케이스 미검증 | `llm-call-trace.test.ts` | `assistant × 3` 픽스처 추가해 `callIndexInTurn: 0, 1, 2` 검증 |
| 9 | 테스트: null 페이로드 인터리빙 미커버 (Testing) | null-payload assistant가 tool loop 중간에 끼어들 때 이후 `callIndexInTurn` 연속성 미검증 | `llm-call-trace.ts:106-108` | null-payload → valid → valid 순서 픽스처로 카운터 건너뜀 동작 검증 |
| 10 | 테스트: 복수 턴 × 복수 호출 조합 미커버 (Testing) | 턴별 카운터 독립 초기화 여부 미검증 | fallback 경로 전체 | turnIndex 1→2호출, turnIndex 2→1호출 픽스처 추가 |
| 11 | 테스트: durationMs 미검증 (Requirement) | 기존 fallback 테스트는 `durationMs: 42` 검증하나 새 테스트는 생략 | `llm-call-trace.test.ts` 신규 테스트 | `toMatchObject({ ..., durationMs: 30 })` 형태로 보완 |
| 12 | 아키텍처: 암묵적 순서 의존성 (Architecture) | `callIndexByTurn` Map이 메시지 배열의 시간 순 정렬을 가정하나 코드에 미명시 | `fromConversationMessages` 전체 | `// messages must be ordered chronologically within each turn` 주석 추가 |
| 13 | 아키텍처: fallback 경로 데드코드화 위험 (Architecture) | 백엔드가 trace 포함 시 `fallbackMessages` 분기가 잔존할 위험 | `extractLlmCalls` JSDoc | 현재는 허용. 백엔드 trace 포함 시점에 분기 제거 필요 TODO 마킹 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | LOW | requestPayload/responsePayload 무검증, LLM 원시 데이터 노출, 타입 단언 런타임 검증 생략 |
| Documentation | LOW | 주석 레이블 예시 오류, JSDoc tool loop 동작 미반영 |
| Side Effect | LOW | fallback callIndexInTurn 값 변경 — 소비자 영향 확인 필요 |
| Maintainability | LOW | 멀티라인 주석 블록 2건 (CLAUDE.md 규약 위반) |
| Testing | LOW | 3+ 호출 루프, null-payload 인터리빙, 복수 턴×복수 호출 케이스 미커버 |
| Requirement | LOW | 주석 예시 오류, durationMs 검증 누락 |
| Performance | NONE | O(n) 알고리즘 유지, Map 비용 무시할 수준 |
| Architecture | NONE | 순서 의존성·fallback 경로 장기 관리 사항 (즉시 수정 불필요) |
| Scope | NONE | 변경 범위 의도에 정확히 부합 |
| Dependency | NONE | 신규 외부 의존성 없음 |
| Concurrency | NONE | 순수 동기 함수, 공유 상태 없음 |
| Database | NONE | DB 접점 없음 |
| API Contract | NONE | 외부 API 계약과 무관한 내부 유틸리티 |

## 발견 없는 에이전트
API Contract, Concurrency, Database, Dependency, Performance

## 권장 조치사항
1. **(즉시)** 멀티라인 주석 블록 1줄로 압축 — CLAUDE.md 규약 위반 (`llm-call-trace.ts:100-103`, `llm-call-trace.test.ts:124-128`)
2. **(즉시)** 주석 내 레이블 예시를 실제 출력 포맷 `"Turn 1 · 호출 1/2"`으로 교정
3. **(단기)** fallback 경로 소비자에서 `callIndexInTurn === 0` 하드코딩 가정 grep 확인
4. **(단기)** 테스트 보완 — 3+ 호출 루프, null-payload 인터리빙, 복수 턴×복수 호출 케이스, `durationMs` 단언 추가
5. **(단기)** `callIndexInTurn` 및 `extractLlmCalls` JSDoc에 tool loop 동작 보장 내용 추가
6. **(중기)** LLM 원시 데이터 탭의 접근 제어(인증된 사용자/개발자 모드 한정) 확인
7. **(장기)** 백엔드 trace 포함 시점에 `fallbackMessages` 분기 제거