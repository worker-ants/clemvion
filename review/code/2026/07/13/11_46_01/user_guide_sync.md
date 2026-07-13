# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

대상: edge §1.2(출력 포트 드래그 → 빈 영역 드롭 시 노드 추가 팝업 + 자동 엣지 연결) 구현 + 2회의 선행 ai-review(11_04_21, 11_28_30)에서 지적된 문서 동기화 갭의 반영 결과.

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` `rows[]` (19행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 Read 했다.

## 변경 파일 → trigger 매칭

- `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `codebase/frontend/src/lib/stores/editor-store.ts`, `codebase/frontend/src/lib/utils/edge-utils.ts` — `new-ui-string`(TSX, semantic) 후보로 점검. diff 전문을 확인한 결과 추가된 한국어 문자열은 전부 JSDoc/인라인 **주석**(`onConnectEnd`/`connectionDragSource`/`onConnect skipUndo` 설명)이며, 신규 toast/label/JSX 텍스트 등 실제 사용자 노출 문자열은 없다. dict 등록 대상 아님 — 정상.
- `codebase/frontend/src/content/docs/03-workflow-editor/{canvas-basics,connecting-nodes}.mdx` + `.en.mdx` — 매트릭스에 정식 행은 없으나(03-workflow-editor 는 `userguide-gui-flow-section` 행의 `02-nodes`/`06-integrations` 글로브 밖) 이 PR 이 자체적으로 "코드 변경 후 유저 가이드 갱신" 원칙(§사후 보정 PR 패턴 금지)을 적용해 4파일 모두 갱신했다. ko/en 내용 대조 결과 parity 정확: 제목 "노드를 추가하는 세 가지 방법"→"네 가지 방법" / "Three ways"→"Four ways" 동시 반영, 신규 4번째 방법 항목(출력 포트 드래그) 문구가 ko/en 대응하며 `connecting-nodes` 로의 교차링크도 양쪽에 존재. `connecting-nodes.mdx`/`.en.mdx` 도 "빈 캔버스에 드롭 = 아무 일도 없음" 구식 서술을 "노드 추가 팝업 + 자동 연결(입력 포트 없으면 노드만 생성)" 으로 정확히 교체했고 다른 무효 대상(출력 포트끼리·동일 노드) 서술은 유지돼 의미 왜곡이 없다.
- `CHANGELOG.md` — Unreleased 항목 추가, SoT(`spec/3-workflow-editor/2-edge.md §1.2`) 명시. 정상.
- `spec/3-workflow-editor/2-edge.md` — `spec-major-change` 행(glob `spec/3-*/**`) 매칭. §1.2 헤더의 "(미구현 · Planned)" 제거, "현재 구현" 각주가 실제 구현(React Flow v12 `connectionState`, `onConnectEnd`, `dragSource`, `skipUndo`, 순수 헬퍼 4종)으로 갱신됨. frontmatter 확인 결과 `status: partial`(§1.3/§3.2 등 잔여로 정당), `code:` 글로브에 `workflow-canvas.tsx`/`edge-utils.ts` 가 이미 포함, `pending_plans:` 에 `spec-sync-edge-gaps.md` 등재 — 정합.
- `plan/in-progress/spec-sync-edge-gaps.md` — 체크박스 `[ ]`→`[x]` + 구현 요약 갱신, §1.3 이월 항목에 ai-review 잔여 4건 기록. 정상.
- 백엔드 노드/스키마/통합/인증/표현식/실행-디버깅/warningCode/errorCode/신규 섹션 디렉토리 관련 파일 변경 없음 — 해당 trigger 전부 불일치.

## 발견사항

없음. 이번 변경 set(및 그 직전 두 차례 ai-review 라운드)이 매트릭스가 요구하는 모든 동반 갱신을 같은 turn 안에서 이미 완료했다:

- 1회차 ai-review(`11_04_21`) 가 spec stale(CRITICAL)·CHANGELOG 누락(WARNING)을 지적 → 커밋 `2b775357b` 로 반영.
- 2회차 ai-review(`11_28_30`) 의 user_guide_sync 리뷰가 `canvas-basics.mdx`/`.en.mdx`·`connecting-nodes.mdx`/`.en.mdx` 갱신 누락을 지적 → 커밋 `7980c2868` 로 4파일 모두 반영, ko/en parity 확인됨.
- 현재 diff(3회차 fresh 검토 대상)에는 그 반영 결과만 남아 있고 신규 갭이 없다.

## 요약

매트릭스 19행 중 실질 매칭 후보는 `new-ui-string`(TSX, semantic — 결과: 신규 사용자 노출 문자열 없음, 무해당) 1건과 `spec-major-change`(glob 매칭 — frontmatter 정합 확인, 무갭) 1건이며, 나머지 17행은 변경 파일과 무관하다. 03-workflow-editor MDX 4파일은 매트릭스 정식 행 밖이지만 관례상 필요한 동반 갱신을 이미 이전 ai-review 라운드에서 지적받아 같은 PR 내에서 완료했다. 발견된 미반영 갭 0건.

## 위험도
NONE
