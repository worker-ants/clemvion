# Convention Compliance Review — memory-internals-refactor-813b6e

- worktree: `/Volumes/project/private/clemvion/.claude/worktrees/memory-internals-refactor-813b6e`
- diff base: `2b793ffa..HEAD`
- date: 2026-06-06

## CRITICAL

없음.

## WARNING

### [WARNING] IE 핸들러가 공유 상수를 여전히 `ai-agent/ai-agent.schema` 에서 import

- target 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` L33-35
- 위반 규약: 공유 유틸 이전의 단일 진실 원칙 — `agent-memory-schema.ts` 가 `DEFAULT_MEMORY_TOP_K` / `DEFAULT_MEMORY_THRESHOLD` 의 SoT 로 선언됨 (파일 내 주석 "본 헬퍼가 단일 진실이다")
- 상세: 이번 PR 이 `DEFAULT_MEMORY_TOP_K`·`DEFAULT_MEMORY_THRESHOLD`·`DEFAULT_MEMORY_TOKEN_BUDGET` 세 상수를 `shared/agent-memory-schema.ts` 로 이전하고 `ai-agent.schema.ts` 는 re-export 래퍼만 남겼다. `ai-agent.schema.ts` 는 해당 상수를 `SHARED_DEFAULT_*` 에서 포워딩하므로 **런타임 값은 일치**한다. 그러나 IE 핸들러는 `ai-agent/ai-agent.schema` 에서 직접 import 하는 상태로 유지되어, 새 SoT 파일(`shared/agent-memory-schema.ts`)을 직접 참조하지 않는 불일치가 남는다. 기능 회귀는 0이지만, 이후 `ai-agent.schema.ts` 의 re-export 래퍼가 정리될 경우 IE 핸들러 import 가 깨진다.
- 제안: IE 핸들러 import 를 `from '../shared/agent-memory-schema'` 로 변경해 SoT 파일을 직접 참조. `ai-agent.schema.ts` 의 re-export 를 유지할지 제거할지 여부와 독립적으로 적용 가능.

---

## INFO

### [INFO] `agent-memory-injection.ts` 파일명이 `-injection` 접미사 유지 — `-schema` 파트와 패턴 통일 여부

- target 위치: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts`
- 위반 규약: 명명 규약 엄격 위반은 없음. 기존 `conversation-context-injection.ts` / `conversation-context-schema.ts` 의 `<도메인>-<역할>` 패턴과 완전히 동일하게 `agent-memory-injection.ts` / `agent-memory-schema.ts` 로 명명됨. INFO 등급은 파일 역할 기준이다: `agent-memory-injection.ts` 는 주입 로직(토큰 추정·요약 압축·안정 프리픽스·enqueue) 뿐 아니라 순수 유틸(`estimateTokens*`, `resolveMemoryTtlDays`, `wrapMemoryContent` 등) 도 함께 내포하여 `injection` 범위를 약간 초과한다. `conversation-context-injection.ts` 는 주입 경로만 담고 상수/스키마는 분리되어 있다.
- 제안: 현재 패턴 유지 가능(기능·컴파일 문제 없음). 향후 파일이 더 커지면 `agent-memory-utils.ts` 로 토큰 추정 함수군을 분리하는 것을 고려.

### [INFO] spec frontmatter `code:` 에 `agent-memory-injection.spec.ts` 미등재

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` / `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter `code:`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 구현 경로 (테스트 파일 포함 여부는 선택). 다른 spec 문서들도 테스트 파일을 `code:` 에 등재하지 않는 경우가 있어 일관성 부재이나 가드 실패는 아님.
- 제안: 관련 `.spec.ts` 를 `code:` 에 등재하거나, 컨벤션에서 테스트 파일 등재 여부를 명시적으로 선택적임을 선언해 일관성을 갖추는 것 고려.

---

## 요약

이번 PR 은 `ai-agent/agent-memory-injection.ts` 를 `shared/agent-memory-injection.ts` 로 이전하고 schema fragment 빌더(`buildAgentMemorySchemaFields`) 를 `shared/agent-memory-schema.ts` 에 추출하는 순수 리팩토링이다. 파일명은 기존 `conversation-context-*` 패턴과 정확히 대칭적으로 일치한다. spec frontmatter `code:` glob 은 두 spec 파일에 모두 정상 추가되어 `spec-code-paths` 가드를 통과한다. 신규 요구사항 ID·메타가 없는 점도 리팩토링 성격과 일치한다. 단, IE 핸들러가 `DEFAULT_MEMORY_TOP_K` / `DEFAULT_MEMORY_THRESHOLD` 를 새 SoT(`shared/agent-memory-schema.ts`)가 아닌 `ai-agent/ai-agent.schema` 경유로 import 하는 불일치가 남아 있다. 값은 동일하나 단일 진실 원칙 위반이므로 WARNING 수준으로 분류한다.

## BLOCK: NO
