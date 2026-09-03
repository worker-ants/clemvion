# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base `origin/main`)

## 검토 범위 요약

- **spec 델타**: 0개 파일 (`spec/5-system/**` 변경 없음 — 이번 PR 은 코드 전용)
- **코드 diff**: 13개 파일 / 396줄 — 전부 TypeORM 엔티티 `@Column` 타입을 DB 의 `nullable: true` 실제와 정렬하는 작업 (`plan/in-progress/entity-nullable-column-type-mismatch.md` 배치 2). `execution.entity.ts`·`node.entity.ts`·`node-execution.entity.ts`·`notification.entity.ts`·`trigger.entity.ts`·`user.entity.ts`·`workflow.entity.ts`·`knowledge-base.entity.ts`·`schedule.entity.ts` 의 필드를 `T` → `T | null` 로 넓히고, 일부는 `@Column` 에 `type: 'varchar'`/`type: 'int'` 를 명시 추가. 나머지 2파일은 `shared/utils/redact-stored-error.ts`(+spec) 의 시그니처를 그 넓힘에 맞춰 정정, 2파일은 `null as unknown as T` 캐스트 제거(spec fixture).
- 위 diff 는 `spec/conventions/**` 의 명명·API 응답 포맷·문서 구조·API 문서 데코레이터 규약 표면을 **직접 건드리지 않는다** — DTO·컨트롤러·에러 코드·swagger 데코레이터·마이그레이션 파일이 diff 에 없다(엔티티 TS 타입 애노테이션만).
- 검토는 diff 자체 + 번들에 포함된 `spec/5-system/2-api-convention.md`·`1-auth.md`·`3-error-handling.md` 본문을 `spec/conventions/**`(주로 `swagger.md`·`migrations.md`·`raw-query-results.md`·`error-codes.md`) 대조로 수행했다.

---

## 발견사항

