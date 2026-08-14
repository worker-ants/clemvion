# Rationale 연속성 검토 결과

## 검토 범위

prompt_file 에 번들된 target(`spec/5-system/14-external-interaction-api.md`)과 diff 본문이
컨텍스트 예산 초과로 절단되어 있어, 절대경로 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서
`git diff origin/main...HEAD` 및 대상 spec 파일 원문을 직접 재조회해 분석했다. 실제 변경 파일:

- `spec/5-system/14-external-interaction-api.md` (§6.2 웹훅 봉투 재작성, `interaction` 블록 Planned 명시, `error.code`/`nodeId` nullable, §R17 strip+redact 대칭화)
- `spec/5-system/6-websocket-protocol.md` (`llmCalls` strip 범위 확장 — WS fanout + EIA REST `getStatus()`, 깊이 무관)
- `spec/1-data-model.md` §2.14 (`Execution.error` 구조에 nullable `nodeId`/`code` + `details?` 반영)
- 코드: `strip-external-only-fields.ts`(신설 공유 유틸), `interaction.service.ts`, `websocket.service.ts` 등

직전 커밋(`462455a52`)이 바로 이 라운드 자체에서 발견된 Rationale 상충(`waitingNodeType` SoT 충돌 — WS §4.4 wire 필드 caveat 결정 위반)을 스스로 정정한 fix 커밋이므로, 그 정정이 실제로 상충을 해소했는지도 함께 검증했다.

## 발견사항

이번 diff 범위(`origin/main...HEAD`)에서 CRITICAL/WARNING 수준의 Rationale 연속성 위반은 발견하지 못했다. 아래는 확인 절차와 결과다.

