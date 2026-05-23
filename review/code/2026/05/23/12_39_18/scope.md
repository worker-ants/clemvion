# 변경 범위(Scope) 리뷰

## 작업 의도

AI Agent `render_*` tool 버튼 클릭 시 chat 으로 발화되는 user message 에 아이템 컨텍스트를 포함하는 기능 추가.
- `ButtonDef` 에 `userMessage` 옵션 필드 신설 (backend schema + 공유 타입)
- frontend `findButtonLabel` → `findButtonContext` 확장 + `composeUserMessage` 헬퍼 추가
- 우선순위: LLM emit → per-item `"{title} → {label}"` → global `"{label}"` → buttonId fallback

---

## 발견사항

### [INFO] `_shared/button.types.ts` 에 `userMessage` 유효성 검사 미추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-agent-render-button-user-message-521f33/codebase/backend/src/nodes/presentation/_shared/button.types.ts` `validateButtons` 함수
- 상세: `validateButtons` 함수가 `userMessage` 필드에 대한 검증 로직을 포함하지 않는다. 예: `type: "link"` 이면서 `userMessage` 가 설정된 경우 경고를 낼 수 있다. 그러나 spec §1.1 에 "warning 아님 — 동작 변화 없음" 으로 명시되어 있어, 의도된 미처리임이 명확하다.
- 제안: 현 구현이 spec 과 정합하므로 조치 불필요. 단, 미래 정책 변경 시 이 함수가 갱신 대상임을 메모할 수 있다.

### [INFO] carousel / table / chart / template 각 파일에 `buttonDefSchema` 가 각자 선언됨 (`_shared` 미사용)
- 위치: `codebase/backend/src/nodes/presentation/carousel/carousel.schema.ts`, `chart/chart.schema.ts`, `table/table.schema.ts`, `template/template.schema.ts` 각 파일 내 지역 `buttonDefSchema`
- 상세: 이번 PR 에서 4개 파일 각각에 `userMessage` 필드를 동일하게 추가했다. 기존 코드 패턴이 각 schema 파일 안에 `buttonDefSchema` 를 중복 선언하는 구조이므로, 이번 변경은 기존 패턴을 그대로 따른 것이다. 신규 중복 도입이 아니라 기존 중복의 동일 패턴 적용이므로 본 PR 의 범위 이탈로 보기 어렵다.
- 제안: 4개 파일에 동일한 13줄 블록이 추가되는 점은 향후 `_shared/buttonDefSchema.ts` 통합 시 해소할 수 있으나, 그 리팩토링은 본 PR 의 요청 범위 밖이므로 별도 task 로 분리 권고.

### [INFO] `review/consistency/2026/05/23/12_00_09/` 경로 파일군이 PR 에 포함됨
- 위치: `review/consistency/2026/05/23/12_00_09/_retry_state.json`, `convention_compliance.md`, `cross_spec.md`, `meta.json`, `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`
- 상세: 본 작업의 consistency check 산출물이 커밋에 포함되었다. 프로젝트 규약 (`CLAUDE.md` "코드 리뷰·일관성 검토 산출물: `review/consistency/...`") 상 해당 폴더는 산출물 보관 위치이므로 체계에 맞는 위치이다. 범위 이탈이 아니라 SDD 워크플로의 필수 산출물 추적 커밋이다.
- 제안: 조치 불필요.

---

## 요약

전체 변경은 `ButtonDef.userMessage` 필드 신설 + 클릭 user-message 합성 우선순위 구현이라는 단일 작업에 집중되어 있다. backend 4개 schema 파일의 `buttonDefSchema` 중복 확장은 기존 코드 구조를 그대로 따른 것이고, frontend 는 `findButtonLabel` 대체 + `composeUserMessage` 헬퍼 신설로 정확히 plan 이 기술한 범위 안에 머무른다. spec 2개 파일 수정 (필드 정의 + §10.8 신설), plan 문서 신설, consistency check 산출물 포함 모두 프로젝트 규약이 정한 산출물 위치를 정상 사용한 것이다. 의도하지 않은 리팩토링, 무관한 파일 수정, 포맷팅·주석·임포트 스코프 이탈은 발견되지 않았다.

## 위험도

NONE
