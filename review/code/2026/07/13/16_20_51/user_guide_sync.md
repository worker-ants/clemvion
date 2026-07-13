## 발견사항

이번 changeset(§4/§5 엣지 데이터 미리보기 툴팁 + 모달, `spec-sync-edge-gaps` plan 항목)은 매트릭스 trigger 에 매칭되는 항목들이 실제로는 **모두 동반 갱신 완료** 상태입니다. 세부 확인 내역:

- **매칭된 trigger 1 — `new-ui-string`** (`codebase/frontend/src/**/*.tsx`, semantic): `edge-data-preview.tsx` 신규 UI 문자열(`editor.edgeDataPreviewTitle`/`edgeDataSize`/`edgeViewFullData`/`edgeNoData`) 4종이 `codebase/frontend/src/lib/i18n/dict/ko/editor.ts` + `dict/en/editor.ts` **양쪽에 동일 키 세트·동일 위치(`duplicateBtn` 과 `enableBtn` 사이)**로 등록됨(파일 9·10). 하드코딩 리터럴 없이 전부 `useT()` 경유. parity 충족 — 결함 없음.
- **매칭된 trigger 2 — `spec-major-change`** (`spec/3-*/**`): `spec/3-workflow-editor/2-edge.md` frontmatter `code:` 배열에 신규 파일 3종(`edge-data-preview.tsx`, `use-edge-hover-preview.ts`, `lib/utils/edge-data-preview.ts`)이 추가되고, §5 본문이 "미구현 · Planned" → 구현 서술로 갱신됨(파일 27). `docs/03-workflow-editor/connecting-nodes.mdx` frontmatter `code:` 배열도 동일 3파일 추가(파일 8). `status: partial` + `pending_plans` 에 진행 중인 plan 유지 — 정합.
- **user-guide MDX**: `connecting-nodes.mdx`(ko) + `connecting-nodes.en.mdx`(en) 양쪽에 동일 위치("Editing edges" 절 앞)로 hover 미리보기 설명이 대칭 추가됨(파일 7·8) — ko/en 균형 유지.
- **plan 체크박스**: `plan/in-progress/spec-sync-edge-gaps.md` §4/§5 항목이 이번 커밋에 `[ ]`→`[x]` 로 실제 구현과 함께 갱신됨(파일 14) — "체크박스=실제 상태" 원칙 준수.

- **[INFO]** `05-run-and-debug/` 절에는 이번 기능 설명이 직접 반영되지 않음 (회색 지대, 확정적 결함 아님)
  - 변경 파일: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx`, `use-edge-hover-preview.ts`, `workflow-canvas.tsx`
  - 매트릭스 항목: `run-debug-flow-change` (semantic) — targets: `codebase/frontend/src/content/docs/05-run-and-debug/`
  - 상세: 이 기능은 backend 실행 엔진 변경이 아니라 순수 프런트엔드 hover UI이므로 trigger 의 문자 그대로의 요건(backend 실행 엔진·디버그 로깅 변경)엔 해당하지 않음. 다만 같은 plan 의 직전 항목(§3.2 실행 상태 스타일)은 "실행 시각화는 `05-run-and-debug/running-a-workflow`(ko/en) '실행 상태 확인' 절에도 반영" 이라고 명시적으로 교차 반영한 선례가 있는데, 이번 §4/§5(실행 후 데이터 확인이라는 디버깅 성격이 더 강한 기능)는 `running-a-workflow.mdx`/`.en.mdx` 에 별도 언급이 없음. 다만 `running-a-workflow.mdx` "실행 상태 확인" 절이 이미 "[연결선 읽기](/docs/03-workflow-editor/connecting-nodes)" 로 크로스링크하고 있어 사용자가 결국 해당 설명에 도달하므로 실질적 가이드 공백은 아님.
  - 제안: 필수는 아니나, 일관성을 위해 `running-a-workflow.mdx`/`.en.mdx` "실행 상태 확인" 절에 "엣지 hover 시 데이터 미리보기" 한 줄을 §3.2 사례처럼 추가하는 것을 고려.

## 요약
매트릭스 rows 21개 중 이번 changeset 은 `new-ui-string`(TSX 신규 문자열)·`spec-major-change`(spec/3-* 변경) 2개 trigger 에 매칭되며, 두 trigger 모두 동반 갱신(dict ko/en parity, MDX ko/en parity, spec frontmatter `code:`/`status`, plan 체크박스)이 이미 완결된 상태로 CRITICAL/WARNING 없음. `05-run-and-debug` 관련 1건은 확정적이지 않은 회색 지대(INFO)로만 기록.

## 위험도
NONE