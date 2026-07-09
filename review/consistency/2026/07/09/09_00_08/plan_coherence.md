# Plan 정합성 검토

## 검토 대상 확인

- 모드: `--impl-done`, scope=`spec/3-workflow-editor/`, diff-base=`origin/main`
- 브랜치: `claude/map-button-overlap-fix-aa9a59` (커밋 `607bba715`)
- 실제 diff(`git diff origin/main`)를 재확인한 결과, `spec/3-workflow-editor/**` 는 **변경분 0줄**이었다. 실질 변경은 다음 3개 파일뿐이다:
  - `codebase/frontend/src/components/editor/canvas/canvas-minimap.tsx` — 미니맵/토글 버튼 위치 교체 (버튼을 우하단 코너에 고정, 미니맵을 버튼 위로 띄워 겹침 제거)
  - `codebase/frontend/src/components/editor/canvas/__tests__/canvas-minimap.test.tsx` — 위 변경에 따른 테스트 갱신
  - `codebase/frontend/src/content/docs/03-workflow-editor/canvas-basics.{mdx,en.mdx}` — 유저 가이드의 "토글 버튼 위/above" 문구를 "아래/below" 로 정정

즉 이번 작업은 `spec/3-workflow-editor/0-canvas.md §7 미니맵` 이 이미 서술한 "구현됨" 상태 내에서의 위치 조정(버그 픽스)이며, spec 문서 자체의 신규 서술이나 결정 변경을 요구하지 않는다.

> 참고: prompt_file 에 포함된 "Target 문서" 절은 `spec/3-workflow-editor/` 전 범위(0~3번 문서 전문 + Rationale)를 컨텍스트로 덤프한 것이라 실제 diff 크기 대비 훨씬 크며, 정작 있어야 할 `## 구현 변경 사항` diff 절은 파일 말미에서 `... (truncated due to size limit) ...` 로 잘려 누락되어 있었다. 이 검토는 해당 손실분을 `git diff origin/main` 직접 조회로 보완했다.

## 관련 plan/in-progress 대조

`spec/3-workflow-editor/0-canvas.md` frontmatter 의 `pending_plans` 는 다음 두 문서를 지목한다. prompt_file 페이로드에는 누락돼 있어 저장소에서 직접 재확인했다.

- `plan/in-progress/spec-sync-canvas-gaps.md` — §7 미니맵 항목은 이미 `[x]` 완료 처리돼 있다("`canvas-minimap.tsx` 신설, workflow-canvas 렌더. lint·unit·build·e2e(236) 통과"). 버튼/미니맵 상대 위치에 대한 미해결 결정이나 후속 항목은 없다. 유일한 미해결 항목은 §4.1 팔레트 Installed(마켓플레이스) 섹션(별도 backlog, `marketplace-and-plugin-sdk.md` 의존)으로 이번 diff 와 무관하다.
- `plan/in-progress/ai-agent-tool-connection-rewrite.md` — AI Agent Tool Area 재설계(§12) 관련 미해결 디자인 결정을 다루며, 미니맵/줌 컨트롤 오버레이와는 대상이 다르다. 저장소 전체에서 `minimap` 키워드로 재검색했을 때도 이 문서에 미니맵 관련 언급은 없다.
- `spec/3-workflow-editor/2-edge.md` 의 `pending_plans: spec-sync-edge-gaps.md` 도 확인했으나 캔버스 하단 오버레이(미니맵/줌 컨트롤) 관련 항목이 없어 이번 변경과 무관하다.

`plan/in-progress/**` 전체(`grep -rn minimap plan/in-progress/*.md`)를 훑어도 `spec-sync-canvas-gaps.md` 의 이미 완료 처리된 §7 언급 외에는 미니맵을 다루는 문서가 없다. 따라서:

1. **미해결 결정과의 충돌** — 없음. 이번 변경은 "결정 필요"로 남겨진 어떤 항목도 우회하지 않는다(위치 조정은 이미 완료된 §7 구현의 시각적 버그 수정일 뿐).
2. **선행 plan 미해소** — 없음. 이 변경이 전제하는 사전 조건(미니맵·토글 버튼 존재)은 `spec-sync-canvas-gaps.md` §7 에서 이미 완료로 표시돼 있다.
3. **후속 항목 누락** — 없음. 변경 범위가 좁고(CSS 포지셔닝 + 대응 유저 가이드 문구 정정) 다른 plan 의 후속 항목을 무효화하거나 새로 만들 필요가 없다. spec 본문(§7)은 이미 "구현됨"으로만 서술하고 버튼-미니맵의 상대 배치를 규정하지 않으므로 spec 텍스트 갱신도 불필요하다.

## 요약

이번 diff 는 캔버스 미니맵과 토글 버튼의 겹침을 해소하는 순수 CSS 포지셔닝 버그 픽스로, `spec/3-workflow-editor/**` 문서 자체는 전혀 변경되지 않았다. 관련 `pending_plans`(`spec-sync-canvas-gaps.md`, `spec-sync-edge-gaps.md`, `ai-agent-tool-connection-rewrite.md`)를 모두 대조한 결과 미해결 결정과의 충돌, 선행 plan 미해소, 후속 항목 누락 어느 것도 발견되지 않았다. `spec-sync-canvas-gaps.md` 의 미니맵 관련 항목은 이미 완료(`[x]`) 상태이며 이번 변경은 그 완료된 구현 위에서의 후속 폴리시(위치 조정)일 뿐이다.

## 위험도

NONE
