---
worktree: .claude/worktrees/auth-config-webhook-wiring
started: 2026-05-28
owner: project-planner
---

# Spec Draft: Webhook 인증 AuthConfig wiring + AuthConfig 도메인 보강

> 본 draft 는 `plan/in-progress/auth-config-webhook-wiring.md` 의 Phase 0 산출. spec 7 파일 변경안 정리. `/consistency-check --spec` 통과 후 실제 spec 갱신.
> **v2 (BLOCK 해소)**: consistency-check `review/consistency/2026/05/28/10_59_10/SUMMARY.md` 의 Critical 5건 + Warning 13건 반영.

## 동기

`/authentication` 페이지(`codebase/frontend/src/app/(main)/authentication/page.tsx`) 와 `auth-configs` 모듈은 워크스페이스 단위로 API Key / Bearer / Basic Auth 자격증명을 발행·암호화 저장·재발급할 수 있도록 구현돼 있으나 **webhook 수신 경로에서 실제로 사용되지 않는다**:

- `HooksService.verifyAuth` (`codebase/backend/src/modules/hooks/hooks.service.ts:584-650`) 가 `trigger.config` inline 필드(`authType`/`secret`/`bearerToken`/`hmacHeader`/`hmacAlgorithm`) 만 read.
- `Trigger.authConfigId` 컬럼·DTO 는 존재하나 인증 경로 caller 0건.
- `AuthConfig.last_used_at` 갱신 코드 없음.
- Frontend trigger drawer 에 AuthConfig selector 없음.

본 draft 는 두 path 통합 + AuthConfig 도메인 보강(`hmac` type 추가, `none` 제거, 마스킹 + reveal, basic_auth UI 완성) 을 위한 spec 7 파일 변경안.

## 사용자 확정 결정 (5건)

1. `Trigger.authConfigId` 가 webhook 인증 SoT. inline 필드 read 즉시 중단 + JSONB cleanup migration 으로 제거.
2. `AuthConfig.type` 에 `hmac` 추가, `none` 제거.
3. `AuthConfig.config` 항상 마스킹 + `POST /:id/reveal` 신설 (password 재확인 + Admin+ + audit 기록).
4. `/authentication` 페이지에 basic_auth UI 폼 본 PR 포함.
5. cleanup migration `V065` 로 trigger.config JSONB 의 inline 키 5개 제거.

## Migration 번호 (확인됨)

최신 = `V063__secret_store.sql`. 본 PR:
- `V064__auth_config_type_add_hmac.sql` — CHECK 제약 (`api_key`/`bearer_token`/`basic_auth`/`hmac`).
- `V065__trigger_config_strip_inline_auth.sql` — `UPDATE trigger SET config = config - 'authType' - 'secret' - 'bearerToken' - 'hmacHeader' - 'hmacAlgorithm' WHERE type='webhook'`.

---

## 1. `spec/1-data-model.md` §2.17 AuthConfig

### 변경

**type 행 갱신** — `Enum | api_key / bearer_token / basic_auth / hmac` (`none` 제거).

**§2.17.1 AuthConfig.config 의 JSONB 스키마 (신규 sub-section)**:

| type | config 스키마 | 자동 발급 |
|---|---|---|
| `api_key` | `{ key: string, headerName?: string = "X-API-Key" }` | `key` = `wfk_<hex24>` |
| `bearer_token` | `{ token: string }` | `token` = `wft_<hex32>` |
| `basic_auth` | `{ username: string, password: string }` | — (사용자 입력) |
| `hmac` | `{ secret: string, header: string = "X-Hub-Signature-256", algorithm: "sha256"\|"sha512" }` | `secret` = `whs_<hex32>` |

**§2.17.2 마스킹·노출 정책 (신규 sub-section)**:

