# 정식 규약 준수 검토 — avatar-upload-public-url (impl-done, scope: spec/5-system/)

대상: `spec/5-system/2-api-convention.md` §9(파일 업로드)·§7(Rate Limiting), `spec/5-system/3-error-handling.md` §1.3(신규 에러 코드)와 이를 뒷받침하는 구현 diff(`codebase/backend/src/modules/users/**`, `common/services/s3.service.ts`, `common/config/s3.config.ts`, `main.ts`, `.env.example`).

## 발견사항

- **[WARNING]** 신규/수정 엔드포인트 2건이 `@ApiOperation.description` "강제" 상한(150자)을 초과 — 이 PR 이 직접 유발
  - target 위치:
    - `codebase/backend/src/modules/users/users.controller.ts` `uploadAvatar()` (`POST /api/users/me/avatar`, 신규) — `@ApiOperation.description` **170자**
    - 같은 파일 `updateMe()` (`PATCH /api/users/me`, 기존) — 이 PR 이 description 을 **107자 → 202자**로 늘림 (기존은 강제 범위 내였고, 이 PR 로 인해 범위를 벗어남)
  - 위반 규약: `spec/conventions/swagger.md` §3 "길이 — 강제되는 것과 지향하는 것을 가른다" 표 — `엔드포인트 description: 50~150자, **강제**` (DTO `description` 만 2026-08-23 개정으로 "지향"이 됨. 엔드포인트 `summary`/`description` 은 그대로 강제로 남음)
  - 상세: 실측(문자열 리터럴을 이어붙여 카운트, 마크다운 강조 기호 포함) — `uploadAvatar` 170자, `updateMe` 202자. swagger.md 는 "보안·정책 캐비엇"(응답 값이 저장된 값과 다를 수 있는 필드 / 요청 값이 정책으로 거부될 수 있는 필드)에 한해 길이 강제를 면제하지만, 그 캐비엇은 **DTO `description`에만** 적용된다고 명시돼 있다 ("DTO 길이가 강제가 아니게 된 이상 '예외'라는 틀은 성립하지 않는다" — DTO 표 행을 전제로 한 문장). 엔드포인트 `description` 행은 여전히 강제이며 이 캐비엇의 적용 대상으로 언급되지 않는다. 이번 PR 은 정확히 "공개 오브젝트·아바타 교체 시 정리" 같은 보안/정책 캐비엇 문구를 두 엔드포인트 `description` 에 이어붙이면서 강제 상한을 넘겼다.
  - 제안: 캐비엇 본문을 엔드포인트 description 이 아니라 `UserProfileDto.avatarUrl` 필드의 `@ApiPropertyOptional({ description: ... })`(swagger.md §1-5·"보안·정책 캐비엇" 규약이 정확히 이 위치를 겨냥함)로 옮기고, 엔드포인트 description 은 1~2문장(50~150자)으로 축약해 SoT 링크만 남긴다. 대안으로, 만약 엔드포인트 description 에도 같은 보안 캐비엇 예외가 필요하다고 판단되면 swagger.md §3 규약 자체를 갱신해 예외 범위를 명시적으로 확장해야 한다(현재는 어느 쪽도 아니어서 규약과 실측이 어긋난 상태).

- **[INFO]** 위 캐비엇이 있어야 할 자리(`UserProfileDto.avatarUrl` 필드)에는 JSDoc/description 이 전혀 없음
  - target 위치: `codebase/backend/src/modules/users/dto/responses/user-response.dto.ts` — `avatarUrl?: string | null;` 위에 `@ApiPropertyOptional({ nullable: true })` 만 있고 JSDoc·`description` 없음 (이 파일은 이번 diff에 포함되지 않은 기존 파일이라 "이 PR 이 새로 위반"은 아님)
  - 위반 규약: `spec/conventions/swagger.md` §1-1 "모든 필드에 JSDoc 추가" 및 "반드시 적는다 — 보안·정책 캐비엇" 절
  - 상세: 이 PR 로 `avatarUrl` 의 의미가 "임의 외부 URL"에서 "URL 을 아는 누구나 접근 가능한 공개 업로드 오브젝트(UUID 로만 보호)"로 실질적으로 확장됐다. swagger.md 의 보안·정책 캐비엇 규약이 정확히 이런 경우("응답 값이 저장된 값과 다를 수 있거나, 소비자가 설명 없이는 못 알아내는 의미")를 위해 DTO description 길이 상한을 풀어준 것인데, 정작 그 필드에는 아무 설명도 없고 캐비엇은 대신 엔드포인트 description(강제 상한이 있는 자리)에 쌓였다.
  - 제안: 위 WARNING 항목의 제안과 동일 — `avatarUrl` 필드에 "공개 URL(추측 불가능 UUID 로 접근 통제) — PATCH/업로드로 바뀌면 이전 오브젝트는 정리됨" 요지의 description 을 추가.

