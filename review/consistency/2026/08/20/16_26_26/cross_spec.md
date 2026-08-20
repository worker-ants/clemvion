STATUS=success cross_spec review complete (0 CRITICAL, 0 WARNING, 1 INFO)
===REPORT_MARKDOWN_BELOW===
# Cross-Spec 일관성 검토 — `spec/5-system/` (`Execution.inputData` 마커 가드, impl-done)

## 검토 방법
`_prompts/cross_spec.md` 는 컨텍스트 예산 초과로 `spec/5-system/14-external-interaction-api.md`
본문과 `<git diff origin/main...HEAD -- code_areas>` 를 포함하지 못했다(둘 다 "의도된 절단"으로
명시됨). 두 항목 모두 이 변경의 핵심(EIA §R17 마스킹 카탈로그, 프런트/백엔드 diff)이라 프롬프트
대신 워크트리 절대경로에서 직접 `git diff origin/main...HEAD` 및 `Read`/`grep` 으로 재조사했다.

대상 diff: `spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`,
`spec/4-nodes/1-logic/12-background.md`, `spec/5-system/{6-websocket-protocol,12-webhook,
13-replay-rerun,14-external-interaction-api}.md` (7개 spec 파일, `Execution.inputData` egress
마스킹 카브아웃 폐지 + 프런트 마커 가드 3곳 신설을 다루는 단일 서사).

## 발견사항

### 데이터 모델 충돌 — 없음
`Execution.input_data`/`NodeExecution.input_data` 두 컬럼의 마스킹 서술이
`spec/1-data-model.md` §2.13/§2.14, `spec/4-nodes/1-logic/12-background.md`,
`spec/5-system/6-websocket-protocol.md`, `spec/5-system/12-webhook.md`,
`spec/5-system/13-replay-rerun.md`, `spec/5-system/14-external-interaction-api.md` §R17 전부에서
"두 레벨 모두 egress 값-패턴 마스킹, DB 는 원문 보존" 으로 일치한다. 예전 카브아웃 문구
("마스킹 대상이 아니다"/"카브아웃")를 남긴 자리는 전부 "2026-08-20 이전에는" 이라는 시제
캐비엇을 붙여 과거형으로 정정했고, 하나도 현재형 모순으로 남지 않았다 (grep 전수 확인).

### API 계약 충돌 — 없음
REST(`GET /api/executions/:id` 등)·WS(`execution.node.*` emit)·Background-run 조회
세 표면이 "같은 store 슬롯에 들어가므로 flip-flop 방지 위해 동일 마스킹 정책" 이라는 동일한
근거로 일관되게 갱신됐다. `spec/5-system/2-api-convention.md`·`3-error-handling.md` 등
generic 계약 문서는 이 필드별 마스킹과 무관해 갱신 불필요.

### 요구사항 ID 충돌 — 없음
이번 diff 는 새 요구사항 ID 를 도입하지 않는다(`RR-PL-02` 등 기존 ID 문서화만 보강). 새 i18n
키 `history.rerun.maskedInputBlocked` 도 다른 영역과 충돌하지 않는다.

### 상태 전이 충돌 — 없음
Execution/NodeExecution 상태 머신 자체는 변경되지 않았고, Re-run 제출 차단은 UI 레벨 게이트라
서버 측 상태 전이 규약과 무관하다.

### 권한·RBAC 모델 충돌 — 없음
채널 인가(`execution:{id}` workspace 소유 검증)·웹훅 인증(§4)은 변경 대상이 아니며, 마스킹은
인가 이후 계층이라는 기존 원칙(`spec/5-system/12-webhook.md` "인증 무영향")이 그대로 유지된다.

### 계층 책임 충돌 — 없음
`masked-markers.ts` 를 `codebase/frontend/src/lib/utils/` 로 승격해 세 컴포넌트
(`dynamic-form-ui.tsx`, `rerun-modal.tsx`, `editor-toolbar.tsx`)가 소비하는 구조는
`spec/conventions/frontend-layering.md` 의 `components → lib` 허용 방향과 정확히 일치한다
(역방향 위반 없음).

### **[INFO]** `Execution.inputData` 마스킹 메커니즘이 두 갈래로 남는다 — 문서화는 이미 정합
- target 위치: `spec/5-system/14-external-interaction-api.md` "잔여 ③" (§R17 카탈로그, `token`
  계열 확장 불릿 하단)
- 충돌 대상: `spec/3-workflow-editor/4-ai-assistant.md` (workflow-assistant `explore-tools`
  응답 envelope, `mask-sensitive-fields.util.ts` 키 기반 마스킹)
- 상세: `Execution.inputData` 는 이제 두 개의 **서로 다른** 마스킹 구현을 갖는다 — (1) REST/WS
  egress 관문(`toResponseExecution`/`emitExecutionEvent` 등)의 값-패턴 마스킹(§R17, 이번
  diff 의 주제), (2) AI Assistant `get_execution_details` 도구가 Repository 직접 조회 후 적용하는
  `maskSensitiveFields`(키 이름 기반, 접미 힌트 보존). 두 메커니즘은 이번 diff 로 새로 생긴
  충돌이 아니라 **이미 존재했고 EIA 문서 자신이 "잔여 ③ (범위 밖 유지)" 로 명시적으로 분리해
  뒀다** — 값-패턴을 단순 합성하면 `maskSensitiveFields` 의 `****9876` 접미 힌트가 사라지는
  회귀가 있어 의도적으로 병합하지 않는다는 근거까지 문서화돼 있다. 따라서 이는 미해결
  모순이 아니라 **의도적으로 병존하는 두 시스템**이며, 독자가 "`Execution.inputData` 는 이제
  전부 §R17 값-패턴 마스킹만 탄다" 로 오해할 여지만 남는다(두 문서를 동시에 봐야 전체 그림이
  보인다).
- 제안: 조치 불요(이미 상호 링크 및 경계가 명시됨). 후속 세션이 이 필드의 마스킹을 다시
  건드릴 때는 `spec/3-workflow-editor/4-ai-assistant.md` 의 `explore-tools` 마스킹도 같은
  turn 에서 재검토 대상인지 판단할 근거로만 남겨 둔다.

## 요약
`Execution.inputData` egress 마스킹 카브아웃 폐지는 7개 `spec/` 파일(데이터 모델·워크플로
에디터·Background 노드·웹훅·Re-run·WebSocket 프로토콜·EIA)에 걸쳐 있으나, 모든 파일이 동일한
근거("프런트 마커 가드가 재제출 오염을 차단하므로 카브아웃 조건이 해소됨")를 공유하고 날짜
캐비엇("2026-08-20 이전에는 …")으로 과거 서술과 현재 서술을 정확히 분리해 뒀다. grep 전수
검사로 스테일한 "마스킹 대상이 아니다"/카브아웃 현재형 서술이 하나도 남지 않았음을 확인했고,
프런트 신규 유틸(`masked-markers.ts`)의 위치도 `frontend-layering.md` 컨벤션과 정확히 부합한다.
유일하게 발견한 항목은 이미 spec 자신이 "범위 밖" 으로 명시해 둔 AI Assistant 별도 마스킹
경로와의 병존이며, 이는 이번 변경이 만든 모순이 아니라 사전에 문서화된 의도적 분리다. Cross-spec
관점에서 새 CRITICAL/WARNING 없음.

## 위험도
NONE
