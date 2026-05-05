# RESOLUTION — F-1 (text-classifier stable id) ai-review 조치

대상 변경: F-1 구현 4커밋 (`ee98449..1d7ce03` + 본 조치 commit) — text-classifier categoryDefSchema.id 도입 + system-prompt/spec 그룹핑 버그 수정.

원본 리뷰: `review/2026-05-05_15-23-14/SUMMARY.md`

전체 위험도(원본): **MEDIUM** — Critical 0 / Warning 7 / Info 15. 본 조치로 Warning 7건 전부 + 핵심 Info 6건 해소.

---

## Warning 조치 (7/7 완료)

| # | 카테고리 | 원본 발견사항 | 조치 | 위치 |
|---|---|---|---|---|
| W-1 | Testing | `resolve-dynamic-ports.spec.ts` 가 classifier `id` 기반 포트 발급을 회귀 테스트로 보호하지 않음 | `classifier-categories` describe 에 2건 추가 — custom id 라우팅 / id 누락·invalid slug fallback | `resolve-dynamic-ports.spec.ts:323-359` |
| W-2 | Testing | JSON 파싱 실패(text fallback) 경로 + 커스텀 id 조합 미커버 | single-label / multi-label 각각 신규 테스트 추가 — substring fallback 도 custom id 로 라우팅 | `text-classifier.handler.spec.ts:522-543, 729-750` |
| W-3 | Consistency | resolver ↔ handler `c.id.trim()` 불일치 (resolver 가 trim 안 함) | 공유 helper `resolveStablePortId` 도입해 handler·resolver 모두 동일 로직. switchPorts·aiAgentConditionalPorts 까지 통일. | `nodes/core/port-id.util.ts` (신규), `text-classifier.handler.ts:buildCategoryPortIds`, `resolve-dynamic-ports.ts:switchPorts/classifierCategoriesPorts/aiAgentConditionalPorts` |
| W-4 | Correctness | `category.id` 중복 시 resolver dedupe ↔ handler findIndex 어긋남 (silent 오분류) | `validateTextClassifierConfig` 에 `Set` 기반 중복 검사 + 한글 에러 메시지 + 테스트 2건 (중복 거부 / whitespace-only id 는 fallback 처리되므로 충돌 없음) | `text-classifier.schema.ts:139-167`, `text-classifier.schema.spec.ts` 신규 it 2건 |
| W-5 | API Contract | 기존 `class_${i}` 엣지가 연결된 카테고리에 `id` 추가 시 silent breaking change | `spec/4-nodes/3-ai-nodes.md` CategoryDef 표 아래 마이그레이션 주의 박스 추가. 시나리오·복구 절차 명시 | `spec/4-nodes/3-ai-nodes.md:496-510` |
| W-6 | Security | 포트 id 생성 지점에서 schema 우회 입력에 대한 포맷 재검증 부재 (defense-in-depth) | `resolveStablePortId` 가 `PORT_ID_SLUG_REGEX = /^[a-zA-Z0-9_-]{1,64}$/` 으로 인라인 검증. invalid slug 는 fallback 으로 떨어짐. 테스트 추가. | `port-id.util.ts:16,28-34`, `resolve-dynamic-ports.spec.ts:344-358` |
| W-7 | Architecture | 3중 포트 id 결정 로직 복제 (backend handler + backend resolver + frontend resolver) | backend 2 곳은 `port-id.util.ts` 헬퍼 공유로 1 곳화. frontend resolver 는 backend 와의 cross-package 의존을 피하기 위해 인라인 동등 헬퍼(`resolveStableSlugId`) 를 frontend 파일 안에 정의해 lockstep 유지. 두 파일에 "lockstep" 명시 주석 추가. | `port-id.util.ts`, `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts:18-30` |

---

## Info 조치 (6 처리, 9 deferred)

처리:

| # | 카테고리 | 조치 | 위치 |
|---|---|---|---|
| I-4 | Maintainability | `buildCategoryPortIds` JSDoc "Mirrors" 표현을 "Applies the same fallback rule as resolveStablePortId"로 완화 | `text-classifier.handler.ts:24-29` |
| I-5 | Documentation | `spec §8` 모호 참조 → `spec/3-workflow-editor/4-ai-assistant.md §8` 명시 + `port-id.util.ts` 위치 안내 | `text-classifier.schema.ts:8-14` |
| I-6 | Documentation | `categoryDefSchema` JSDoc 추가 — id 의 schema/UI/router 역할 명문화 | `text-classifier.schema.ts:8-14` |
| I-7 | Documentation | CategoryDef 표 id 행에 "설정 UI 에 노출되지 않으며 (hidden) AI Assistant 가 자동 지정", 중복 금지 명시 | `spec/4-nodes/3-ai-nodes.md` CategoryDef id 행 |
| I-8 | Documentation | 테스트 제목 `'class_${i}'` (single-quote 안의 보간 안 됨) → `'class_N (index-based)'` | `text-classifier.handler.spec.ts:498,507`, `text-classifier.schema.spec.ts:32` |
| I-12 | Testing | 빈 문자열 `id` 거부 케이스 추가 | `text-classifier.schema.spec.ts` 신규 it |

Deferred (본 작업 범위 외 / 기존 코드 / 별도 audit 적합):

- I-1 (Scope, name/description default 부수 변경): 본 PR 의 일관성 보강 사유로 의도적 포함. 별도 분리하면 schema 변경이 두 commit 에 걸쳐 일관성 깨짐. 유지.
- I-2 (`aiAgentConditionalPorts` trim 누락 — 기존 코드): W-3/W-7 helper 도입 시 함께 통일됨. 추가 조치 불필요.
- I-3 (`PORT_ID_SLUG_REGEX` 공유 상수): backend 는 `port-id.util.ts` 에 단일 export. frontend 도 동일 상수명으로 정의. 두 코드베이스 간 패키지 분리는 별도 follow-up (review 권장 사항도 즉시 합쳐야 한다고 보지 않음).
- I-9 (system-prompt information_extractor 단락 가독성): 기존 표 레이아웃의 cell 길이 문제로 단순 분리 어렵고, sub-entry id 그룹과 함께 묶이는 게 의미상 자연스러움. 향후 system-prompt 리팩터링 시 함께 정리.
- I-10 (`config.passthrough()` 사유 주석): 기존 코드. F-1 범위 외.
- I-11 (`originalInput` PII 노출 — 기존 코드): F-1 범위 외, 별도 보안 audit 필요.
- I-13 (단일 레이블 custom id 테스트 mock 의존성): 기존 패턴과 일관 — beforeEach 가 default mock 을 설정하는 jest 표준. 별도 수정 불필요.
- I-14 (`buildCategoryPortIds` 내부 trim 이중 호출): helper 추출로 자연스럽게 해소 (resolveStablePortId 내부 1회 trim).
- I-15 (fallback 경로 buildCategoryPortIds 전체 순회): 영향도 극미 (카테고리 수 ≤ 수십). 가독성 우선 유지.

---

## 새로 추가된 파일 / 변경 요약

**신규**:
- `backend/src/nodes/core/port-id.util.ts` — `resolveStablePortId` + `PORT_ID_SLUG_REGEX`. text-classifier·switch·ai-agent resolver/handler 가 공통 사용.

**변경**:
- `backend/src/modules/workflow-assistant/tools/resolve-dynamic-ports.ts` — 3 함수 (switchPorts, classifierCategoriesPorts, aiAgentConditionalPorts) 공유 helper 사용
- `backend/src/modules/workflow-assistant/tools/resolve-dynamic-ports.spec.ts` — classifier custom id / invalid id 테스트 추가
- `backend/src/nodes/ai/text-classifier/text-classifier.handler.ts` — buildCategoryPortIds 가 helper 호출
- `backend/src/nodes/ai/text-classifier/text-classifier.handler.spec.ts` — text-fallback + custom id (single-label, multi-label) 추가
- `backend/src/nodes/ai/text-classifier/text-classifier.schema.ts` — categoryDefSchema JSDoc, validateTextClassifierConfig 중복 id 검사
- `backend/src/nodes/ai/text-classifier/text-classifier.schema.spec.ts` — 중복 id / 빈 문자열 / whitespace fallback 테스트 + 제목 수정
- `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` — `resolveStableSlugId` 인라인 helper, classifier·switch·ai-agent 적용
- `frontend/src/lib/node-definitions/__tests__/resolve-dynamic-ports.test.ts` — classifier custom id 테스트 2건 추가
- `spec/4-nodes/3-ai-nodes.md` — CategoryDef 표 id 행 보강 + 마이그레이션 주의 박스

---

## 재검증

- backend: lint 통과, 164 suites / 2622 tests 통과, build 성공
- frontend: lint 통과, 102 suites / 1154 tests 통과, build 성공
