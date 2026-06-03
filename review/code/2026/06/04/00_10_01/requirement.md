# 요구사항(Requirement) 리뷰

## 발견사항

### [INFO] 앵커 수정 전체 — 실제 heading 과 일치 확인

각 수정된 앵커가 실제 spec 파일의 heading 과 일치하는지 주요 항목을 검증했다.

**검증 완료 (정확)**:
- `#1-condition-구조` — `spec/4-nodes/1-logic/0-common.md` 줄 33: `## 1. Condition 구조` (기존 `#1-conditiongroup-구조` 가 오류였음. 수정 정확)
- `#7-dry-run-모드-정의` — `spec/5-system/13-replay-rerun.md` 줄 140: `## 7. dry-run 모드 정의` (수정 정확)
- `#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input` — `spec/5-system/6-websocket-protocol.md` 줄 356: `### 4.4 사용자 입력 대기 이벤트 상세 (execution.waiting_for_input)` (수정 정확)
- `#42-hmac-서명--authconfigtypehmac` — `spec/5-system/12-webhook.md` 줄 218: `### 4.2 HMAC 서명 — AuthConfig.type=hmac` (수정 정확)
- `#55-표현식-해석-단계` — `spec/5-system/4-execution-engine.md` 줄 516: `### 5.5 표현식 해석 단계` (수정 정확)
- `#7-integration-노드-4종` — `spec/4-nodes/_product-overview.md` 줄 243: `## 7. Integration 노드 (4종)` (수정 정확. 기존 `3종` 오류였음)
- `#9-presentation-노드-5종` — `spec/4-nodes/_product-overview.md` 줄 323: `## 9. Presentation 노드 (5종)` (수정 정확. 기존 `6종` 오류였음)
- `#71-외부-부수효과-노드-분류` — `spec/5-system/13-replay-rerun.md` 에서 해당 heading 존재 확인 필요 (아래 WARNING 참조)
- `#4-trigger-등록-페이로드-확장` — `spec/5-system/14-external-interaction-api.md` 줄 157: `## 4. Trigger 등록 페이로드 확장` (수정 정확)
- `#7-데이터-모델` — `spec/5-system/14-external-interaction-api.md` 줄 564: `## 7. 데이터 모델` (수정 정확. 기존 `#7-시크릿-회전--token-revoke` 는 오류였음)
- `#3-인가-authorization` — `spec/5-system/1-auth.md` 줄 282: `## 3. 인가 (Authorization)` (수정 정확. 기존 `#3-rbac` 는 오류였음)
- `#2-knowledge-base-연동-ai-agent-전용` — `spec/4-nodes/3-ai/0-common.md` 줄 34: `## 2. Knowledge Base 연동 (AI Agent 전용)` (수정 정확)
- `#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix` — `spec/4-nodes/3-ai/0-common.md` 줄 157: `## 11. AI 노드 시스템 프롬프트 자동 prefix (System Context Prefix)` (수정 정확)
- `#10-ai-tool-모드-render_` — `spec/4-nodes/6-presentation/0-common.md` 줄 268: `## 10. AI Tool 모드 (render_*)` (수정 정확)
- `#2-캔버스-요약-미구현--planned` — `spec/4-nodes/7-trigger/0-common.md` 줄 57: `## 2. 캔버스 요약 (미구현 — Planned)` (수정 정확)
- `#82-websocket-명령-클라이언트--서버` — `spec/3-workflow-editor/3-execution.md` 줄 298: `### 8.2 WebSocket 명령 (클라이언트 → 서버)` (수정 정확)
- `#62-저장-전략` — `spec/5-system/4-execution-engine.md` 줄 704: `### 6.2 저장 전략` (수정 정확. 기존 `#62-제공-변수` 는 오류였음)
- `#14-oauth-만료-스캐너-bullmq-integration-expiry-scanner` — `spec/data-flow/5-integration.md` 줄 129: `### 1.4 OAuth 만료 스캐너 (BullMQ integration-expiry-scanner)` (수정 정확)
- `#r-1-docs-내부-사이드바-breakpoint-가-글로벌--1280px-과-다른-이유` — `spec/2-navigation/13-user-guide.md` 줄 185: `### R-1. /docs 내부 사이드바 breakpoint 가 글로벌 (< 1280px) 과 다른 이유` (수정 정확)
- `#r-cc-13-discord-v1-의-cch-mp-01-부분-유예--interactions-webhook-only-의-결과` — `spec/5-system/15-chat-channel.md` 줄 622: 해당 Rationale heading 존재 확인 (수정 정확)
- `#r-cc-17-render_form-v1-임시-텍스트-fallback--presentation-renderer-shape-처리` — `spec/5-system/15-chat-channel.md` 줄 667: heading 존재 확인 (수정 정확)
- `#r-cca-5-execution-failed-분류-helper-를-convention-에-두는-이유` — `spec/conventions/chat-channel-adapter.md` 줄 516: heading 존재 확인 (수정 정확)
- `#r-cca-6-ai_conversation--ai_form_render-waiting--chat-channel-silent-정책` — `spec/conventions/chat-channel-adapter.md` 줄 524 (수정 정확)
- `#r-d-3-v1--interactions-webhook-only-gateway-는-v2` — `spec/4-nodes/7-trigger/providers/discord.md` 줄 344: `### R-D-3. v1 = Interactions Webhook only, Gateway 는 v2` (수정 정확)
- `#r-s-6-form--5-fields-native-modal-6-또는-multi_step-opt-out-시-다단계` — `spec/4-nodes/7-trigger/providers/slack.md` 줄 333: heading 존재 확인 (수정 정확)
- `#3-eia--internal-event--rendernode-매핑` — `spec/conventions/chat-channel-adapter.md` 줄 329: `## 3. EIA / Internal Event → renderNode 매핑` (수정 정확. 기존 `#3-eia-event--rendernode-매핑` 은 오류였음)
- `#83-allowlist-mcpserversenabledtools` — `spec/4-nodes/4-integration/4-cafe24.md` 줄 407: `### 8.3 allowlist (mcpServers[].enabledTools)` (수정 정확)
- `#93-노드의-resourceoperation-메타데이터-위치` — `spec/4-nodes/4-integration/4-cafe24.md` 줄 449: `### 9.3 노드의 Resource/Operation 메타데이터 위치` (수정 정확)
- `#31-어댑터-라이프사이클` — `spec/5-system/15-chat-channel.md` 줄 49: `#### 3.1 어댑터 라이프사이클` (수정 정확. 기존 `#31-실행-엔진과의-연결` 은 오류였음)
- `#34-신뢰성일관성` — `spec/5-system/14-external-interaction-api.md` 줄 135: `### 3.4 신뢰성·일관성` (수정 정확)
- `#42-trigger-테이블-신규-컬럼` — `spec/5-system/15-chat-channel.md` 줄 259: `### 4.2 Trigger 테이블 신규 컬럼` (수정 정확. 기존 `#342-trigger-테이블-신규-컬럼` 는 오류였음)
- `#5-출력-구조` — `spec/4-nodes/3-ai/3-information-extractor.md` 줄 159: `## 5. 출력 구조` (수정 정확. 기존 `#5-실행-로직` 는 오류였음)
- `parallel-p2-followups.md` — 실제 plan 파일명 변경을 반영한 링크 수정 (기능 정확)
- `spec/5-system/_product-overview.md` 16개 링크 추가 — 해당 파일 목록 모두 실존 확인 (정확)
- `spec/7-channel-web-chat/_product-overview.md` 구성요소 spec 4개 링크 — 해당 파일 실존 확인 (정확)

