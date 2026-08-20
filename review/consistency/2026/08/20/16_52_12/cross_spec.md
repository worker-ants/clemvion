STATUS=success cross_spec review complete (0 CRITICAL, 0 WARNING, 1 INFO)
===REPORT_MARKDOWN_BELOW===
# Cross-Spec 일관성 검토 — `spec/5-system/` (`Execution.inputData`/`NodeExecution.inputData` egress 마스킹 전환, impl-done)

## 검토 방법

`_prompts/cross_spec.md` 는 컨텍스트 예산 초과로 `spec/5-system/14-external-interaction-api.md`
본문과 `<git diff origin/main...HEAD -- code_areas>` 를 포함하지 못했다(둘 다 "의도된 절단"으로
명시). 두 항목 모두 이 변경의 핵심(EIA §R17 마스킹 카탈로그, 프런트/백엔드 diff)이라, 워크트리
절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/eia-inputdata-marker-guard`)에서
직접 `git diff origin/main...HEAD -- spec/**` 와 `grep -rn`/`Read` 로 재조사했다.

대상 diff (spec 7파일): `spec/1-data-model.md` §2.13/§2.14, `spec/3-workflow-editor/3-execution.md`
§5.1 히스토리 로드 + §5.2 inputData 데이터 흐름 정정, `spec/4-nodes/1-logic/12-background.md`
nodeExecutions.data 표, `spec/5-system/6-websocket-protocol.md` §2.2 캐비엇,
`spec/5-system/12-webhook.md` §5.3 ingestion 방어 이중화 서술, `spec/5-system/13-replay-rerun.md`
§10.2 모달 마커 가드, `spec/5-system/14-external-interaction-api.md` §R17 카탈로그(잔여 ② 종결).
단일 서사: `Execution.inputData` 의 egress 값-패턴 마스킹 카브아웃을 프런트 마커 가드
(`masked-markers.ts` + 세 소비처: `dynamic-form-ui.tsx`/`rerun-modal.tsx`/`editor-toolbar.tsx`)로
폐지.

이번 라운드(HEAD 직전 커밋 `6f1d4d41d`)는 위 spec 서사에 대한 **코드 전용** 후속 수정(마커 탐색
재귀 깊이 상한)이라 spec diff 는 직전 cross-spec 검토(`review/consistency/2026/08/20/16_26_26/`)
시점에서 변경이 없다. 이번 회차는 그 결론을 독립적으로 재검증한 것이다.

## 발견사항

### 데이터 모델 충돌 — 없음

`Execution.input_data`/`NodeExecution.input_data` 두 컬럼의 마스킹 서술이
`spec/1-data-model.md` §2.13/§2.14, `spec/4-nodes/1-logic/12-background.md`,
`spec/5-system/{6-websocket-protocol,12-webhook,13-replay-rerun,14-external-interaction-api}.md`
전부에서 "두 레벨 모두 egress 값-패턴 마스킹, DB 는 원문 보존"으로 일치한다. 구 카브아웃 문구
("마스킹 대상이 아니다"/"카브아웃"/"잔여 ②")가 남은 자리를 `grep -rln` 으로 전수 확인했는데,
7개 대상 파일 밖에서는 한 건도 검출되지 않았고, 대상 파일 내에서도 전부 "2026-08-20 이전에는…"
시제 캐비엇으로 과거형 처리돼 현재형 모순이 없다.

### API 계약 충돌 — 없음

REST(`GET /api/executions/:id`)·WS(`execution.node.*` emit)·Background-run 조회 세 표면이
"같은 프런트 store 슬롯에 들어가므로 flip-flop 방지 위해 동일 마스킹 정책"이라는 동일 근거로
일관되게 갱신됐다(`spec/1-data-model.md` §2.13/§2.14 · `spec/5-system/6-websocket-protocol.md`
§2.2/§4.1 · `spec/4-nodes/1-logic/12-background.md`). `spec/5-system/2-api-convention.md`·
`3-error-handling.md` 등 generic 계약 문서는 필드별 마스킹과 무관해 갱신 대상이 아니며 실제로
손대지 않았다 — 정합.

### 요구사항 ID 충돌 — 없음

새 요구사항 ID 도입 없음(`RR-PL-02`/`RR-PL-06` 등 기존 ID 문서 보강만). 신규 i18n 키
`history.rerun.maskedInputBlocked` 도 다른 i18n 키·요구사항 ID 와 충돌하지 않는다.

### 상태 전이 충돌 — 없음

Execution/NodeExecution 상태 머신(§status)은 미변경. Re-run 제출 차단은 클라이언트 레벨
게이트(버튼 disable)일 뿐 서버 상태 전이 규약(`spec/5-system/4-execution-engine.md`)과 무관하다.
`RR-PL-06`(권한 부족 시 모달 disabled)과 신규 마커 가드(마스킹 필드 미해소 시 disabled)는
서로 다른 조건의 별개 disable 사유로 §10.2 표에 함께 병기돼 있어 혼동 여지가 없다.

### 권한·RBAC 모델 충돌 — 없음

채널 인가(`execution:{id}` workspace 소유 검증, §3.3)·웹훅 인증(§4)은 변경 대상이 아니다.
`spec/5-system/12-webhook.md` 의 "인증 무영향"(마스킹은 인증 이후 계층) 원칙이 이번 diff 에도
그대로 유지된다는 문장이 §5.3 캐비엇 갱신분에 남아 있다.

### 계층 책임 충돌 — 없음

`masked-markers.ts` 가 `codebase/frontend/src/lib/utils/` 에 위치하고 `components/editor/**`·
`components/executions/**` 세 컴포넌트가 이를 소비하는 구조는 `spec/conventions/
frontend-layering.md` §1 의 허용 방향(`components → lib`, 금지: `lib → components`)과
정확히 부합한다(역방향 위반 없음, `eslint-layering-guard` 권위 판정 대상 코드 위치도 규약과
일치).

### **[INFO]** `Execution.inputData` 마스킹이 여전히 두 독립 메커니즘으로 병존

- target 위치: `spec/5-system/14-external-interaction-api.md` §R17 카탈로그, "잔여 ③ (범위 밖
  유지)" 불릿 (`token` 계열 확장 불릿 바로 아래)
- 충돌 대상: `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 "마스킹 규칙"
  (workflow-assistant `explore-tools.service.ts` 가 `get_execution_details` 등에서 쓰는
  `maskSensitiveFields` — 키 이름 기반, `****9876` 접미 힌트 보존)
- 상세: `Execution.inputData`(그리고 `outputData`/`error`)는 노출 경로에 따라 서로 다른 두
  마스킹 구현을 탄다 — (1) REST/WS egress 관문(`toResponseExecution`/`emitExecutionEvent`)의
  §R17 값-패턴 마스킹(자유 텍스트 안 자격증명 형태를 `***` 로), (2) AI Assistant 도구가
  Repository 를 직접 읽어 응답 직전 적용하는 `maskSensitiveFields`(자격증명 **키 이름** 매칭만,
  자유 텍스트 안에 박힌 리터럴은 통과). 두 메커니즘은 이번 diff 가 새로 만든 충돌이 아니라
  기존부터 있었고, EIA 문서 자신이 "값-패턴을 단순 합성하면 안 된다(접미 힌트 소실 회귀)"는
  근거까지 들어 명시적으로 분리해 뒀다. 다만 이번 diff 로 `Execution.inputData` 의 REST/WS
  egress 쪽 카브아웃이 막 닫혀 "이제 `inputData` 는 전부 §R17 값-패턴 마스킹을 탄다"로 오독할
  여지가 조금 더 커졌다 — 두 문서를 같이 봐야 AI Assistant 표면은 여전히 키-이름 기반이라는
  전체 그림이 보인다.
- 제안: 조치 불요(이미 상호 링크·경계·근거가 문서화돼 있음). 후속 세션이 `Execution.inputData`
  마스킹을 다시 건드릴 때는 `spec/3-workflow-editor/4-ai-assistant.md` 의 `explore-tools`
  마스킹도 같은 turn 재검토 대상인지 판단 근거로만 남겨 둔다.

## 요약

`Execution.inputData`/`NodeExecution.input_data` egress 마스킹 카브아웃 폐지는 spec 7파일
(데이터 모델·워크플로 에디터·Background 노드·웹훅·Re-run·WebSocket 프로토콜·EIA)에 걸쳐 있지만,
모든 파일이 "프런트 마커 가드가 재제출 오염을 차단하므로 카브아웃 조건이 해소됐다"는 동일 근거를
공유하고 "2026-08-20 이전에는…" 캐비엇으로 과거·현재 서술을 정확히 분리해 뒀다. 데이터 모델·API
계약·요구사항 ID·상태 전이·RBAC·계층 책임 여섯 관점 전부에서 새 모순을 발견하지 못했으며,
구 카브아웃 문구의 현재형 잔존도 grep 전수 검사로 0건 확인했다. 이번 회차(HEAD 직전 커밋)는
코드 전용 후속 수정(마커 탐색 재귀 깊이 상한)이라 spec 서사 자체는 직전 cross-spec 검토와
동일 상태이고, 독립 재조사로도 같은 결론(NONE)에 도달했다. 유일한 항목은 spec 스스로 이미
"범위 밖"으로 명시해 둔 AI Assistant 별도 마스킹 경로와의 의도적 병존이며 이번 변경이 만든
모순이 아니다.

## 위험도

NONE