- API 응답에서 `config.key` / `config.token` / `config.secret` / `config.password` 는 항상 `***<last4>` (last4 부족 시 `***`).
- `config.username` / `config.header` / `config.headerName` / `config.algorithm` 는 평문 (식별·검증 보조, 비밀 아님).
- 평문 노출은 3 경로만: `POST /api/auth-configs` (create), `POST /:id/regenerate`, `POST /:id/reveal`.
- 암호화 저장은 기존대로 AES-256-GCM (Integration `credentials` 와 동일 transformer 공유).

### Rationale 추가 (§2.17 본문 끝 또는 data-model Rationale)

- **none 제거 (I-5/W-12 반영)**: "인증 없음" 은 `Trigger.authConfigId IS NULL` 로 표현 — AuthConfig row 자체가 `type='none'` 인 의미 없음. DB CHECK 제약에 처음부터 미포함이라 DTO·service 정리만. `Integration.auth_type='none'` (MCP 공용 서버) 과는 다른 개념: 후자는 "Integration 이 존재하되 자격증명 불요", 전자는 "AuthConfig 자체가 부재". 두 경로가 같은 단어를 쓰지 않도록 AuthConfig 는 none 을 제거.
- **bearer_token 자동 발급 강제 (I-5 반영)**: 기존 6-config 의 "자동 생성 또는 사용자 입력" 중 사용자 입력 옵션 제거 — 자동 발급만. 사용자 입력 토큰은 엔트로피·형식 검증 부담이 크고, 외부 호출자에게 발급하는 토큰은 본 제품이 생성하는 게 일관적.
- **transformer 공유 (I-6 반영)**: `AuthConfig.config` 는 Integration `credentials` 와 동일 `ENCRYPTION_KEY`·AES-256-GCM transformer 공유. `secret-store.md` 의 URI scheme (`secret://...`) 은 trigger ref 슬롯 전용이며 AuthConfig 는 자체 테이블 컬럼 transformer 라 본 scheme 미사용.
- **마스킹 정책 (C-4 통합)**: 현재 API 가 평문 credentials 노출 — 콘솔/네트워크/로그 유출 위험. Stripe·GitHub PAT 패턴 (생성 1회 노출 → 이후 마스킹 → reveal 로만 재확인) 채택. **본 §2.17.2 가 마스킹 정책의 단일 진실** — 다른 문서는 본 절을 참조만.

---

## 2. `spec/5-system/12-webhook.md`

### 2.1 §2.1 표 — `authConfigId` 행 갱신

`auth_config_id` "Webhook 인증 검증의 단일 진입 (FK → AuthConfig). `NULL` 이면 인증 없음(none). 인증 자료·`ip_whitelist` 는 모두 AuthConfig 가 보유 — trigger.config 에 inline 인증 키 없음 (V065 cleanup)."

### 2.2 §2.2 config JSON 예시 갱신

inline 인증 키 5개 삭제:

```json
{
  "notification": { /* EIA outbound */ },
  "interaction":  { /* EIA inbound */ },
  "chatChannel":  { /* Chat Channel adapter */ }
}
```

본문 한 줄: "Webhook 인증 검증은 `trigger.auth_config_id` 가 가리키는 AuthConfig.type 으로 결정. `config.authType`/`secret`/`bearerToken`/`hmacHeader`/`hmacAlgorithm` 등 inline 키는 V065 cleanup migration 으로 제거되며 코드는 무시." (W-13: 기존 `hmacHeader`/`hmacAlgorithm` 필드명은 AuthConfig.config 의 `header`/`algorithm` 과 위치·소유자가 다름 — cleanup 완료 후 본 §2.2 의 기존 필드명 언급은 본 한 줄 외 모두 삭제.)

### 2.3 §3.1 "인증" 행 재작성

"`trigger.auth_config_id` 가 가리키는 `AuthConfig.type` 에 따름. `auth_config_id IS NULL` 이면 인증 없음(none). `is_active=false` 인 AuthConfig 는 즉시 401 `AUTH_FAILED`. `AuthConfig.ip_whitelist` 가 있으면 함께 시행."

