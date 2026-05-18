# 정식 규약 준수 검토 — convention_compliance

검토 대상: `plan/in-progress/2fa-webauthn.md`
검토 모드: spec draft 검토 (--spec)
검토 기준: `spec/conventions/` 정식 규약 + `CLAUDE.md` 명명·구조 컨벤션

---

### 발견사항

- **[INFO]** plan 문서 자체는 정식 규약 준수 의무 대상이 아님 — 그러나 참조된 구현 산출물에 규약 언급이 있어 일관성 확인 필요
  - target 위치: 전체 문서
  - 위반 규약: 해당 없음 (이하 세부 항목 참고)
  - 상세: `plan/in-progress/` 문서는 spec 이 아니라 작업 추적 문서이므로 `spec/conventions/` 의 DTO·API·Output 포맷 규약이 직접 적용되지 않는다. 단, 본 plan 이 지시하는 구현 내용이 규약과 정합하는지를 아래에서 점검한다.
  - 제안: 해당 없음

- **[INFO]** frontmatter 구조 — CLAUDE.md 준수
  - target 위치: 라인 1–5 (frontmatter)
  - 위반 규약: `CLAUDE.md §PLAN 문서 라이프사이클` — `worktree`, `started`, `owner` 3 필드
  - 상세: `worktree: 2fa-webauthn-impl`, `started: 2026-05-18`, `owner: developer` 모두 존재하고 규약과 일치한다.
  - 제안: 적합

- **[INFO]** plan 파일 위치 — CLAUDE.md 준수
  - target 위치: 파일 경로 `plan/in-progress/2fa-webauthn.md`
  - 위반 규약: `CLAUDE.md §명명 컨벤션` — `plan/in-progress/<name>.md` 평문 명명
  - 상세: 규약에서 요구하는 `plan/in-progress/<name>.md` 형식이며, 숫자 prefix 없는 평문 파일명이다. 적합.
  - 제안: 해당 없음

- **[WARNING]** Swagger 규약 참조가 불완전 — `ApiOkWrappedResponse` 언급만 있고 응답 DTO 위치 언급 없음
  - target 위치: §4 백엔드 구현 항목 `auth.controller.ts` 에 endpoints 추가 (`모두 Swagger annotation...`)
  - 위반 규약: `spec/conventions/swagger.md §5-1` — 응답 DTO 는 `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts` 에 위치해야 하며, `§5-4 새 엔드포인트 체크리스트` 4개 항목을 모두 이행해야 함
  - 상세: plan 의 §4 에서 `ApiOkWrappedResponse` 사용 언급은 있으나, WebAuthn 전용 응답 DTO 파일(`dto/responses/webauthn-response.dto.ts` 등)을 `dto/responses/` 하위에 별도 생성해야 한다는 점이 plan 체크리스트에 명시되어 있지 않다. `codebase/backend/src/modules/auth/dto/webauthn.dto.ts` 는 request DTO 만 언급되어 있고 response DTO 위치가 누락이다. 또한 `§5-4` 체크리스트의 "UUID 파라미터는 `@ApiParam({ format: 'uuid' })` 일관 적용" 항목도 `:id` PATCH/DELETE 엔드포인트에 적용 여부가 명시되지 않았다.
  - 제안: §4 체크리스트에 다음 두 항목 추가 권장: (1) `codebase/backend/src/modules/auth/dto/responses/webauthn-response.dto.ts` 신설 — credential 목록·등록 결과·복구 코드 응답을 response DTO 클래스로 분리 (엔티티 직접 노출 금지); (2) `/credentials/:id` 의 `:id` 파라미터에 `@ApiParam({ name: 'id', format: 'uuid' })` 명시.

- **[WARNING]** 마이그레이션 명명 — `V057`/`V058` 번호 점유 시점 확인 절차가 plan 내 주의 문구로만 처리되어 있고 정식 절차 참조 없음
  - target 위치: §3 데이터 모델 / 마이그레이션 첫 번째 ⚠️ 문구
  - 위반 규약: `spec/conventions/migrations.md §5 새 마이그레이션 추가 절차` — `git fetch origin main && git rebase origin/main` → max(V) 확인 → `python3 scripts/check-migration-versions.py --base origin/main` → `make e2e-test` dry-run 순서
  - 상세: plan 은 `ls ... | tail -1` 로 V057 비어있는지 확인하라고만 안내한다. 정식 규약 §5 는 "git fetch + rebase → max(V) 확인 → 가드 스크립트 실행 → e2e dry-run → PR 후 recheck" 순서를 요구한다. plan 에는 가드 스크립트(`python3 scripts/check-migration-versions.py`) 실행과 `make e2e-test` dry-run 단계가 누락되어 있다.
  - 제안: §3 ⚠️ 문구를 다음으로 보강: "착수 직전 `git fetch origin main && git rebase origin/main` 후 `python3 scripts/check-migration-versions.py --base origin/main` 실행하여 V번호 충돌 없음 확인 → `make e2e-test` dry-run으로 마이그레이션 apply 검증 (`spec/conventions/migrations.md §5`)."

