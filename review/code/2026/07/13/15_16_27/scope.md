# 변경 범위(Scope) Review

대상: `review/code/2026/07/13/15_01_46/{security,side_effect,testing}.md`(신규) +
`spec/3-workflow-editor/2-edge.md`(§3.2 상태 갱신) — payload 로 전달된 4개 파일.
단, payload 완전성 확인을 위해 `git diff origin/main..HEAD --stat` 로 실제 전체 changeset(54개
파일, 4개 커밋: `36f37067a`→`7a18ec6e1`→`e3a3166b7`→`c6f094ebb`)을 직접 대조했다.

## 발견사항

- **[WARNING]** 이번 세션에 전달된 diff payload(4개 파일)가 실제 전체 changeset(54개 파일)의
  일부에 불과함 — scope 리뷰 완전성 결여
  - 위치: `_prompts/scope.md` (파일 1~4만 포함)
  - 상세: `git diff origin/main..HEAD --stat` 로 확인한 실제 누적 diff 는 54개 파일(운영 코드
    `custom-edge.tsx`/`edge-utils.ts`/`use-edge-execution-state.ts`(신규)/`workflow-canvas.tsx`/
    `globals.css`/`CHANGELOG.md`/mdx 문서 4건/`plan/in-progress/spec-sync-edge-gaps.md`, 그리고
    이전 3라운드 ai-review 산출물 디렉터리(`14_20_12`/`14_42_20`/`15_01_46`) 하위 39개 파일)인데,
    본 세션이 받은 payload 는 그중 `15_01_46/{security,side_effect,testing}.md` 3건과
    `spec/3-workflow-editor/2-edge.md` 1건, 총 4건뿐이다. router 가 큰 diff 를 여러 리뷰어
    세션에 파일 단위로 분할 배정한 것으로 보이나, "변경 범위 이탈 여부" 를 판정하는 scope
    리뷰어가 changeset 의 약 7%만 보고 STATUS=success 를 반환하면, 호출자가 이를 "전체 diff 를
    스코프 검토 완료" 로 오인할 위험이 있다(과거 기록된 "리뷰 changeset 이 직전 검토 코드 제외"
    패턴과 유사한 부류의 완전성 갭).
  - 제안: 이 갭을 보완하기 위해 아래 항목은 git 도구로 직접 나머지 50개 파일(운영 코드 7건 +
    mdx 4건 + plan/CHANGELOG 2건 + 이전 라운드 산출물 39건)을 대조해 보충 검증했다. 다만 router
    가 scope 리뷰어에게는 전체 changeset(또는 최소한 파일 목록 전체)을 항상 전달하도록
    배정 로직을 재검토할 것을 권고한다.

- **[INFO]** (보충 검증) 운영 코드 변경 7건은 전부 §3.2 "엣지 실행 상태 스타일" 목적에 직결 —
  무관한 리팩터링·기능 확장·포맷팅 혼입 없음
  - 위치: `codebase/frontend/src/components/editor/canvas/{custom-edge.tsx,use-edge-execution-state.ts(신규),workflow-canvas.tsx}`,
    `codebase/frontend/src/lib/utils/edge-utils.ts`, `codebase/frontend/src/app/globals.css`,
    `CHANGELOG.md`, `plan/in-progress/spec-sync-edge-gaps.md`
  - 상세: `edge-utils.ts` 의 신규 export(`EdgeExecutionState`/`FLOWING_EDGE_CLASS`/
    `COMPLETED_EDGE_CLASS`/`resolveEdgeExecutionState`/`buildEdgeStyle`)는 전부 additive이고
    기존 export 는 미변경. `custom-edge.tsx` 의 인라인 스타일 조립을 `buildEdgeStyle` 호출로
    치환한 것은 §3.2 구현이 거친 ai-review 라운드에서 지적된 "스타일 조립 미검증" 을 해소하기
    위한 목적성 리팩터(순수 함수 추출)로, 요청 스코프(§3.2 + 그 리뷰 피드백 반영) 안에 있다.
    `workflow-canvas.tsx` 변경은 신규 훅 배선(`useEdgeExecutionState(edges, nodes)` →
    `useEdgeHighlighting(executionEdges)`) 3줄 추가/치환뿐. `globals.css` 추가분은 §3.2 keyframe
    2개(`edge-complete-flash`)와 클래스 규칙뿐, 기존 규칙 변경 없음. `CHANGELOG.md`/plan 파일은
    이번 기능에 대한 서술 항목 1개 추가·체크박스 갱신뿐. 임포트 정리·주석 대량 수정·무관 파일
    수정·설정 파일 변경 없음.
  - 제안: 조치 불요.

