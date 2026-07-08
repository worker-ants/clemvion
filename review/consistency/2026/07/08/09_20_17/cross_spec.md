# Cross-Spec 일관성 검토 — 재실행 (저장 모델 정정 검증)

## 재실행 배경
`spec/3-workflow-editor/0-canvas.md` 는 워크플로우 에디터의 저장 모델을 "타이머 자동 저장 없음, 수동 저장(Ctrl+S/Save) + 실행 직전 저장만, 설정 패널은 `변경 저장`/`JSON 적용` 명시 클릭" 으로 정정하는 spec-정정 draft다 (§8, §8.1, §5.3.1, `## Rationale` R-3, 2026-07-08). 직전 회차 검토에서 이 정정과 모순되는 CRITICAL 2건이 다른 spec 영역에서 발견되었고, 이번 회차는 (1) 그 2건이 현재 워킹트리에서 실제로 수정되었는지 검증하고 (2) `spec/**` 전역을 재스윕해 동일 유형의 잔존 모순이 더 있는지 확인한다.

## 발견사항

### 직전 CRITICAL 2건 — 수정 확인: 해소됨

- **[해소 확인]** `spec/0-overview.md` §3.3 "상세/설정 패널 패턴" (line 306)
  - 이전: `변경사항 자동 저장 (에디터)` — canvas §8 의 "타이머 자동 저장 없음" 과 정면 모순.
  - 현재: `저장 방식: 설정 패널은 저장/취소(또는 변경 저장) 버튼, 워크플로우 에디터 캔버스는 수동 저장(Ctrl+S·Save) + 실행 직전 저장 (타이머 자동 저장 없음 — 상세: [캔버스 §8](3-workflow-editor/0-canvas.md#8-저장))`
  - `spec/3-workflow-editor/0-canvas.md` §8(line 506: "**주기적(타이머) 자동 저장은 두지 않는다**")과 완전히 일치. 앵커 링크(`#8-저장`)도 유효. **모순 해소.**

- **[해소 확인]** `spec/4-nodes/0-overview.md` §1.4 "캔버스 설정 요약(summaryTemplate)" 표 "업데이트" 행 (line 137)
  - 이전: `실시간 (2초 디바운스)` — canvas 가 이번에 폐기한 "2초 디바운스 자동 저장" 모델의 잔재.
  - 현재: `노드 config 가 store 에 반영되면 즉시 갱신 (상세: 캔버스 §5.3.1)`
  - `spec/3-workflow-editor/0-canvas.md` §5.3.1(line 328: "노드 config 가 store 에 반영되면(설정 패널 `변경 저장`·`JSON 적용`, 어시스턴트 편집 등) 요약도 즉시 갱신")과 트리거 조건("config 가 store 에 반영된 시점")이 정확히 일치. "2초 디바운스"라는 타이머성 표현은 완전히 제거됨. **모순 해소.**

두 수정 모두 `spec/3-workflow-editor/_product-overview.md` 의 ED-SP-05("설정 변경을 `변경 저장`·`JSON 적용` 으로 캔버스에 반영")·ED-SV-02("실행 직전 자동 저장 … 주기적(타이머) 자동 저장은 두지 않음")과도 정합적이며, `spec/3-workflow-editor/2-edge.md` §8(line 215: "사용자가 저장(`Ctrl+S`·`Save` / 실행 직전 저장)할 때 서버에 확정")·`spec/data-flow/11-workflow.md`(line 128-129: "수동 Save … auto-save 는 없으며, 500ms debounce 는 저장이 아니라 graph-warning 사전 평가용")와도 일관되게 맞물린다.

### 전역 스윕 결과 — 신규 CRITICAL 없음

`spec/**` 전체에서 `자동 저장` / `디바운스`(2초 포함) / `즉시 반영` / `즉시 갱신` / `오프라인 로컬 스토리지` / `동시 편집 충돌` / `저장 버튼 불필요` 를 grep 하여 전수 대조했다. 저장 모델과 실제로 관련된 문서는 위 2건 및 canvas §8/R-3 자신뿐이며, 나머지 매치는 모두 무관한 도메인이거나 지시된 대로 정상(미충돌)이다.

