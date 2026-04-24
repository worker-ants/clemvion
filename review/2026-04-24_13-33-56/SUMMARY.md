# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능적 결함 없음. `includeEvidence` 추가는 기존 `includeConfidence` 패턴을 올바르게 확장했으며, 보안·테스트 품질 측면에서 개선 권고 사항이 있음.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `sanitizeEvidence`에 배열 길이·문자열 길이 상한 없음. 조작된 LLM 응답이 수백 개의 긴 문자열을 반환할 경우 응답 페이로드가 무제한 팽창 가능 | `text-classifier.handler.ts` — `sanitizeEvidence` | `.slice(0, 20)`(최대 항목 수), `.map(s => s.slice(0, 200))`(항목당 최대 길이) 적용 |
| 2 | Security | 사용자 원문이 `evidence`로 echo-back됨. PII 포함 입력 분류 시 로그·응답·캐시에 PII 노출 가능 | `buildSingleLabelPrompt` / `buildMultiLabelPrompt` 프롬프트 지시문 | UI/API 문서에 "evidence에는 원문 발췌가 포함될 수 있음" 경고 표기; 서버 로그에 evidence 기록 시 PII 마스킹 적용 |
| 3 | Security | 카테고리 이름·설명이 LLM 프롬프트에 비검증 삽입됨. 개행 문자 포함 페이로드로 프롬프트 인젝션 가능 (기존 취약점, `includeEvidence` 추가로 노출 면적 증가) | `buildSingleLabelPrompt` L178, `buildMultiLabelPrompt` L230 | `validate()`에서 카테고리명의 개행 문자(`\n`, `\r`) 차단 또는 `categoryList` 생성 시 strip/escape 처리 |
| 4 | Architecture | `include*` 불리언 플래그가 모든 private 메서드 시그니처에 낱개로 추가되는 패턴. 세 번째 플래그 추가 시 OCP 위반 누적 | `processSingleLabelResult`, `processMultiLabelResult`, `buildSingleLabelPrompt`, `buildMultiLabelPrompt` | `interface OutputOptions { includeConfidence: boolean; includeEvidence: boolean; }`로 묶어 값 객체로 전달 |
| 5 | Architecture | `responseFields` / `itemFields`를 빈 문자열 삽입 후 `.filter(Boolean)`으로 걸러내는 패턴. 옵션 증가 시 가독성 하락 및 실수 위험 | `buildSingleLabelPrompt` L175-186, `buildMultiLabelPrompt` L226-237 | 명시적 `if (flag) arr.push(...)` 방식으로 전환 |
| 6 | Testing | 테스트 이름 `"should coerce non-string evidence items to strings (defensive)"` 이 실제 동작(`filter`로 드롭)과 불일치. 테스트 내부 주석은 "dropped"로 올바르게 기술 (4개 에이전트 동시 지적) | `text-classifier.handler.spec.ts` — sanitizeEvidence 테스트 | `"should drop non-string evidence items to preserve string[] contract"` 로 수정 |
| 7 | Testing | `includeEvidence: true` + `includeConfidence: false` 조합 미검증. 두 플래그의 독립 동작이 테스트로 보장되지 않음 | `handler.spec.ts` — single-label / multi-label 모든 evidence suite | 두 모드 각각에 `{ ...baseConfig, includeConfidence: false, includeEvidence: true }` 케이스 추가 |
| 8 | Testing | multi-label + `includeEvidence: true` + 빈 categories 반환(`{"categories": []}`) 시 fallback 포트 동작 미검증 | `handler.spec.ts` — multi-label includeEvidence suite | `'{"categories": []}'` 반환 케이스에서 `port: 'fallback'`, `result.categories: []` 검증 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | `sanitizeEvidence`가 `includeEvidence: false`인 single-label 경로에서도 항상 호출됨 (multi-label은 가드 존재). `undefined` 입력 시 O(1) 반환이므로 성능 영향 없으나 두 경로 간 비일관성 | `processSingleLabelResult` — try 블록 | `if (includeEvidence) { evidence = sanitizeEvidence(parsed.evidence); }` 로 조건 처리 또는 현 상태 유지 |
| 2 | Maintainability | 조건부 spread `...(flag ? { key: val } : {})` 패턴이 5곳에 산재. 새 플래그 추가 시 누락 위험 증가 | `processSingleLabelResult` L326-328, `processMultiLabelResult` L376-379, L387-389 | 현재 2개 플래그 수준 허용 범위. 3개 이상 시 `pickIf` 헬퍼 또는 명시적 조립 방식 전환 권장 |
| 3 | Maintainability | catch 블록에서 `evidence = []` 재할당 없이 초기값에 암묵적 의존 | `processSingleLabelResult` catch 블록 | `evidence = [];` 한 줄 명시적 추가로 의도 문서화 |
| 4 | Maintainability | 테스트 픽스처 `usage` 객체가 각 `it` 블록에 인라인 중복 | `handler.spec.ts` — includeEvidence describe 블록들 | `const evidenceUsage = { ... }` 상수로 suite 상단에 추출 |
| 5 | Testing | `textClassifierNodeConfigSchema`의 `includeEvidence` 기본값·파싱 동작 미검증 | `text-classifier.schema.spec.ts` | `includeEvidence` 기본값 `false` 및 boolean 검증 케이스 최소 1개 추가 |
| 6 | Testing | `sanitizeEvidence` 모듈 스코프 함수의 독립 단위 테스트 없음 (핸들러 통합 경로로 간접 커버만 됨) | `text-classifier.handler.ts:421-424` | export 또는 헬퍼 파일 분리 후 순수 단위 테스트 추가 고려 |
| 7 | API Contract / Documentation | `includeConfidence` UI 기본값(`?? true`)이 schema 기본값(`false`) 및 spec 문서(`기본: false`)와 불일치 (기존 문제, 이번 PR에서 spec 명문화로 표면화) | `ai-configs.tsx:65` | `?? false`로 통일하거나 spec에 "UI 기본 체크: true, 스키마 기본값: false" 주석 추가 |
| 8 | Documentation | 어댑터 평탄화 동작(`output.result.*` → `output.*`) 미문서화. 워크플로우 작성자가 올바른 출력 접근 경로 파악 불가 | `text-classifier.schema.ts:94` 주석, spec 예시 | 스키마 JSDoc에 "adapter flattens `output.result.*` into `output.*`" 한 줄 추가 또는 spec에 `$node["X"].output.evidence` 접근 예시 명시 |
| 9 | Documentation | spec 출력 예시에 `includeConfidence: true, includeEvidence: true` 전제 조건 미명시 | `spec/4-nodes/3-ai-nodes.md` — Single/Multi-label 예시 블록 | 예시 블록 앞에 `# config: includeConfidence: true, includeEvidence: true` 주석 추가 |
| 10 | Scope | spec 문서에서 flat 출력 구조를 `result` wrapper 구조로 수정한 것은 `includeEvidence`와 독립적인 기회 수정 (기술적으로 올바른 정합성 보완) | `spec/4-nodes/3-ai-nodes.md` — 출력 예시 JSON | 현상 유지 가능. 커밋 메시지에 "spec output example corrected to reflect result wrapper" 사유 명시 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | LOW | `sanitizeEvidence` 크기 제한 없음, PII echo-back, 프롬프트 인젝션 |
| Architecture | LOW | 파라미터 목록 증식, filter(Boolean) 패턴 취약성 |
| Testing | LOW | 테스트 이름 오류, 플래그 조합·fallback 케이스 미검증 |
| Requirement | LOW | 테스트 이름 불일치, 플래그 조합 미검증 |
| API Contract | LOW | 테스트 이름 불일치, includeConfidence UI/schema 기본값 불일치 |
| Side Effect | LOW | 테스트 이름 불일치 |
| Maintainability | LOW | 조건부 spread 반복, catch 블록 암묵적 의존, sanitizeEvidence 위치 |
| Documentation | LOW | 어댑터 평탄화 미문서화, includeConfidence 기본값 불일치 표면화 |
| Performance | NONE | 마이크로초 수준 연산만, 실질적 성능 영향 없음 |
| Dependency | NONE | 신규 외부 의존성 없음 |
| Scope | NONE | 모든 변경이 기능 범위 내, 기회 수정 1건 수용 가능 |
| Database | NONE | DB 관련 코드 없음 |
| Concurrency | NONE | 가변 공유 상태 없음, 완전한 스레드 안전성 |

