# 신규 식별자 충돌 검토 결과

대상: `plan/in-progress/prod-fail-closed-guards.md`

---

## 발견사항

### 요구사항 ID 충돌 — 없음

target 이 새로 부여하는 요구사항 ID 없음. 출처 plan (`plan/in-progress/refactor/04-security.md`) 의 내부 찾기 인덱스(`C-1`, `M-4`, `M-7`)를 참조 링크로만 사용하며, 독자적 요구사항 ID를 새로 정의하지 않는다. 타 plan 문서(`spec-sync-structural-followups.md` 등)에서 동일 표기 `C-1`이 등장하지만 별도 plan-문서 스코프 내의 로컬 찾기 인덱스이므로 전역 충돌이 아니다.

### 엔티티/타입명 충돌 — 없음

- **`assertProductionConfig(env)`** — 신규 함수명. `spec/`, `codebase/` 전체 grep 결과 해당 심볼이 기존 어디에도 존재하지 않는다. 충돌 없음.
- 파일 경로 **`common/config/production-guards.ts`** — 기존 `codebase/backend/src/common/config/` 에는 `app.config.ts`, `jwt.config.ts` 등 9개 파일만 존재하며 `production-guards.ts`는 없다. 충돌 없음.

### API endpoint 충돌 — 없음

target 은 신규 REST endpoint를 도입하지 않는다.

### 이벤트/메시지명 충돌 — 없음

target 은 신규 webhook/queue/SSE 이벤트를 도입하지 않는다.

### 환경변수·설정키 충돌 — 없음

target 이 처리하는 환경변수는 전부 기존에 정의된 것이다:

| 환경변수 | 기존 사용처 | target 의 역할 |
|---|---|---|
| `JWT_SECRET` | `codebase/backend/src/common/config/jwt.config.ts:4` — `|| 'dev-jwt-secret'` fallback | 기존 변수에 production 가드 추가 (신규 변수 아님) |
| `ENCRYPTION_KEY` | `spec/conventions/secret-store.md §3.3`, `spec/5-system/7-llm-client.md §암호화 키` — AES-256-GCM 마스터키 | 기존 변수에 production 가드 추가 (신규 변수 아님) |
| `MCP_ALLOW_INSECURE_URL` | `spec/5-system/11-mcp-client.md:132` — 로컬 개발 escape hatch | 기존 변수에 production throw 추가 (신규 변수 아님) |
| `ALLOW_PRIVATE_HOST_TARGETS` | `spec/4-nodes/4-integration/1-http-request.md:105`, `spec/2-navigation/4-integration.md:1118` — SSRF opt-out | 기존 변수, production warn(throw 아님) — 정당 self-host 용도 분리로 기존 정책과 정합 |
| `OAUTH_STUB_MODE` | `codebase/backend/src/main.ts:41-50` — 기존 production fail-closed 가드 존재 | 기존 인라인 가드를 `assertProductionConfig` 로 응집 이동 (변수 자체는 신규 아님) |
| `LLM_STUB_MODE` | `codebase/backend/src/main.ts:51-61` — 기존 production fail-closed 가드 존재 | 위와 동일 |

신규 도입 환경변수 없음. 모든 변수는 기존 spec/코드에 정의되어 있고 target 은 기존 변수에 대한 가드 정책을 변경/응집한다.

### 파일 경로 충돌 — 없음

- `common/config/production-guards.ts` — 기존 파일과 충돌 없음(위 확인).
- spec 갱신 대상: `spec/5-system/1-auth.md`, `spec/conventions/secret-store.md`, `spec/5-system/11-mcp-client.md` — 기존 파일의 섹션 추가이므로 경로 충돌 없음.

---

## 요약

target(`prod-fail-closed-guards.md`)이 도입하는 신규 식별자는 함수명 `assertProductionConfig` 와 파일 경로 `common/config/production-guards.ts` 두 가지뿐이며, 둘 다 기존 spec·코드베이스 어디에도 존재하지 않는다. 처리 대상 환경변수 6종(`JWT_SECRET`, `ENCRYPTION_KEY`, `MCP_ALLOW_INSECURE_URL`, `ALLOW_PRIVATE_HOST_TARGETS`, `OAUTH_STUB_MODE`, `LLM_STUB_MODE`)은 모두 기존 정의를 재사용하며 신규 환경변수를 추가하지 않는다. 요구사항 ID, 엔티티/타입명, API endpoint, 이벤트명 영역에서 신규 식별자가 없어 충돌 가능성 자체가 없다.

---

## 위험도

NONE
