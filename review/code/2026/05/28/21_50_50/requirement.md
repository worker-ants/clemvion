# 요구사항(Requirement) 리뷰 결과

리뷰 대상: auth-config-webhook-wiring 브랜치의 spec 변경 4개 파일
- `spec/5-system/1-auth.md`
- `spec/5-system/12-webhook.md`
- `spec/conventions/secret-store.md`
- `spec/data-flow/10-triggers.md`

참조 구현 파일:
- `/codebase/backend/src/modules/auth-configs/auth-configs.controller.ts`
- `/codebase/backend/src/modules/auth-configs/auth-configs.service.ts`
- `/codebase/backend/src/modules/auth-configs/entities/auth-config.entity.ts`
- `/codebase/backend/src/modules/hooks/hooks.service.ts`

---

## 발견사항

### [CRITICAL] Auth Config CRUD 권한 — Spec vs 코드 불일치

- **위치**: `/codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` lines 86, 105, 200
- **상세**:
  Spec `spec/5-system/1-auth.md §3.2` 권한 매트릭스는 `Auth Config` 리소스에 대해:
  - Owner = CRUD, Admin = CRUD, **Editor = R, Viewer = R**

  그러나 코드의 RBAC 데코레이터는:
  - `POST /auth-configs` (create) → `@Roles('editor')` — Editor가 생성 가능 (spec 위반)
  - `PATCH /auth-configs/:id` (update) → `@Roles('editor')` — Editor가 수정 가능 (spec 위반)
  - `DELETE /auth-configs/:id` (delete) → `@Roles('editor')` — Editor가 삭제 가능 (spec 위반)
  - `POST /auth-configs/:id/regenerate` → `@Roles('admin')` — 올바름
  - `POST /auth-configs/:id/reveal` → `@Roles('admin')` — 올바름

  Spec이 "Auth Config = Owner/Admin CRUD, Editor/Viewer R-only" 로 명시하고 있으므로, create/update/delete는 `@Roles('admin')` 이어야 한다. 현재 Editor 역할이 자격증명을 생성·수정·삭제할 수 있어 spec이 해결하려는 RBAC 회피 문제(webhook.md Rationale §5 — "inline path 는 trigger CRUD 권한(editor+)으로 자격증명까지 수정 가능")가 AuthConfig 도메인에서도 그대로 재현된다.

- **제안**: `create`, `update`, `remove` 핸들러의 데코레이터를 `@Roles('admin')`으로 변경.

---

### [CRITICAL] chatChannel 트리거 + isActive=false 처리 순서 불일치 — Spec §7 step 5 위반

- **위치**: `/codebase/backend/src/modules/hooks/hooks.service.ts` lines 89-108
- **상세**:
  Spec `spec/5-system/12-webhook.md §7` step 5는 다음을 명시한다:
  > "Trigger.isActive === false → `config.chatChannel` 가 있으면 step 6 (인증) → step 7c 의 silent skip 분기로 진입 ... `config.chatChannel` 가 없으면 → 410 Gone 즉시 반환"

  즉, chatChannel이 있는 트리거가 비활성화된 경우: **인증(step 6)을 수행한 후** 202 + `{ ignored: true }`를 반환해야 한다. 이는 spec이 명시한 보안 근거(auth 실패 요청에 silent 202를 주면 공격자가 trigger 활성 여부를 추론 가능)에 따른 것이다.

  그러나 코드는:
  ```
  line 89-94: if (!trigger.isActive) → GoneException (410) 즉시 throw
  line 100-108: chatChannelCfg 확인 (isActive 체크 이후)
  ```
  isActive 체크가 chatChannel 분기보다 먼저 실행되므로, chatChannel 트리거가 비활성화된 경우 항상 410 Gone을 반환하고 인증 + 202 ignored 경로에 도달하지 않는다.

- **제안**: chatChannel 여부를 먼저 확인해 두 경로를 분기한 뒤, chatChannel 경로에서 isActive 상태를 `handleChatChannelWebhook` 내부로 전달하거나, isActive 체크 이전에 chatChannel 분기를 먼저 실행한다.

---

### [CRITICAL] bearer_token 자동 발급 강제 미구현 — Spec §2.17.3(consistency W-2) 위반

