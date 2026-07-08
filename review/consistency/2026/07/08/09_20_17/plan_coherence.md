# Plan 정합성 검토 — spec/3-workflow-editor/0-canvas.md

## 발견사항

- **[INFO]** `spec-draft-cross-audit-doc-batch.md` V-13 변경 3b 가 이미 target 에 반영된 채로 plan 만 in-progress 에 잔존
  - target 위치: `spec/3-workflow-editor/0-canvas.md` §5.3.1 예시(`gpt-4o · 1 KB`), §5.3.4 AI Agent 행("구 `{N} tools`(Tool Area) 폐기")
  - 관련 plan: `plan/in-progress/spec-draft-cross-audit-doc-batch.md` "변경 3b — 0-canvas.md §5.3 (미러 2곳)" — `· 2 tools`/`· {N} tools` 세그먼트 삭제를 "할 일"로 서술
  - 상세: `git log -S "구 \`{N} tools\`(Tool Area) 폐기"` 로 확인한 결과 해당 변경은 이미 커밋 `6b25ccc3e`(PR #820)에서 target 에 반영 완료됐고, 그 커밋이 이 plan 파일 자체를 신설한 커밋과 동일하다. 즉 plan 문서가 "이미 끝난 작업의 기록"을 여전히 미완료 TODO 형식으로 담고 있어 in-progress 목록만 보면 §5.3 이 아직 손대지 않은 것처럼 오인될 수 있다. target 자체와는 충돌 없음(내용이 이미 정합) — 순수 plan lifecycle 갱신 누락.
  - 제안: `spec-draft-cross-audit-doc-batch.md` 를 완료 처리해 `plan/complete/` 로 이동하거나(다른 항목 V-05/V-14/V-18 잔여 여부 확인 후), 최소한 변경 3b 항목에 완료 마커를 추가. target 은 수정 불필요.

- 그 외 target 이 명시한 `pending_plans` 2건(`ai-agent-tool-connection-rewrite.md`, `spec-sync-canvas-gaps.md`) 대조 결과 충돌 없음:
  - `spec-sync-canvas-gaps.md` — 금번 target diff(§8/§8.1 "자동 저장"→"저장" 재정의, Rationale R-3 신설)는 동일 세션에서 함께 갱신된 plan 항목("§8 자동 저장 + PRD ED-SP-05 — spec 정정으로 해소", 2026-07-08 결정, `[x]` 로 체크)과 완전히 일치한다. `git diff -- plan/in-progress/spec-sync-canvas-gaps.md` 로 plan 체크박스 갱신이 target 변경과 같은 diff 에 포함돼 있음을 확인. §4.1(Recent/Installed 분리), §10/§3.3/§11.3(구현됨 마킹) 도 plan 의 `[x]` 항목과 1:1 대응.
  - `ai-agent-tool-connection-rewrite.md` — §1 "디자인 결정" 5개 항목 전부 TBD 인 채로 남아 있고, target §12 박스("재작성 예정 (현재 제거됨)... 새 도구 연결 디자인이 결정될 때 갱신한다")는 그 미해결 상태를 그대로 존중한다. target 이 (a)/(b)/(c) 중 어느 모델도 선점하지 않음 — 미해결 결정 우회 없음.
  - `marketplace-and-plugin-sdk.md`(§4.1 Installed 섹션의 선행 조건으로 target Rationale R-1 이 인용) — plan §0 결정 사항(Phase 분할·호스팅·수익화 등) 전부 미결정 상태이고, target 은 이를 "마켓플레이스 모듈 도입 후로 미룬다"고만 서술해 선행 미해소 상태를 정확히 반영. 데이터 모델·UI 를 앞서 확정하지 않음.
- §11.4(중첩 최대 깊이 enforcement)·§11.2(시각 containment 미사용) 간 정합 요구는 target 자체 박스("§11.2 와 정합 주의... 재정의 대상")와 `spec-sync-canvas-gaps.md` 의 동일 항목("§11.2 '시각 containment 미사용' 과의 정합성 재정의 선행 필요")이 문구까지 일치 — 선행 조건 인지 및 명시가 이미 되어 있어 추가 조치 불필요.
- Parallel 관련 plan(`node-output-redesign/parallel.md`, `node-output-redesign/background.md`)이 "컨테이너"라는 용어를 실행-엔진 계약(Principle 9, `output:null` 오버라이트) 의미로 사용하는 것은 target §11 의 "UI 박스 렌더링" 의미의 컨테이너와 스코프가 달라 실제 충돌 아님(용어 중첩일 뿐, cross-spec 정합성 영역이지 plan 미해결 결정 충돌 아님).

## 요약

target(`spec/3-workflow-editor/0-canvas.md`)의 금번 변경(§8/§8.1 저장 모델 재정의 + Rationale R-3)은 같은 세션에서 함께 갱신된 `plan/in-progress/spec-sync-canvas-gaps.md` 의 결정 항목과 정확히 1:1 대응하며, frontmatter `pending_plans` 가 가리키는 두 plan(`ai-agent-tool-connection-rewrite.md`, `spec-sync-canvas-gaps.md`) 모두와 충돌·선행 미해소·후속 누락이 발견되지 않았다. 유일한 관찰 사항은 별개 plan(`spec-draft-cross-audit-doc-batch.md`)의 §5.3 관련 TODO 서술이 이미 과거 커밋에서 target 에 반영 완료됐음에도 plan 문서가 아직 in-progress 에 남아 있는 lifecycle 갱신 누락으로, target 자체의 정합성 문제는 아니다.

## 위험도
LOW
