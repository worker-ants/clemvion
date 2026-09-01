# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

## 검토 개요

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- scope(`spec/5-system`) 문서 델타: **0개 파일** — 이 브랜치는 spec 문서를 변경하지 않았다.
- 구현 diff: 8개 파일 / 134줄. 전량 다음 두 범주:
  1. `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,masked-markers,node-summary}/package.json` — `lint` 스크립트의 glob 을 `eslint src/**/*.ts` → `eslint "src/**/*.ts"` 로 quoting (zsh 등에서 셸이 glob 을 먼저 확장하는 것 방지). 순수 빌드 tooling.
  2. `codebase/packages/expression-engine/`:
     - `src/parser.ts` — `case TokenType.LParen:` 케이스를 블록 `{ }` 으로 감싼 것 (`no-case-declarations` lint 대응). 파싱 로직·반환값·동작은 diff 전후 동일 (순수 구문적 리팩터).
     - `src/__tests__/error-shape.spec.ts` — `SUBCLASSES` 필터의 타입 서명을 `[string, new (...) => ExpressionError]` (수기 타입)에서 모듈 export 로부터 유도한 `SubclassName` mapped type 으로 교체. 런타임 필터 로직(`Object.entries(errors).filter(...)`)과 검증 대상은 diff 전후 동일 — 테스트 전수성 캐너리의 타입 안전성 강화일 뿐 새 assertion·새 동작 추가 없음.

## 교차 확인

- `expression-engine`, `graph-warning-rules`, `masked-markers`, `node-summary` 는 `spec/5-system/5-expression-language.md`, `spec/5-system/14-external-interaction-api.md` 등에서 `code:`/본문으로 참조되는 패키지이므로 형식상 target 영역(`spec/5-system`)과 연관됨을 확인했다. 그러나 위 diff 어디에도 이 문서들이 서술하는 API 계약·데이터 모델·상태 전이·요구사항 ID·RBAC 를 바꾸는 변경이 없다.
- `5-expression-language.md` 본문에 `error-shape.spec.ts` 의 구현 세부(수기 배열 vs 타입 유도)를 규정하는 문장이 없음을 확인 (`grep` 0건) — 이 diff 가 spec 서술과 불일치를 만들 여지가 없다.
- `parser.ts` 변경은 함수 스코프만 바꾸는 구문적 리팩터이며 파싱 결과·에러 코드·AST 노드 타입(`{ type: 'Identifier', ... }` 등 §6 계열 계약)에 영향이 없다.
- `frontend-layering.md` 등 `spec/conventions/**` 가 언급하는 `eslint src/lib` 류 lint 명령은 frontend 전용 축이며, 본 diff 의 `codebase/packages/*/package.json` lint 스크립트(별개 패키지군)와 무관 — 명령 문자열 참조 충돌 없음.

## 발견사항

없음.

## 요약

이번 diff 는 `spec/5-system/` 이 SoT 로 규정하는 어떤 API 계약·데이터 모델·요구사항 ID·상태 전이·RBAC 도 변경하지 않는다. 6개 패키지의 `lint` 스크립트 glob quoting 수정과 `expression-engine` 내부의 순수 구문적 리팩터(케이스 블록 스코핑)·테스트 타입 안전성 강화로 국한되며, 대상 패키지들이 `spec/5-system` 및 인접 spec 영역(`spec/4-nodes`, `spec/conventions` 등)에서 참조되긴 하지만 그 문서들이 서술하는 어떤 계약도 이 diff 로 인해 코드와 어긋나지 않는다. Cross-spec 충돌 소지 없음.

## 위험도

NONE
