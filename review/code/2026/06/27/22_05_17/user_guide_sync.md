# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

> 세션 22:05:17 · 대상 커밋 20771c845c (refactor(agent-memory): saveMemories 계약 가드 W-1)

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` 19개 행 적재 완료. 보조 PROJECT.md 는 JSON SSOT 로 대체.

## 변경 파일 목록

| 파일 | 분류 |
|---|---|
| `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` | 백엔드 서비스 구현 |
| `codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts` | 테스트 |
| `codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts` | 테스트 (nodes/ 하위 위치) |
| `plan/in-progress/ai-context-memory-followup-v2.md` | 계획 문서 |
| `review/code/2026/06/27/21_40_18/*` (RESOLUTION, SUMMARY, _retry_state, 각 reviewer.md) | 리뷰 산출물 |
| `review/consistency/2026/06/27/21_39_37/*` | 일관성 검토 산출물 |

## trigger 매칭 분석

### 1. `codebase/backend/src/modules/agent-memory/agent-memory.service.ts`

- **"new-node"** (glob: `codebase/backend/src/nodes/**`): 경로 **불일치** (modules/ 하위, nodes/ 아님).
- **"node-schema-change"** (glob: `codebase/backend/src/nodes/**`): 동일, 경로 불일치.
- **"new-warning-code"** (semantic): 변경 내용은 `typeof args !== 'object' → throw` 런타임 가드 추가. 새로운 warningCode 또는 warning rule 발행 없음.
- **"new-error-code"** (glob: `codebase/backend/src/nodes/core/error-codes.ts`): 해당 파일 미변경.
- **"new-backend-ui-zod-value"** (semantic): zod ui.label/hint/group 값 변경 없음.
- **"backend-api-change"** (semantic): controller/DTO 미변경. 내부 서비스 메서드의 방어 가드 추가이며 공개 API 시그니처 변화 없음.
- 나머지 semantic trigger (auth-session-flow-change, expression-language-change, run-debug-flow-change 등): 해당 없음.

**판정: 매트릭스 trigger 매칭 없음.**

### 2. `codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts`

- **"new-node"** / **"node-schema-change"** (glob: `codebase/backend/src/nodes/**`): 경로 패턴은 매칭되나, 파일은 `.spec.ts` 테스트 파일이며 변경 내용은 `readExtractionWatermark` 의 기존 엣지 케이스(primitive memoryState 폴백)에 대한 테스트 추가 1건에 불과함. 신규 노드 생성도, 노드 필드·라벨·타입 변경도 없음. glob 경로가 일치하더라도 실제 변경 의미가 "새 노드 추가" 또는 "노드 schema 변경" 에 해당하지 않으므로 의미적으로 매칭되지 않음.

**판정: 경로 glob 형식 매칭이나 의미 미매칭 — 동반 갱신 불필요.**

### 3. 나머지 변경 파일 (plan/, review/)

- plan 문서 및 review 산출물은 어떤 trigger glob 에도 해당하지 않음.

**판정: 전체 매칭 없음.**

## 발견사항

해당 없음. 변경 파일 중 어떤 것도 doc-sync-matrix 의 19개 trigger 에 의미적으로 매칭되지 않음.

참고: 이전 SUMMARY.md 에서도 "user_guide_sync = 출력 미착지(무관 — user-guide 변경 0)" 로 예고되어 있으며, 이번 분석과 일치함.

## 요약

doc-sync-matrix 19개 trigger 전체 검토. 변경 코드 중 glob 경로 패턴이 형식적으로 일치하는 파일은 `codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts` 1건이나, 실제 변경 내용은 기존 헬퍼 함수의 엣지 케이스 테스트 추가이므로 "새 노드 추가" / "노드 schema 변경" 에 해당하지 않음. 나머지 변경 파일(백엔드 서비스 런타임 가드, 계획·리뷰 산출물)도 어떤 trigger 에도 매칭되지 않음. 매칭 0건 / 누락 0건.

## 위험도

NONE
