# 정식 규약 준수 분석 — plan/in-progress/2fa-webauthn.md

검토 모드: spec draft 검토 (--spec)  
검토 대상: `plan/in-progress/2fa-webauthn.md` (worktree 버전: `.claude/worktrees/2fa-webauthn-impl/plan/in-progress/2fa-webauthn.md`)  
검토 기준: `spec/conventions/migrations.md`, `spec/conventions/swagger.md`, `CLAUDE.md` 명명 컨벤션

---

## 발견사항

- **[WARNING]** 마이그레이션 번호 `V057` 선점 — 두 파일을 단일 번호로 처리
  - target 위치: §2 데이터 모델 / 마이그레이션, 4번째 항목 — `V057__webauthn_credentials_and_recovery.sql`
  - 위반 규약: `spec/conventions/migrations.md §2` — "두 개를 추가하면 +1, +2 가 되어야 한다" / `§5 새 마이그레이션 추가 절차` — 실제 max(V) 확인 후 순서대로 번호 부여
  - 상세: 현재 main 의 최대 마이그레이션 번호는 `V056__notification_active_partial_index.sql`. 따라서 다음 번호는 `V057` 이 맞다. 그런데 이 plan 은 `webauthn_credential` 테이블 신설 + `user.webauthn_recovery_codes` 컬럼 추가 + CHECK 제약 갱신(`AuditLog` event enum, §3 `V058` 로 언급) 총 2개의 논리적 변경을 하나의 `V057` 에 묶고 있다. 동시에 §3 코드 항목에 "V058 로 갱신"이라는 별도 언급이 있어 실제 구현 시 V057·V058 두 파일이 필요함을 암시한다. plan 문서가 이 분리를 명확히 하지 않은 채 V057 한 번호만 작성 절에 표기하면, 구현자가 번호 갱신 없이 두 파일을 V057 하나로 합치거나 V058 선점을 누락할 수 있다.
  - 제안: §2 의 마이그레이션 항목을 두 줄로 분리. `V057__webauthn_credentials_and_recovery.sql` (테이블 + 컬럼) 과 `V058__login_history_webauthn_failed_event.sql` (CHECK 제약 갱신) 로 나누어 번호 범위를 명시한다. 구현 착수 전 `git fetch origin main && ls codebase/backend/migrations | tail -2` 로 실제 max(V) 를 재확인하는 절차(`migrations.md §5` step 1~2) 를 plan 에 체크박스로 추가하면 race 방지에 효과적이다.

- **[WARNING]** `PATCH /api/auth/2fa/webauthn/credentials/:id` — HTTP 메서드 선택 근거 불명확
  - target 위치: §3 백엔드 구현, credential 관리 항목 — `PATCH /api/auth/2fa/webauthn/credentials/:id`
  - 위반 규약: `spec/conventions/swagger.md §2-4 상태 코드 응답 규칙` — 수정은 `@ApiOkResponse` (200 OK). PATCH 는 부분 수정이라 200 반환이 자연스럽지만, 기존 TOTP 관련 엔드포인트(`POST /api/auth/2fa/setup`, `POST /api/auth/2fa/verify`)가 모두 POST 를 사용하고 있으며 spec `1-auth.md §5 API 표` 에 PATCH 패턴이 없다.
  - 상세: 위반이라기보다 기존 인증 모듈의 REST 스타일 일관성 점검이 필요하다. `auth.controller.ts` 에는 현재 POST 와 GET 만 사용되며 PATCH 패턴이 없다. `device_name` 단일 필드 수정에 PATCH 를 쓰는 것은 REST 관례상 타당하나, 기존 코드베이스 스타일과 차이가 생긴다.
  - 제안: spec `1-auth.md §5` 에 webauthn 엔드포인트를 추가할 때 PATCH 선택 이유를 Rationale 로 명시하거나, 팀 내 REST 규약을 `spec/conventions/` 에 별도 문서로 정의하는 것을 검토한다. 현재는 INFO 경계이지만, `swagger.md §2-4` 의 상태 코드 표가 PATCH 를 명시하지 않아 구현자가 200 vs 204 를 혼동할 소지가 있으므로 WARNING 으로 분류한다.

