# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` · scope: `spec/2-navigation`
검토 대상: `spec/2-navigation/2-trigger-list.md` (M-8 refactor — `trigger-detail-drawer.tsx` 분할 착수 전 사전 검토)

---

## 발견사항

### [WARNING] R-2 Rationale 의 `PATCH { config.hmacSecret }` 경로가 R-14 에 의해 제거됨에도 Rationale 에 잔존

- **target 위치**: `spec/2-navigation/2-trigger-list.md §Rationale R-2` ("Webhook HMAC secret 입력 vs. rotate 분리")
- **충돌 대상**: 동일 파일 `§3 API` 주석 및 `§Rationale R-14` ("authConfigId v1 — inline 인증 필드 제거")
- **상세**:
  - R-2 는 `PATCH /api/triggers/:id { config.hmacSecret }` (v1) 경로를 유효한 현행 입력 경로로 기술하며, 이에 대응하는 `POST /api/triggers/:id/auth/rotate-secret` (v1.1) 을 미결 TBD 로 남겨둔다.
  - 그러나 R-14 는 인라인 인증 키 (`config.authType` / `hmacHeader` / `hmacSecret` / `bearerToken`) 전부를 제거했고, `§3 API` 주석에도 "과거 v1.1 예약 행 `POST /api/triggers/:id/auth/rotate-secret` 은 신설되지 않은 채 본 PR 에서 폐기됐다" 고 명시한다.
  - 즉 R-2 는 R-14 가 채택되기 이전 설계 안을 기술하는 상태로 남아 있어, 같은 파일 내에서 inline `hmacSecret` 경로가 "유효하다"(R-2)와 "이미 제거됐다"(R-14, §3) 가 동시에 성립한다.
  - M-8 구현 시 `WebhookConfigCard` 를 만들 때 R-2 를 참조하면 존재하지 않는 필드(`hmacSecret`)를 UI 에 포함시킬 오해가 발생할 수 있다.
- **제안**: R-2 에 "R-14 채택으로 `config.hmacSecret` 인라인 경로 폐기됨 — 본 Rationale 은 선행 설계 기록으로 보존하되 현재 계약에서 제외된 결정임을 명시" 주석 추가. `POST /api/triggers/:id/auth/rotate-secret` v1.1 TBD 항목도 "AuthConfig `regenerate` 로 일원화됨에 따라 폐기" 로 닫는다.

---

### [INFO] §2.1 더보기(⋮) 설명에서 Chat Channel 카드가 암묵적으로 누락

- **target 위치**: `spec/2-navigation/2-trigger-list.md §2.1` `더보기(⋮)` 셀: "메타·인증·Schedule·EIA 카드 노출"
- **충돌 대상**: 동일 파일 `§2.3` ("Chat Channel 상세" 카드 명시) 및 `§2.3.1 필드 권한 매트릭스` ("Chat Channel" 카드 행 다수)
- **상세**:
  - §2.1 의 상세 보기 설명은 "메타·인증·Schedule·EIA 카드" 라고 나열하지만 "Chat Channel 카드" 를 명시하지 않는다. §2.3 에는 `config.chatChannel` 설정 트리거에 대한 별도 Chat Channel 카드가 명확히 정의돼 있다.
  - 기능상 모순은 아니고 §2.3 이 상세 정의를 제공하므로 구현에 영향은 없으나, drawer 카드 목록 나열의 완결성이 떨어져 M-8 구현 시 카드 목록 파악 시 오해 여지가 있다.
- **제안**: §2.1 상세 보기 설명을 "메타·인증·Schedule·EIA·Chat Channel(해당 시) 카드 노출" 로 동기화.

---

## 요약

`spec/2-navigation` 영역은 타 영역 spec(`spec/1-data-model.md §2.8 Trigger`, `spec/5-system/12-webhook.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md`)과의 교차 일관성이 양호하다. Trigger 엔티티 필드, API 계약(PATCH 단일 경로, rotate 전용 endpoint, RBAC), 상태 전이(Schedule ↔ Trigger 동기화), 권한 모델(editor+ 게이트) 모두 데이터 모델·시스템 spec 과 모순 없이 일치한다. M-8 리팩터 플랜 자체도 "spec 갱신: 불요" 로 확인되어 구현이 기존 spec 을 그대로 반영한다. 주요 위험은 동일 파일 내부의 R-2 Rationale 이 R-14 채택 이후에도 갱신되지 않아 inline `hmacSecret` 경로가 폐기됐음을 기술하지 않는 점이다. M-8 `WebhookConfigCard` 구현 시 R-2 를 오해해 존재하지 않는 입력 필드를 추가할 위험을 차단하려면 R-2 를 닫는 것이 권장된다.

## 위험도

LOW

---

STATUS: SUCCESS
