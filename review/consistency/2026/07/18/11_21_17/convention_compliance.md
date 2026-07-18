# 정식 규약 준수 검토 — `spec/conventions/interaction-type-registry.md`

## 검토 범위 및 방법
- target: 작업 트리 working-copy 상태의 `spec/conventions/interaction-type-registry.md` (uncommitted diff: `grep` → `AST(코드 리터럴) 스캔/AST 가드` 용어 정정, origin/main 대비 6줄 변경).
- 대조: `spec/conventions/**` 전체(`spec-impl-evidence.md`, `swagger.md`, `error-codes.md`, `node-output.md`, `conversation-thread.md`, `frontend-layering.md`, `cross-node-warning-rules.md`, `audit-actions.md`, `cafe24-api-catalog/*` 등) + `CLAUDE.md`/`project-planner/SKILL.md` 의 문서 구조 규약.
- frontmatter `code:` 10개 경로 전부 실존 확인, 본문의 spec 상호 링크(WebSocket §4.4·AI Agent·conversation-thread·EIA·channel-web-chat·execution-engine·`ai-end-reason` 패키지·`interaction-type-registry.ts`) 전부 실존 확인. 본문이 언급하는 `WaitingSurface`(`waiting-surface-guard.ts`) 타입 정의·`chat-channel/types.ts` 의 4값 `interactionType`·EIA 응답 DTO 서브디렉토리(`dto/responses/`) 명명도 실측 대조.

## 발견사항

### INFO — 명시적 `## Overview` 헤딩 부재
- target 위치: 문서 상단, 타이틀(`# Interaction Type Registry`)과 `> 관련 문서:` 블록쿼트 직후 두 단락 (헤더 없이 `cross-cutting **enum 값**의 단일 진실…`으로 시작, `## 1. WaitingInteractionType` 로 바로 진입)
- 위반 규약: `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" — `## Overview (제품 정의)` / 본문 / `## Rationale` 3섹션 권장
- 상세: target 은 도입부 산문은 있으나 `## Overview` 헤딩으로 명시하지 않는다. 다만 이 패턴은 target 만의 일탈이 아니다 — `spec/conventions/` 내 `conversation-thread.md`, `chat-channel-adapter.md`, `cross-node-warning-rules.md`, `data-hydration-surfaces.md`, `node-cancellation.md`, `secret-store.md` 등 다수의 `status: implemented` 정식 규약도 동일하게 명시적 Overview 헤딩 없이 바로 `## 1.` 로 진입한다. 반면 최근 신설된 `frontend-layering.md`(같은 PR 클러스터, 2026-07-17)는 명시적 `## Overview` 를 쓴다. 즉 이미 두 스타일이 혼재하는 상태이며, target 은 그중 절반의 기존 관행을 따른 것이다.
- 제안: "권장" 이라 CRITICAL/WARNING 대상은 아님. 가독성·검색성을 위해 도입부 두 단락 앞에 `## Overview` 헤딩을 붙이는 안을 고려할 수 있으나, 강제 사항은 아니므로 target 수정 없이 두어도 무방.

### INFO — Rationale 섹션 번호 매김 스타일 혼재
- target 위치: `## 5. Rationale`
- 위반 규약: 없음 (강한 규약 위반 아님, 문서 구조 규약 §관련 참고 사항)
- 상세: target 은 Rationale 을 `## 5.` 로 번호 매겨 본문 섹션과 연속 numbering 한다. `spec/conventions/` 내 `conversation-thread.md`(`## 8. Rationale`), `data-hydration-surfaces.md`(`## 4. Rationale`)는 같은 번호-매김 스타일이나, `error-codes.md`/`swagger.md`/`execution-context.md`/`frontend-layering.md`/`chat-channel-adapter.md`/`cross-node-warning-rules.md`/`node-cancellation.md`/`secret-store.md`/`rag-evaluation.md`/`audit-actions.md` 는 번호 없는 standalone `## Rationale` 을 쓴다. 후자가 다수이나 이미 corpus 전체에 두 스타일이 공존하므로 target 고유 결함이 아니라 repo 전반의 기존 비일관이다.
- 제안: 규약 갱신 대상(선호 스타일을 `project-planner/SKILL.md` 에 명문화)이 적절하지, target 개별 수정을 요구할 사안은 아님.

