# Rationale 연속성 Check — spec/5-system/4-execution-engine.md (impl-done)

## 검토 범위 및 방법

payload 의 diff(`origin/main...HEAD`)는 `codebase/**` 변경만 담고 있어, target spec(`spec/5-system/4-execution-engine.md`)에 대한 실제 spec-level diff 는 별도로 `git diff origin/main...HEAD -- spec/**` 로 직접 확인했다. 이번 PR 이 건드린 spec 파일은 다음 4개다:

- `spec/5-system/4-execution-engine.md` (§7.5.1 — nodeId 불일치 행 + 진입점별 커버리지 매트릭스 신설)
- `spec/5-system/15-chat-channel.md` (§4.1.1 — `surfaceMismatch` 키 신설)
- `spec/4-nodes/7-trigger/providers/telegram.md` (§5.8 — Surface Mismatch 안내 telegram 매핑)
- `spec/conventions/chat-channel-adapter.md` (문구 정정 1줄)

target 문서 자체(`4-execution-engine.md`)의 `## Rationale` 전체, 그리고 직접 연관된 `spec/5-system/14-external-interaction-api.md`·`spec/5-system/15-chat-channel.md`·`spec/conventions/chat-channel-adapter.md`·`spec/4-nodes/7-trigger/providers/telegram.md` 의 Rationale/원칙 절을 절대경로로 직접 Read 하여 대조했다 (payload 의 "관련 Rationale 발췌" 섹션에는 이 파일들의 Rationale 이 빠져 있어 별도 확인함).

## 발견사항

- **[INFO]** `nodeId 불일치` 신규 행의 `근거` 링크가 가리키는 Rationale 절이 실제로는 nodeId 를 다루지 않음
  - target 위치: `spec/5-system/4-execution-engine.md` §7.5.1 표의 "nodeId 불일치" 행 (`git diff origin/main...HEAD` 상 신규 라인) — `근거 §Rationale "대기 표면 ↔ 명령 매트릭스"` 로 cross-ref
  - 과거 결정 출처: 같은 문서 `## Rationale` → `### 대기 표면 ↔ 명령 매트릭스 publisher 사전 검증 (§7.5.1, 2026-07-11)`
  - 상세: 해당 Rationale 절 본문은 전부 **표면(interactionType) 매칭**(form/buttons 단일 명령, AI 4종 허용, fail-closed 사유)만 설명하며 "위 §7.5.1 표 3번째 행"(표면 불일치 행)만 명시적으로 지칭한다. 이번 diff 로 §7.5.1 표에 새로 삽입된 "nodeId 불일치" 행(및 그 아래 진입점별 커버리지 매트릭스 — EIA `/interact` 적용, `in_process_trusted` 면제, WS/`/continue` 미적용)은 같은 "근거" 링크를 재사용하지만, 그 절 안에는 nodeId 매칭·in_process_trusted 면제에 대한 서술이 없다. 실질적 판단으로는 이 변경 자체가 과거 결정을 뒤집는 것은 아니다 — `spec/5-system/14-external-interaction-api.md` §5.1 STATE_MISMATCH 행(변경 없음, origin/main 에 이미 존재)이 "다른 nodeId" 를 이미 409 사유로 명시하고 있었고, 코드는 그동안 `assertNodeId` 로 존재 검사만 했을 뿐 실제 일치 검사를 하지 않던 **선행 spec-code drift**였다. 이번 diff(F-1)는 그 drift 를 코드 쪽에서 메운 것이므로 "새 결정"이 아니라 "이미 약속된 동작의 뒤늦은 구현"에 가깝다. 다만 문서 구조상 "근거" 링크의 정확성만 아쉽다.
  - 제안: `### 대기 표면 ↔ 명령 매트릭스 …` Rationale 절 제목/본문에 nodeId 매칭 근거(3rd row=표면, 4th row=nodeId 로 구분)를 한두 문장 추가하거나, nodeId 행의 "근거"를 `EIA-IN-13`/`EIA §5.1 STATE_MISMATCH`(기존 nodeId 불일치 명시) 쪽으로 보강 cross-ref. 필수 수정은 아님(정보 보강 수준).

## 대조 확인한 주요 항목 (위반 없음 — 참고용 근거)