- **[INFO]** Rate Limiting §7 표에 아바타 업로드 엔드포인트가 별도 행으로 등재되지 않음
  - target 위치: `spec/5-system/2-api-convention.md` §7 Rate Limiting 표 — `파일 업로드 (KB 문서)` 행만 존재, 아바타 업로드(`POST /api/users/me/avatar`) 행 없음
  - 위반 규약: 엄밀히는 `spec/conventions/**` 위반이 아니라 `2-api-convention.md` 자체의 "표의 범위 — 라우트별 오버라이드를 cross-cutting SoT 로 정리" 원칙과의 내부 정합성 이슈. 다만 §9 개정으로 "파일 업로드 엔드포인트는 둘이다"라고 명시했으므로, 같은 절이 관리하는 §7 표도 짝을 맞추는 편이 일관적이다.
  - 상세: 아바타 업로드는 KB 문서 업로드와 동일하게 별도 `@Throttle` 없이 글로벌 100 req/min 을 상속한다(구현 diff 확인: `uploadAvatar()` 에 `@Throttle` 데코레이터 없음). §7 표는 "KB 문서" 행만 명시하고 있어, §9 에서 언급한 두 번째 업로드 엔드포인트가 §7 에는 반영되지 않은 채 남아 있다.
  - 제안: §7 표의 "파일 업로드 (KB 문서)" 행을 "파일 업로드 (KB 문서·아바타)"로 확장하거나 별도 행을 추가.

- **[INFO]** `2-api-convention.md` 문서에 명시적 `## Overview` 섹션이 없음 (frontmatter 직후 바로 `## 1. 기본 원칙`)
  - target 위치: `spec/5-system/2-api-convention.md` 최상단
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성(Overview / 본문 / Rationale) 권장"
  - 상세: `3-error-handling.md` 는 `## Overview` 섹션을 갖추고 있는 반면(§Overview, 본문 앞), `2-api-convention.md` 는 frontmatter + 관련 문서 링크 한 줄 뒤 바로 `## 1. 기본 원칙`로 들어간다. 이 PR 은 이 문서의 §9 표·본문 한 항목만 수정했을 뿐 문서 구조를 바꾸지 않았으므로 **이 PR 이 새로 만든 문제는 아니다** — 사전에 존재하던 구조적 갭을 참고용으로 남긴다("권장" 수준이라 CRITICAL/WARNING 은 아님).
  - 제안: 이번 PR 범위에서 고칠 필요는 없음. 추후 이 문서를 다룰 때 `## Overview` 절 신설을 고려.

- **정상 확인된 항목** (별도 조치 불요, 참고용 기록):
  - 신규 에러 코드 `FILE_REQUIRED`/`INVALID_FILE_TYPE` — `UPPER_SNAKE_CASE`, 의미 기반 명명, `error-codes.md` §1 원칙과 §3 historical-artifact 예외 레지스트리 어디에도 저촉되지 않음. 카탈로그 등재 위치(`3-error-handling.md` §1.3)·형식(`| 코드 | 설명 | HTTP |`)도 인접 행과 일치.
  - `POST /api/users/me/avatar` 응답 `{ data: <UserProfileDto> }` — `api-convention.md §5.1`·`swagger.md §2-5` pass-through 규칙과 일치. 기존 `ApiOkWrappedResponse(UserProfileDto)` 재사용(신규 DTO 불필요) — swagger.md §5-1 원칙(엔티티 노출 금지·응답 DTO 재사용) 준수.
  - `@HttpCode(HttpStatus.OK)` — 이 컨트롤러의 다른 POST 5개와 동일하게 200 명시, `@ApiOkWrappedResponse`(200 문서)와 런타임 일치. swagger.md §2-4 "200 OK (조회/수정)" 분류와 부합(업로드가 아바타 URL 을 "갱신"하는 성격이라 201 Created 대상 아님).
  - `enum(['summary'])` 길이 — `uploadAvatar` summary "아바타 이미지 업로드"(11자)는 10~20자 강제 범위 내.
  - `S3_PUBLIC_BASE_URL` 등 신규 env var 명명 — 기존 `S3_*` 계열과 일관.
  - `AVATAR_MAX_BYTES`/`AVATAR_CONTENT_TYPES` — `UPPER_SNAKE_CASE` static 상수, 기존 관행과 일치.

## 요약

이 PR 이 정식 규약(`spec/conventions/**`)을 직접 위반하는 지점은 하나로 수렴한다 — `swagger.md` §3 이 "강제"로 명시한 엔드포인트 `@ApiOperation.description` 50~150자 상한을 `POST /api/users/me/avatar`(170자)와 `PATCH /api/users/me`(202자, 이 PR 이 107자에서 늘림) 두 곳에서 넘겼다. 원인은 명확하다 — 공개 URL·정리 동작에 대한 보안/정책 캐비엇을, 정확히 그 용도로 예외를 열어 둔 DTO `description`(`UserProfileDto.avatarUrl`, 현재 비어 있음) 대신 강제 상한이 있는 엔드포인트 description 에 넣었다. 에러 코드 명명(`FILE_REQUIRED`/`INVALID_FILE_TYPE`)·응답 envelope·wrapper 헬퍼 사용·HTTP status 선택 등 나머지 규약 축은 모두 기존 관례와 일치하며 새로운 위반이 없다. Rate Limiting 표 갱신 누락과 `api-convention.md` 의 Overview 섹션 부재는 참고용 INFO 로, 이번 PR 의 직접적 책임은 아니다.

## 위험도

LOW