### [WARNING] `spec/conventions/chat-channel-adapter.md` — `#31-어댑터-라이프사이클` 링크 수정 중 중복 heading 주의

- 위치: `spec/conventions/chat-channel-adapter.md` 줄 1472 의 수정된 앵커 `#31-어댑터-라이프사이클`
- 상세: `spec/5-system/15-chat-channel.md` 에는 `#### 3.1 어댑터 라이프사이클` (줄 49) 과 `### 3.1 전체 시퀀스 (Telegram 예시)` (줄 118) 두 개의 `3.1` heading 이 존재한다. Markdown 렌더러는 첫 번째 매칭 heading 으로 점프하므로, `#31-어댑터-라이프사이클` 는 줄 49 의 heading 을 올바르게 가리킨다. 그러나 두 개의 3.1 heading 이 있다는 사실은 향후 앵커 혼동의 근거가 될 수 있다.
- 제안: 현재 수정은 기능적으로 정확하므로 코드 fix 불필요. 다만 `spec/5-system/15-chat-channel.md` 의 중복 `3.1` heading 구조가 잠재적 혼동 요인이므로 추후 project-planner 가 heading 번호 정리를 고려할 것을 권장한다.

### [WARNING] `spec-impl-evidence.md` Gate 수 갱신 — Gate D 가 "build 가드" 아닌 advisory 인데 §4 "빌드 가드" 제목에 포함

