# 신규 식별자 충돌 검토 — spec/2-navigation/4-integration.md

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation/, diff-base=origin/main)

변경 파일: `spec/2-navigation/4-integration.md` (1개 파일만 변경됨)

---

## 발견사항

이번 변경이 도입하는 신규 식별자는 세 가지다.

### 1. `isRefreshCapable` — INFO

- **target 신규 식별자**: `isRefreshCapable` (§11.1 `connected-expiry` 잡 설명, 의사코드, 후속 산문)
- **기존 사용처**:
  - `spec/data-flow/5-integration.md` line 275, 340, 433 — 동일 이름·동일 의미로 이미 사용 중
  - `spec/4-nodes/4-integration/4-cafe24.md` line 436 — 동일 이름으로 이미 참조
  - `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` line 531 — 동일 이름 함수 구현 존재
- **상세**: origin/main 의 `4-integration.md` 는 "refresh-capable provider" 를 산문으로만 설명하고 함수명을 명시하지 않았다. 이번 변경이 `isRefreshCapable` 이라는 이름을 4-integration.md 에 도입했으나, 이 식별자는 이미 data-flow spec 과 codebase 에서 동일 의미로 사용 중이다. 충돌 없음 — 오히려 문서 간 통일.
- **제안**: 없음. 기존 정의와 완전히 정합.

---

### 2. `status_reason='token_expired'` — INFO

- **target 신규 식별자**: `status_reason=token_expired` (§11.1 `connected-expiry` 잡 동작 설명, 의사코드)
- **기존 사용처**:
  - `spec/1-data-model.md` line 293 — `INTEGRATION_STATUS_REASONS` 에 `token_expired` 이미 정의. 설명: "refresh_token 없는 provider 의 token_expires_at 만료"
  - `spec/data-flow/5-integration.md` line 285, 366, 433 — 동일 값 이미 사용
  - `spec/2-navigation/4-integration.md` (origin/main) line 993, 1416, 1423, 1425 — `token_expired` 이미 사용
- **상세**: 이번 변경 전에도 4-integration.md 의 §11.2, Rationale 에서 `status_reason='token_expired'` 가 사용됐다. 이번 변경은 §11.1 잡 테이블 설명에 `status_reason=token_expired` 를 추가해 기존 정의와 일관되게 맞췄다. 충돌 없음.
- **제안**: 없음.

---

### 3. `refresh_capable` (의사코드 로컬 변수) — INFO

- **target 신규 식별자**: `refresh_capable` (§11.1 의사코드 블록 내 로컬 변수)
- **기존 사용처**: 동명 변수 없음. 함수명 `isRefreshCapable` 과 표기법이 다르나 의사코드 내 로컬 변수라 네임스페이스 충돌 없음.
- **상세**: 의사코드 전용 로컬 변수로, spec 이나 코드베이스에서 타입명·API 파라미터·환경변수로 사용되지 않는다. 충돌 없음.
- **제안**: 없음.

---

### 4. `token_expired` vs `auth.token_expired` 네임스페이스 — INFO

- **기존 참조**: `spec/5-system/6-websocket-protocol.md` 에 `auth.token_expired` (WebSocket 이벤트, 미구현 Planned), `spec/1-data-model.md` 에 `TOKEN_EXPIRED` (REST/JWT 검증 에러 코드)
- **target 의 `token_expired`**: `Integration.status_reason` 컬럼 값 (DB 레벨 `snake_case`)
- **상세**: 세 식별자는 동일 단어를 다른 네임스페이스에서 사용한다. `spec/1-data-model.md` line 293 에서 "※ `token_expired` 는 본 컬럼(Integration.status_reason) 전용 슬러그 — JWT 만료 REST 에러 `TOKEN_EXPIRED`·WebSocket 이벤트 `auth.token_expired` 와 표기가 유사하나 별개 네임스페이스"라고 명시적으로 구분하고 있다. 충돌 없음 — 의도적 분리가 이미 문서화됨.
- **제안**: 없음. 기존 주석으로 충분히 구분됨.

---

## 요약

이번 diff 는 `spec/2-navigation/4-integration.md` 단 1개 파일을 변경하며, 도입하는 식별자(`isRefreshCapable`, `status_reason='token_expired'`, `refresh_capable`)는 모두 기존 `spec/data-flow/5-integration.md`, `spec/1-data-model.md`, `spec/4-nodes/4-integration/4-cafe24.md`, 코드베이스에서 동일 의미로 이미 사용 중이다. 신규 식별자가 기존 사용처와 다른 의미로 충돌하는 케이스는 없으며, 모든 변경은 기존 정의와 표기를 통일하는 방향의 정합 작업이다.

## 위험도

NONE
