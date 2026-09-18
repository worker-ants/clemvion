# Plan 정합성 Check — `spec-draft-webhook-endpoint-path-global-unique.md`

## 발견사항

없음 — CRITICAL/WARNING 급 plan 정합성 위배를 찾지 못했다.

### 확인 경위 (참고용 INFO)

- **미해결 결정과의 충돌 없음**: 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md:4632-4637`
  (`plan/complete/spec-draft-fk-remaining-dispositions.md` «비대상» 으로 이 트래커에 보내짐)의
  원문은 "결정할 것: `endpoint_path` 를 전역 유일로 좁혀도 되는가 · 비유일 보조 인덱스로 조회만
  고치는가" 를 **열린 선택지**로 남겨 뒀다. target 은 이 선택지 중 전자를 골랐는데, 무근거
  일방 결정이 아니라 (a) 워크스페이스 간 경로 복사 가로채기 재현(PostgreSQL 실측, `routed_to =
  복사한 w5`), (b) 사용자 결정 날짜(2026-09-18) 명시, (c) 기각한 대안(비유일 인덱스 + 앱 레벨
  검사)과 기각 사유(동시 요청 경합을 DB 가 못 막음)를 함께 적어 결정 근거를 갖췄다. 열린 결정을
  우회한 사례가 아니라 정상적으로 닫은 사례다.
- **선행 plan 미해소 없음**: V131/V132 는 최신 마이그레이션 V130(1cc089343, 이미 main 에 머지)
  바로 다음 번호라 순번 충돌이 없고, `idx_trigger_endpoint_path`·`TRIGGER_ENDPOINT_PATH_CONFLICT`
  등 신규/재사용 식별자도 `plan/in-progress/**` 전수 grep 에서 이 draft·트래커 언급 외 충돌이
  없다. target 이 의존하는 "chatChannel 이 실린 PATCH → `setupChannel` 재호출" 메커니즘은
  R-CC-21 기각 이력에 이미 확정돼 있는 부분이며, 같은 트래커의 열린 항목(`spec-draft-nullable-
  notation-followups.md:2165` "§5.4.1 표 2행 — **`isActive` 토글 전용 PATCH** 의 `setupChannel`
  재호출 여부 미확정")은 **다른 PATCH 경로**(활성화 토글, `chatChannel` 필드 없음)를 묻는 것이라
  target 의 "사용자의 다시 저장(=chatChannel 재저장) → `setupChannel`" 근거와 겹치지 않는다 —
  혼동 소지가 있어 참고로만 남긴다.
- **후속 항목 누락 없음**: 1차 검토(`review/consistency/2026/09/18/23_39_46`, BLOCK: YES ·
  Critical 2 · WARNING 1)가 지적한 세 항목이 target 본문에 반영돼 있는 것을 확인했다 — Critical 1
  (V131 이 chat-channel 트리거의 provider 등록을 끊는 문제)은 「결정 2」 보강 + 구현 V131 보강 +
  「채팅 채널 트리거 — R-CC-21 과의 관계」 Rationale 절로, Critical 2(`data-flow/10-triggers.md`
  Rationale 절의 반증된 전제 잔존)는 S7 신설(원문 취소선 보존 + 정정 블록)로, WARNING 1
  (`3-error-handling.md` 카탈로그 표 "동일 워크스페이스에" 문구 누락)은 S5 확장으로 각각
  대응됐다. target 이 "새 결함"으로 등재 예정인 «지운 웹훅 경로 재등록(묘비 부재)» 항목은
  `plan/in-progress/**` 전체에서 중복 등재가 없고, 체크리스트("트래커 반영" 섹션)에 실행 대기
  항목으로 명시돼 있어 누락이 아니다. chat-channel 관련 다른 backlog plan
  (`chat-channel-discord-gateway.md`, `chat-channel-slack-socket-mode.md`, `chat-channel-visual-
  ssr-png.md`)은 Gateway/Socket Mode 도입·SSR PNG 렌더링을 다루며 endpointPath 유일성·
  `setupChannel` 재등록 메커니즘과 교차하지 않는다.

## 요약

target 은 트래커가 열어 둔 "전역 유일 vs 비유일 보조 인덱스" 결정을 재현 실측과 사용자 결정을
근거로 닫았고, 1차 `--spec` 검토의 Critical 2건·WARNING 1건을 본문에서 확인 가능한 형태로
반영했다. `plan/in-progress/**` 전수 대조에서 마이그레이션 번호·인덱스명 충돌, 다른 진행 중
plan 과의 전제 충돌, 후속 트래커 항목 누락을 찾지 못했다. Plan 정합성 관점에서는 병합을 막을
사유가 없다.

## 위험도
NONE
