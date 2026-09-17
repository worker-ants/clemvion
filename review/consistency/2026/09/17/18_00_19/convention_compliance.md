# 정식 규약 준수 검토 — `spec/2-navigation/` (--impl-prep, `trigger-deletion-release` 착수 전)

## 검토 범위 및 방법

target 은 `spec/2-navigation/` 이며, 프롬프트 번들에서 전문이 포함된
`2-trigger-list.md` · `1-workflow-list.md` · `3-schedule.md` 를 중심으로, 절단된
`spec/conventions/{error-codes,swagger,spec-impl-evidence}.md` 는 저장소에서 직접 `Read`
했다(번들엔 `secret-store.md`·`audit-actions.md` 는 전문 포함). 이번 착수 대상 구현 plan
(`plan/in-progress/trigger-deletion-release.md`, `spec_impact: none`)이 코드만 바꾸고
spec 은 안 건드리는 것이 전제이므로, 검토 초점은 "지금 landed 된 spec 텍스트가 conventions 와
정합해 그대로 구현 착수 기준으로 쓸 수 있는가" 다. 같은 spec 변경에 대해 이미 두 차례
`--spec` 라운드(`review/consistency/2026/09/17/{16_32_44,17_05_02,17_20_54}`)가 돌았고,
17_20_54 의 `convention_compliance.md` 가 WARNING 1(`secret-store.md §2.1` vs §2 인터페이스
불일치)을 냈던 이력이 있어 그 항목이 현재 상태에서 해소됐는지도 재확인했다.

## 발견사항

이번 라운드에서 새로 발견한 CRITICAL/WARNING 위반은 없다. 아래는 확인 과정에서 나온 INFO
2건이다 — 둘 다 target(`spec/2-navigation/`) 자체의 위반이 아니라 그 target 이 의존하는
`spec/conventions/` 문서 쪽의 잔여 갭이다.

- **[INFO]** `secret-store.md §2.1` vs §2 인터페이스 불일치 — 이미 해소됨 (재확인 결과 보고)
  - target 위치: 해당 없음 (이전 라운드 이력 확인용 재검증)
  - 위반 규약: 없음 — `spec/conventions/secret-store.md §2` `SecretResolver` 인터페이스
  - 상세: `17_20_54/convention_compliance.md` 가 지적했던 "§2 인터페이스에 `deleteByPrefix`
    가 선언돼 있지 않은데 §2.1/§5.3/§6 이 이미 정식 메서드처럼 인용한다"는 WARNING 은, 현재
    `secret-store.md §2` 코드 블록에 `deleteByPrefix(prefix: string): Promise<number>` 가
    포함돼 있어 **더 이상 성립하지 않는다**. 해소 확인 목적으로만 기록.
  - 제안: 없음(이미 반영됨).

- **[INFO]** `spec-impl-evidence.md §3.1` 전이 규칙에 "실측에 의한 하향 정정" 경로가 여전히 없다
  - target 위치: `spec/conventions/secret-store.md` frontmatter (`status: partial`,
    이번 변경 세트에서 `implemented` → `partial` 로 하향), 근거 서술은 secret-store.md §6
    끝의 "(2026-09-17 정정 — 그 전까지 이 문단은 SQL 한 줄로 이미 정리되는 것처럼 적었지만
    그렇게 지우는 코드는 없었다)"
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3.1 전이 규칙` — `backlog→spec-only`,
    `spec-only→partial`, `partial→implemented`, `*→archived` 네 방향만 정의하고, "실측으로
    오분류가 드러나 반대 방향(하향)으로 정정" 하는 경로가 표에 없다
  - 상세: `secret-store.md` 는 이번에 `implemented` 였다가 `partial` + `pending_plans`
    (`spec-draft-nullable-notation-followups.md`) 로 하향됐다. 근거(네 삭제 경로 중 하나만
    실제로 정리하고 있었다는 실측)는 명확하고 `git log -S` 로 확인되는 선례도 있어 **차단
    사유는 아니다** — build 가드(`spec-status-lifecycle.test.ts`)도 전이 방향을 강제하지
    않는다. 다만 §3.1 표 자체가 이 경로를 명문화하지 않아, 이런 정당한 하향이 반복될 때마다
    각 spec 이 스스로 정당성을 서술해야 하는 상태가 계속된다. (이전 `--spec` 라운드에서
    같은 갭이 이미 INFO 로 지적됐고, 이번 `--impl-prep` 시점에도 여전히 미반영 — 새 위반은
    아니지만 반복 관측이라 다시 적는다.)
  - 제안: target(`spec/2-navigation/`) 을 막을 사유는 아니므로 이번 구현 착수를 지연시키지
    않는다. `spec-impl-evidence.md §3.1` 에 "실측으로 status 오분류가 드러나면 방향 무관하게
    즉시 정정하고 Rationale/정정 문단에 실측을 남긴다" 류의 규칙을 추가하는 것을 별도
    planner 턴에서 검토할 만하다.

## 그 외 대조 결과 (위반 없음 — 근거만 기록)

- **명명 규약**:
  - 에러 코드 `RESOURCE_CONFLICT` / `VALIDATION_ERROR` / `INVALID_FIELD` / `RESOURCE_NOT_FOUND`
    / `INTERNAL_ERROR` / `AUTH_CONFIG_NOT_FOUND` / `BOT_TOKEN_INVALID` / `TRIGGER_ENDPOINT_PATH_CONFLICT`
    모두 `error-codes.md §1` `UPPER_SNAKE_CASE` + `3-error-handling.md §1` 카탈로그에 등재된
    코드와 1:1 일치(직접 대조: `3-error-handling.md` L83, L238, L252, L285 등).
    `details.field='endpoint_path'` (snake_case) 는 다른 `details.field` 값(`botTokenRef` 등
    camelCase)과 표기가 달라 보이지만, `spec/5-system/2-api-convention.md §5.3`(`{ field:
    'endpoint_path', code: … }`)이 이 값을 **그 자체로 표준 예시**로 싣고 있어 target 의
    독자적 표기 오류가 아니다 — DB 컬럼명을 그대로 실은 기존 정식 사례.
  - audit action `trigger.created/updated/deleted`,
    `trigger.notification_secret_rotated` / `chat_channel_bot_token_rotated` /
    `interaction_token_revoked` 는 `audit-actions.md §3` 레지스트리와 정확히 일치(구현
    2026-08-11 표기까지).
  - secret ref `secret://triggers/{id}/bot-token` 등은 `secret-store.md §1` URI scheme
    (`scope`/`resourceId`/`name` kebab-case) 을 그대로 따른다.
  - frontmatter `id: trigger-list` / `id: workflow-list` / `id: schedule` 등은
    `spec-impl-evidence.md §2.1` 의 "파일 basename 기반" 규칙과 일치.