- **[INFO]** `waitingNodeType` SoT 상충은 이미 자기-정정됨 — 재확인만
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.2 blockquote (`node.type` 매핑 행)
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` "§4.4 wire 필드 caveat — 직접 재작성 대신 caveat + 오너십 분리" (외부 소비 매핑=EIA §6.2 소유, WS 내부 부가 식별자(`waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`/`startedAt`)=WS §4.4 소유)
  - 상세: 직전 planner 턴(`4b13ca5ae`)이 §6.2 blockquote 에 `node.type → waitingNodeType` 을 "외부 소비 필드" 로 잘못 추가해 WS Rationale 의 오너십 분리 결정과 정반대 주장을 만들었었다. 이 라운드가 검토 대상으로 받은 최신 커밋(`462455a52`)이 실측(`use-execution-events.ts` 만 참조, 외부 위젯 `parseWaitingForInput` 0건)으로 이를 되돌리고 "`node.type` 은 외부 소비 매핑이 없다 — `waitingNodeType` 은 WS 내부 부가 식별자" 로 정정, 근거를 명시했다.
  - 제안: 조치 불필요 — 현재 HEAD 상태는 WS §4.4 Rationale 의 오너십 분리 결정과 정합한다. 기록용으로만 남김 (향후 라운드에서 같은 필드가 다시 뒤집히지 않는지 감시 포인트로 삼을 것).

- **[INFO]** `llmCalls` strip 범위 확장은 기존 "값-마스킹만으로는 부족" 판단의 자연 확장 — 신규 Rationale 정합
  - target 위치: `spec/5-system/6-websocket-protocol.md` "`llmCalls` 외부 수신자 strip" 항목의 2026-08-14 갱신 블록쿼트, `spec/5-system/14-external-interaction-api.md` §R17 "`nodeOutput.conversationConfig` + terminal `result`/`error`" 서브섹션
  - 과거 결정 출처: 동일 항목의 원 결정("**기각된 대안**: 값-레벨 마스킹은 에디터 디버깅 가치를 훼손하고 부분적이며 …") 및 origin/main 시점 §R17("`getStatus` 는 … `deepRedactSecrets` 로 마스킹한다")
  - 상세: origin/main 의 §R17 은 REST `getStatus()` 에 값-마스킹(`deepRedactSecrets`)만 적용하고 있었는데(WS fanout 의 strip-only 결정과 스코프가 달랐음), 이번 diff 가 REST 경로에도 `stripExternalOnlyFields` 를 적용해 WS와 동일 정책으로 통일했다. 이는 과거 결정을 "무근거로" 뒤집은 것이 아니라, WS Rationale 이 이미 명시한 "값 마스킹만으로는 raw debug 필드 자체가 안 지워진다" 는 논리를 REST 표면에 뒤늦게 동일 적용한 것이며, 실제 유출 실측(중첩 `turnDebug.llmCalls` 누출)과 새 Rationale 블록쿼트("2026-08-14 갱신" / "이 절이 실제로 새던 자리다")를 명시적으로 함께 작성했다.
  - 제안: 조치 불필요 — "결정의 무근거 번복" 에 해당하지 않는다(새 Rationale 동반 확인됨). 구현(`interaction.service.ts` `stripAndRedact`, `websocket.service.ts`)도 문서 서술과 정확히 일치.

- **[INFO]** `error.code`/`nodeId` nullable 승격 및 `interaction` 블록 Planned 명시 — 기존 문서 서술과 일관
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.4 신규 블록쿼트("`code` 는 `null` 일 수 있다"), §6.2 신규 블록쿼트("`interaction` 블록은 미구현 (Planned) 이다"); `spec/1-data-model.md` §2.14
  - 과거 결정 출처: 동일 문서 §6.2 기존 서술("`expectedCommands` 자체는 현재 미구현 문서 필드다" — origin/main 에도 이미 존재) 및 [API 규약 §5.4](spec/5-system/2-api-convention.md) 부재 표현(null vs 키 생략) 원칙, R17 의 "형제 필드는 null" 선례
  - 상세: `interaction`(submitUrl 등) 블록을 "미구현" 으로 명시한 것은 새 결정이 아니라 origin/main 에 이미 있던 "미구현 문서 필드" 서술을 §6.2 예시 전체로 일관되게 넓힌 것이다. `code`/`nodeId` 를 `null` 허용으로 바꾼 것도 API 규약 §5.4 원칙과 형제 필드(`nodeId`) 의 기존 null 관례를 그대로 따르며, "왜 fallback 코드를 억지로 만들지 않는가" 를 새 Rationale 로 명시했다. `spec/1-data-model.md` 변경도 같은 근거를 인용해 동기화됐다.
  - 제안: 조치 불필요.

- **[INFO]** §6.2 웹훅 봉투 재작성 — 문서 자기 원칙(§6 채널별 봉투 normative) 준수로의 정정
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.2 JSON 예시(`payload` 래핑 추가)
  - 과거 결정 출처: 동일 문서 §6 도입부 "채널별 봉투 — 셋이 서로 다르다 (normative)" (webhook 은 `{type,…,payload:{…}}`)
  - 상세: 이번 변경은 §6.2 예시가 자기 문서의 정본 규칙(§6 도입부)을 어기던 상태를 규칙에 맞춰 고친 것이다 — 원칙을 새로 만든 게 아니라 원칙 위반 예시를 원칙에 맞춘 것이므로 방향이 "합의 원칙 위반" 이 아니라 "합의 원칙 준수로의 수정" 이다.
  - 제안: 조치 불필요.

## 요약

diff 대상 3개 spec 문서(`14-external-interaction-api.md`, `6-websocket-protocol.md`, `1-data-model.md`)를 각 문서의 `## Rationale`/`### R*` 항목과 대조한 결과, 기각된 대안의 재도입·합의 원칙 위반·무근거 결정 번복·invariant 우회에 해당하는 사례는 없었다. 오히려 이 브랜치는 직전 라운드에서 스스로 발견한 Rationale 상충(`waitingNodeType` SoT 충돌)을 실측 기반으로 정정했고, 각 변경마다 "왜 바뀌었는가"·"과거 결정과의 관계"를 명시적 블록쿼트로 남기는 패턴을 일관되게 유지하고 있다(§R17 2026-08-14 갱신, WS `llmCalls` strip 갱신 등). 코드(`strip-external-only-fields.ts`, `interaction.service.ts`, `websocket.service.ts`)도 문서 서술과 정확히 대응한다.

## 위험도

NONE
