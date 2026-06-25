# Cross-Spec 일관성 검토 결과

검토 대상: refactor 03 m-1 — backend 서비스 console.* → NestJS Logger 전환 + eslint no-console 가드
검토 모드: --impl-done
diff-base: origin/main

---

## 발견사항

### [INFO] spec 내 `console.warn` 처방 2건이 NestJS Logger 전환 후 구현과 어긋남

- target 위치: 구현 diff 전반 (telegram-message.renderer.ts, language-hint-defaults.ts, mcp-test-connection.service.ts, node-handler.registry.ts)
- 충돌 대상:
  - `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` 줄 406 — `console.warn('[processMultiTurnMessage] form submission without pendingFormToolCall …')` 를 진단 surface 로 명시
  - `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` 줄 1108 — `console.warn` 후 진행(soft-fail) 으로 명시
- 상세: 위 두 spec 본문은 `console.warn` 을 구현 처방 형태로 직접 기술하고 있다. 이번 리팩터링이 backend no-console 규칙을 적용하면, 해당 경로의 구현자가 spec 지시를 그대로 따를 경우 ESLint error 가 발생한다. 현재 diff 에 포함된 변경(telegram/language-hint/mcp/node-handler)은 이 두 경로와 무관하지만, 이후 구현자가 ai-agent.md §7.4 fallback 을 작성할 때 spec 문자 그대로 `console.warn` 을 쓰면 lint 실패한다. plan 에 따르면 planner에게 spec-sync 위임이 등록되어 있으나, 현재 spec 본문이 아직 갱신되지 않은 상태다.
- 제안: planner spec-sync 위임이 이미 등록된 것으로 확인됨. 위임 완료 시 해당 spec 본문의 `console.warn(...)` 처방을 `logger.warn(...)` (또는 구현 세부를 spec 에서 제거) 으로 갱신하여 정합 유지.

---

### [INFO] `spec/5-system/3-error-handling.md §6.2` 로그 포맷 예시와 Logger 컨텍스트 명명 스타일 비일관

- target 위치: telegram-message.renderer.ts — `new Logger('ChatChannel.Telegram')`, language-hint-defaults.ts — `new Logger('ChatChannel.LanguageHint')`
- 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` §6.2 — 구조적 로그 포맷 예시의 `"service": "execution-engine"` 필드 패턴
- 상세: §6.2 예시는 `service` 필드에 `kebab-case` 를 사용하는 패턴이다. 이번 변경에서 Logger 컨텍스트 이름으로 `'ChatChannel.Telegram'`(PascalCase.dot 혼합)·`'ChatChannel.LanguageHint'`, `McpTestConnectionService`·`NodeHandlerRegistry`(클래스명 그대로 PascalCase) 를 혼용한다. spec §6.2 는 구조적 JSON 로그의 `service` 예시만 제시하며 NestJS Logger 컨텍스트 명명 규칙을 강제하지 않으므로 직접 모순은 아니다. 다만 Logger 컨텍스트 명명 규약이 spec/conventions 에 부재하다는 점이 관찰된다.
- 제안: 현재 INFO 수준이며 차단 불필요. 향후 spec §6.2 또는 `spec/conventions/` 에 Logger 컨텍스트 명명 패턴(예: `'Domain.SubModule'` vs 클래스명 사용 기준)을 추가하면 코드베이스 전반의 일관성 보장에 도움이 된다.

---

## 요약

이번 변경(03 m-1)은 순수 내부 리팩터링으로, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 spec 과의 직접 충돌을 유발하지 않는다. 발견된 사항은 모두 INFO 수준이며, 핵심은 spec 본문 2곳(`spec/4-nodes/3-ai/1-ai-agent.md` §7.4, `spec/5-system/14-external-interaction-api.md` R15 주변)에 `console.warn` 처방이 잔존해 no-console 규칙과 잠재적 불일치가 있다는 점이다. 이는 이미 plan 에 planner spec-sync 위임으로 등록된 것으로 확인되므로 별도 차단 없이 위임 완료를 대기하면 된다.

## 위험도

LOW