### 2.4 §3.2 인증 요구사항 표 — 기존 ID 보존 + 신규 ID 추가 (C-1 해소)

> **C-1 핵심**: WH-SC-01~05 의 기존 의미를 유지한다. `15-chat-channel.md:408` (WH-SC-04 = "인증 실패→401"), `chat-channel-adapter.md:393` (WH-SC-02 = "HMAC 서명") cross-ref 오염 방지. 신규 type 은 WH-SC-06 이후로 배정.

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-SC-01 | 인증 없음(공개) 옵션 — `auth_config_id IS NULL`. `endpointPath` UUID 가 사실상 비밀 키 [보존] |
| WH-SC-02 | HMAC 서명 검증 (AuthConfig.type=`hmac`, secret 기반, header=`config.header` default `X-Hub-Signature-256`) [보존 — 의미 유지, AuthConfig 출처 명확화] |
| WH-SC-03 | Bearer Token 검증 (AuthConfig.type=`bearer_token`) [보존] |
| WH-SC-04 | 인증 실패 시 `401 Unauthorized` (단일 메시지 `AUTH_FAILED`, enumeration 방지) [보존 — chat-channel cross-ref] |
| WH-SC-05 | Rate limiting (트리거당 분당 최대 요청 수) [보존] |
| WH-SC-06 | **(신규)** API Key 검증 (AuthConfig.type=`api_key`, 헤더 `config.headerName` default `X-API-Key`) |
| WH-SC-07 | **(신규)** Basic Auth 검증 (AuthConfig.type=`basic_auth`, `Authorization: Basic base64(user:pass)`) |
| WH-SC-08 | **(신규)** 인증 성공 시 `AuthConfig.last_used_at = NOW()` fire-and-forget UPDATE (트랜잭션 외) |
| WH-SC-09 | **(신규)** AuthConfig.ip_whitelist 가 설정된 경우 클라이언트 IP allowlist 시행 (불일치 시 401 AUTH_FAILED). ip_whitelist 는 AuthConfig 종속이므로 `auth_config_id IS NOT NULL` 일 때만 평가 |

### 2.5 §4 "인증 방식" 본문 재작성

§4.1~§4.3 (None / HMAC / Bearer) 를 `AuthConfig.type` 기준으로 재서술 + api_key / basic_auth 신규. §4.3 의 `config.bearerToken` 참조는 `AuthConfig.config.token` 으로 **완전 대체** (W-3). 알고리즘 화이트리스트 (`sha256`/`sha512`) 정책 유지.

### 2.6 §8 보안 고려사항 갱신 (I-3: 현행 섹션 번호는 §8)

- "비밀 키 저장" 행 삭제 → "Webhook 인증 자료는 모두 `auth_config.config` JSONB 에 AES-256-GCM 암호화 저장 ([`spec/1-data-model.md §2.17.2`](../../spec/1-data-model.md#2172-마스킹노출-정책)). 응답 시 항상 마스킹, 평문 노출은 create/regenerate/reveal 3 경로만."
- 신규 행: "AuthConfig `last_used_at` — 인증 성공 직후 fire-and-forget UPDATE. 트랜잭션 외 (race 시 last-write-wins), 실패 시 미갱신 (활성 가시성 차단)."

### 2.7 §7 처리 흐름 step 6 재작성 (C-3 반영)

```
6. 인증 검증:
   a. trigger.auth_config_id IS NULL → 통과 (none). (ip_whitelist 도 AuthConfig 종속이라 평가 대상 없음)
   b. authConfigsService.findById(trigger.auth_config_id, trigger.workspace_id) → AuthConfig row
   c. AuthConfig.is_active === false → 401 AUTH_FAILED
   d. AuthConfig.ip_whitelist 가 있으면 클라이언트 IP allowlist 검증 (불일치 → 401)
   e. AuthConfig.type 별 분기 (bearer_token / api_key / basic_auth / hmac) → constantTimeEquals 비교
   f. 성공 → AuthConfig.last_used_at = NOW() fire-and-forget UPDATE
   g. 실패 → 401 Unauthorized (단일 메시지 AUTH_FAILED, 갱신 X)
```

