# 신규 식별자 충돌 검토 결과

## 검토 범위

- target: `spec/2-navigation/` (검토 모드: `--impl-done`, diff-base: `origin/main`)
- 실제 변경 파일: `spec/2-navigation/4-integration.md`, `spec/data-flow/5-integration.md`, `spec/1-data-model.md`, `spec/data-flow/8-notifications.md`

---

## 발견사항

### [WARNING] `token_expired` — Integration.status_reason 슬러그와 JWT REST 에러 코드 `TOKEN_EXPIRED` 의 표기 근접성

- **target 신규 식별자**: `token_expired` (`Integration.status_reason` 의 새 DB 저장값 — `connected-expiry` 0d 분기에서 refresh_token 없는 provider 격하 시 기록)
- **기존 사용처**:
  - `spec/5-system/3-error-handling.md` §2 — `TOKEN_EXPIRED` (UPPER_SNAKE_CASE): JWT Access Token 만료 시 REST API 401 에러 코드
  - `spec/5-system/6-websocket-protocol.md` §4.5 — `auth.token_expired` (점 표기, 계획·미구현): WebSocket 이벤트 이름
  - `spec/data-flow/2-auth.md` §3.2 — `TOKEN_EXPIRED`: refresh 엔드포인트 401 응답 코드
  - `spec/data-flow/15-external-interaction.md` — `TOKEN_EXPIRED`: External Interaction JWT 만료 매핑
- **상세**: `token_expired` (snake_case) 는 `Integration.status_reason` DB 컬럼의 새 값이고, `TOKEN_EXPIRED` (UPPER_SNAKE_CASE) 는 JWT 인증 REST 에러 코드다. 두 식별자는 표기 방식이 다르고 네임스페이스도 명확히 분리돼 있다. target 문서 자체가 이 잠재적 혼동을 인지하고 `spec/1-data-model.md §2.10` 의 `status_reason` 컬럼 정의 끝에 "※ `token_expired` 는 본 컬럼 전용 슬러그 — JWT 만료 REST 에러 `TOKEN_EXPIRED`·WebSocket 이벤트 `auth.token_expired` 와 표기가 유사하나 별개 네임스페이스다" 주석을 명시적으로 추가했다. 코드에서 혼용 오염 위험은 낮으나, 문서 간 grep 또는 쿼리 패턴 검색 시 혼동 가능성이 남는다.
- **제안**: 현재 단계에서 식별자를 변경할 필요는 없다. 기존 주석이 적절하게 분리를 문서화하고 있다. 코드 구현부에서 `Integration.status_reason` 을 다루는 TypeScript union(`INTEGRATION_STATUS_REASONS`)에도 `// DB-only slug, distinct from REST error code TOKEN_EXPIRED` 인라인 주석을 추가해 코드 레벨에서도 명확히 구분하는 것을 권장한다.

---

### [WARNING] `unknown_error` — `spec/2-navigation/4-integration.md` §6 데이터베이스 에러 정규화에 잔존하는 `unknown` 표기

- **target 신규 식별자**: `unknown_error` — `INTEGRATION_STATUS_REASONS` union 의 미분류 fallback 값 (target 변경으로 `unknown` → `unknown_error` 로 통일)
- **기존 사용처**:
  - `spec/2-navigation/4-integration.md` 488번째 줄 (현재 워크트리 기준): "테스트: 연결 후 `SELECT 1` 실행. 실패 시 드라이버별 에러 메시지를 `error.code`에 정규화(`auth_failed`, `network`, `unknown`)." — 변경 diff 에서 `unknown_error` 로 갱신됐으나 동일 파일의 §6 Database 설명 단락에 `unknown` 이 잔존
- **상세**: `git diff` 에서 `spec/2-navigation/4-integration.md` 의 해당 줄이 `unknown` → `unknown_error` 로 변경된 것이 확인됐다. 그러나 현재 main 브랜치(`origin/main`)의 `spec/2-navigation/4-integration.md` 488번째 줄에는 아직 `unknown` 표기가 남아 있다. 이 파일에 대한 변경이 현재 브랜치에 이미 반영되어 있다면 충돌 없이 해소된 것이지만, 현재 파일 상태를 직접 확인해야 한다.
- **제안**: `spec/2-navigation/4-integration.md` §6 (데이터베이스 테스트 에러 정규화 설명) 의 `unknown` 표기가 `unknown_error` 로 갱신됐는지 확인할 것. 미갱신이라면 단일 파일 내 두 표기 공존 → 독자 혼동 발생.

