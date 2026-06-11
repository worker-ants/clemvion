# Cross-Spec 일관성 검토 결과

검토 범위: `spec/2-navigation/` (구현 완료 후 검토, diff-base=origin/main)
검토 대상 변경 spec: `spec/2-navigation/4-integration.md`, `spec/1-data-model.md`, `spec/data-flow/5-integration.md`, `spec/data-flow/8-notifications.md`, `spec/4-nodes/4-integration/4-cafe24.md`

---

## 발견사항

### [INFO] `status_reason='unknown'` → `'unknown_error'` 명칭 변경 — 다른 영역 참조 잔존 없음
- **target 위치**: `spec/2-navigation/4-integration.md §5.4` (데이터베이스 연결 테스트 오류 정규화), `spec/1-data-model.md §2.10`
- **충돌 대상**: `spec/data-flow/5-integration.md §3.2` status_reason 매핑 표
- **상세**: `spec/1-data-model.md §2.10` 과 `spec/data-flow/5-integration.md §3.2` 는 모두 이번 브랜치에서 동기적으로 `unknown_error` 로 갱신되었다. `spec/2-navigation/4-integration.md §5.4` (데이터베이스 연결 테스트) 도 동시에 갱신됨. 세 파일 모두 `unknown_error` 를 일관되게 사용하며 `INTEGRATION_STATUS_REASONS` union 이 단일 진실로 명시되어 있다.
- **제안**: 이미 동기화 완료. 추가 조치 불필요.

### [INFO] `isRefreshCapable` 도입 — `spec/5-system/` 및 `spec/4-nodes/4-integration/5-makeshop.md` 참조 관계 확인
- **target 위치**: `spec/2-navigation/4-integration.md §11.1`, `spec/data-flow/5-integration.md §1.4`
- **충돌 대상**: `spec/4-nodes/4-integration/5-makeshop.md §4` (MakeShop 노드 실행 로직) — 이번 브랜치에서 변경되지 않음
- **상세**: `isRefreshCapable` 판별 로직 (`service_type ∈ {cafe24, makeshop}` AND `credentials.refresh_token` 존재) 이 `spec/2-navigation/4-integration.md §11.1` 과 `spec/data-flow/5-integration.md §1.4` 양쪽에 명시되었고 정의가 일치한다. `spec/4-nodes/4-integration/5-makeshop.md §4 step 6` 이 proactive + reactive_401 자가 회복 흐름을 독립적으로 정의하고 있으며, 본 브랜치의 스캐너 정책(makeshop 은 enqueue 없이 in-call 에 위임)과 모순되지 않는다 — makeshop spec 은 갱신되지 않았으나 기존 기술이 현행 동작과 이미 일치한다.
- **제안**: 이미 정합. 추가 조치 불필요.

### [INFO] `token_expired` 네임스페이스 충돌 주의 주석 — spec/5-system/1-auth.md 의 `TOKEN_EXPIRED` 와 혼동 가능성
- **target 위치**: `spec/1-data-model.md §2.10` `status_reason` 열 설명 끝
- **충돌 대상**: `spec/5-system/1-auth.md` (JWT 만료 REST 에러 코드 `TOKEN_EXPIRED`), WebSocket 이벤트 `auth.token_expired`
- **상세**: 브랜치에서 `spec/1-data-model.md §2.10` 에 "※ `token_expired` 는 본 컬럼 전용 슬러그 — JWT 만료 REST 에러 `TOKEN_EXPIRED`·WebSocket 이벤트 `auth.token_expired` 와 표기가 유사하나 별개 네임스페이스다" 주석이 추가되었다. 이 주석은 독자에게 혼동을 명시적으로 경고하고 있어 잠재 충돌을 문서 레벨에서 이미 처리한 상태다. `spec/5-system/1-auth.md` 자체 정의와 실제 값 충돌은 없음 — `Integration.status_reason` 컬럼 값(`snake_case`)과 REST/WS 에러 코드(`UPPER_SNAKE_CASE`)는 층위가 다르다.
- **제안**: 이미 처리됨. 필요 시 `spec/5-system/1-auth.md` 에도 역참조 주석 추가 가능하나 필수 아님.

### [INFO] `integration_expired` 알림 발사 대상 범위 변경 — `spec/data-flow/8-notifications.md` 동기화 완료
- **target 위치**: `spec/2-navigation/4-integration.md §11.2`, `spec/data-flow/8-notifications.md`
- **충돌 대상**: 없음 (양쪽 모두 이번 브랜치에서 동기적으로 갱신)
- **상세**: `integration_expired` passive 알림이 refresh-capable provider (cafe24·makeshop) 에는 발사되지 않는다는 정책이 `spec/2-navigation/4-integration.md §11.2` 와 `spec/data-flow/8-notifications.md` 양쪽에 일관되게 반영되었다. `integration_action_required` active 알림과의 분리 원칙도 양쪽에서 동일하게 기술됨.
- **제안**: 이미 동기화 완료. 추가 조치 불필요.

### [INFO] `status_reason=NULL` → `status_reason='token_expired'` 상태 전이 표기 — state diagram 일관성
- **target 위치**: `spec/data-flow/5-integration.md §3.1` stateDiagram (mermaid) 의 `connected → expired` 전이 주석
- **충돌 대상**: `spec/2-navigation/4-integration.md §6` 상태 전이 표
- **상세**: 이번 브랜치에서 `spec/data-flow/5-integration.md` 의 state diagram 주석이 "status_reason=NULL" 에서 "status_reason=token_expired" 로 갱신되었고, `spec/2-navigation/4-integration.md §11.1` 의사코드와 설명도 동일하게 갱신되었다. `spec/2-navigation/4-integration.md §6` 상태 전이 표를 확인하면 `connected → expired` 행에 status_reason 이 명시되어 있으나 이번 브랜치에서 변경된 파일이다 — 내용을 교차 검증하면 이미 `token_expired` / `install_timeout` 두 경로가 §6 표에 기술되어 있어 정합한다.
- **제안**: 이미 동기화 완료. 추가 조치 불필요.

---

## 요약

이번 브랜치의 spec 변경은 `integration-expiry-fixes` 작업의 핵심 설계 결정 — `isRefreshCapable` 일반화(makeshop 포함), passive/active 알림 분리, `unknown_error` 명칭 통일, `status_reason=token_expired` 격하 경로 명확화 — 을 네 개 spec 파일(`spec/2-navigation/4-integration.md`, `spec/1-data-model.md`, `spec/data-flow/5-integration.md`, `spec/data-flow/8-notifications.md`)에 걸쳐 조율하여 반영하였다. 각 변경 지점은 서로를 교차 참조하는 형태로 동기화되어 있으며, 변경되지 않은 인접 spec(`spec/4-nodes/4-integration/5-makeshop.md`, `spec/4-nodes/4-integration/4-cafe24.md §6.1`, `spec/5-system/1-auth.md`)과의 모순도 발견되지 않았다. 발견된 항목은 모두 INFO 등급(명칭 동기화 확인, 네임스페이스 충돌 주의 사항)이며, 기능적 충돌이나 작동 불가 수준의 모순은 없다.

## 위험도

NONE
