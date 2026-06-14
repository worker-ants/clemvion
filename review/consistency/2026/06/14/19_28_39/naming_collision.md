# 신규 식별자 충돌 검토 결과

target: `spec/5-system/3-error-handling.md`

---

## 발견사항

### [INFO] `TOKEN_INVALID` / `TOKEN_EXPIRED` — EIA §1.6 과 §1.2 동일 문자열, 다른 토큰 family

- **target 신규 식별자**: `TOKEN_REVOKED`, `TOKEN_SCOPE_MISMATCH`, `TOKEN_AUDIENCE_MISMATCH` (§1.6, EIA REST 전용)
- **기존 사용처**: `spec/5-system/3-error-handling.md §1.2` — `TOKEN_INVALID`, `TOKEN_EXPIRED` 가 워크스페이스 JWT 계층에서 이미 정의됨. EIA spec(`spec/5-system/14-external-interaction-api.md:328`)도 `TOKEN_INVALID`/`TOKEN_EXPIRED` 가 양 레이어에서 **같은 문자열**임을 주석으로 명시
- **상세**: §1.6 Rationale 주석이 "같은 문자열이나 진입점(`/api/external/*`)·토큰 family 로 레이어가 구분된다"고 명기하고 있다. 실제 충돌이 아닌 의도된 재사용. `TOKEN_REVOKED`·`TOKEN_SCOPE_MISMATCH`·`TOKEN_AUDIENCE_MISMATCH` 세 신규 코드는 기존 spec 어디에도 다른 의미로 정의된 용례가 없다.
- **제안**: 현행 표기대로 유지. §1.6 의 기존 주석이 혼동 방지에 충분하다.

---

### [INFO] `STATE_MISMATCH` (EIA §1.6) vs `OAUTH_STATE_MISMATCH` (OAuth 흐름)

- **target 신규 식별자**: `STATE_MISMATCH` (§1.6, EIA REST 409)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md:842` — `OAUTH_STATE_MISMATCH`(400), OAuth callback state 파라미터 불일치. `/Volumes/project/private/clemvion/spec/conventions/error-codes.md:35` — 예시로 등장. `/Volumes/project/private/clemvion/spec/data-flow/2-auth.md:128` — OAuth flow 발행
- **상세**: 두 코드는 문자열이 다르다(`STATE_MISMATCH` vs `OAUTH_STATE_MISMATCH`). "state 불일치"라는 자연어로는 같은 표현이 가능하나 `OAUTH_` prefix 로 도메인이 분리된다. target §1.6 은 §1.3 `INVALID_STATE`·§1.5 `INVALID_EXECUTION_STATE` 와의 동형 관계 cross-ref 를 명시하고 있다.
- **제안**: 현행 이름 유지. 충돌 없음.

---

### [INFO] `EXECUTION_INTERNAL_ERROR` (WS §1.5) vs `INTERNAL_ERROR` (§1.1 시스템 에러)

- **target 신규 식별자**: `EXECUTION_INTERNAL_ERROR` (§1.5, WS ack 전용)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/2-api-convention.md:160` — `INTERNAL_ERROR` 가 5xx REST 기본 코드. `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md:882` 에서 "별개 scope" 라 명시
- **상세**: `INTERNAL_ERROR`(REST 5xx)와 `EXECUTION_INTERNAL_ERROR`(WS continuation ack)는 문자열이 다르며 WS protocol spec 에 이미 분리 주석이 있다. 이름 유사성만 존재하는 INFO 사항.
- **제안**: 현행 유지. 기존 주석으로 충분.

---

## 충돌 없음 확인 (CLEAR)

다음 §1.5·§1.6 신규 식별자들은 기존 spec 전체에서 다른 의미로 쓰이는 동일 문자열 사용처가 없음을 확인:

| 신규 식별자 | 확인 결과 |
|------------|---------|
| `EXECUTION_MESSAGE_TOO_LONG` | 기존 `4-execution-engine.md`·`6-websocket-protocol.md` — 동일 의미로만 등장. 충돌 없음 |
| `EXECUTION_INTERNAL_ERROR` | 기존 `4-execution-engine.md`·`6-websocket-protocol.md` — 동일 의미. `INTERNAL_ERROR`(REST)와 다른 문자열 |
| `RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE` | 기존 `4-execution-engine.md`·`6-websocket-protocol.md` 등 — 동일 의미. 충돌 없음 |
| `SERVER_SHUTTING_DOWN` | `4-execution-engine.md:1186` — 동일 의미. 충돌 없음 |
| `INVALID_COMMAND` | 기존 다른 용례 없음 |
| `MESSAGE_TOO_LONG` | `EXECUTION_MESSAGE_TOO_LONG` 과 다른 문자열. 기존 다른 용례 없음 |
| `STATE_MISMATCH` | `OAUTH_STATE_MISMATCH` 와 다른 문자열. 충돌 없음 |
| `IDEMPOTENCY_KEY_CONFLICT` | 기존 다른 용례 없음 |
| `EXECUTION_TERMINATED` | `data-flow/15-external-interaction.md:95` — 동일 의미. 충돌 없음 |
| `TOKEN_REVOKED` | `data-flow/15-external-interaction.md:269` — 동일 의미. 충돌 없음 |
| `TOKEN_SCOPE_MISMATCH` | `data-flow/15-external-interaction.md:270` — 동일 의미. 충돌 없음 |
| `TOKEN_AUDIENCE_MISMATCH` | `data-flow/15-external-interaction.md:270` — 동일 의미. 충돌 없음 |
| `TOO_MANY_CONNECTIONS` | `14-external-interaction-api.md:668` — 동일 의미. `RATE_LIMITED` 와 다른 문자열 |

파일 경로 충돌: `spec/5-system/3-error-handling.md` 는 기존 파일이며 frontmatter `id: error-handling` 은 `spec/5-system/` 내 유일. 충돌 없음.

---

## 요약

target `spec/5-system/3-error-handling.md` 가 §1.5·§1.6 에 새로 등재한 WS/EIA 에러 코드 식별자들은 기존 spec 코퍼스에서 다른 의미로 사용 중인 동일 문자열과 충돌하지 않는다. `TOKEN_INVALID`/`TOKEN_EXPIRED` 가 §1.2 와 EIA 양 표면에서 동일 문자열로 재사용되는 것은 이미 "같은 문자열이나 레이어 구분"으로 명기한 의도적 설계다. `EXECUTION_INTERNAL_ERROR` vs `INTERNAL_ERROR`, `STATE_MISMATCH` vs `OAUTH_STATE_MISMATCH` 의 유사명 관계는 INFO 수준 관찰이나 실제 충돌이 아니다. 신규 식별자 중 기존 사용처와 의미가 다른 동일 문자열은 발견되지 않았다.

---

## 위험도

NONE

STATUS: OK
