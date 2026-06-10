# Cross-Spec 일관성 검토 결과

검토 대상: `spec/2-navigation/` (구현 완료 후 검토, diff-base=origin/main)
검토 범위: `spec/2-navigation/4-integration.md` 의 만료 스캐너·알림 정책 변경이 다른 영역 spec 과 충돌하는지 분석

---

## 발견사항

### 1. **[WARNING]** `spec/1-data-model.md` §2.10 `status_reason` 열거값 — `unknown` vs `unknown_error` 비일치

- **target 위치**: `spec/1-data-model.md` §2.10 `Integration.status_reason` 필드 설명 (현재 이 PR 의 변경 행)
- **충돌 대상**: `spec/2-navigation/4-integration.md` §5.4 Database 테스트 정규화 목록 (변경됨: `unknown` → `unknown_error`), `spec/data-flow/5-integration.md` §3.2 `status_reason` 매핑 표 (`unknown_error` 사용, `INTEGRATION_STATUS_REASONS` union SoT 언급)
- **상세**: 이번 PR 에서 `spec/2-navigation/4-integration.md` §5.4 는 Database 드라이버 에러 정규화 목록을 `unknown` → `unknown_error` 로 갱신하고, `spec/data-flow/5-integration.md` §3.2 도 `unknown_error` 로 기술되어 있다. 그러나 `spec/1-data-model.md` §2.10 의 `status_reason` 설명 행은 `error` 상태의 허용값 열거에 여전히 `unknown` (현행) 을 기재하고 있다 — `unknown_error` 로의 갱신이 누락되어 세 파일이 서로 다른 값을 열거한다. `INTEGRATION_STATUS_REASONS` union 이 SoT 이므로 `spec/1-data-model.md` 를 `unknown_error` 로 동기화해야 한다.
- **제안**: `spec/1-data-model.md` §2.10 `status_reason` 행의 `error` 허용값 목록에서 `unknown` (현행) 을 `unknown_error` (미분류 fallback) 로 교체. "현행" 주석도 삭제 또는 업데이트.

---

### 2. **[INFO]** `spec/1-data-model.md` §2.20 `Notification.type` 설명 — `integration_expired` 발사 정책 설명이 구 서술을 참조

- **target 위치**: `spec/1-data-model.md` §2.20 `Notification` 엔티티의 `type` Enum 설명 (이번 PR 미변경)
- **충돌 대상**: `spec/2-navigation/4-integration.md` §11.2 (이번 PR 에서 변경) — refresh-capable provider 는 `integration_expired` 알림 대상에서 제외됨을 명시
- **상세**: `spec/1-data-model.md` 의 `Notification.type` 설명 행에는 `integration_expired` 가 `status_reason='token_expired'` 임박/도래를 알리는 passive notice 라고 설명되어 있으며 이것 자체는 이번 변경과 정합하다. 그러나 같은 행에 링크된 `[Spec 통합 §11.2]` 의 내용이 이번 PR 에서 크게 바뀌어, 이제 "refresh-capable provider (cafe24·makeshop) 는 passive 알림 면제" 라는 맥락이 data-model 행에서는 보이지 않는다. 독자가 data-model 행만 읽으면 cafe24·makeshop 에도 `integration_expired` 가 발사된다고 오인할 수 있다.
- **제안**: `spec/1-data-model.md` §2.20 `Notification.type` 의 `integration_expired` 설명에 "refresh-capable provider (cafe24·makeshop) 는 발사 제외 — [Spec 통합 §11.2] 참조" 한 줄 추가. 강제 사항은 아니나 독자 혼선 방지를 위해 동기화 권장.

---

### 3. **[INFO]** `spec/data-flow/5-integration.md` §1.4 sequence diagram — `Scan->>Noti` 알림 발사 행이 refresh-capable 분기 바깥에 위치

- **target 위치**: `spec/data-flow/5-integration.md` §1.4 `connected-expiry` sequenceDiagram (이번 PR 에서 변경)
- **충돌 대상**: `spec/2-navigation/4-integration.md` §11.1 의 `connected-expiry` 의사코드 (이번 PR 에서 변경) — refresh-capable 분기는 `continue` (알림 없음) 로 loop 조기 탈출
- **상세**: `spec/data-flow/5-integration.md` §1.4 의 sequenceDiagram 에서 `loop each row` 블록의 마지막 줄에 `Scan->>Noti: notify integration_expired (수신자: personal→소유자 / organization→Admin, email 은 preferences 따라 both)` 행이 isRefreshCapable `alt` 블록과 `else` 블록의 **외부**에 위치해 있다 (loop 전체 마지막). 이로 인해 diagram 상으로는 refresh-capable 행에 대해서도 매 반복마다 알림이 발사되는 것처럼 읽힌다. `spec/2-navigation/4-integration.md` §11.2 와 의사코드는 "refresh-capable 는 알림 없음" 을 명확히 하는데, sequence diagram 이 이를 반영하지 못한다.
- **제안**: `spec/data-flow/5-integration.md` §1.4 sequenceDiagram 에서 `Scan->>Noti` 행을 `else refresh_token 없는 provider` 블록 안으로 이동시켜, refresh-capable 분기에서는 알림이 발사되지 않음을 diagram 에서도 명확히 표현.

---

## 요약

이번 PR (`integration-expiry-fixes`) 은 `spec/2-navigation/4-integration.md` §11 과 `spec/data-flow/5-integration.md` §1.4 에서 refresh-capable provider (cafe24·makeshop) 를 만료 격하 및 passive `integration_expired` 알림 대상에서 제외하는 `isRefreshCapable` 정책을 spec 에 반영한다. `spec/1-data-model.md` 의 `status_reason` 행도 이번 PR 에서 `token_expired` 를 추가하는 등 대부분 정합하게 갱신되었다. 발견된 항목은 두 가지 비일치 — (1) `spec/1-data-model.md` §2.10 의 `error` status_reason 열거에 `unknown` 이 `unknown_error` 로 갱신되지 않은 것(WARNING), (2) `spec/data-flow/5-integration.md` §1.4 sequenceDiagram 에서 알림 발사 행이 refresh-capable 분기 바깥에 위치해 diagram 판독이 사양과 어긋나는 것(INFO), 그리고 `spec/1-data-model.md` Notification 행의 refresh-capable 제외 설명 미동기(INFO) — 이다. CRITICAL 충돌은 없으며, WARNING 1건은 union SoT(`INTEGRATION_STATUS_REASONS`)와의 동기화 누락이다.

---

## 위험도

LOW
