---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# edge — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 유지하며 분리한 미구현 항목 추적.
> 관련 spec: spec/3-workflow-editor/2-edge.md
> 주의: AI Agent Tool Area(§7) 관련 재설계는 별도 plan `ai-agent-tool-connection-rewrite.md` 가 담당 — 본 plan 은 엣지 생성/유효성/실행상태/데이터미리보기 갭만 추적한다.

## 미구현 항목
- [ ] §1.2 출력 포트 드래그 → 빈 영역 드롭 시 노드 추가 검색 팝업 + 자동 엣지 연결 (`onConnectEnd` 핸들러 부재; 현재 팝업은 더블클릭/우클릭 메뉴로만)
- [ ] §1.3 입력 포트 시작 역방향 연결 + 기존 엣지 분리 재연결 모드 (`onReconnect`/역방향 드래그 핸들러 부재)
- [ ] §2.2 금지 연결 검사 — 자기연결(source===target), 출력→출력 / 입력→입력, 동일 연결 중복 + 커서 금지 아이콘·툴팁
- [ ] §2.3 엣지 생성 시 DFS 사이클 검사 / DAG 검증 + "순환 연결은 허용되지 않습니다" 툴팁 (Loop/ForEach body 예외 포함)
- [ ] §3.2 실행 상태 스타일 — 데이터 흐름(애니메이션 점선), 실행 완료(초록 잠시), 비활성 노드(반투명 점선)
- [ ] §4 / §5 엣지 호버 데이터 미리보기 툴팁 (Data Flow Preview) + 축약 표시 + 전체 데이터 모달
- [ ] §4 엣지 중간 노드 드롭 삽입 (source→새노드, 새노드→target)

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings 및 위 spec 본문의 "현재 구현" 주석 참조.
- 구현된 부분(§2.1 출력→입력 방향 강제, §3.1 포트색, §3.3 hover dim/glow, §4 클릭/Delete/hover 하이라이트)은 spec 본문 그대로 정확.