## 규약 준수로 확인된 항목 (참고)
- **frontmatter 스키마**: `id: interaction-type-registry`(basename 일치) · `status: implemented` · `code:` 10개 경로 — `spec-impl-evidence.md` §2/§3 요건(“implemented ⇒ code: ≥1 매치 의무, pending_plans 없음”) 충족. 전 경로 실존 확인.
- **적용 대상/제외 규칙**: `spec/conventions/**.md` 는 frontmatter 의무 대상이고 target 은 `0-overview.md`/`_*.md`/카탈로그 하위파일 등 제외 대상에 해당하지 않아 정상 적용 대상 — 준수.
- **`spec-area-index.test.ts` 예외**: `spec/conventions/` 는 "flat reference, 무-index" 로 명시 제외되어 있어 별도 index 링크 의무 없음 — target 이 index 미등재라도 위반 아님.
- **API DTO 명명**: 본문이 언급하는 `external-interaction/dto/responses/execution-status-response.dto.ts` 는 실제로 `dto/responses/` 서브디렉토리 구조(swagger §5-1 정규화, PR #914)와 파일명 kebab-case + `.dto.ts` 접미사 패턴을 그대로 따른다 — 명명 규약 위반 없음. 클래스명도 `ExecutionStatusDto`/`ButtonsContextDto`/`NodeOutputContextDto` 로 `ExecutionContext*` 접두 충돌(과거 지적된 금지 패턴) 없음.
- **에러 코드 표기**: 인용된 `INVALID_EXECUTION_STATE` 는 `error-codes.md` §1 `UPPER_SNAKE_CASE` 표기와 일치.
- **cross-cutting SoT 경계 서술**: §4 의 `endReason` 절이 "값의 의미·port 매핑은 AI Agent/Information Extractor 소유, 출력 봉투 구조는 `node-output.md` 소유, 본 패키지는 값 도메인만" 이라고 명시해 `node-output.md` 와 책임을 침범하지 않는다 — `node-output.md` 본문에도 `endReason` 관련 상충 서술이 없어 경계 서술이 정합.
- **frontend 레이어 경계**: target 이 SoT 로 지목하는 `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` 는 `src/lib/**` 계층에 위치해 `frontend-layering.md` 위반(레이어 역전) 없음.
- **grep→AST 용어 정정 (본 diff 자체)**: `interaction-type-exhaustiveness.test.ts` 실제 구현이 TS AST(`collectCodeStringLiterals`, ts-morph/compiler API 기반)로 스캔함을 확인 — 이번 diff 의 "grep"→"AST(코드 리터럴) 스캔"/"AST 가드" 치환은 실제 구현과 더 정합하도록 만드는 정정으로, 새로운 규약 위반을 만들지 않는다.
- **§1.1 4값↔EIA 3값 매핑 서술**: `chat-channel/types.ts` 의 내부 `interactionType` 4값 선언과 `chat-channel.dispatcher.ts` 의 `ai_form_render` 흡수 로직, `waiting-surface-guard.ts` 의 `WaitingSurface` 3값 타입이 target 서술과 정확히 일치.

## 요약
target 문서(`spec/conventions/interaction-type-registry.md`, 현재 working-tree 상태)는 frontmatter 스키마·적용 대상 규칙·API DTO 명명·에러 코드 표기·SoT 책임 경계 서술·frontend 레이어 경계 등 정식 규약(`spec/conventions/**`)의 핵심 항목을 모두 충족한다. 유일하게 짚을 만한 점은 문서 구조의 "3섹션 권장" 중 `## Overview` 헤딩을 명시적으로 두지 않는다는 것과 `## Rationale` 을 번호 매김 스타일로 쓴다는 것인데, 둘 다 이미 `spec/conventions/` corpus 전반에 걸쳐 혼재하는 기존 스타일이라 target 고유의 위반이 아니라 INFO 수준의 참고 사항이다. 이번 uncommitted 변경분(`grep`→`AST` 용어 정정) 자체는 실제 구현(TS AST 파싱)과 문서 서술을 더 일치시키는 정정이라 규약 준수에 긍정적이다. CRITICAL/WARNING 은 발견되지 않았다.

## 위험도
LOW