### 2.8 Rationale 신규 항목 "R-A. inline auth path 폐지 (2026-05-28)"

근거 6가지: (1) vault 중복, (2) rotation 훅 부재, (3) `last_used_at` 미갱신, (4) ip_whitelist 우회 (AuthConfig 의 ip_whitelist 가 inline path 에서 시행 안 됨), (5) RBAC 회피 (AuthConfig = Owner/Admin CRUD·Editor/Viewer R 인데 inline 은 trigger CRUD 권한으로 자격증명 수정 가능), (6) 평문 secret JSONB 잔존 (V065 cleanup). inline read 중단 + cleanup migration 동일 PR 처리 → hidden break 없음.

### 2.9 frontmatter (W-8 반영)

본 PR 의 모든 Phase (backend + frontend) 완료 후 일괄 격상:
```yaml
status: implemented
code:
  - codebase/backend/src/modules/hooks/**
  - codebase/backend/src/modules/auth-configs/**
  - codebase/frontend/src/app/(main)/authentication/**
  - codebase/frontend/src/components/triggers/**
```
> `implemented` 선택 시 `pending_plans:` 불요 (모든 surface 구현). Phase 6 종료 전까지는 `spec-only` 유지 → 마지막에 격상 (spec-code-paths 가드는 격상 시점에 충족).

---

## 3. `spec/5-system/1-auth.md`

### 3.1 §3.2 권한 매트릭스 — Auth Config Reveal 행 추가

| 리소스 | Owner | Admin | Editor | Viewer |
|--------|-------|-------|--------|--------|
| Auth Config | CRUD | CRUD | R | R |
| **Auth Config Reveal** | ✅ | ✅ | — | — |

### 3.2 §3.2 Rationale — Reveal 분리 근거 (W-5 반영)

§3 RBAC 본문 또는 1-auth Rationale 에 추가: "Auth Config 의 `R` (Editor/Viewer) 은 **마스킹된 응답 조회** 를 포함한다 (`***last4`). 평문을 보는 Reveal 은 별도 액션으로 분리 — Admin+ 만. 이유: 마스킹 응답은 자격증명 존재·식별엔 충분하나 평문 유출 위험이 없고, 평문 reveal 은 password 재확인 + audit 가 필요한 민감 동작이므로 권한을 좁힘."

### 3.3 §4.1 감사 로그 카테고리

"설정" 행: `auth_config.*` → `auth_config.create, auth_config.update, auth_config.delete, auth_config.regenerate, auth_config.reveal, llm_config.*`. (W-2: `spec/data-flow/1-audit.md` 의 동일 action 목록도 cross-check 갱신.)

---

## 4. `spec/2-navigation/6-config.md` Part A

### 4.1 §A.2 — HMAC sub-section 신규

| 필드 | 설명 |
|------|------|
| 이름 | 인증 설정 이름 |
| Secret | 자동 생성 (`whs_<hex32>`, 마스킹 표시, regenerate 가능) |
| Header | 기본 `X-Hub-Signature-256` |
| Algorithm | select: `sha256` / `sha512` |
| IP Whitelist | 허용 IP (선택, 모든 type 공통) |

### 4.2 §A.2 — Bearer Token sub-section 정리 (W-1 반영)

기존 "Token: 자동 생성 또는 사용자 입력" → "Token: 자동 생성 (`wft_<hex32>`)". **"만료 시간 (선택)" 행 삭제** — 본 PR 은 토큰 만료·rotation 을 다루지 않음 (out-of-scope). JSONB 스키마 `{ token }` 와 정합.

### 4.3 §A.2 — Basic Auth UI 명세 보강

- Username: 입력 후 저장. 응답 평문 노출 (식별 보조).
- Password: masked input, 저장 후 `***<last4>` 마스킹. Reveal 로만 평문 재확인.
- 자동 발급 없음 — 둘 다 사용자 입력 필수.