- **[INFO]** `.conf` 파일 미언급 — V057·V058 트랜잭션 모드 명시는 적합
  - target 위치: §3 V057·V058 마이그레이션 항목
  - 위반 규약: `spec/conventions/migrations.md §1 명명 규약` — `.conf` 파일은 `executeInTransaction=false` 가 필요한 경우만 동일 base name 으로 생성
  - 상세: plan 에 "단일 트랜잭션 (CONCURRENTLY 없음) → `.conf` 불필요"라고 명시되어 있다. 규약과 일치한다.
  - 제안: 적합

- **[INFO]** 마이그레이션 명명 패턴 — snake_case 준수
  - target 위치: §3 `V057__webauthn_credentials_and_recovery.sql`, `V058__login_history_webauthn_failed_event.sql`
  - 위반 규약: `spec/conventions/migrations.md §1` — `V<번호>__<snake_case_descriptor>.sql`
  - 상세: 두 파일 모두 `V<N>__<snake_case>` 형식이고 영문 소문자·숫자·`_` 만 사용한다. 적합.
  - 제안: 해당 없음

- **[WARNING]** WebAuthn 엔드포인트 경로 슬래시 표기 불일치 — `/recovery` 경로가 conventions API 표 형식과 다름
  - target 위치: §4 `auth.controller.ts` endpoints 항목 — `/api/auth/2fa/webauthn/authenticate/options` · `/verify` · `/recovery`
  - 위반 규약: `spec/conventions/swagger.md §2-2 엔드포인트 데코레이터` 및 `spec/5-system/1-auth.md §5 API 표` (plan 에서 참조)
  - 상세: plan 은 엔드포인트 경로를 불완전한 형태(` · `/recovery`)로 열거해 경로 계층 구조가 불분명하다. spec `1-auth.md §5` 에 canonical 경로가 정의되어 있으므로 plan 에서는 "spec §5 와 1:1 대응" 언급 자체는 올바르나, plan 내 약식 경로 표기가 `/api/auth/2fa/webauthn/authenticate/recovery` 인지 `/api/auth/2fa/webauthn/recovery` 인지 모호하다. 이는 plan 문서의 정보 정확성 문제이며, 구현 시 spec §5 canonical 을 따르면 위반은 아니다.
  - 제안: plan §4 엔드포인트 목록을 spec `1-auth.md §5` 경로 그대로 인용하거나, "spec 5-system/1-auth.md §5 참조" 한 줄로 위임하고 약식 표기를 제거.

- **[INFO]** `ApiOkWrappedResponse` 헬퍼 import 경로 — 규약 정합
  - target 위치: §4 Swagger annotation 언급
  - 위반 규약: `spec/conventions/swagger.md §5-2` — import `from '../../common/swagger'`
  - 상세: plan 에서 `ApiOkWrappedResponse` 를 언급하지만 import 경로는 구현 시 결정 사항이다. 규약상 `codebase/backend/src/common/swagger/` 의 헬퍼를 사용하면 된다. plan 수준에서는 위반 없음.
  - 제안: 해당 없음 (구현 시 `spec/conventions/swagger.md §5-2` 준수 필요)

- **[INFO]** 문서 구조 — plan 문서는 Overview/본문/Rationale 3섹션 불필요
  - target 위치: 전체 문서 구조
  - 위반 규약: `CLAUDE.md §프로젝트 스펙 문서` — 권장 3섹션은 `spec/` 문서에만 적용
  - 상세: `plan/` 문서는 작업 추적 목적이므로 3섹션 권장이 적용되지 않는다. 현재 구조(배경/관련 문서/작업 단위/수용 기준/의존성·리스크)는 plan 용도에 적합하다.
  - 제안: 해당 없음

---

### 요약

`plan/in-progress/2fa-webauthn.md` 는 `CLAUDE.md` 가 요구하는 plan 문서 형식(frontmatter 3 필드, 파일 위치, 평문 명명)을 모두 준수하고 있다. `spec/conventions/` 정식 규약과의 관계에서는 두 가지 WARNING 이 발견되었다. 첫째, Swagger 규약(`swagger.md §5-1, §5-4`)이 요구하는 응답 DTO 파일 위치(`dto/responses/`) 생성 및 UUID 파라미터 `@ApiParam` 적용이 plan 체크리스트에 누락되어 있어, 구현 착수 시 해당 항목이 빠질 위험이 있다. 둘째, 마이그레이션 착수 절차가 `migrations.md §5` 의 전체 단계(가드 스크립트 + e2e dry-run)를 커버하지 않고 번호 확인 단계만 언급한다. 두 WARNING 은 plan 문서를 보강하거나 체크리스트를 추가하면 해소된다. CRITICAL 위반은 없다.

### 위험도

LOW