- **[INFO]** (보충 검증) mdx 사용자 가이드 4건은 §3.2 가 실제로 구현한 3가지 상태(흐름/완료/
  비활성)만 서술 — 과잉 서술 없음
  - 위치: `connecting-nodes.mdx`/`.en.mdx`(신규 문단 추가 + frontmatter `code:` 목록에
    `use-edge-execution-state.ts` 추가), `running-a-workflow.mdx`/`.en.mdx`(엣지 항목 1줄 확장)
  - 상세: 추가된 텍스트는 spec §3.2 표에 정확히 대응하는 3개 상태(데이터 흐름/실행 완료/비활성)
    설명뿐이며, 구현되지 않은 기능(§4/§5 데이터 미리보기 툴팁 등)에 대한 언급이나 새로운 약속을
    추가하지 않았다.
  - 제안: 조치 불요.

- **[INFO]** payload 로 전달된 `spec/3-workflow-editor/2-edge.md` 변경은 §3.2 상태 테이블 3행
  플립 + 구현 서술 + frontmatter `code:` 목록 갱신뿐 — 정확히 이번 작업(spec-sync-edge-gaps)의
  목적 그 자체
  - 위치: `code:` 목록에 `use-edge-execution-state.ts` 1줄 추가, §3.2 표 "미구현 (Planned)" ×3 →
    "구현됨" + 구현 근거 blockquote로 교체
  - 상세: 코드가 실제로 구현한 3가지 상태(flowing/completed/inactive)와 실제 컴포넌트
    이름(`use-edge-execution-state.ts`/`edge-utils.ts`)·CSS 클래스(`edge-flowing`/
    `edge-completed`)를 정확히 미러링한다. §3.2 이외 다른 절(§4, §5 등 여전히 Planned 로 남은
    항목)에는 손대지 않아, "spec 을 실제 구현 상태에 동기화" 라는 plan(`spec-sync-edge-gaps.md`)
    스코프를 벗어나지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/07/13/15_01_46/{security,side_effect,testing}.md` 신규 커밋 —
  본 저장소 기존 관례(리뷰 산출물 커밋)와 일치, scope 이탈 아님
  - 위치: 3개 파일 전체(security.md 72줄/side_effect.md 72줄/testing.md 32줄, 모두 신규)
  - 상세: `review/` 디렉터리는 gitignore 대상이 아니며 `RESOLUTION.md`/`SUMMARY.md` 와 함께
    각 리뷰어 산출물도 커밋하는 것이 이 저장소의 확립된 관례다(이전 라운드 `14_20_12`/`14_42_20`
    도 동일 패턴으로 이미 커밋돼 있음 — `git diff origin/main..HEAD` 전체 대조로 확인). `testing.md`
    가 `security.md`/`side_effect.md` 와 달리 파일 상단에 제목(`# ... Review`)·"대상:" 줄이 없는
    포맷 차이가 있으나, 이는 이번 diff 가 새로 만든 불일치가 아니라 이전 두 라운드
    (`14_20_12`/`14_42_20`)의 `testing.md` 도 동일하게 제목 없이 "### 발견사항" 로 바로 시작하는
    — 해당 리뷰어의 기존 출력 관례다. scope 관점의 신규 문제 아님(포맷 일관성은 별건).
  - 제안: 조치 불요.

## 요약

payload 로 전달된 4개 파일(`review/code/2026/07/13/15_01_46/{security,side_effect,testing}.md`
신규 + `spec/3-workflow-editor/2-edge.md` 갱신) 자체에는 스코프 이탈이 없다 — 전부 §3.2 엣지
실행 상태 스타일 구현 및 그 spec-sync 목적에 직결된다. 다만 이번 세션의 diff payload 가 실제
누적 changeset(origin/main..HEAD, 54개 파일)의 4개 파일만 포함해 완전성이 결여됐음을 확인했고,
`git diff origin/main..HEAD` 로 나머지 50개 파일(운영 코드 7건·mdx 4건·plan/CHANGELOG 2건·이전
ai-review 라운드 산출물 39건)을 직접 보충 대조한 결과 그 어디에도 요청 스코프를 벗어난 리팩터링·
기능 확장·무관한 파일 수정·포맷팅 혼입·불필요한 주석/임포트/설정 변경을 발견하지 못했다. 운영
코드 변경은 신규 export 위주의 additive 변경 + §3.2 목적성 리팩터(스타일 조립 함수 추출, 선행
ai-review 피드백 반영)뿐이고, 문서·spec·plan 변경도 실제 구현 범위와 1:1 대응한다. 위험도는
payload 완전성 갭(router 배정 로직 재검토 권고)을 반영해 LOW 로 판정하되, 실질적 코드 스코프
이탈은 발견되지 않았다.

## 위험도

LOW

STATUS=success ISSUES=1
