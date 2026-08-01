# 정식 규약 준수 검토 — spec/5-system (impl-done, diff-base=origin/main)

검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md` (번들 포함분) +
diff 로 반영된 구현 (`codebase/backend/src/modules/audit-logs/audit-action.const.ts`,
`.../dto/responses/audit-log-response.dto.ts`). 대조 규약: `spec/conventions/audit-actions.md`,
`spec/conventions/error-codes.md`, `spec/conventions/swagger.md`, `spec/conventions/spec-impl-evidence.md`.

## 발견사항

- **[INFO]** Swagger DTO `action` 필드 설명이 길이 가이드라인을 크게 초과
  - target 위치: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts`
    `AuditLogDto.action` 의 `@ApiProperty({ description: ... })` — 이 DTO 는
    `spec/5-system/1-auth.md` frontmatter `code:` 가 지목하는 구현 evidence 파일이다.
  - 위반 규약: `spec/conventions/swagger.md` §3 "DTO `description`은 10~40자 내외"
  - 상세: 현재 `description` 은 리소스군 나열·중복 회피 근거·레거시 값 주의사항까지 담아
    400자를 크게 상회한다. 이번 diff 이전에도 이미 §3 가이드라인을 벗어난 상태였고, 이번
    diff 는 `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` 13개 추가 언급으로 그
    분량을 한층 더 늘렸다. swagger.md 는 이 항목에 대해 build-time 가드를 두지 않는
    연성(soft) 가이드라인이라 CRITICAL/WARNING 은 과하다고 판단해 INFO 로 표기한다.
  - 제안: 강제 조치는 아니나, 상세 설명은 `AUDIT_ACTIONS` const 상단 JSDoc(이미 동일 내용을
    보유)으로 위임하고 `@ApiProperty.description` 은 "SoT 는 `AUDIT_ACTIONS` 참조" 수준의
    짧은 문장 + `example` 로 축약하는 편이 §3 취지("10~40자 내외")에 더 부합한다.