### 4.4 §A.2 — API Key "복사" 명확화 (I-2 반영)

"API Key: 자동 생성 (표시: 마스킹, 복사 가능)" → "복사 버튼은 **마스킹 문자열** 복사. 평문 복사는 생성 직후 1회 또는 Reveal 흐름."

### 4.5 §A.4 마스킹과 Reveal 흐름 — 신규 sub-section

#### 마스킹 표시 규칙
`config.key`/`token`/`secret`/`password` → `***<last4>`. `headerName`/`header`/`algorithm`/`username` → 평문. (정의 SoT 는 [`spec/1-data-model.md §2.17.2`](../../spec/1-data-model.md#2172-마스킹노출-정책).)

#### Reveal 흐름
```
1. 카드 ⋮ 메뉴 → "Reveal" (Admin+ 만 노출).
2. 비밀번호 재확인 다이얼로그 — 현재 로그인 비밀번호.
3. POST /api/auth-configs/:id/reveal { password }.
   - 통과: 200 + config 평문 전체 (1회).
   - 실패: 401 (잘못된 password) / 403 (Editor/Viewer).
4. UI: 평문 표시 + "Copy" + 30초 후 자동 hide.
5. Audit: audit_log action='auth_config.reveal'.
```

#### 권한
Owner/Admin → Reveal 노출+호출. Editor/Viewer → 미노출, API 직접 호출 시 403.

### 4.6 §3 API 표 — reveal 행 추가 (I-8 반영)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/auth-configs/:id/reveal | 평문 config 1회 노출. `:id` (UUID). body `{ password }`. Admin+. audit_log 기록 |

---

## 5. `spec/2-navigation/2-trigger-list.md`

### 5.1 §2.3.1 매트릭스 — Webhook Configuration 인증 4행 → Auth Config 단일 행 (C-2 반영)

**제거**: `authType` / `hmacHeader` / `hmacSecret` / `bearerToken` 4행.

**기존 "Auth Config | authConfigId | edit (v1.1 후속) ... v1 표시 전용" 행을 v1 활성화로 격상**:

`Auth Config | authConfigId | edit | 'Authentication' 메뉴의 AuthConfig 셀렉터로 트리거에 binding. NULL = 인증 없음. 인증 자료(secret/token/password) 는 Authentication 메뉴에서만 편집/Reveal/Regenerate — 본 drawer 는 binding 만. PATCH /api/triggers/:id { authConfigId } (소속 검증은 backend).`

UX 흐름 (W-3): drawer 의 AuthConfig selector 는 (a) 워크스페이스 AuthConfig 목록 드롭다운 + (b) "인증 없음" 옵션 + (c) "+ 새 인증 설정 만들기" → `/authentication` 링크.

### 5.2 §3 API 표 — `/auth/rotate-secret` 행 제거 (C-5 반영)

> **C-5 핵심**: 이 endpoint 는 "v1.1 예약 (실제 신설은 별 spec PR)" 상태로 **아직 미존재**. 미존재 endpoint 에 "Deprecated + 410" 기록은 논리 모순. → **예약 행 자체 제거** + rotation 은 `POST /api/auth-configs/:id/regenerate` 로 일원화.

- §3 API 표에서 `POST /api/triggers/:id/auth/rotate-secret` 행 삭제.
- §2.3.1 의 `hmacSecret` rotate (v1.1) 언급 삭제 (해당 행 자체가 제거되므로 자연 해소).
- W-11: line 135 의 `eia-secret-rotation-revoke-api.md` 참조 텍스트도 함께 제거.

### 5.3 §3 PATCH 노트 정리 (C-2)

PATCH body deep-merge 키 목록에서 `config.authType` / `config.hmacHeader` / `config.hmacSecret` / `config.bearerToken` 제거. `authConfigId` 를 top-level PATCH 가능 키로 명시. (chatChannel/notification/interaction 서브키 부분 갱신은 유지.)

### 5.4 Rationale 신규 "R-14. authConfigId v1 격상 (2026-05-28)" (C-2 / W-6 반영)

- R-2 TBD (Webhook HMAC secret 입력 vs rotate) 와 "Auth Config authConfigId v1 표시 전용" 결정을 **번복**: v1.1 후속으로 미뤘던 authConfigId binding 을 v1 으로 격상하고, inline `authType`/secret 필드를 제거.
- 번복 근거: AuthConfig 도메인이 이미 발행·회전(regenerate)·RBAC·통계·마스킹을 책임 — inline 과 외부 AuthConfig 두 경로가 공존하던 모호함을 단일 SoT 로 정리하는 게 일관적. R-2 의 "v1 은 inline 으로 충분" 전제는 AuthConfig wiring 이 실제 구현되며 무효.
- authType 인라인 필드·`none` 값 제거 사유 (W-6): "인증 없음" 은 `authConfigId IS NULL` 로 표현. inline authType enum 의 `none`/`hmac`/`bearer` 3값은 AuthConfig.type 4값으로 대체.
- W-10: 본 변경으로 `plan/in-progress/trigger-drawer-tests.md` 케이스 6번 ("authType 별 i18n 렌더링 hmac/bearer/none") 무효화 → 해당 plan 케이스를 `AuthConfig.type` selector 기준으로 갱신 (developer Phase 5 에서 처리, 본 plan §미해결에 등재).

---

## 6. `spec/data-flow/10-triggers.md`

### 6.1 §1.2 Webhook 진입 sequence — 인증 분기 재작성 (C-3 반영)

> **C-3 핵심**: `ip_whitelist` 는 `AuthConfig` 종속 (`spec/1-data-model.md §2.17`) — Trigger 에는 ip_whitelist 컬럼 없음. 따라서 "ip_whitelist-only (auth_config_id IS NULL)" 경로는 **성립 불가**. 기존 `OR ip_whitelist` 표현이 부정확했음. 응답 코드도 `200` → `202` 정정 ([12-webhook §3.1](../../spec/5-system/12-webhook.md#3-api-명세) 정합).

**변경**:
```
alt trigger.auth_config_id IS NOT NULL
  Hk->>PG: SELECT auth_config (decrypt config) WHERE id=:authConfigId AND workspace_id=:wsId
  Hk->>Hk: is_active 확인 + ip_whitelist (있으면) + AuthConfig.type 별 검증 (bearer/api_key/basic_auth/hmac)
  alt 실패 또는 is_active=false
    Hk-->>Ext: 401 AUTH_FAILED
  end
  Hk->>PG: UPDATE auth_config SET last_used_at = NOW() (fire-and-forget, 성공 시)
end
...
Hk-->>Ext: 202 { executionId }   (기존 200 → 202 정정)
```

### 6.2 §2.1 Postgres 표 — `auth_config` 행 (I-1 반영)

기존 SELECT 행 **보존** + UPDATE 행 별도 추가:

| Sink (table) | 흐름 | read/write 컬럼 | 인덱스 / 제약 |
| --- | --- | --- | --- |
| `auth_config` | 웹훅 인증 (read) | SELECT `type, config (decrypted), ip_whitelist, is_active` | FK from `trigger.auth_config_id` |
| `auth_config` | 검증 성공 (write) | UPDATE `last_used_at` (fire-and-forget) | — |

### 6.3 trigger.config 본문에서 인증 키 표기 제거

`config` JSONB 예시·표·언급에서 `authType`/`secret`/`bearerToken`/`hmacHeader` 토큰 모두 제거. §4 외부 의존 표의 "Auth 도메인 (AuthConfig)" 행은 유지 ("API Key / Bearer / Basic / HMAC. credentials 암호화" 로 HMAC 추가).

---

## 7. `spec/conventions/secret-store.md`

### 7.1 §1 URI Scheme — AuthConfig 비대상 명시 (W-4 반영, C-4 해소)

§1 표 아래 한 줄 추가: "**비대상**: `AuthConfig.config` (`spec/1-data-model.md §2.17`) 는 `auth-configs` 모듈 자체의 컬럼 transformer (Integration `credentials` 와 동일 AES-256-GCM) 가 직접 암복호화 — 본 `secret://` scheme 의 통합 대상이 아니다. scope 예시의 `auth-configs` 는 향후 확장 여지일 뿐 현재 사용처 아님."

### 7.2 ~~§4.A 마스킹 단락 삽입~~ — **철회 (C-4)**

> consistency-check C-4: draft 가 §7.1 에서 "별 도메인" 선언하면서 동일 convention 파일에 §4.A 마스킹 단락을 삽입하는 것은 단일 진실 원칙 위반. **§4.A 삽입 계획 전체 철회.** 마스킹 정책은 `spec/1-data-model.md §2.17.2` 에만 위치.

### 7.3 §Changelog — 외부 링크 한 줄만 (C-4 허용 범위)

Changelog 표에 행 추가: `2026-05-28 | AuthConfig.config 응답 마스킹 정책 신설 — 본 store 와 별 도메인 (모듈 transformer 직접 처리). 정책 SoT: spec/1-data-model.md §2.17.2. 본 convention 변경 없음.`

---

## 8. PROJECT.md §변경 유형 → 갱신 위치 매핑

### 8.1 신규 행 추가

| 변경 유형 | 필수 갱신 위치 | 검증 명령 |
| --- | --- | --- |
| **AuthConfig type enum 변경 (`api_key` / `bearer_token` / `basic_auth` / `hmac`)** | (a) `spec/1-data-model.md` §2.17 + §2.17.1<br>(b) `spec/2-navigation/6-config.md` Part A AUTH_TYPES<br>(c) `codebase/frontend/src/lib/i18n/dict/{ko,en}/authentication.ts` type 라벨 + 폼 helper<br>(d) `codebase/frontend/src/content/docs/06-integrations-and-config/<page>.{mdx,en.mdx}`<br>(e) DB migration (CHECK 제약) | `cd codebase/frontend && npm test -- i18n docs` |

---

## consistency-check 재실행 의무

본 v2 draft 완료 후 `/consistency-check --spec` 재실행 → `BLOCK: NO` 확인 후 spec 7 파일 실제 갱신.

## Side-effect 영향 영역 (경로 정정 — W-2)

- `spec/data-flow/1-audit.md` (← `audit.md` 오기 정정) — audit_log 카테고리에 `auth_config.reveal` 추가. §3.3 에서 1-auth.md §4.1 갱신 시 동시 처리.
- `spec/conventions/spec-impl-evidence.md` — 본 PR 후 `12-webhook.md`·`6-config.md` frontmatter `code:` 글로브 추가 시 `spec-code-paths` 가드 통과 의무.
- `PROJECT.md` 변경 유형 매트릭스 — §8.1 행 추가.
- `plan/in-progress/eia-secret-rotation-revoke-api.md` (I-11) — "inbound rotation 은 본 PR 에서 auth-configs/:id/regenerate 로 흡수됨" 한 줄 추가 권장 (outbound notification rotation 과 별개 확인).
- `plan/in-progress/trigger-drawer-tests.md` (W-10) — 케이스 6번 AuthConfig.type selector 기준 갱신.

## Migration 컨벤션 (W-7 해소)

placeholder `V0NN+1` 표기 제거 — 확정 번호 `V064` / `V065` 사용 (위 §Migration 번호 참고). `spec/conventions/migrations.md §1` alphanumeric suffix 금지 원칙 준수.

## swagger (I-9)

`POST /:id/reveal` 의 `@ApiResponse` + reveal 의 password 검증 실패 401 / 권한 403 데코레이터 명시 (developer Phase 2). `/auth/rotate-secret` 410 행은 endpoint 자체를 제거하므로 swagger 410 follow-up 불요.