- **[WARNING]** 기존 `/auth/login` 응답 구조 변경 — `requiresTotp` 필드 하위 호환 정책이 plan 에만 기술, spec 반영 없음
  - target 위치: §3 백엔드 구현 — "기존 `/auth/login` 응답을 확장: `{ requiresTotp }` 대신 `{ requires2fa: true, methods: [...], challengeToken }` 로 진화"
  - 위반 규약: `CLAUDE.md §정보 저장 위치` — "기술 명세(스펙)는 `spec/<영역>/*.md` 본문", "제품 정의·요구사항은 `spec/<영역>/_product-overview.md`". plan 문서는 작업 추적 전용이며 API 응답 형식의 정식 정의 위치가 아니다.
  - 상세: `/api/auth/login` 응답 포맷은 `spec/5-system/1-auth.md §5 API 표` 의 관할 사항이다. 해당 spec 파일에는 현재 `requiresTotp` 기반 응답이 정의되어 있다(혹은 암묵적으로 코드베이스에서 사용 중). plan 에서만 `{ requires2fa, methods, challengeToken }` 로 바꾼다는 설계를 기술하고 spec 갱신 체크박스(`§5`)에 나중에 반영하겠다고 미루면, 현재 시점에 spec 과 plan 의 API 포맷이 불일치 상태가 된다.
  - 제안: §7 REVIEW 단계(`consistency-check --spec`) 이전에 spec `1-auth.md` 의 로그인 응답 포맷을 먼저 갱신하거나, plan §5 의 spec 갱신 체크박스를 §3 구현 착수보다 선행하도록 순서를 재배치한다. 하위 호환(`requiresTotp` 병렬 제공) 기간과 제거 시점도 spec Rationale 에 기재해야 한다.

- **[INFO]** plan 문서에 `data-flow/2-auth.md` 참조 추가 — 기존 main 브랜치 파일과의 차이
  - target 위치: § 관련 문서 항목 — `spec/data-flow/2-auth.md (인증 데이터 흐름)`
  - 위반 규약: 직접적인 규약 위반은 아니나 `CLAUDE.md §명명 컨벤션` — `spec/<영역>/N-name.md` (숫자 prefix)
  - 상세: main 브랜치의 원본 plan 파일에는 `spec/data-flow/2-auth.md` 참조가 없었다. 이 파일이 실제로 존재하는지 확인 필요. `data-flow/` 가 `0-` prefix 영역 인덱스 없이 번호만 가진 구조인지 불확실하다.
  - 제안: 구현 전에 `ls spec/data-flow/` 로 파일 존재 확인 후 참조를 유지하거나 제거한다. 필요시 신설 대상을 §5 체크박스에 명시한다.

- **[INFO]** Swagger 응답 DTO 체크리스트가 plan 에 미포함
  - target 위치: §3 백엔드 구현 전반 (등록/인증/관리 endpoints)
  - 위반 규약: `spec/conventions/swagger.md §5-4 새 엔드포인트 체크리스트` — 응답 DTO 가 `dto/responses/` 에 있는지, `ApiOkWrappedResponse` / `ApiCreatedWrappedResponse` 사용 여부 등
  - 상세: plan 의 §3 은 엔드포인트 목록을 나열하지만 각 엔드포인트의 응답 DTO 위치(`dto/responses/*-response.dto.ts`)나 래퍼 헬퍼 사용 의도를 명시하지 않았다. swagger.md §5 에서 필수 체크리스트를 요구하므로, plan 단계에서 이를 인식하는 것이 구현 품질에 유리하다.
  - 제안: §3 또는 §7 REVIEW 체크리스트에 swagger.md §5-4 체크리스트 항목(응답 DTO 위치, 래퍼 헬퍼 사용, `@ApiParam({ format: 'uuid' })` 등)을 추가한다.

---

## 요약

`plan/in-progress/2fa-webauthn.md`(worktree 버전)는 CLAUDE.md 가 요구하는 frontmatter(`worktree`, `started`, `owner`)를 정상 포함하고 있으며, 마이그레이션 번호(`V057`)도 현재 max(V056) 기준으로 올바르게 선점되어 있다. API 엔드포인트 경로 접두사(`/api/auth/...`)는 `main.ts`의 global prefix(`api`) + 컨트롤러 prefix(`auth`) 와 일치한다. 단, 두 건의 WARNING이 주의를 요한다: (1) 단일 마이그레이션 번호 `V057` 안에 논리적으로 분리 가능한 두 DDL 변경이 뒤섞여 있고 `V058` 선점 누락 위험이 있으며, (2) `/api/auth/login` 응답 포맷 변경(`requiresTotp` → `requires2fa/methods`)이 spec 갱신보다 구현이 선행될 수 있는 순서 문제가 있다. 이 두 항목은 `migrations.md`와 CLAUDE.md의 단일 진실 원칙을 각각 위협하므로 구현 착수 전 plan 수정이 권장된다.

---

## 위험도

**LOW**

(CRITICAL 없음. WARNING 2건은 구현 시 혼동을 유발할 수 있으나, 파국적 invariant 파괴보다는 구현 오류 가능성 수준임. INFO 2건은 품질 개선 제안.)
