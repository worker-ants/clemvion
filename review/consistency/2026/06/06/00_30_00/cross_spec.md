# Cross-Spec 일관성 검토 — memory-internals-refactor-813b6e

diff 범위: `2b793ffa..HEAD`

---

## 발견사항

### WARNING: `information-extractor.handler.ts` 가 여전히 `ai-agent/ai-agent.schema` 에서 DEFAULT 상수를 직접 임포트
- **target 위치**: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` 라인 32-35
- **충돌 대상**: `codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts` (새로 생성, `DEFAULT_MEMORY_TOP_K` / `DEFAULT_MEMORY_THRESHOLD` / `DEFAULT_MEMORY_TOKEN_BUDGET` 모두 export)
- **상세**: 이번 리팩토링의 명시적 목적 중 하나가 `DEFAULT_MEMORY_TOP_K` / `DEFAULT_MEMORY_THRESHOLD` 의 SoT 를 `shared/agent-memory-schema.ts` 로 이전하는 것이다. 스키마 파일(`information-extractor.schema.ts`)은 이미 `buildAgentMemorySchemaFields` 를 `shared/agent-memory-schema.ts` 에서 임포트하도록 완전히 이전됐다. 그러나 핸들러(`information-extractor.handler.ts` 라인 33-35)는 아직 `../ai-agent/ai-agent.schema` 에서 `DEFAULT_MEMORY_TOP_K`, `DEFAULT_MEMORY_THRESHOLD` 를 가져오고 있다. `ai-agent.schema.ts` 쪽은 이 두 상수를 이제 `shared/agent-memory-schema.ts` 에서 re-export 하는 구조(하위호환 re-export)이므로 런타임에 값 불일치는 없다. 하지만 "공유 유틸 추출"이라는 이번 PR 의도와 어긋나고, 향후 `ai-agent.schema.ts` 의 re-export 를 제거할 경우 IE 핸들러가 조용히 깨진다. spec 본문에서는 두 spec 모두 `shared/agent-memory-schema.ts` 를 `code:` 에 명시했는데, 핸들러 임포트는 여전히 `ai-agent/ai-agent.schema` 경유라서 spec frontmatter 의도와 어긋난다.
- **제안**: `information-extractor.handler.ts` 의 `DEFAULT_MEMORY_TOP_K`/`DEFAULT_MEMORY_THRESHOLD` 임포트를 `../ai-agent/ai-agent.schema` 에서 `../shared/agent-memory-schema` 로 변경.

---

### INFO: `spec/5-system/17-agent-memory.md` `code:` frontmatter 에 shared 파일 미등록
- **target 위치**: `spec/5-system/17-agent-memory.md` frontmatter `code:` 섹션 (라인 4-5: `codebase/backend/src/modules/agent-memory/**` 만 기재)
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/3-information-extractor.md` — 두 노드 spec 모두 `shared/agent-memory-injection.ts` · `shared/agent-memory-schema.ts` 를 `code:` 에 포함
- **상세**: `shared/agent-memory-injection.ts` 는 `scheduleMemoryExtraction` 함수를 포함하며, 파일 헤더 주석에 `SoT: spec/5-system/17-agent-memory.md §3, §6.1 단계 2.7` 라고 명시돼 있다. 즉 이 파일은 `17-agent-memory.md` 의 추출 파이프라인 명세를 직접 구현하는 핵심 코드인데, `17-agent-memory.md` 의 `code:` 에는 포함되지 않았다. `spec-coverage` 도구가 17-agent-memory spec 의 coverage 를 점검할 때 이 파일을 스캔 대상에서 누락할 수 있다.
- **제안**: `17-agent-memory.md` 의 `code:` 에 `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` 와 `codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts` 를 추가. (혹은 `codebase/backend/src/nodes/ai/shared/agent-memory-*.ts` glob 으로 통합)

---

### INFO: spec 본문은 무변경 — 동작 변경 없음 확인
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §1 / `spec/4-nodes/3-ai/3-information-extractor.md` §1·§7
- **충돌 대상**: 없음
- **상세**: diff 에서 두 spec 파일의 변경은 frontmatter `code:` 목록 추가(+2줄씩)뿐이고 본문(요구사항·동작·필드 기술·상태 전이)은 전혀 변경되지 않았다. `buildAgentMemorySchemaFields` 결과 필드(label / hint / default / visibleWhen)가 인라인 정의와 100% 동치임은 코드 diff 에서 확인 가능하다. `scheduleMemoryExtraction` 공유 함수의 watermark·M1·snapshot 로직도 두 핸들러의 원래 private 메서드와 byte-identical 이다. spec 본문과 구현 간 의미 충돌 없음.

---

## 요약

이번 PR 은 `agent-memory-injection.ts` · `agent-memory-schema.ts` 를 `ai-agent/` 에서 `shared/` 로 이동하는 순수 내부 리팩토링이다. spec 본문(요구사항·동작)은 변경이 없고, 두 노드 spec 의 frontmatter `code:` 경로가 실제 이동된 파일 위치와 정합하여 spec-code-paths 관점에서 주요 누락은 없다. 단 WARNING 1건: `information-extractor.handler.ts` 가 `DEFAULT_MEMORY_TOP_K`/`DEFAULT_MEMORY_THRESHOLD` 를 여전히 `ai-agent/ai-agent.schema` 경로에서 임포트하고 있어 shared 추출의 완결성이 불완전하다. 런타임 값은 동일(re-export 경유)하므로 즉각 파손 없이 작동하나, `ai-agent.schema.ts` re-export 제거 시 깨지는 잠재 부채다. INFO 1건: `17-agent-memory.md` frontmatter 에 shared 파일 미등록으로 spec-coverage 스캔 범위 누락 가능성이 있다.

## 위험도

LOW

BLOCK: NO
