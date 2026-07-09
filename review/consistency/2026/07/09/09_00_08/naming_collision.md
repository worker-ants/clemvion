# 신규 식별자 충돌 검토 — spec/3-workflow-editor/ (impl-done)

## 검토 방법 메모

payload 에 첨부된 "Target 문서" 섹션은 `spec/3-workflow-editor/{0-canvas,1-node-common,2-edge,3-execution}.md` 전문(全文)을 포함하고 있으나, 이는 해당 영역의 **기존 spec 전체**이지 이번 diff 로 새로 도입된 내용이 아니다. payload 자체가 명시한 절차("diff 의 `+` 라인 또는 워킹트리에 식별자가 있으면 그것은 구현된 것")에 따라, 실제 신규 식별자 유무는 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/focused-borg-fd463a`)에서 `git diff origin/main...HEAD` 로 직접 확인했다.

```
git diff origin/main...HEAD --stat
 .../canvas/__tests__/canvas-minimap.test.tsx       | 86 ++++++++++++++++++++--
 .../components/editor/canvas/canvas-minimap.tsx    | 37 +++++-----
 .../src/content/docs/03-workflow-editor/canvas-basics.en.mdx | 2 +-
 .../src/content/docs/03-workflow-editor/canvas-basics.mdx    | 2 +-
```

확인 결과:

- `spec/3-workflow-editor/*.md` 자체는 이번 브랜치에서 **전혀 수정되지 않았다** (해당 영역의 최신 spec 변경 — 예: §11.4 컨테이너 중첩 파기 — 는 이미 `origin/main` 에 병합되어 있고 diff-base 이전 상태다). 즉 이번 diff 는 "target 문서가 새로 부여하는 요구사항 ID/엔티티명/endpoint/이벤트명/ENV/파일 경로" 자체가 존재하지 않는다.
- 실제 코드 변경은 미니맵-토글 버튼 겹침 버그 수정(`canvas-minimap.tsx`)과 그 테스트, 매뉴얼 문구(위/아래) 정정뿐이다. 신규로 도입된 식별자를 diff 상에서 전수 스캔한 결과:
  - `data-testid="minimap"`, `data-testid="minimap-toggle"`, `t("common.aria.minimap")` — 모두 `origin/main` 시점에 이미 존재(`git show origin/main:...canvas-minimap.tsx` 로 확인), 이번 diff 는 JSX 내 배치 순서와 CSS 유틸리티 클래스(`!bottom-12 !right-2` 등)만 교체. 신규 식별자 아님.
  - `data-testid="panel"` — 테스트 파일의 `vi.mock("@xyflow/react", …)` 목(mock) 컴포넌트에만 부여된 테스트 전용 속성으로, 프로덕션 코드에는 존재하지 않는다. 저장소 전체에서 동일 testid 사용처를 검색해도 다른 곳과 충돌하지 않는다(`grep -rn 'data-testid="panel"' codebase/frontend/src` → 해당 테스트 파일 외 매치 없음).
  - `function twSpacingPx(...)` — 테스트 파일 내부 로컬 헬퍼 함수. 모듈 스코프 밖으로 export 되지 않으며, 요구사항 ID·엔티티·API·이벤트·ENV·spec 파일 경로 어느 범주에도 해당하지 않는다.

## 점검 관점별 결과

1. **요구사항 ID 충돌** — 해당 없음(신규 ID 없음).
2. **엔티티/타입명 충돌** — 해당 없음(신규 타입·인터페이스·DTO 없음).
3. **API endpoint 충돌** — 해당 없음(신규 endpoint 없음).
4. **이벤트/메시지명 충돌** — 해당 없음(신규 webhook/queue/SSE 이벤트 없음).
5. **환경변수·설정키 충돌** — 해당 없음(신규 ENV/설정 키 없음).
6. **파일 경로 충돌** — 신규 spec 파일 없음. 변경된 코드/문서 파일(`canvas-minimap.tsx`, `canvas-minimap.test.tsx`, `canvas-basics.mdx`, `canvas-basics.en.mdx`)은 모두 기존 파일의 in-place 수정이며 기존 명명 컨벤션과 무관.

### 발견사항

없음.

### 요약

이번 diff(origin/main...HEAD)는 spec 을 전혀 변경하지 않고, 미니맵이 토글 버튼을 가리는 UI 버그를 CSS 위치 값 교체로 수정한 순수 코드 fix 다. `git diff` 를 SoT 로 직접 전수 스캔한 결과 신규로 도입된 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·설정키·spec 파일 경로가 전혀 없으며, 유일하게 새로 등장한 식별자(`twSpacingPx` 테스트 헬퍼, mock 전용 `data-testid="panel"`)는 테스트 파일 로컬 스코프에 국한되어 다른 어떤 기존 사용처와도 충돌하지 않는다. 따라서 신규 식별자 충돌 관점에서 지적할 사항이 없다.

### 위험도

NONE