- **출력 포맷 규약**: `GET /api/triggers`·`GET /api/schedules` 의 "페이지네이션 응답 형식은
  API 규약 §5.2 준수" 인용이 올바른 절을 가리킨다. `DELETE /api/triggers/:id` → `204 No
  Content` 는 `swagger.md §2-4` 상태 코드 표와 일치. `TriggerDto.workflow` 키 생략형 판정은
  `2-api-convention.md §5.4` 기준 (b) 를 올바르게 인용하고, 스케줄 응답의 자매 참조가 `id` 를
  담지 않는 것을 "의도적으로 다르다"고 명시해 §5.4 규칙(필드별 근거 요구)을 충족한다.
- **문서 구조 규약**: `2-trigger-list.md`/`1-workflow-list.md`/`3-schedule.md` 모두 명시적
  `## Overview` 헤딩 없이 화면구조→기능상세→API→Rationale 구조를 쓴다 — 이는 위반이 아니라
  `project-planner/SKILL.md` "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"
  규칙과 정확히 일치하는 패턴이며(세 문서 모두 상단에 `_product-overview.md` 로 링크), 세
  파일 다 `## Rationale` 로 끝난다. frontmatter 스키마(`id`/`status`/`code`/`pending_plans`)도
  `spec-impl-evidence.md §2` 형식과 일치하고, `status: partial` 인 두 문서(`trigger-list`,
  `secret-store`) 모두 `pending_plans`(`spec-draft-nullable-notation-followups.md`, 실존
  확인)를 채워 §3 라이프사이클 의무를 충족한다.
  - 참고(비차단): `secret-store.md` 는 본문 시작에 프로즈 개요만 두고 `audit-actions.md` /
    `error-codes.md` / `spec-impl-evidence.md` 처럼 명시적 `## Overview` 헤딩을 쓰지 않는다 —
    `spec/conventions/` 안에서도 스타일이 갈려 있는 기존 상태이며, "권장" 조항이라 위반은
    아니다. 이번 PR 이 §2.1/§5.3/§6/R4 를 크게 손댔으니 참고로만 남긴다.
- **API 문서 규약**: 본 target 은 spec 서술이라 DTO/컨트롤러 코드 자체는 없지만, 서술이
  가리키는 패턴(`Update` 접두는 top-level 요청 바디 한정, write-only `botToken`/
  `inboundSigningPlaintext`, readOnly derived `hasBotToken`)은 `swagger.md §1-5`/`§1-7` 과
  일치한다. §2.3.1 매트릭스의 "API 응답 시 camelCase, DB 컬럼은 snake_case" 서술도
  `swagger.md §1-6`/API 규약과 같은 축을 올바르게 반복한다.
- **금지 항목**: `PATCH .../toggle` 서브경로 미채택(R-4), 인라인 인증 필드(`hmacSecret` 등)
  제거(R-14), `Patch` 접두 미사용 등 conventions 가 금지한 패턴을 다시 들여오는 곳이 없다.
  `secret-store.md` R4 가 `ON DELETE CASCADE` 를 명시적으로 "채택하지 않는다"고 재확인한 것도
  §3.4(백엔드 교체 가능성 유지)와 일관된 재확인이며 새 금지 위반이 아니다.

## 요약

`spec/2-navigation/`(특히 `2-trigger-list.md` §3/§4.3/§4.4)과 그 근거 `spec/conventions/
secret-store.md`(§2/§2.1/§5.3/§6/R4)는 이미 두 차례의 `--spec` 검토를 거쳐 정식 규약과
정합한 상태로 착지했다. 이번 `--impl-prep` 재검토에서도 에러 코드·audit action·secret URI·
frontmatter 스키마·문서 구조·응답 형태 모두 해당 conventions 문서와 어긋나는 곳을 새로
찾지 못했고, 이전 라운드가 지적했던 `secret-store.md §2` 인터페이스 갭도 이미 해소돼 있다.
남은 것은 `spec-impl-evidence.md §3.1` 이 "하향 status 전이" 경로를 아직 명문화하지 않았다는
기존 갭(정당한 하향이지만 매번 각 spec 이 스스로 근거를 대야 함)과 `secret-store.md` 의
`## Overview` 헤딩 부재라는 스타일 차이뿐이며, 둘 다 이번 구현 착수를 막을 사유가 아니다.

## 위험도

LOW