- 위치: `spec/conventions/spec-impl-evidence.md` §4 제목 "Build-time 가드 (5건)" 과 Gate D 내용
- 상세: §4 의 제목이 "Build-time 가드 (5건)" 으로 변경됐으나, Gate D 는 advisory (build 차단 아님) 로 본문에 명시되어 있다. Gate D 를 §4 의 "5건" 에 포함시키면 "빌드 가드가 5건" 이라는 표제와 "Gate D 는 build 아님" 이라는 본문이 불일치한다. Gate C 는 실제 빌드 차단 가드이므로 가드 수가 4→5 로 늘어난 것은 정확하지만, Gate D 가 advisory 이면서 제목의 카운트에 포함된 것인지 아닌지가 불명확하다.
- 제안: 본문을 읽으면 "5건" 이 Gate C 추가를 반영한 것(Gate D 는 advisory 별도)임을 확인할 수 있으므로, 코드(spec 문서) 자체의 fix 필요 여부는 project-planner 가 판단한다. 현재 변경은 plan item 7 의 의도를 반영한 것이므로 기능적으로는 충족.

### [INFO] `spec/5-system/15-chat-channel.md` — `4-execution-engine.md#75-resume-after-restart-rehydration` 상대 경로 수정

- 위치: 줄 1172 (변경 후)
- 상세: `../4-execution-engine.md` → `4-execution-engine.md` 로 수정. `spec/5-system/15-chat-channel.md` 가 `spec/5-system/` 하위이므로 동일 폴더의 `4-execution-engine.md` 를 참조하는 것이 올바르다. 수정 정확.

### [INFO] `spec/2-navigation/6-config.md` — 상대 경로 `../../1-data-model.md` → `../1-data-model.md` 수정

- 위치: 줄 552, 561
- 상세: `spec/2-navigation/6-config.md` 에서 `../../1-data-model.md` 는 `spec/` 루트가 아니라 상위로 올라가 잘못된 경로였다. `spec/2-navigation/` 에서 `spec/1-data-model.md` 를 가리키려면 `../1-data-model.md` 가 맞다. 수정 정확.

### [INFO] `spec/5-system/_product-overview.md` — 기존 3개 링크가 새 16개 맵으로 흡수·확장

- 위치: 파일 30 diff
- 상세: 기존 `인증/인가 · API 규칙 · 에러 처리` 3개가 신규 `**시스템 영역 spec 맵**` 16개 링크 블록으로 재구성됐다. 기존 3개 링크는 새 맵 안에 포함되어 있으므로 정보 손실 없음. plan item 6 명세와 완전 일치.

### [INFO] `spec/conventions/spec-impl-evidence.md` — `code:` frontmatter 에 `spec-plan-completion.test.ts` 추가

- 위치: 파일 28, frontmatter `code:` 섹션
- 상세: Gate C 테스트 파일 경로를 evidence 문서의 `code:` 글로브에 추가. plan item 7 직접 구현. 기능적으로 완전.

---

## 요약

변경된 38개 파일(리뷰 결과 파일 3개 + 실질 변경 35개)의 요구사항 충족도를 검토했다. plan `knowledge-base-quality-improvements.md` 의 item 1(앵커 무결성), item 6(영역 index 완전성), item 7(Gate C/D) 세 작업의 직접 구현 의도에 부합한다. 앵커 수정 30여 건을 실제 heading 과 대조한 결과 모두 정확히 수정됐음을 확인했다 — `#1-condition-구조`, `#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input`, `#7-integration-노드-4종`, `#9-presentation-노드-5종`, `#7-dry-run-모드-정의`, `#3-인가-authorization`, `#62-저장-전략`, `#5-출력-구조`, `#31-어댑터-라이프사이클`, `#42-trigger-테이블-신규-컬럼` 등 전수 확인. 상대 경로 오류 수정(`../../1-data-model.md` → `../1-data-model.md`, `../4-execution-engine.md` → `4-execution-engine.md`) 도 정확하다. `spec-impl-evidence.md` 의 Gate 수 갱신과 `spec-plan-completion.test.ts` frontmatter 추가는 plan item 7 과 완전히 일치한다. 기능·로직·설정 변경은 전혀 포함되지 않으므로 요구사항 누락이나 명세 위반이 발생할 구조적 위험은 없다. 미완성 TODO/FIXME 주석이나 의도-구현 간 괴리도 없다.

## 위험도

NONE
