# Rationale 연속성 검토 — `spec/5-system/15-chat-channel.md`

검토 모드: `--impl-prep` (구현 착수 전)
검토일: 2026-05-23

---

## 발견사항

### 발견사항 없음 (NONE)

아래는 충돌 여부를 검토한 영역별 상세 결과다.

---

### [INFO] R-CC-10 (bot token single-path) vs R-2 (hmacSecret PATCH+rotate 양쪽 허용) — 의도적 상이, 신규 Rationale 충분히 작성됨

- target 위치: `spec/5-system/15-chat-channel.md §5.4.1` + `## Rationale R-CC-10`
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md ## Rationale R-2`
- 상세: R-2 는 `hmacSecret` 에 대해 "PATCH 입력 변경 (v1)" 과 "rotate 액션 (v1.1 후속)" 을 **양쪽 모두** 허용하는 분리 구조를 채택했다. `15-chat-channel.md` R-CC-10 은 `botToken` 에 대해 **rotate API 단일 경로만** 허용하고 PATCH body 변경을 차단한다. 구조가 다르므로 기각된 대안의 재도입 여부를 확인해야 한다. R-CC-10 은 이 차이를 명시적으로 인지하고 "자원의 위치(server-side 보유 vs external provider 측 등록) 차이" 로 정당화했다 — R-2 에서 채택한 dual-path 패턴을 R-CC-10 은 기각 대안 ②로 명기하며 기각 사유("PATCH 직접 교체 시 텔레그램 측 webhook 즉시 단절", "grace 정책 불일치", "audit log mixing")를 작성했다.
- 결론: 새 Rationale(R-CC-10)이 과거 결정(R-2)과의 차이와 그 이유를 모두 설명하고 있으므로 연속성 위반이 아니라 명시적·정당한 번복이다.
- 제안: 현 상태 유지. `spec/2-navigation/2-trigger-list.md` 의 Chat Channel botToken 행 (§2.3.1 매트릭스)에 이미 R-CC-10 cross-link가 있으므로 추가 조치 불필요.

---

### [INFO] CCH-CV-03 `running` 케이스 — 큐잉(기각된 대안 Redis 큐)과 CCH-NF-03 rate-limit 큐의 병존

- target 위치: `spec/5-system/15-chat-channel.md §3.2 CCH-CV-03` + `## Rationale R9`
- 과거 결정 출처: 동 문서 내 Rationale R9
- 상세: R9 는 `execution.running` 중 사용자 메시지 도착 시 "Redis 큐 임시 적재 후 재발사"를 기각했다. 반면 CCH-NF-03 은 "분당 60건 초과 시 어댑터의 chat 단위 큐에 적재"를 정책으로 채택한다. 두 큐 정책이 같은 문서 안에 공존하므로 혼동 여지가 있다.
- R9는 이 차이를 명시적으로 설명하고 있다: "CCH-NF-03 의 rate-limit 큐 정책은 다른 트리거 조건(분당 60건 초과 시 적재)으로, 본 케이스(execution running 중 사용자 메시지 도착)와 정책 방향이 다른 것은 정당하다."
- 결론: 기각된 대안의 재도입 아님. 의도적 구분이 Rationale 에 기술되어 있음.
- 제안: 현 상태 유지.

---

### [INFO] R4 (NotificationDispatcher in-process EventEmitter 채택) vs EIA §R10 (facade 원칙) — 정합 확인

- target 위치: `spec/5-system/15-chat-channel.md §3.2`, `§3.3`, `## Rationale R4`
- 과거 결정 출처: `spec/5-system/14-external-interaction-api.md ## R10`, `spec/5-system/4-execution-engine.md §4.4`
- 상세: 실행 엔진 §4.4 는 "엔진 레벨 단일 sink — `WebsocketService`" 정책을 수립했고, EIA R10 은 이를 유지하면서 NotificationDispatcher / SSE 어댑터를 "엔진 외부 facade 계층"으로 확장했다. EIA R10 은 동시에 Chat Channel 어댑터도 "동일 facade 계층의 추가 in-process subscriber"로 명시했다.
  `15-chat-channel.md` R4 는 "Redis pub/sub"과 "별도 after-commit hook 추가"를 기각하고 NotificationDispatcher 의 in-process EventEmitter 를 채택했다. "별도 after-commit hook 추가" 기각 사유로 "엔진 §4.4 의 단일 sink 정책 위반"을 명기하고 있어 과거 결정과 완전히 정합한다.
- 결론: 충돌 없음.

---

### [INFO] CCH-AD-06 (InteractionService.interact 직접 호출) vs EIA-AU-08 예외 조항

