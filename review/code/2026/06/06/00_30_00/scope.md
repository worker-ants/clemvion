# Scope Review — memory-internals-refactor-813b6e

**기준**: `git diff 2b793ffa..HEAD` (5 커밋)
**범위 의도**: agent-memory 공유 유틸 추출 (순수 리팩토링, 동작 불변)

---

## CRITICAL

없음.

---

## WARNING

### [WARNING-1] `estimateTokensLanguageAware` — A4 lite 기능 신규 추가 (범위 초과)

- **위치**: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` L44–111
- **상세**: 이전(move/extract)인 `agent-memory-injection.ts` 안에 기존 원본에 없던 새 함수 군 (`isCjkCodePoint`, `isLatinCodePoint`, `estimateTokensLanguageAware`)이 포함됐다. 커밋 메시지("동작 불변")와 달리, `estimateTextTokens`의 구현이 종전 `char/3` 단일 상수 방식에서 CJK/Latin/Other 3종 가중치 방식(A4 lite)으로 **실질 변경**되었다. 이는 spec plan `ai-context-memory-followup-v2.md`의 "A4 lite" 완료 항목과 대응하며, plan 파일도 이 PR에서 "A4 lite 완료" 로 체크됐다.
- **영향**: 토큰 예산 추정 결과값이 변경된다. 한국어가 포함된 워크스페이스에서 `summary_buffer` / `persistent` 전략의 롤링 요약 트리거 시점이 이전과 달라진다 (한국어 chunk는 더 많은 토큰으로 추정, 영어 chunk는 더 적은 토큰으로 추정). 동작 불변이 아니다.
- **제안**: 이 변경은 A4 lite 독립 커밋으로 분리해 "동작 불변" 선언 커밋들과 구분해야 했다. 이미 plan에서 완료 처리했으므로, 최소한 커밋 메시지의 "동작 불변" 선언을 해당 커밋에서 제거하거나, 별도 `feat:` 커밋으로 squash-split해야 한다. 기능 자체에 문제는 없으나 범위 라벨이 부정확하다.

### [WARNING-2] `wrapMemoryContent` + `DATA_FENCE_GUIDE` 신규 추가

- **위치**: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` L163–193
- **상세**: `wrapMemoryContent`와 `DATA_FENCE_GUIDE` (indirect prompt injection 방어 — W-2) 가 종전 `ai-agent/agent-memory-injection.ts`에 있었다면 이전이지만, git rename 유사도(R074 — 74%)이므로 상당량의 코드가 신규 추가됐을 가능성이 있다. 실제로 shared 파일은 672줄인 반면 원본에서 이전된 기능(estimate/summary/recall 블록)에 더해 `AgentMemoryScheduler`, `ConversationThreadReader` 인터페이스, `scheduleMemoryExtraction` 공유 함수가 모두 신규 추가됐다. W-2 방어 문구 자체는 이전 원본에서도 주석으로 존재했으나 `wrapMemoryContent` 함수의 구현이 신규인지 확인 필요. 추출 범위에 포함해 설명했지만 커밋은 "이전"으로만 서술했다.
- **영향**: 낮음 — 방어적 기능 추가이므로 보안 측면에서 유리하나, 범위 기술("동작 불변") 과 불일치.
- **제안**: 커밋 메시지에서 실질 추가 항목 명시 또는 별도 커밋 분리.

---

## INFO

### [INFO-1] `ai-agent.schema.ts` order 주석 변경: `44-48` → `44-49.7`

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` 주석 라인
- **상세**: 종전 주석이 `order 44-48`이었는데 `order 44-49.7`로 수정됐다. 실제 필드 순서(44, 45, 46, 47, 48, 49, 49.5, 49.6, 49.7)는 이미 원본에서도 동일했다 — 원본 주석이 부정확했던 것을 이 리팩토링에서 교정한 것이다. 실행에 영향 없는 주석 정정이며 리팩토링 맥락에서 자연스럽다.

### [INFO-2] `information-extractor.schema.ts` — `DEFAULT_MEMORY_TOP_K / DEFAULT_MEMORY_THRESHOLD` import 경로 변경

- **위치**: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.schema.ts` 상단 import
- **상세**: 종전 `ai-agent/ai-agent.schema.js`에서 import하던 두 상수를 `shared/agent-memory-schema.js`로 바꿨다. `ai-agent.schema.ts`는 shared 상수를 re-export하므로 런타임 값은 동일하다. 범위 내 정리이며 의존 방향이 더 명확해진다.

### [INFO-3] `plan/in-progress/ai-context-memory-followup-v2.md` 체크박스 2개 갱신

- **위치**: `plan/in-progress/ai-context-memory-followup-v2.md`
- **상세**: (a) "provider tokenizer-exact" 항목을 "A4 lite 완료"로 교체, (b) listScopes 인덱스 항목 완료 체크. WARNING-1과 연동 — A4 lite 체크는 이 PR에서 실제 구현됐으므로 체크 자체는 정당하다. listScopes 인덱스 체크는 별도 PR #482 완료를 반영한 것으로 본 리팩토링과 무관하나 doc-only 1행이므로 노이즈 수준.

### [INFO-4] spec frontmatter `code:` glob 갱신

- **위치**: `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/3-information-extractor.md`
- **상세**: 두 파일 모두 `shared/agent-memory-injection.ts`, `shared/agent-memory-schema.ts`를 code glob에 추가했다. 이전된 파일 경로가 변경됐으므로 spec-coverage 추적 정확도를 위해 반드시 필요한 변경이며 이전에 비례한다.

### [INFO-5] `agent-memory-injection.spec.ts` 이동 + A4 lite 테스트 추가

- **위치**: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts`
- **상세**: git rename R099 (spec 파일 99% 유사). `estimateTokensLanguageAware` 관련 테스트 스위트가 신규 추가됐다. WARNING-1의 A4 lite 기능에 대응하는 커버리지이므로 정당하나, 마찬가지로 "동작 불변" 커밋에 포함된 것이 범위 라벨과 불일치한다.

---

## 요약

이 변경의 주된 작업(shared/ 디렉토리로의 이전·추출, import 경로 재배선, spec frontmatter 갱신)은 순수 리팩토링 범위 안에 있다. 그러나 `agent-memory-injection.ts` 안에 A4 lite language-aware 토큰 추정(`estimateTokensLanguageAware`, CJK/Latin 가중치) 기능이 "동작 불변" 커밋에 함께 포함됐다 — 이는 토큰 예산 계산 결과를 실제로 바꾸는 기능 변경이며, plan 파일에서도 독립 완료 항목으로 관리되던 것이다. 보안 방어(W-2) 관련 코드도 신규 추가 여부를 커밋 설명이 명시하지 않는다. 실행 오류나 회귀를 유발하는 변경은 없으나, "동작 불변" 선언이 부정확하다는 점에서 커밋 메시지 레벨의 범위 이탈이 존재한다. 프로덕션 블로킹 수준은 아니다.

---

## 위험도

LOW

---

BLOCK: NO
