# 정식 규약 준수 검토 — KB WS 이벤트 count drift 정정

- worktree: `/Volumes/project/private/clemvion/.claude/worktrees/kb-ws-event-drift-3f4536`
- diff: `origin/main..HEAD` (base=2aa4c8093, HEAD=31bbd1d3a)
- 대상 커밋: `8c3e95319` (fix(kb-ws)), `31bbd1d3a` (docs+test 후속)
- 변경 파일: `CHANGELOG.md`, `codebase/backend/.../websocket.service.ts`(JSDoc only), `codebase/frontend/.../use-kb-events.ts`, `codebase/frontend/.../use-kb-events.test.ts`(신규), `spec/2-navigation/5-knowledge-base.md`, `spec/5-system/{6-websocket-protocol,8-embedding-pipeline,10-graph-rag}.md`

## 검토 방법

`spec/conventions/**` 전체 목록을 확인하고, 아래 관점별로 diff 내용과 관련 규약 문서(특히 event 명명 규약이 실려 있는 `spec/5-system/6-websocket-protocol.md ## Rationale` §"KB 채널 단위 전환", `spec/conventions/spec-impl-evidence.md`, `PROJECT.md §변경 유형 → 갱신 위치 매핑`)를 대조했다.

## 발견사항

이번 diff 범위에서 `spec/conventions/**` 직접 위반 또는 규약과의 명백한 거리감은 **발견되지 않음**. 아래는 확인 근거와 참고용 INFO 2건이다.

- **[INFO]** 프론트 코드 스타일(named export const, JSDoc)에 대한 전용 정식 규약 문서 부재
  - target 위치: `codebase/frontend/src/lib/websocket/use-kb-events.ts:18` (`export const KB_EVENT_NAMES = [...] as const;`)
  - 위반 규약: 해당 없음 — `spec/conventions/**` 안에 프론트엔드 export/JSDoc 스타일을 규정하는 문서가 없음 (`codebase/frontend/AGENTS.md` 는 datetime 표기 규약만 다룸)
  - 상세: closure-local 상수를 module-scope `export const SCREAMING_SNAKE_CASE = [...] as const;` 형태로 승격한 패턴은 동일 디렉토리의 기존 관례(`codebase/frontend/src/lib/llm-providers.ts` 의 `export const LLM_PROVIDERS = [...]`)와 일치하고, 테스트 파일도 인접 `__tests__/*.test.ts` 배치 관례(`use-execution-events.test.ts` 등)와 동일하다. 다만 이 일관성은 "정식 규약" 이 아니라 관행(convention-by-precedent)에 의존하고 있어, 엄밀히는 `spec/conventions/**` 로 판단할 근거 문서가 없다.
  - 제안: 위반은 아니므로 target 수정 불필요. 규약 자체를 갱신한다면 프론트 export/JSDoc 스타일 가이드를 `spec/conventions/`(또는 기존 codebase-level 문서)에 명문화하는 편이 향후 유사 판단의 근거가 될 수 있음 — 이번 PR 범위에서 강제할 사안은 아님.

- **[INFO]** Rationale 교정에 쓰인 취소선(`~~...~~`) 표기 — 기존 관행과 일치함을 확인
  - target 위치: `spec/5-system/8-embedding-pipeline.md` `## Rationale` "WebSocket 채널 명명을 KB 단위(...)" 문단 — `~~union 12개 이벤트~~ → ... 현재 **11개**...`
  - 위반 규약: 해당 없음(문제 없음 확인용 기록)
  - 상세: `spec/5-system/17-agent-memory.md`, `spec/conventions/cross-node-warning-rules.md`, `spec/conventions/conversation-thread.md`, `spec/data-flow/6-knowledge-base.md` 등 여러 spec 의 Rationale/로드맵 절에서 "과거 서술 취소선 + 화살표 정정" 패턴이 이미 폭넓게 쓰이고 있음을 확인했다. 이번 수정은 그 기존 패턴을 그대로 따른 것으로, 신규 패턴 도입이 아니며 문서 구조 규약(본문 불변, Rationale 안에서만 교정)에도 부합한다.

