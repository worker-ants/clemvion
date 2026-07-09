# Rationale 연속성 검토 결과

## 검토 범위 확인

`diff-base=origin/main` 대비 실제 변경분을 `git diff origin/main...HEAD --stat` 로 확인한 결과, 이번 target(`spec/3-workflow-editor/`) 커밋 범위는 다음 4개 파일뿐이다:

- `codebase/frontend/src/components/editor/canvas/canvas-minimap.tsx`
- `codebase/frontend/src/components/editor/canvas/__tests__/canvas-minimap.test.tsx`
- `codebase/frontend/src/content/docs/03-workflow-editor/canvas-basics.mdx`
- `codebase/frontend/src/content/docs/03-workflow-editor/canvas-basics.en.mdx`

`spec/3-workflow-editor/**/*.md` 자체는 이번 diff 에서 **변경되지 않았다** (`git diff origin/main...HEAD -- spec/3-workflow-editor/` 결과 없음). 프롬프트에 첨부된 target 문서 전문은 이미 병합된 이전 결정(R-1~R-4, 2026-07-07~08)을 반영한 현재 상태 그대로이며, 이번 diff 로 인한 신규 spec 서술 변경은 없다.

실제 코드 변경 내용: 미니맵 토글 버튼이 미니맵을 가리는 겹침 버그 수정. 기존에는 "토글 버튼이 미니맵 위에 있다가 미니맵이 숨겨지면 코너로 내려가는" 구조(`mb-[168px]` 동적 마진)였고, 변경 후에는 "토글 버튼을 코너에 고정하고 미니맵이 그 위로 뜨는" 구조(`!bottom-12` 고정 오프셋)로 바뀌었다. `canvas-basics.mdx`/`.en.mdx` 유저 가이드 문구도 "토글 버튼이 미니맵 위" → "토글 버튼이 미니맵 아래"로 함께 갱신됐다.

## Rationale 대조

- `spec/3-workflow-editor/0-canvas.md §7 미니맵`(target 문서, line 535-545)은 "캔버스 우하단에 작은 오버레이로 표시" · "토글 버튼으로 표시/숨김" 수준의 일반 규격만 정의하며, 토글 버튼과 미니맵의 상대 위치(위/아래)나 정확한 px 오프셋에 대해서는 아무 것도 규정하지 않는다. 따라서 이번 버튼-미니맵 배치 반전은 spec 규격 위반이 아니다.
- `spec/3-workflow-editor/0-canvas.md ## Rationale`(R-1~R-4)을 포함해 `spec/3-workflow-editor/{1-node-common,2-edge,3-execution}.md` 의 Rationale, 그리고 첨부된 타 spec 문서(`0-overview`, `1-data-model`, `2-navigation/**`)의 `## Rationale` 발췌 전체를 훑었으나, 미니맵·토글 버튼의 레이아웃/포지셔닝을 다룬 과거 결정이나 기각된 대안은 존재하지 않는다 (`미니맵`/`minimap`/`토글 버튼` 전문 검색 결과 §7 본문과 팔레트 접기 항목(§4.2, 무관)만 매칭).
- R-3(§8 저장 모델 — 타이머 자동 저장 미제공 확정), R-4(§11.4 컨테이너 중첩 — 깊이 제한/배경 틴트 파기 확정) 등 최근 확정된 결정들은 이번 diff 코드가 손대는 영역(캔버스 minimap 컴포넌트)과 무관하며, target 문서 본문도 그 결정과 일관되게 서술되어 있어 재도입·번복 정황이 없다.
- §12 AI Agent Tool Area("재작성 예정 — 현재 제거됨")·§11.4 컨테이너 중첩 정책 등 기존에 명시적으로 폐기/보류된 항목들이 이번 diff 로 인해 되살아나거나 코드에 재도입된 흔적도 없다 (해당 코드 파일은 diff 대상에 포함되지 않음).

## 발견사항

없음 — 이번 diff 는 spec Rationale 이 다루는 결정(저장 모델, 컨테이너 중첩, 팔레트 Recent/Installed, Tool Area 등)과 무관한 순수 CSS 포지셔닝 버그 수정이며, target 문서 자체도 변경되지 않았다.

## 요약

이번 target 범위(`spec/3-workflow-editor/`)의 실제 diff 는 미니맵-토글 버튼 겹침을 해결하는 프론트엔드 CSS/테스트/유저가이드 문구 수정 4건뿐이고 spec 문서는 전혀 변경되지 않았다. spec 의 `## Rationale` 어디에도 미니맵/토글 버튼의 상대 배치를 규정하거나 특정 대안을 기각한 기록이 없으므로, 기각된 대안 재도입·합의 원칙 위반·무근거 번복·암묵적 invariant 충돌 어느 관점에서도 문제가 발견되지 않았다. 최근 병합된 R-3(저장 모델 정정)·R-4(컨테이너 중첩 정책 확정) 등 굵직한 결정들과도 이번 코드 변경은 접점이 없다.

## 위험도

NONE