- target 위치: `spec/5-system/15-chat-channel.md §3.1 CCH-AD-06`, `§5.1`
- 과거 결정 출처: `spec/5-system/14-external-interaction-api.md §3.3 EIA-AU-08`, `EIA-IN-06`
- 상세: 어댑터가 EIA HTTP 표면을 우회하고 `InteractionService.interact()` 를 in-process 직접 호출하는 것이 EIA-AU-08 ("in-process trusted caller 예외")에 의해 명시적으로 허용된 범위 안에 있다. `15-chat-channel.md §5.1` 은 이 예외 조항을 참조하고, `scope: 'in_process_trusted'` 구현 단계 접근 제어도 기술하고 있다. EIA 에서 기각된 대안("어댑터도 EIA HTTP endpoint 를 호출")이 R2 에서도 동일하게 기각된 것과 일관성을 유지한다.
- 결론: 충돌 없음.

---

### [INFO] 비활성 트리거 202 Accepted (CCH 경로) vs WH-EP-07 410 Gone 정책

- target 위치: `spec/5-system/15-chat-channel.md §5.5 Inbound HTTP Contract`, `## Rationale R-CC-12`
- 과거 결정 출처: `spec/5-system/12-webhook.md WH-EP-07`
- 상세: WH-EP-07 은 원칙적으로 "비활성 트리거 요청 → 410 Gone"이었다. 15-chat-channel.md 는 chatChannel 설정 트리거에 한해 비활성 시에도 `202 Accepted + { ignored: true }` 반환으로 예외를 적용한다. 이 결정은 WH-EP-07 자체에 예외 절을 추가하는 형식으로 두 spec 이 동기화되어 있다(`"예외: config.chatChannel 이 설정된 트리거는 202 Accepted + { ignored: true } 반환"`).
  R-CC-12 는 이 번복을 "텔레그램 Bot API 의 non-2xx 응답 시 webhook 자동 비활성화·retry 폭주" 라는 명시적 이유와 함께 Rationale 로 기록하고 있다.
- 결론: WH-EP-07 에 예외 절이 반영되어 있고, R-CC-12 에 번복 Rationale 가 작성되어 있어 연속성 요건 충족.

---

### [INFO] CCH-SE-01 "자동 비활성화 금지" vs EIA R6 / WH-MG-04 정책

- target 위치: `spec/5-system/15-chat-channel.md §3.4 CCH-SE-01`
- 과거 결정 출처: `spec/5-system/14-external-interaction-api.md ## R6`, `spec/5-system/12-webhook.md WH-MG-04`
- 상세: EIA R6 는 "notification 실패 시 자동 비활성화 금지 — degraded 표시 + 사용자 승인 필요" 원칙을 수립했다. CCH-SE-01 도 동일 원칙을 "자동 비활성화 금지 (WH-MG-04 / EIA-NX-07 과 동일 정책)" 로 명시 참조한다.
- 결론: 기존 합의 원칙을 명시적으로 인용하며 따름. 충돌 없음.

---

### [INFO] R1 신규 트리거 유형 신설 기각 — "Chat Channel Trigger" 신규 노드 기각 대안과 현행 일관성

- target 위치: `spec/5-system/15-chat-channel.md ## Rationale R1`
- 과거 결정 출처: 동 문서 내 R1 (2026-05-21 최초 결정, 외부 spec 의 Rationale 에는 선례 없음)
- 상세: R1 은 "Chat Channel Trigger 신규 노드" (트리거 종류 N+1 증가) 를 기각하고 "Webhook 트리거 + chatChannel config" 옵션을 채택했다. 이는 `spec/2-navigation/2-trigger-list.md` 의 트리거 유형 카탈로그(Manual / Webhook / Schedule 3종)를 유지하는 방향과 정합하며, `spec/4-nodes/7-trigger/0-common.md` 의 기존 분류 체계를 확장하지 않는다.
- 결론: 기존 체계를 보존하는 결정으로 충돌 없음.

---

## 요약

`spec/5-system/15-chat-channel.md` 는 관련 spec 의 `## Rationale` 에 기록된 기각 결정, 합의 원칙, 시스템 invariant 에 대해 전반적으로 높은 연속성을 보인다. 가장 주의 깊게 확인한 지점은 R-CC-10(bot token single-path)이 `2-trigger-list.md` R-2(hmacSecret dual-path 허용)와 외견상 다른 결론을 내리는 부분으로, R-CC-10 내에 자원 위치의 의미 차이를 명시적으로 기록하고 기각 대안도 표기해 연속성 요건을 충족한다. WH-EP-07 의 "410 Gone" 정책을 chatChannel 경로에서 번복한 R-CC-12, EIA R10 과 실행 엔진 §4.4 의 단일 sink 정책을 그대로 따른 R4, EIA R6 의 "자동 비활성화 금지" 원칙을 준수한 CCH-SE-01 모두 과거 결정과 정합한다. 기각된 대안 재도입, 합의 원칙 위반, 무근거 번복에 해당하는 항목은 발견되지 않았다.

---

## 위험도

NONE