## 세부 검증 결과 (근거)

1. **명명 규약** — `document:embedding_*` / `document:graph_*` 콜론+언더스코어 표기는 `spec/5-system/6-websocket-protocol.md:1007`("이벤트 표기는 콜론+언더스코어(`document:embedding_started`) 를 사용 — backend type union 의 형식과 일치") 규약과 완전히 일치. 이번 diff 는 새 이벤트명을 만들지 않고 이미 존재하지 않는(`document:graph_error`) 죽은 구독만 제거했으므로 명명 규약 위반 소지 자체가 없음.

2. **출력 포맷 규약** — payload 표(`{ documentId, ... }` 형태), 이벤트 표 컬럼(`이벤트 type | payload | 설명`), union count 표기(`총 N종 = embedding X + graph Y`) 모두 수정 전 표 구조를 그대로 유지한 채 텍스트/카운트만 정정. 4개 spec 문서(§4.3, §8.1/§8.2, §6/KB-GR-OB-02, §2.7.1)와 `spec/data-flow/6-knowledge-base.md §2.5`(diff 대상 아니었으나 사전 대조 확인, 이미 11개·#443 반영 상태로 일치) 간 count·서술이 일관됨을 직접 대조 확인 (embedding 6 + graph 5 = 11, 모든 5곳에서 동일).

3. **문서 구조 규약** — 수정된 3개 spec (`5-knowledge-base.md`/`10-graph-rag.md`/`8-embedding-pipeline.md`)는 모두 기존 `## Overview (제품 정의)` / 본문(`## 1.` ~) / `## Rationale` 3단 구조를 그대로 유지했고, 이번 diff 는 본문·Rationale 기존 섹션 내부 텍스트만 교체했다(신규 섹션 추가·구조 변경 없음). frontmatter(`id`/`status`/`code`)는 diff 대상이 아니며 사전 확인 결과 이상 없음(`status: implemented`, `code:` 매치 유지).

4. **API 문서 규약** (`spec/conventions/swagger.md` 대상) — 이번 diff 는 controller/DTO 변경이 없어 swagger 데코레이터·DTO 명명 규약이 적용될 대상 자체가 없음. 해당 없음으로 판단.

5. **금지 항목** — `spec/conventions/spec-impl-evidence.md`(frontmatter lifecycle), `PROJECT.md §변경 유형 → 갱신 위치 매핑`(동반 갱신 매트릭스) 등에서 명시적으로 금지하는 "사후 보정(`fix(docs)`/`fix(i18n)`) 분리 커밋" 패턴은 관찰되지 않음 — 코드(frontend export 승격)·테스트·backend JSDoc·4개 spec·CHANGELOG 가 모두 동일 커밋 셋(`8c3e95319`+`31bbd1d3a`) 안에서 함께 갱신됨. CHANGELOG 항목 포맷(`## Unreleased — <제목> (<spec 경로 §절>)` → `### 변경 사항` → 번호목록 `**볼드 요약** — 상세... SoT: ...`)도 기존 항목들과 완전히 동일한 틀을 따름.

## 요약

이번 변경은 이미 backend union·`data-flow/6-knowledge-base.md §2.5` 에 기록돼 있던 11종(embedding 6 + graph 5) 권위를 frontend 구독 목록과 나머지 3개 spec 문서(§4.3/§8.1·§8.2/§6·KB-GR-OB-02/§2.7.1)에 소급 정렬한 순수 drift-정정이며, 이벤트 명명(콜론+언더스코어), 출력 포맷(payload 표 구조), 문서 3섹션 구조(Overview/본문/Rationale), CHANGELOG 항목 포맷 모두 기존 `spec/conventions/**` 및 확립된 관행과 정확히 일치한다. API 문서(swagger) 규약은 이번 diff 범위에 해당 사항이 없다. CRITICAL/WARNING 수준의 정식 규약 위반은 발견되지 않았고, INFO 2건은 모두 "문제없음을 확인한 참고 기록" 성격이다.

## 위험도

NONE
