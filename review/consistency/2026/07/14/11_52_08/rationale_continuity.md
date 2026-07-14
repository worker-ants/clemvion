# Rationale 연속성 Check — `spec/5-system/15-chat-channel.md` (+ 연관 `4-execution-engine.md` / `14-external-interaction-api.md` / `6-websocket-protocol.md`)

## 검토 범위

- target: `spec/5-system/15-chat-channel.md` (HEAD 버전 전체 정독 — Overview/본문/`## Rationale` R1~R9, R-CC-10~19, R-K)
- 코드 diff: F-1(publisher nodeId 매칭) · F-2(surfaceMismatch 안내) · F-4(sendBestEffortNotice 리팩터) · F-5(telegram raw-send MarkdownV2 검증) · F-6(WS nodeId forwarding) — `plan/in-progress/eia-command-waiting-surface-guard.md` 계열
- 연관 spec 교차검증: `spec/5-system/4-execution-engine.md` §7.5.1 + `## Rationale`, `spec/5-system/14-external-interaction-api.md` §5.1 + `## Rationale`, `spec/5-system/6-websocket-protocol.md` §4.2 + `## Rationale`

## 발견사항

- **[WARNING]** `대기 표면 ↔ 명령 매트릭스` Rationale의 "표 3번째 행" 참조가 F-1 삽입으로 stale
  - target 위치: `spec/5-system/4-execution-engine.md` `## Rationale` → `### 대기 표면 ↔ 명령 매트릭스 publisher 사전 검증 (§7.5.1, 2026-07-11)` (파일 내 라인 ~1305) — "`resolveWaitingNodeExecutionId` 가 대기 노드의 표면을 판정해 도착 명령의 허용 여부를 publish 전에 검사한다(**위 §7.5.1 표 3번째 행**)"
  - 과거 결정 출처: 동일 문서 §7.5.1 표 (2026-07-11 시점에는 `매칭 row 0건` / `동일 매칭 row 2건 이상` / `표면(interactionType) 불일치` 3행이었고, 당시 "표면 불일치"가 3번째 행이라 이 각주가 정확했다)
  - 상세: 이번 변경(F-1, 2026-07-14)이 §7.5.1 표에 `nodeId 불일치` 행을 **표면 불일치보다 앞에** 삽입해, 표면 불일치가 이제 4번째 행이 됐다(§7.5.1 본문에서 직접 확인: 매칭 0건 → 2건+ → **nodeId 불일치(신규)** → 표면 불일치). 그 결과 위 Rationale 각주 "3번째 행"은 이제 신규 `nodeId 불일치` 행을 가리키게 되어, 본문이 서술하는 "표면 판정" 내용과 실제로 가리키는 행이 어긋난다. Rationale continuity 관점에서 과거 결정 자체가 뒤집힌 것은 아니지만, 새 결정(F-1)을 기존 문서에 삽입하면서 기존 Rationale의 교차참조를 갱신하지 않아 문서 신뢰도가 떨어진다.
  - 제안: 각주를 "표면(interactionType) 불일치 행" 같은 이름 기반 참조로 바꾸거나(행 번호 의존 제거), 최소한 "4번째 행"으로 갱신.

- **[WARNING]** F-5 telegram raw-send MarkdownV2 검증이 같은 문서 §4.1 예시 config 값과 충돌
  - target 위치: `spec/5-system/15-chat-channel.md` §4.1 `Trigger.config.chatChannel` JSON 예시 (`groupChatRefusal: "이 봇은 1:1 대화만 지원합니다."`, `executionStillRunning: "워크플로우가 처리 중입니다. 잠시만 기다려 주세요."`) vs §4.1.1 F-5 문단(같은 파일, 신규 결정)
  - 과거 결정 출처: 해당 §4.1 JSON 예시 자체(이 diff가 손대지 않은 기존 내용) — F-5 도입 전에는 이 예시가 항상 유효한 override 값이었음
  - 상세: 이번 diff가 `LanguageHintsRawSendValidator`(F-5)를 신설해 `provider==='telegram'`일 때 `groupChatRefusal` / `executionStillRunning` 등 7개 raw-send 키의 override에 **unescaped MarkdownV2 특수문자**(마침표 포함)가 있으면 `400 UNSAFE_TELEGRAM_MARKDOWN`으로 거부한다. 그런데 같은 문서 §4.1의 예시 JSON(provider=telegram)은 정확히 이 두 키에 unescaped 마침표를 쓰고 있어, **이 문서가 스스로 제시하는 예시 config가 이 문서가 스스로 도입한 새 invariant를 위반**한다. (참고로 backend 하드코딩 default 문자열은 이미 `\\.`로 pre-escape 되어 있어 실제 런타임 기본값은 문제 없음 — 문제는 §4.1의 "사용자가 override로 넣을 법한" 예시 문자열임.)
  - 제안: §4.1 예시의 `groupChatRefusal`/`executionStillRunning` 값을 escape된 형태(`...\.`)로 갱신하거나, 예시 하단에 "telegram + 위 raw-send 7키는 MarkdownV2 이스케이프 필요(F-5, §4.1.1 참조)" 각주 추가.

## 요약

target(`spec/5-system/15-chat-channel.md`)과 F-1/F-2/F-4/F-5/F-6 변경은 기각된 대안을 이유 없이 재도입하거나 합의된 설계 원칙(EIA-AU-08 in-process trusted caller 예외, CCH-ERR-04 "silently swallow 금지", R-CC-15 등록시점 validator 패턴)을 위반하지 않는다 — 오히려 CCH-ERR-04의 "silently swallow 금지" 정신을 STATE_MISMATCH 삼킴 경로(F-2)까지 일관되게 확장하고, `nodeId: 'chat-channel'` placeholder 제거·§7.5.1 nodeId 검사·scope 단위 면제(F-1)·WS forwarding(F-6) 모두 코드 주석과 `spec/5-system/4-execution-engine.md` §7.5.1 진입점별 커버리지 표 + `spec/5-system/14-external-interaction-api.md` §5.1 "STATE_MISMATCH 강제 정합(2026-07)" 단락에 상세히 문서화되어 있어 "무근거 번복"에 해당하지 않는다(오히려 "코드가 기존 계약 미이행 갭을 메운 것"으로 명시). 다만 새 결정을 기존 문서에 삽입하면서 인접 콘텐츠(행 번호를 참조한 옛 Rationale 각주, §4.1의 unescaped 예시 값)를 함께 갱신하지 않아 두 건의 문서 내부 정합성 흠결이 남았다 — 둘 다 설계 결정 자체의 재도입/번복이 아니라 문서 갱신 누락 수준이다.

## 위험도

LOW