---

### [INFO] `isRefreshCapable` — 내부 함수명/술어명으로 도입되는 식별자

- **target 신규 식별자**: `isRefreshCapable` (spec 내 의사코드·설명에 등장하는 backend 함수/술어 이름)
- **기존 사용처**: `isCafe24RefreshCapable` — `integration-expiry-scanner.service.ts` 의 구(旧) 내부 함수명. origin/main 의 `spec/data-flow/5-integration.md` 에 `isCafe24RefreshCapable` 로 표기된 항목이 있었으나 이번 브랜치에서 `isRefreshCapable` 로 전면 교체됨.
- **상세**: 두 이름이 같은 파일의 다른 위치에 공존하면 혼동이 생길 수 있으나, diff 확인 결과 target 이 `isCafe24RefreshCapable` 표기를 모두 `isRefreshCapable` 로 교체했다. 구 이름은 spec 내에서 완전히 제거됐으므로 충돌은 없다. 단, 실제 backend 코드(`integration-expiry-scanner.service.ts`)에서 함수명이 `isCafe24RefreshCapable` 에서 `isRefreshCapable` 로 실제로 변경됐는지 확인이 필요하다 — spec 만 갱신하고 코드는 구 이름이면 spec-impl 불일치 발생.
- **제안**: backend 구현 파일에서 `isCafe24RefreshCapable` 심볼이 제거되고 `isRefreshCapable` 로 대체됐는지 확인. 코드가 `isRefreshCapable` 로 변경됐다면 이 항목은 무시해도 된다.

---

### [INFO] `integration_action_required` — Notification.type 신규 enum 값의 기존 중복 노출 위치

- **target 신규 식별자**: `integration_action_required` (Notification.type Enum 신규 값)
- **기존 사용처**:
  - `spec/1-data-model.md` §2.19 — Notification.type Enum 에 이미 열거됨 (`**integration_action_required**`)
  - `spec/data-flow/8-notifications.md` §1.1 표 — 이미 `integration_action_required` 행이 존재
  - `spec/2-navigation/_layout.md` §알림 팝오버 — `integration_action_required` 필터 칩 정의
- **상세**: `integration_action_required` 는 이번 브랜치 이전 커밋(`V052` 마이그레이션)에서 이미 도입된 식별자다. target 변경은 기존 식별자의 *알림 정책 설명을 명확화*하는 것이지 새로운 충돌을 유발하지 않는다. 충돌 없음.
- **제안**: 해당 없음.

---

## 요약

이번 `integration-expiry-fixes` 브랜치의 spec 변경이 도입하는 핵심 신규 식별자는 `token_expired` (Integration.status_reason DB 슬러그), `unknown_error` (`unknown` 교체), `isRefreshCapable` (술어명 일반화) 세 가지다. `integration_action_required` 는 기존에 이미 존재하는 식별자로 충돌이 없다. `token_expired` 는 동일 코드베이스에 JWT 에러 코드 `TOKEN_EXPIRED` 가 이미 존재하므로 표기 근접성으로 인한 혼동 가능성이 있으나, target 문서가 이를 인지하고 네임스페이스 구분 주석을 이미 삽입했다. `unknown_error` 는 동일 파일 내 잔존 `unknown` 표기와 일관성 갭이 있을 수 있으며 확인이 필요하다. 전체적으로 충돌 위험은 낮은 수준이다.

## 위험도

LOW

---

_관련 파일_
- `/Volumes/project/private/clemvion/spec/1-data-model.md` §2.10 (`status_reason`), §2.19 (Notification.type)
- `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md` §7, §11.1, §11.2, §Rationale
- `/Volumes/project/private/clemvion/spec/data-flow/5-integration.md` §1.4, §2.1, §3.2, §Rationale
- `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` §2 (TOKEN_EXPIRED)
- `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md` §4.5 (auth.token_expired)