- **위치**: `/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` line 107
- **상세**:
  Spec `spec/1-data-model.md §2.17.3`은 명시한다:
  > "bearer_token 자동 발급 강제 (2026-05-28, consistency W-2): 기존 '자동 생성 또는 사용자 입력' 중 사용자 입력 옵션을 제거하고 자동 발급(`wft_<hex32>`)만 허용."

  코드:
  ```typescript
  if (data.type === 'bearer_token' && !config.token) {
    config.token = `wft_${randomBytes(32).toString('hex')}`;
  }
  ```
  `&& !config.token` 조건이 있어, `CreateAuthConfigDto`의 `config.token`에 임의 값을 주입하면 사용자 지정 토큰이 그대로 저장된다. `CreateAuthConfigDto.config`는 `IsObject()`로만 검증되어 `config.token` 필드를 거부하지 않는다.

  Spec이 명시한 "사용자 입력 옵션 제거"가 구현되지 않았다.

- **제안**: `bearer_token` 타입 생성 시 `config.token`을 사용자 입력 여부와 무관하게 항상 자동 발급으로 덮어쓴다. `if` 조건에서 `!config.token` 부분을 제거: `config.token = 'wft_...'`

---

### [WARNING] 감사 로그(Audit Log) — create/update/delete/regenerate 미기록

- **위치**: `/codebase/backend/src/modules/auth-configs/auth-configs.service.ts`
- **상세**:
  Spec `spec/5-system/1-auth.md §4.1`은 설정 카테고리에 다음 액션을 명시:
  > `auth_config.create, auth_config.update, auth_config.delete, auth_config.regenerate, auth_config.reveal`

  코드에서 `auditLogsService.record()`가 호출되는 것은 `reveal` 뿐이다. `create`, `update`, `remove`, `regenerate` 메서드에는 audit 로그 기록이 없다.

  특히 `regenerate`는 자격증명을 교체해 외부 호출자를 즉시 차단하는 고위험 동작이므로 audit 기록이 중요하다.

- **제안**: `create`, `update`, `remove`, `regenerate` 메서드에도 `auditLogsService.record()`를 추가.

---

### [WARNING] ip_whitelist 설정 시 클라이언트 IP 미확인 → 화이트리스트 우회 가능

- **위치**: `/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` line 218
- **상세**:
  코드:
  ```typescript
  if (ac.ipWhitelist?.length && ctx.clientIp) {
    if (!ac.ipWhitelist.includes(ctx.clientIp)) { throw this.authFailed(); }
  }
  ```
  `ctx.clientIp`가 `undefined`이면(CF-Connecting-IP도, X-Forwarded-For도 없는 경우) ip_whitelist 검증이 통째로 스킵된다.

  Spec `WH-SC-09`는 "ip_whitelist 가 설정된 경우 클라이언트 IP allowlist 시행 (불일치 시 401)"으로 명시하며, IP를 알 수 없을 때의 fallback 동작을 명시하지 않는다.

  역방향 프록시 없이 직접 연결되는 경우 또는 헤더가 strip된 환경에서 ip_whitelist가 있어도 임의 IP가 통과할 수 있다.

- **제안**: spec이 침묵하는 회색지대이나, 보안 원칙상 "IP를 알 수 없을 때 ip_whitelist가 설정돼 있으면 거부"가 더 안전하다. spec에 명시 추가를 `project-planner`에 위임하거나, 코드를 방어적으로 수정하는 것을 검토.

---

### [WARNING] 권한 매트릭스 추가(Spec 파일 1) — `@Get()` 목록 조회 Roles 데코레이터 없음

- **위치**: `/codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` lines 51-66
- **상세**:
  Spec `§3.2`에서 Auth Config 읽기(R)는 Editor와 Viewer 모두 가능하다. `@Get()` 목록 조회와 `@Get(':id')` 단건 조회에는 `@Roles()` 데코레이터가 없다. `RolesGuard` 구현상 `@Roles()` 없으면 자동 통과이므로 워크스페이스 멤버가 아닌 사람도 통과할 가능성이 있다(단, JWT guard가 먼저 동작하므로 비인증자는 차단됨). 워크스페이스 멤버이기만 하면 역할 무관하게 조회 가능한 것은 spec의 "Viewer = R" 정책과는 부합한다. 현재 동작은 spec 의도와 일치하나, 워크스페이스 소속 확인 없이 통과할 수 있는지 `RolesGuard` 로직을 재확인 필요.

