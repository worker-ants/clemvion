# Plan 정합성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
Target: `spec/7-channel-web-chat/` (전 6문서)
기준 plan: `plan/in-progress/webchat-polish-batch.md` + 관련 in-progress plan 전체

---

## 발견사항

### 발견사항 없음 — 하기 항목 전부 PASS 또는 INFO 수준

---

- **[INFO]** `1-widget-app §2` 입력창 행 — `isTextInputSurface` 명시 (SPEC-DRIFT 해소)
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md §2` 입력창 행
  - 관련 plan: `plan/in-progress/web-chat-quality-backlog.md §C` 추가 backlog 메모 "1-widget-app §3.1·§2 spec 문서화(SPEC-DRIFT, planner) — 전부 비차단"
  - 상세: `web-chat-quality-backlog.md §C` 가 이 SPEC-DRIFT 를 비차단 backlog 로 명시하고 있으며, `webchat-polish-batch.md` 는 그것을 같은 PR 에서 해소하도록 계획했다. target spec 은 이미 `isTextInputSurface SoT` 명시를 포함하고 있어 SPEC-DRIFT 를 해소한다. plan 간 정합 — 충돌 없음.
  - 제안: 추적 메모 권장. `webchat-polish-batch.md` 의 해당 항목이 체크되면 `web-chat-quality-backlog.md §C` 의 SPEC-DRIFT 언급도 완료로 표시할 것.

- **[INFO]** `2-sdk §1` `resetSession` 메서드 추가
  - target 위치: `spec/7-channel-web-chat/2-sdk.md §1` 메서드 열거
  - 관련 plan: `plan/in-progress/webchat-polish-batch.md` 변경(spec) 항목 2번째
  - 상세: `webchat-polish-batch.md` 가 이 변경을 명시적으로 포함하고 있고, 미해결 결정 사항과의 충돌 없음. `2-sdk.md §3` 프로토콜 테이블 및 `ChatInstance` 타입 블록(§5)에는 `resetSession` 이 이미 기재되어 있어 §1 열거가 누락된 상태를 정렬하는 것이다.
  - 제안: 추적 메모 권장 수준. 변경 적용 후 §1 / §3 / §5 세 위치의 `resetSession` 노출이 일관함을 확인하는 것으로 충분.

- **[INFO]** `5-admin-console §Overview` 표준 정렬
  - target 위치: `spec/7-channel-web-chat/5-admin-console.md ## Overview`
  - 관련 plan: `plan/in-progress/webchat-polish-batch.md` 변경(spec) 항목 4번째
  - 상세: 표준 헤더 정렬 변경이며 내용 변경 없음. 어떤 in-progress plan 의 결정 사항과도 충돌하지 않는다.
  - 제안: 없음.

- **[INFO]** `configFromQuery` apiBase 하드닝 (`safeApiBaseFromQuery`)
  - target 위치: `spec/7-channel-web-chat/` (코드 변경, 직접 spec 변경 아님)
  - 관련 plan: `plan/in-progress/web-chat-quality-backlog.md §C` 추가 backlog 메모 "configFromQuery apiBase origin 검증(보안 #6) — 비차단"
  - 상세: `web-chat-quality-backlog.md` 가 이 보안 하드닝을 비차단 backlog 로 적시하고 있으며, `webchat-polish-batch.md` 코드 변경 항목으로 포함된다. 미해결 결정 충돌 없음.
  - 제안: `web-chat-quality-backlog.md §C` 의 해당 backlog 메모를 완료 처리 대상으로 추적.

---

## 요약

`spec/7-channel-web-chat/` 의 target 변경 내용(`webchat-polish-batch.md` 범위 — `0-overview §6.2→§6.1` 이동, `2-sdk §1` resetSession 추가, `1-widget-app §2` isTextInputSurface 명시, `5-admin-console Overview` 표준화, `EmbedConfigDto` JSDoc 추가, `safeApiBaseFromQuery` 코드 하드닝)은 현재 진행 중인 모든 in-progress plan 과 **충돌하지 않는다**. 변경 항목들은 이미 `web-chat-quality-backlog.md §B·§C` 에서 비차단 backlog 또는 SPEC-DRIFT 로 명시적으로 식별·이연된 항목들을 해소하는 것이며, 어떤 미해결 결정도 일방적으로 내리지 않는다. `spec-sync-external-interaction-api-gaps.md`, `spec-sync-webhook-gaps.md` 등 관련 in-progress plan 의 미해결 항목(SSE replay_unavailable, rate-limit 구현 등)은 target 변경 범위 외부에 있어 영향받지 않는다. 후속 항목 누락이나 선행 plan 미해소도 없다.

## 위험도

NONE
