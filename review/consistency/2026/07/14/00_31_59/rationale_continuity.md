# Rationale 연속성 검토 결과

대상: `spec/5-system/15-chat-channel.md` (impl-done, diff-base `origin/main`)
변경 요지: 채팅 채널 inbound 명령이 대기 노드 인터랙션 표면과 맞지 않아 409 `STATE_MISMATCH` 로
거부될 때, 종전 warn 로그만 남기던 것을 `languageHints.surfaceMismatch` best-effort 사용자 안내
발송으로 보강 (`plan/in-progress/eia-command-waiting-surface-guard.md` F-2 이행).

## 발견사항

- **[INFO]** R4("MarkdownV2 escape 책임을 어댑터로")의 예외 목록이 4건째인데 R4 본문은 갱신되지 않음
  - target 위치: `spec/4-nodes/7-trigger/providers/telegram.md` line 202-205 (§5.8 표 + "non-escape 예외" 주석), R4 본문은 line 253-255
  - 과거 결정 출처: `spec/4-nodes/7-trigger/providers/telegram.md` `## Rationale` → `### R4. MarkdownV2 escape 책임을 어댑터로` — "어댑터가 sendMessage 직전에 escape" 를 원칙으로 서술, 예외 언급 없음
  - 상세: 이번 변경(`surfaceMismatch`)은 §5.8 주석에서 "`sessionExpired`/`executionStillRunning`/`groupChatRefusal` 등 다른 hooks 직접 발송 안내와 동일 경로" 라고 명시하며 R4 의 예외임을 스스로 인정하고 정당화한다 — 이는 은폐된 위반이 아니라 **투명하게 문서화된 의도적 예외**다. 다만 R4 원칙문 자체는 여전히 무조건적 서술("어댑터가 escape")이라, R4 하나만 읽는 독자는 이 예외 계열(4건: sessionExpired/groupChatRefusal/executionStillRunning/surfaceMismatch)의 존재를 알 수 없다. 결정을 뒤집는 것이 아니라 원칙의 **적용 범위를 명확화**하지 않은 문서 정합성 갭이다.
  - 제안: R4 본문에 "단, `HooksService` 가 `renderNode` 를 우회해 `adapter.sendMessage` 를 직접 호출하는 control-plane 안내(hooks-originated notice: sessionExpired/groupChatRefusal/executionStillRunning/surfaceMismatch)는 렌더러 escape 대상이 아니며 default 문구 자체를 MarkdownV2-safe 로 관리한다" 는 한 문장을 추가해 예외 카테고리를 canonical 하게 고정할 것을 권장 (선택 사항, 정합성 자체는 이미 각 사용처에서 개별 각주로 충족됨).

- **[INFO]** CCH-ERR-05(안내 발송 최종 실패 시 `chat_channel_health=degraded` 갱신)와 신규 `sendSurfaceMismatchNotice` catch 블록의 관계가 spec 에 명시되지 않음
  - target 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` line 1019-1039 (`sendSurfaceMismatchNotice`)
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` §3.5 `CCH-ERR-05` — "안내 메시지 발송도 CCH-SE-01 의 5초 timeout + 3회 지수 백오프 정책 적용... 안내 발송이 최종 실패하면 CCH-SE-01 의 일반 정책에 따라 `chat_channel_health=degraded` 갱신"
  - 상세: `sendSurfaceMismatchNotice` 의 catch 는 `logger.warn` 만 수행하고 `chat_channel_health` 갱신 호출이 코드상 보이지 않는다. 그러나 이는 **이 PR 이 새로 도입한 편차가 아니라**, 바로 위에 있는 기존 `sendExecutionStillRunningNotice` (line 986-1007, R9 로 이미 채택된 안내)와 정확히 동일한 catch 패턴을 그대로 복제한 것이다 — 즉 기존 로컬 코드 관례를 신규 안내에도 일관되게 적용한 것으로, **Rationale 번복이 아니라 기존 패턴의 계승**이다. degraded 갱신이 `adapter.sendMessage` 내부(재시도 소진 시점)에서 이뤄지는지 여부는 이번 diff 범위 밖의 기존 구현이라 본 rationale-continuity 관점에서는 신규 위반으로 보지 않는다.
  - 제안: 이 gap 이 실재한다면(즉 어떤 hooks-notice 도 degraded 갱신을 트리거하지 않는다면) CCH-ERR-05 자체가 pre-existing 미이행 상태일 가능성 — spec-code 일치성 검토(다른 checker) 대상으로 넘기고, 본 검토에서는 "새 코드가 기존 관례를 따랐다"는 사실만 기록.

## 요약

`surfaceMismatch` 도입은 과거 Rationale 을 뒤집거나 기각된 대안을 재도입하는 사례가 아니다. 오히려 `plan/in-progress/eia-command-waiting-surface-guard.md` 의 F-2 항목("종전엔 로그만 남기고 사용자 피드백 없음 — CCH-ERR-04 관례상 필요")을 그대로 이행한 계획된 후속 작업이며, `spec/5-system/15-chat-channel.md`(§4.1.1, line 261)와 `spec/4-nodes/7-trigger/providers/telegram.md`(§5.8, line 195-205) 양쪽에 새 `## Rationale` 급 설명을 동봉해 "왜 이런 예외가 필요한가"를 스스로 근거를 대며 기록했다 — CCH-ERR-04 를 문자 그대로의 적용이 아니라 "관례상"(analogy) 이라고 명시적으로 한정한 점도 정직한 서술이다. R4(escape 책임)의 예외로 편입되는 것도 `sessionExpired`/`groupChatRefusal`/`executionStillRunning` 기존 3건과 동일 경로임을 인용해 정당화했다. 유일한 잔여 항목은 R4 원칙문 자체가 이 예외 계열을 아직 canonical 하게 흡수하지 않았다는 문서 위생 수준의 INFO 2건뿐이며, 어느 것도 CRITICAL/WARNING 등급의 결정 번복·원칙 위반·invariant 우회에 해당하지 않는다.

## 위험도

LOW