---

## 발견 없는 에이전트

**Database**, **Concurrency** — 검토 대상 자체가 해당 없음으로 완전히 클리어.  
**Dependency**, **Performance**, **Scope** — INFO 수준 관찰만 있으며 위험도 NONE 판정.

---

## 권장 조치사항

1. **[즉시]** `sanitizeEvidence` 크기 제한 추가 — `.slice(0, 20)` 및 `.map(s => s.slice(0, 200))` 적용 (Security · WARNING)
2. **[즉시]** 테스트 이름 수정 — `"coerce"` → `"drop"` (4개 에이전트 동시 지적 · WARNING)
3. **[단기]** 미검증 테스트 케이스 추가 — `includeEvidence: true` + `includeConfidence: false` 조합, multi-label + 빈 categories + evidence fallback (Testing · WARNING)
4. **[단기]** PII echo-back 위험 문서화 — UI 및 API 문서에 evidence 원문 포함 경고 표기 (Security · WARNING)
5. **[단기]** 카테고리명 프롬프트 인젝션 방어 — `validate()`에 개행 문자 차단 추가 (Security · WARNING)
6. **[다음 플래그 추가 시점]** `OutputOptions` 값 객체 리팩토링 — boolean 플래그를 단일 DTO로 묶어 메서드 시그니처 안정화 (Architecture · WARNING)
7. **[단기]** `includeConfidence` UI 기본값 불일치 해소 — `?? true` → `?? false` 통일 (API Contract / Documentation · INFO)
8. **[단기]** 어댑터 평탄화 동작 문서화 — 스키마 JSDoc 또는 spec에 `output.result.*` → `output.*` 변환 명시 (Documentation · INFO)
9. **[선택]** `textClassifierNodeConfigSchema` 테스트 추가 — `includeEvidence` 기본값 및 파싱 검증 (Testing · INFO)