- **[INFO] `redact-stored-error.ts` 시그니처 넓힘은 §5.4 "부재 표현" 기본값과 정합**
  - target 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` (diff) — `maskIfPresent`/`redactNodeExecutionRowForResponse`
  - 관련 규약: `spec/5-system/2-api-convention.md §5.4` (부재 표현 — `null` vs 키 생략, 기본값은 `null`)
  - 상세: `NodeExecution.outputData`/`error` 를 `| null` 로 넓히면서 `maskIfPresent` 도 `Record<...> | null` 을 받고 그대로 `null` 을 반환하도록 정정됐다(`value == null ? value : ...`). 이는 §5.4 의 기본 규칙("응답에 상시 존재하는 필드는 `null`, 키 생략 아님")과 일치한다 — 이 필드들은 이미 `null` 로 노출되던 자리이고 이번 diff 는 그 wire 형태를 바꾸지 않는다(내부 타입만 실제와 정렬).
  - 제안: 조치 불요. 참고로 기록.

- **[WARNING] `2-api-convention.md §2.2` 명명 규칙에 `/api/auth/*` 다수 엔드포인트가 명시된 두 예외(RPC-style sub-channel action / `/api/external/*`) 어디에도 포섭되지 않음 — 이번 diff 와 무관한 선재 gap, 이미 추적 중**
  - target 위치: `spec/5-system/2-api-convention.md §2.2 명명 규칙` (표 4번째 행 "예외 — RPC-style sub-channel action") vs `spec/5-system/1-auth.md §5 API 엔드포인트` (`/api/auth/login/totp`, `/api/auth/2fa/setup`, `/api/auth/2fa/webauthn/register/options` 등 15개 이상)
  - 위반 규약: 문서 자기 자신의 명명 규칙(§2.2) — "리소스는 복수형 명사" + 명시된 두 예외만 인정
  - 상세: `/api/auth/{verb}` 형태(`login/totp`, `2fa/setup`, `2fa/webauthn/register/options` 등)는 `{resource}/{id}/{channel}/{action}` RPC 예외(항상 `:id` 포함)에도, `/api/external/{resource}` 예외에도 해당하지 않는다. §2.2 원문 그대로 읽으면 이 다수 엔드포인트가 명명 규칙 위반으로 읽힌다.
  - 이번 diff 와의 관계: **무관**. 이번 PR 은 엔티티 nullable 타입 정렬만 다루고 auth 컨트롤러·라우팅을 건드리지 않았다. 이 gap 은 `plan/in-progress/entity-nullable-column-type-mismatch.md` "할 일" 절에 **이미 개발자가 발견·기록**했고("후속(planner 턴, 이 작업과 무관) — `2-api-convention.md §2.2` 에 `/api/auth/*` 액션 네임스페이스 예외 조항"), 본인 권한(§자기-반증형 소정정 다섯 조건 미충족 — 이 문장은 developer 자신이 쓴 예고가 아니라 제품 계약 규칙)을 넘는다고 스스로 판단해 planner 턴으로 위임한 상태다.
  - 제안: 이 diff 를 막을 사유는 아니다. 이미 tracked 이므로 별도 조치 불요 — 다음 planner 턴에서 `spec/5-system/2-api-convention.md §2.2` 에 `/api/auth/{verb}` 계열을 위한 세 번째 명명 예외(또는 인증 네임스페이스 전용 규칙)를 추가하도록 안내.

- **[INFO] `2-api-convention.md` 에 문서 자체 `## Overview` 섹션 부재 — 같은 번들의 `1-auth.md`/`3-error-handling.md` 와 구조 불일치**
  - target 위치: `spec/5-system/2-api-convention.md` — `# Spec: API 설계 규칙` 직후 바로 `## 1. 기본 원칙` 로 진입(전용 `## Overview` 헤딩 없음)
  - 관련 규약: `.claude/skills/project-planner/SKILL.md` "각 spec 문서는 3섹션 (Overview / 본문 / Rationale)" + "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"
  - 상세: `spec/5-system/` 은 `_product-overview.md` 를 보유한 다중-파일 영역이라 개별 문서가 자체 `## Overview` 를 생략해도 규약상 허용된다(exception 적용). 다만 같은 번들 안에서 `1-auth.md`(`## Overview` 있음, `_product-overview.md` 링크도 병존)·`3-error-handling.md`(`## Overview` 있음)는 둘 다 갖고 있어 `2-api-convention.md` 만 빠진 형태 — 규약 위반은 아니지만 영역 내 구조 일관성이 흔들린다.
  - 제안: 조치 불요(위반 아님). 추후 `2-api-convention.md` 를 만질 일이 생기면 짧은 `## Overview` (예: "REST API 설계·응답·에러·WS 접속의 공통 규칙") 를 얹어 형제 문서와 통일하는 정도의 cosmetic 제안.

- **[INFO] 엔티티 `@Column` 데코레이터에 명시적 `type:` 을 추가하는 새 관례 — `spec/conventions/**` 에 문서화된 규칙은 아직 없음**
  - target 위치: diff 전반(`user.entity.ts` `avatarUrl`/`oauthProvider`/`oauthProviderId`, `trigger.entity.ts` `endpointPath`, `notification.entity.ts` `resourceType`)
  - 관련 규약: 없음(`spec/conventions/migrations.md` 는 V번호·append-only 정책만 다루고 엔티티 컬럼 선언 형식은 범위 밖)
  - 상세: `plan/in-progress/entity-nullable-column-type-mismatch.md` 가 "타입을 `| null` 로 넓히면 TypeORM 의 `design:type` 이 `Object` 로 방출돼 부팅이 깨진다(e2e 만 검출) → 같은 `@Column` 에 `type:` 명시 필수" 라는, 코드베이스 전역에 적용될 실질 규칙을 실측으로 확립했다. 이는 `spec/conventions/raw-query-results.md` 가 성문화됐던 것과 같은 패턴("같은 지식을 반복 재발견")이 될 소지가 있다.
  - 제안: 정식 규약 위반은 아니므로 이번 diff 를 막을 사유는 아니다. 다만 이 규칙이 향후 다른 PR 에서도 반복 재발견될 위험이 있다면(현재는 배치 3 이 예정돼 있어 그 시점에 규약화 여부를 재판단할 수 있음), planner 가 `spec/conventions/` 에 짧은 엔티티-컬럼 규약(예: `entity-nullable-columns.md` 또는 기존 문서 확장)을 신설할지 검토할 후보로 남긴다 — 이번 검토에서 강제하지는 않는다.

---

## 요약

이번 diff(엔티티 nullable 배치 2, 13파일/396줄)는 TypeORM 엔티티의 TS 타입을 DB 의 실제 `nullable: true` 와 맞추는 내부 타입-안전성 정정이며, `spec/conventions/**` 가 규정하는 명명·API 응답 포맷·API 문서(swagger)·마이그레이션·raw-query 규약의 표면을 직접 건드리지 않는다 — DTO·컨트롤러·에러코드·swagger 데코레이터·마이그레이션 파일이 diff 에 없다. `redact-stored-error.ts` 의 시그니처 확장은 §5.4 "부재 표현" 기본값(`null`, 키 유지)과 그대로 정합한다. 번들에 포함된 `spec/5-system/2-api-convention.md §2.2` 자체의 명명 규칙과 `1-auth.md §5` 의 실제 `/api/auth/*` 엔드포인트 목록 사이에 선재 gap(RPC-style/external 두 예외 어디에도 안 걸리는 액션 네임스페이스 15+ 건)이 있으나, 이는 이번 diff 가 만든 것이 아니고 개발자가 이미 `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 planner 턴 필요 항목으로 정확히 기록해 두었다. 나머지는 문서 구조(Overview 섹션 유무)·엔티티 컬럼 선언 스타일에 대한 cosmetic/INFO 수준 관찰이다. 이번 PR 을 이 관점에서 막을 CRITICAL·WARNING 성격의 새 위반은 없다.

## 위험도

LOW