- **[WARNING]** DTO 설명이 가리키는 spec 교차참조가 diff 반영 후 시점 기준으로 어긋남
  - target 위치: `AuditLogDto.action` description 말미의 `(spec/5-system/1-auth.md §4.1)` 참조 ·
    대조 대상: `spec/5-system/1-auth.md` §4.1 "Planned (미구현 — 목표 커버리지)" 표
    (`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` 행)
  - 위반 규약: 엄밀한 spec/conventions/** 조항 위반은 아니고, 리뷰 관점 ④ "API 문서 규약"
    (API 응답 문서화가 가리키는 SoT 의 정확성) 범주의 정합성 이슈로 분류.
  - 상세: 이번 diff 로 `AUDIT_ACTIONS` 에 `workflow.created/updated/deleted` ·
    `trigger.created/updated/deleted` · `schedule.created/updated/deleted` ·
    `model_config.create/update/delete/set_default` 13개가 실제 구현값으로 편입됐고, DTO
    description 도 "리소스군은 … workflow · trigger · schedule · model_config" 라고 갱신되어
    이 사실을 반영한다. 그런데 description 이 근거로 지목하는 `spec/5-system/1-auth.md §4.1`
    본문은 여전히 이 네 리소스를 "Planned (미구현)" 표에 두고 있어(구현됨 표로 미이동), 독자가
    description → §4.1 순서로 따라가면 "구현됨" 이라는 DTO 설명과 "미구현" 이라는 spec 본문이
    서로 모순되는 상태를 만난다. `spec/conventions/audit-actions.md` §3 도메인별 분류
    레지스트리 역시 해당 4개 리소스를 여전히 "미구현" 으로 표기해 동일한 drift 를 보인다.
  - 제안: 신규 발견이 아니라 이미 `plan/in-progress/spec-sync-auth-gaps.md` 가
    "spec SoT 4곳 동기화 — planner 턴 필요"(`5-system/1-auth.md §4.1` Planned→구현 이동,
    `conventions/audit-actions.md §3` 상태 컬럼 포함) 항목으로 명시 추적 중이다
    (`developer` 는 `spec/` write 권한이 없어 이 PR 범위에서 처리 불가함이 계획서에 이미
    기록됨). 별도 조치를 새로 요구하지 않되, 해당 planner 턴이 완료되기 전까지는 이 DTO
    description 의 spec 참조가 stale 함을 인지해야 한다. (spec↔plan 정합 자체의 1차 판정은
    `plan_coherence` 검토자 소관으로 보이며, 본 항목은 "API 문서가 가리키는 참조의 정확성"
    관점에서 교차 확인한 것이다.)

## 준수 확인 (긍정 소견)

- **audit-actions.md 명명 규약 완전 준수**: 신규 `AUDIT_ACTIONS` 항목(`WORKFLOW_CREATED` 등
  13개)이 §1 `<resource>.<verb>` dot-prefix, 언더스코어 토큰 구분자, §2 verb 시제 3분류를
  모두 그대로 따른다 — `workflow`/`trigger`/`schedule` 은 §2.1 과거분사(`created`/`updated`/
  `deleted`), `model_config` 은 §2.2 CRUD 현재형 예외(`set_default` 의 부자연스러움 때문에
  resource 단위 통일)로, `spec/5-system/1-auth.md §4.1` Planned 표·`§Rationale 4.1.A` 가
  이미 확정해 둔 표기와 정확히 일치한다. TS const 키 네이밍(`MODEL_CONFIG_CREATE` 등)도 기존
  `AUTH_CONFIG_*` 패턴과 동형이다.
- **spec-impl-evidence.md frontmatter 스키마 준수**: `1-auth.md` frontmatter
  (`status: partial`, `code:` glob, `pending_plans: [plan/in-progress/spec-sync-auth-gaps.md]`)
  는 §2~§3 스키마를 그대로 만족한다. `pending_plans` 가 가리키는 plan 은 여전히
  `plan/in-progress/`에 실존하며 LDAP/SAML(§1.3) 미구현 항목이 남아 있어 `status: partial`
  유지가 타당하다 — `implemented` 로의 조기 승격 압력이 없다.
  `3-error-handling.md`(`status: implemented`, `pending_plans` 없음)도 §3 라이프사이클과
  일치한다.
- **error-codes.md 준수**: `3-error-handling.md` §1 전체가 `UPPER_SNAKE_CASE` 를 일관 사용하며,
  예외(초대 흐름 `lower_snake_case` — `1-auth.md §1.5.4`)는 `error-codes.md §3` historical-
  artifact 레지스트리에 양방향으로 정확히 링크돼 있다.
- **문서 구조 규약 준수**: `1-auth.md`·`3-error-handling.md` 모두 Overview → 본문(§1~§5/§7)
  → Rationale 3섹션 구조를 따른다.
- **swagger.md 응답 wrapping/DTO 위치 규약 준수**: `dto/responses/audit-log-response.dto.ts`
  파일 위치·명명이 §5-1 패턴(`*-response.dto.ts`)과 일치한다.

## 요약

이번 diff(감사 로그 `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` CRUD 액션 구현)는
`spec/conventions/audit-actions.md` 의 명명·시제 규약을 한 치의 이탈 없이 그대로 따르고 있고,
`spec-impl-evidence.md` frontmatter 계약과 `error-codes.md` 표기 규약도 target 문서
(`spec/5-system/1-auth.md`, `3-error-handling.md`) 전반에서 잘 지켜지고 있다. 발견된 두 항목은
모두 경미하다 — 하나는 build 가드가 없는 Swagger description 길이 소프트 가이드라인의 사소한
초과(INFO), 다른 하나는 DTO 설명이 가리키는 spec 교차참조가 diff 반영 시점 기준으로 일시적으로
어긋난 것(WARNING)인데 이는 이미 `plan/in-progress/spec-sync-auth-gaps.md` 가 "planner 턴
필요" 항목으로 명시 추적 중인 사안이라 신규 차단 사유는 아니다. 정식 규약 준수 관점에서
CRITICAL 은 없다.

## 위험도

LOW