- **정상(미충돌) — AI Assistant "즉시 반영"**: `spec/3-workflow-editor/4-ai-assistant.md` (lines 25, 54, 155, 375, 552, 778, 819, 1399), `_product-overview.md` ED-AI-16. 전부 "편집 결과가 `editor-store`(in-memory) 에 즉시 반영 + Undo push"를 가리키며 line 819 는 "DB 영구 기록은 사용자의 Save 를 통해서만" 이라 명시해 canvas §8 의 서버 영구 저장 레이어와 명확히 구분된다. 지시대로 플래그하지 않음.
- **무관한 도메인의 "자동 저장"/"즉시 반영"**: `spec/1-data-model.md:595`, `spec/5-system/7-llm-client.md:452`, `spec/5-system/9-rag-search.md:406`, `spec/2-navigation/6-config.md:180,345` (LLM/embedding ModelConfig dimension 자동 감지·저장 — 워크플로우 캔버스와 무관), `spec/2-navigation/4-integration.md:1605` (다중 pod 캐시 미동기), `spec/7-channel-web-chat/5-admin-console.md:196,290` (웹챗 위젯 미리보기 `wc:boot` 재전송), `spec/4-nodes/1-logic/5-variable-modification.md:95` (실행 중 변수 컨텍스트 전파, 에디터 저장과 무관).
- **참고(정보성, 이슈 아님)**: `spec/2-navigation/13-user-guide.md:55` 는 IA 트리에서 `saving-and-sharing` 페이지 제목을 "저장·자동저장·가져오기/내보내기"로 표기한다. 실제 콘텐츠(`codebase/frontend/src/content/docs/03-workflow-editor/saving-and-sharing.mdx`)를 대조하면 이 "자동저장"은 "실행 시 자동 저장"(save-before-run) 한 항목만 가리키고 타이머 자동 저장을 서술하지 않아 canvas §8 과 모순되지 않는다.

### [WARNING] (직전 회차 이월, 이번 정정과는 무관 — 여전히 유효)

- **ED-PL-05(마켓플레이스 팔레트 표시, "필수") 와 canvas §4.1 의 backlog 처리 사이 우선순위 미조정**
  - target 위치: `spec/3-workflow-editor/0-canvas.md` §4.1 "**미구현 (Planned)**: `▼ Installed`(마켓플레이스) 섹션은 아직 렌더되지 않는다 … 마켓플레이스 모듈 도입 후로 미룬다 (backlog)" + Rationale R-1
  - 충돌 대상: `spec/3-workflow-editor/_product-overview.md` line 73 — `ED-PL-05 | 마켓플레이스에서 설치한 커스텀 노드도 팔레트에 표시 | 필수`
  - 상세: PRD 표는 ED-PL-05 를 여전히 "필수"로 유지하지만, 상세 spec(canvas §4.1/R-1)은 마켓플레이스 모듈 선행 의존 backlog 로 명시적으로 미룬다. 이번 저장 모델 정정과는 무관한 기존 gap 이며, 이번 diff 로 인해 새로 생기거나 악화되지 않았다.
  - 제안: `_product-overview.md` ED-PL-05 우선순위를 "권장" 으로 낮추거나 "(마켓플레이스 모듈 선행 필요 — backlog, 상세: 0-canvas §4.1 R-1)" 각주 추가.

## 요약
이번 spec-정정(저장 모델을 "타이머 자동 저장 없음, 수동 저장 + 실행 직전 저장" 으로 현재 구현에 맞춰 정정)의 파급 범위 밖에 있던 `spec/0-overview.md §3.3`(변경사항 자동 저장)과 `spec/4-nodes/0-overview.md §1.4`(2초 디바운스)의 CRITICAL 모순 2건은 현재 워킹트리에서 모두 정정 완료되어, `spec/3-workflow-editor/0-canvas.md` §8/§8.1/§5.3.1/Rationale R-3 및 관련 PRD 요구사항(ED-SP-05, ED-SV-02)과 완전히 일치한다. `spec/**` 전역을 "자동 저장"/"디바운스"/"즉시 반영" 키워드로 재스윕한 결과 저장 모델과 관련된 추가 CRITICAL 은 발견되지 않았다 — 남은 "즉시 반영" 용례는 지시대로 AI Assistant in-memory 편집(정상) 또는 완전히 별개 도메인(LLM config dimension, 실행 중 변수 컨텍스트, 웹챗 위젯 미리보기, 캐시 동기화)에 속한다. 이번 정정과 무관한 기존 WARNING(ED-PL-05 우선순위 vs backlog 처리) 1건만 이월된다.

## 위험도
LOW