- **제안**: `@Roles()` 데코레이터 없이 `JwtAuthGuard`만 걸린 라우트가 타 워크스페이스 리소스에 접근 가능한지 확인. 문제가 없으면 INFO 수준.

---

### [INFO] Spec-only 파일에 code 배열 비어 있음 — 구현 연결 추적 불가

- **위치**: `spec/5-system/1-auth.md`, `spec/5-system/12-webhook.md` frontmatter `code: []`
- **상세**: 두 spec 파일 모두 `status: spec-only`, `code: []`로 표기되어 있다. 그러나 실제로는 `auth-configs` 모듈과 `hooks` 모듈이 구현되어 있다. spec-impl coverage 추적이 단절된다.
- **제안**: `code` 배열에 구현 파일 경로를 추가하거나, 이것이 의도된 운영 방식인지 확인.

---

### [INFO] Webhook spec 처리 흐름(§7) — triggerRepository 조회 시 `is_active` 필터 미적용

- **위치**: `/codebase/backend/src/modules/hooks/hooks.service.ts` line 77-85
- **상세**:
  ```typescript
  const trigger = await this.triggerRepository.findOne({
    where: { endpointPath, type: 'webhook' },
  });
  ```
  data-flow spec `§1.2`의 시퀀스 다이어그램:
  ```
  Hk->>PG: SELECT trigger WHERE endpoint_path=:path AND type='webhook' AND is_active
  ```
  코드는 `is_active` 필터 없이 조회한 후 `trigger.isActive` 를 별도로 체크한다. 동작은 동등하지만, 비활성 트리거를 DB에서 먼저 가져오는 extra DB round-trip이 발생한다. 기능 correctness 문제는 없다.
- **제안**: INFO 수준. 성능 민감 경로라면 `where: { endpointPath, type: 'webhook', isActive: true }`로 단일 쿼리 최적화 가능하나, isActive=false의 404와 410 구분을 위해 현재 방식도 유효하다.

---

### [INFO] Spec 신규 행 추가 — `Auth Config Reveal` 권한 매트릭스 일관성

- **위치**: `spec/5-system/1-auth.md` diff 행 36
- **상세**: `Auth Config Reveal` 행이 Owner=✅, Admin=✅, Editor=—, Viewer=— 로 추가됐다. 위의 CRITICAL 이슈(create/update/delete가 `@Roles('editor')`인 문제)가 수정되지 않으면 Reveal 권한 제한의 의의가 퇴색된다 — Editor가 자격증명을 삭제하고 재생성한 뒤 create 응답에서 평문을 볼 수 있기 때문. 이 취약점은 CRITICAL #1의 수정으로 해소된다.

---

## 요약

본 변경의 spec 문서 4개(1-auth.md, 12-webhook.md, secret-store.md, 10-triggers.md)는 Auth Config를 webhook 인증의 단일 진입으로 격상하는 내용을 일관되게 기술하고 있으며, 데이터 모델·처리 흐름·보안 정책·Rationale이 전반적으로 잘 정비되어 있다. 그러나 대응 구현 코드(`auth-configs.controller.ts`, `auth-configs.service.ts`, `hooks.service.ts`)에서 3건의 CRITICAL 이슈가 확인되었다: (1) Auth Config CRUD 권한이 spec 매트릭스(Admin+ 전용)와 달리 Editor에게도 부여되어 spec이 해결하려는 RBAC 회피 문제가 AuthConfig 도메인에서 재현됨, (2) chatChannel 트리거가 isActive=false일 때 spec §7의 "인증 수행 후 202 ignored" 흐름 대신 isActive 체크가 먼저 실행되어 410 Gone을 반환함, (3) bearer_token 생성 시 사용자 제공 token을 거부하지 않아 spec §2.17.3의 강제 자동 발급 정책이 우회됨. 이 세 이슈는 보안 설계 의도를 직접적으로 훼손하므로 배포 전 수정이 필요하다.

## 위험도

HIGH