1. **`resolveWaitingNodeExecutionId` 의 nodeId 매칭 도입(F-1)** — `spec/5-system/14-external-interaction-api.md` §5.1 `STATE_MISMATCH` 행("다른 nodeId" 포함)은 이 PR 이전부터 이미 존재(diff 없음). 즉 spec 은 이미 이 동작을 약속했고 코드가 뒤늦게 따라간 것 — "기각된 대안의 재도입"이나 "무근거 번복"이 아니다. `plan/in-progress/eia-command-waiting-surface-guard.md` 도 2026-07-10 consistency-check 에서 발견된 결함(사용자 결정 기록 포함)으로 이 작업을 명시적으로 추적하고 있어 ad-hoc 변경이 아님을 뒷받침한다.
2. **`in_process_trusted` 의 nodeId 검사 면제** — `interaction.service.ts` 가 재사용하는 `isInternalCtx()`/`InteractionRequestContext.scope: 'in_process_trusted'` 는 `spec/5-system/14-external-interaction-api.md` EIA-AU-08/§3.3.1 이 이미 확립한 "in-process trusted caller 는 검증을 우회할 수 있다"(토큰 인증 우회 선례)는 원칙의 **자연스러운 연장**이다. 신규 우회 카테고리를 만든 것이 아니라 기존 신뢰 경계 메커니즘을 재사용했다.
3. **`nodeId: 'chat-channel'` placeholder 제거(`hooks.service.ts`)** — 과거엔 `assertNodeId` 존재-검사만 통과시키려는 placeholder 였음을 코드 주석·spec 진입점 매트릭스(§7.5.1 "면제" 행) 양쪽에서 일관되게 설명한다. 결정 번복이 아니라 처음부터 실제 의미 없던 값의 제거이며, 새 spec 문구(진입점 커버리지 표)로 그 대체 상태를 명시했다.
4. **`surfaceMismatch` 안내가 `renderNode` escape 를 우회하는 것(F-2)** — `spec/4-nodes/7-trigger/providers/telegram.md` R4("MarkdownV2 escape 책임을 어댑터로")와 표면적으로 배치되는 것처럼 보이지만, 신설된 §5.8 은 `executionStillRunning`/`groupChatRefusal` 등 기존에 이미 확립된 "control-plane 직접 발송 경로는 `renderNode` 를 우회한다"는 선례와 동일 계열임을 명시적으로 cross-ref 하며, "그래서 default 문구가 MarkdownV2 특수문자를 배제한다"는 대체 안전장치까지 부여했다(단위 테스트로 불변식 강제, `escapeMarkdownV2` 재사용). R4 예외의 신설이 아니라 기존 예외 패턴의 확장.
5. **CCH-ERR-04 "silently swallow 금지"** — `sendSurfaceMismatchNotice` 신설은 이 원칙을 위반하지 않고 오히려 "로그만 남기고 사용자 피드백 없음"이었던 기존 갭을 CCH-ERR-04 취지에 맞춰 메운 것으로, spec(§4.1.1)·코드 주석 모두 이 근거를 명시한다. 발송 자체 실패 시 swallow+warn 처리도 같은 파일의 "webhook 5xx 재시도 루프 회피" 기존 catch 관례를 그대로 재사용한다.
6. **Rationale ID 컨벤션(`R-CC-N`) 미부여** — `surfaceMismatch` 설명 문단은 `## Rationale` 섹션이 아니라 §4.1.1 본문(표 바로 아래 inline 설명)에 삽입되었다. `spec/5-system/15-chat-channel.md` 의 "Rationale ID 컨벤션" 규정은 "본 절(= `## Rationale`) 신규 항목"에만 적용되므로 범위 밖이며, `sessionExpired` 도 동일한 inline 설명 패턴을 쓰고 있어 기존 관례와 일치한다.
7. **§7.5.1 표 재작성("매칭 row 0건" 사유 문구 축소)** — 구 문구("Execution 이 다른 상태거나 nodeId 미일치")를 "nodeId 미일치" 제거 + 신규 전용 행으로 분리한 것은, nodeId 검사가 이제 대부분의 진입점에서 "미적용/면제"(WS·`/continue`·in_process_trusted)라는 실제 구현과 문구를 일치시키기 위함으로 판단된다 — 과장이었던 구 문구(사실상 검사되지 않던 것을 "검사됨"처럼 서술)를 정정한 것에 가까워 회귀가 아니다.

## 요약

target 인 `spec/5-system/4-execution-engine.md` §7.5.1 개정과 그에 연동된 chat-channel/telegram/EIA 관련 코드 변경(F-1 nodeId 매칭, F-2 surfaceMismatch 안내)은 모두 기존 Rationale·원칙과 정합적이다. F-1 은 `EIA §5.1 STATE_MISMATCH`(이미 "다른 nodeId"를 명시)와 `plan/in-progress/eia-command-waiting-surface-guard.md`(2026-07-10 사용자 결정·발견 경위 기록)로 뒷받침되는, 선행 spec-code drift 를 해소하는 구현이지 새 결정의 무단 도입이 아니다. `in_process_trusted` nodeId 면제는 EIA-AU-08 의 기존 in-process 신뢰 경계 우회 원칙을 재사용했고, F-2 의 MarkdownV2 escape 우회는 `groupChatRefusal`/`executionStillRunning` 선례와 동일 계열로 명시적으로 cross-ref 되어 있다. 유일한 흠은 §7.5.1 신규 "nodeId 불일치" 행의 "근거" 링크가 실제로는 표면(surface) 매칭만 설명하는 Rationale 절을 가리켜 다소 부정확하다는 점(INFO, 선택적 보강)뿐이며, 기각된 대안의 재도입이나 원칙 위반, 무근거 번복은 발견되지 않았다.

## 위험도

NONE
