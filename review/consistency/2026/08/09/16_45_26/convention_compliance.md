# 정식 규약 준수 검토 — spec/conventions/**

## 검토 범위 및 제약

번들에 포함된 문서를 전문 검토했다: `audit-actions.md`, `cafe24-api-catalog/_overview.md`,
`cafe24-api-catalog/category.md`, `cafe24-api-catalog/store.md`, `cafe24-api-catalog/translation.md`,
`cafe24-api-metadata.md`, `chat-channel-adapter.md`. 컨텍스트 예산 초과로 나머지 263개 파일
(대부분 `<name>-api-catalog/<resource>/**` field-level 레퍼런스·나머지 resource 인덱스·
`error-codes.md`/`swagger.md`/`node-output.md`/`secret-store.md` 등)은 본문이 프롬프트에
없어 직접 열지 못했다 — 이 부분의 부재는 "위반 없음" 의 근거가 아니라 **미검토** 로 표기한다.
`spec/conventions/` 자체가 target 이라 비교 대상 "정식 규약 모음" 이 비어 있어(`(없음)`),
CLAUDE.md·`.claude/skills/project-planner/SKILL.md` 의 메타 컨벤션(문서 3섹션 구조·frontmatter·
명명) 및 문서 내부 자기 일관성을 기준으로 검토했다.

## 검증 절차

- `spec/conventions/spec-impl-evidence.md` §1 (frontmatter 의무·제외 규칙)과 실제 가드 구현
  (`codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`)을 대조.
- `audit-actions.md` 의 명명 규약(§1 `<resource>.<verb>`, 언더스코어 토큰 구분자, 인라인 문자열 금지)을
  실제 구현(`codebase/backend/src/modules/audit-logs/audit-action.const.ts`)과 대조.
- `chat-channel-adapter.md` frontmatter 의 `pending_plans` 3건이 실제로 `plan/in-progress/` 에
  존재하는지 확인.
- `cafe24-api-metadata.md` 가 언급하는 에러코드(`CAFE24_MISSING_FIELDS`)·엔드포인트
  (`GET services/:type/catalog`)를 실제 backend 코드와 대조.

## 발견사항

- **[INFO]** `CONVENTION:` 계열 문서의 `## Overview` 헤딩 누락 (형식 일관성)
  - target 위치: `cafe24-api-catalog/_overview.md`, `cafe24-api-metadata.md`, `chat-channel-adapter.md` 의 도입부
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" — `## Overview (제품 정의)` / 본문 / `## Rationale`
  - 상세: 위 세 문서는 제목(`# CONVENTION: ...`) 직후 산문 도입부 → `---` → `## 1. ...` 로 바로 들어가며 명시적 `## Overview` 헤딩이 없다. 반면 같은 번들의 `audit-actions.md` 는 `## Overview` 헤딩을 명시적으로 사용한다. 세 문서 모두 말미에 `## Rationale` 은 존재하므로 구조 자체가 없는 것은 아니고, "Overview" 섹션 표기 방식만 문서군 사이에서 갈린다.
  - 제안: 3섹션 구조는 SKILL.md 상 "권장"이지 강제가 아니며, `CONVENTION:` prefix 문서군 전반(번들 밖 나머지 컨벤션 파일들도 동일 패턴일 가능성이 높음)에 일관되게 적용된 기존 스타일로 보인다 — 이번 diff 로 새로 발생한 문제로 보이지 않는다. 급하게 고칠 필요는 없으나, 다음에 `spec/conventions/` 를 손볼 기회가 있으면 `## Overview` 헤딩을 명시적으로 붙이거나, 반대로 SKILL.md 의 3섹션 권장에 "`CONVENTION:` 문서는 도입부 산문으로 Overview 를 대체 가능" 같은 예외를 명문화해 문서-규약 간극을 없애는 편을 검토.

- 그 외 명명 규약·출력 포맷 규약·frontmatter 의무/제외 규칙·금지 패턴(인라인 문자열, 하이픈/camelCase 토큰 등) 에서는 위반을 발견하지 못했다. 구체적으로:
  - `_overview.md` 는 basename `_` prefix 로 frontmatter 의무에서 제외되며(`spec-frontmatter-parse.ts` 의 `base.startsWith("_")` 가드가 경로 깊이 무관 basename 매칭임을 확인) 실제로 frontmatter 가 없는 것이 정상.
  - `cafe24-api-catalog/category.md`·`store.md`·`translation.md` 는 frontmatter `id` 가 파일 basename 과 일치하고 `status: implemented` + `code:` 단일 경로로 §2.1 스키마를 만족.
  - `chat-channel-adapter.md` 는 `status: partial` + `pending_plans` 3건을 갖추었고, 3건 모두 `plan/in-progress/` 에 실존.
  - `audit-actions.md` §1 의 `<resource>.<verb>` + 언더스코어 토큰 규약은 `audit-action.const.ts` 의 `AUDIT_ACTIONS` 실제 값과 정확히 일치(`2fa_enabled`, `role_changed`, `re_run`, `transfer_ownership`, `set_default` 등 전부 언더스코어, 하이픈/camelCase 없음).
  - `cafe24-api-metadata.md` 가 언급하는 `CAFE24_MISSING_FIELDS` 에러 코드·`GET services/:type/catalog` 엔드포인트(`@ApiOkWrappedResponse` 사용, 프로젝트 공통 `{data: ...}` 래핑 컨벤션 준수)는 실제 구현과 대조해 일치.

## 요약

번들에 포함된 7개 문서는 frontmatter 스키마·명명 규약(`<resource>.<verb>`, 언더스코어 토큰)·
`_` prefix 예외 규칙·pending_plans 실존성·참조 에러코드/엔드포인트 모두 실제 구현·타 규약과
정합했다. 유일한 관찰 사항은 `CONVENTION:` 계열 문서 3건이 명시적 `## Overview` 헤딩 없이
산문 도입부로 대체하는 형식 편차이며, 이는 SKILL.md 상 "권장" 수준이고 문서군 전반의 기존
스타일로 보여 INFO 수준에 그친다. 다만 컨텍스트 예산 초과로 263개 파일(주로 field-level
레퍼런스와 `error-codes.md`/`swagger.md`/`secret-store.md` 등 핵심 규약 일부)을 열지 못했으므로,
이 검토는 스코프 내 완전성을 보장하지 못한다 — 특히 `swagger.md`(API 문서 도구 데코레이터 규약)와
`error-codes.md`(출력 포맷·에러코드 규약)를 직접 참조하는 diff 가 있다면 별도 targeted 재검토가 필요하다.

## 위험도
NONE
