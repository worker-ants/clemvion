# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`, scope=`spec/2-navigation/`, diff-base=`origin/main`
실제 변경 파일: `spec/2-navigation/4-integration.md`, `spec/1-data-model.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/data-flow/5-integration.md`, `spec/data-flow/8-notifications.md`

---

## 발견사항

### **[CRITICAL]** `spec/data-flow/5-integration.md` §3.2 `status_reason` 매핑 테이블 — `expired` 행이 여전히 `NULL` 을 정확값으로 기재

- **target 위치**: `spec/data-flow/5-integration.md` §3.2 `status_reason` 매핑 테이블 (line 383)
  ```
  | `expired` | `install_timeout` (...), **NULL** (connected-expiry 0d 격하 — scanner 가 reason 을 채우지 않음. §1.4 / Rationale 참조) |
  ```
- **충돌 대상**:
  - `spec/1-data-model.md` §2.10 `status_reason` 컬럼 정의 — `expired → token_expired` (refresh_token 없는 provider 의 token_expires_at 만료)
  - `spec/2-navigation/4-integration.md` §11.1 `connected-expiry` 잡 동작 — `status=expired, status_reason=token_expired` 격하
  - `spec/2-navigation/4-integration.md` §11.2 알림 발사 정책 — `status_reason='token_expired'` 에만 `integration_expired` 발사
  - `spec/data-flow/5-integration.md` §1.4 스캐너 잡 표 (line 251) — `remain ≤ 0d` 시 `status='expired', status_reason='token_expired'` 로 격하
  - `spec/data-flow/5-integration.md` Mermaid 시퀀스 다이어그램 (line 285) — `status='expired', status_reason='token_expired'`
  - `spec/data-flow/5-integration.md` 상태 전이 다이어그램 (line 366) — `connected --> expired: ... status_reason=token_expired`
  - `spec/data-flow/5-integration.md` Rationale "폐기된 옛 서술" (line 433) — "`token_expired` status_reason 미구현" 이 V-07 fix 로 해소됐다고 선언
- **상세**: 동일 파일(`spec/data-flow/5-integration.md`) 안에서도 내부 모순이 발생한다. §1.4 잡 표·시퀀스 다이어그램·상태 전이 다이어그램·Rationale Archival 절은 모두 `status_reason='token_expired'` 를 현행 구현으로 기술하는데, §3.2 매핑 테이블만 옛 서술(`NULL`, "scanner 가 reason 을 채우지 않음")을 그대로 유지하고 있다. 이 표를 SoT 로 읽는 독자는 `token_expired` 값이 존재하지 않는다고 오해할 수 있다.
- **제안**: `spec/data-flow/5-integration.md` §3.2 `expired` 행을 다음과 같이 갱신한다.
  ```
  | `expired` | `install_timeout` (pending_install 24h TTL — cafe24·makeshop 공통), `token_expired` (refresh_token 없는 provider 의 connected-expiry 0d 격하 — §1.4 / V-07) |
  ```

---

### **[WARNING]** `spec/2-navigation/4-integration.md` §7 Database 연결 테스트의 `status_reason` `unknown` 표기

- **target 위치**: `spec/2-navigation/4-integration.md` §7 (line 488)
  ```
  실패 시 드라이버별 에러 메시지를 `error.code`에 정규화(`auth_failed`, `network`, `unknown`).
  ```
- **충돌 대상**:
  - `spec/1-data-model.md` §2.10 `status_reason` 정의 — `unknown_error` (미분류 fallback)
  - `spec/data-flow/5-integration.md` §3.2 — `unknown_error` (미분류 fallback — 운영 알람 신호)
  - `spec/4-nodes/4-integration/_product-overview.md` INT-ST-01 — `unknown_error`
- **상세**: Database Integration 연결 테스트의 에러 정규화 목록이 `unknown` 을 사용하는데, `INTEGRATION_STATUS_REASONS` union 및 다른 모든 spec 영역은 `unknown_error` 를 canonical 슬러그로 채택하고 있다. `normalizeStatusReason` 이 union 밖 값을 `unknown_error` 로 강제하므로 런타임에는 무해할 수 있지만, spec 독자 입장에서 두 이름이 같은 값인지 구분이 안 된다.
- **제안**: `spec/2-navigation/4-integration.md` §7 의 `unknown` 을 `unknown_error` 로 통일한다.

---

### **[INFO]** `spec/data-flow/5-integration.md` §3.2 `status_reason` 매핑 테이블 — `token_expired` 가 `INTEGRATION_STATUS_REASONS` union 에 있음을 명시하지 않음

- **target 위치**: `spec/data-flow/5-integration.md` §3.2 (line 383 일대)
- **충돌 대상**: `spec/1-data-model.md` §2.10 — "`INTEGRATION_STATUS_REASONS` union" 이라고 명시하고 `token_expired` 추가를 언급, `spec/data-flow/5-integration.md` Rationale (line 433) 에서도 "union 추가" 를 언급
- **상세**: `status_reason` 매핑 표 도입부(`INTEGRATION_STATUS_REASONS 가 단일 진실`)가 `token_expired` 는 union 에 없다는 맥락에서 작성된 옛 표현을 그대로 두고, §1.4 잡 표와 Rationale 가 "union 추가 완료" 를 선언한다. §3.2 표 자체를 `token_expired` 로 갱신하면 이 INFO 도 함께 해소된다.
- **제안**: CRITICAL 항목 수정 시 자동 해소.

---

## 요약

이번 변경의 핵심은 `isRefreshCapable` 술어 일반화(cafe24 → cafe24·makeshop)와 `token_expired` status_reason 도입이다. `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/data-flow/8-notifications.md` 는 상호 일관되게 갱신되었다. 그러나 `spec/data-flow/5-integration.md` §3.2 `status_reason` 매핑 테이블만 이전 표현(`expired → NULL, "scanner 가 reason 을 채우지 않음"`)을 유지하여 동일 파일 내부에서도 §1.4·시퀀스 다이어그램·상태 전이 다이어그램·Rationale Archival 절과 직접 모순된다. 이 CRITICAL 불일치는 해당 테이블 한 행 수정으로 해소 가능하다.

## 위험도

MEDIUM
