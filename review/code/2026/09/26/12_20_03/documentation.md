# 문서화(Documentation) 리뷰 — forbidden-desc-codes

## 발견사항

- **[INFO]** `forbidden-descriptions.ts` 상단에 파일 소유자가 없는(floating) JSDoc 블록
  - 위치: `codebase/backend/src/common/swagger/forbidden-descriptions.ts:7-13`
  - 상세: 7~13행의 `/** ... */` 블록은 어떤 `export` 에도 바로 붙지 않은 채(빈 줄 하나 뒤에 `FORBIDDEN_NOT_A_MEMBER` 용 별도 JSDoc(15-18행)이 이어진다) 모듈 헤더 역할을 한다. 내용 자체(`RolesGuard` 거부 코드를 싣는다는 배경 설명)는 정확하고 유용하지만, TSDoc/TypeDoc 류 도구는 이 블록을 어떤 심볼에도 매지 않아 렌더링에서 누락될 수 있다.
  - 제안: `@module` 태그를 붙이거나, 파일 최상단 한 줄 요약만 남기고 나머지 배경 설명은 아래 `FORBIDDEN_NOT_A_MEMBER` 독스트링에 합치는 것을 고려. 다만 저장소 다른 곳(`workspace-roles.ts` 등)도 유사하게 "표 전체에 대한 서문 주석"을 두는 관례가 있어 급하지 않음.

- **[INFO]** `integrations.controller.ts` 의 기존 주석이 새 공용 헬퍼 경유를 언급하지 않음(주석 정확성 — 오래된 정도는 아니고 불완전)
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:92-94` (diff 상 컨텍스트 줄, 이번 변경으로 텍스트 자체는 바뀌지 않음)
  - 상세: "403 · 404 설명 — 거부 코드는 공유 거부 표(`common/constants/workspace-roles.ts`)의 `.code` 를 보간한다" 라는 주석은 여전히 참이지만(직접 `ROLE_REQUIRED.admin.code` 를 보간하는 부분이 남아 있어서), 바로 아래 95·97행이 이제 `FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole('editor')`(공용 헬퍼, `common/swagger`)를 경유해 조립된다는 사실은 언급하지 않는다. 다른 컨트롤러(`workspaces.controller.ts` 등)는 이번 PR 에서 같은 취지의 로컬 주석을 새 헬퍼 언급으로 갱신했는데, 이 파일만 옛 표현이 남았다.
  - 제안: "공유 거부 표에서 보간" 뒤에 "(공용 헬퍼 `common/swagger` `FORBIDDEN_NOT_A_MEMBER`·`forbiddenForRole` 경유, Organization 부가 코드만 `ROLE_REQUIRED` 직접 보간)" 정도로 한 구절 보강하면 다른 4개 컨트롤러의 헬퍼-우선 서술과 맞춰진다. 차단 사유는 아님.

## 확인된 양호 사항 (참고)

- `codebase/backend/src/common/constants/workspace-roles.ts` 의 `lowestRequiredRole` JSDoc(27-37행)은 `RolesGuard.assertMember`(`roles.guard.ts:210-229`)와 `forbidden-response-codes-guard.ts` 양쪽의 실제 사용을 정확히 서술하고, 서열 밖 문자열이 섞였을 때의 위험(요구가 사라짐)을 경고하며 이는 `workspace-roles.spec.ts` 의 신규 테스트 주석("서열 밖 문자열(0)은 어떤 역할보다 낮다 … 주석의 경고를 고정")과 정확히 짝을 이룬다. `roles.guard.ts:224-225` 의 "threshold 는 늘 등록된 역할이다" 주석도 로직을 대조해 보면(레벨 0인 threshold 는 `>=` 비교를 항상 통과해 그 분기에 닿지 않음) 정확하다.
- `spec/conventions/swagger.md` §5-4 가 이 PR 과 같은 날짜(2026-09-26)로 갱신되어 새 규칙(가드가 낼 수 있는 코드 전부를 싣는다·공용 헬퍼·reflection 가드가 소급 적용된다는 점)을 반영했고, `code:` frontmatter 에 `forbidden-response-codes*.ts` 를 등재해 가드-문서 연결도 되어 있다. (다만 이 파일은 `codebase/**` 리뷰 스코프 밖이라 diff 로는 안 보임 — `git diff origin/main...HEAD -- spec/conventions/swagger.md` 로 별도 확인.)
- `CHANGELOG.md` 에 "403 응답 설명이 가드 거부 코드를 싣는다" · "저장소 가드: 403 설명이 가드가 낼 수 있는 거부 코드를 담는다" 두 항목이 이미 추가되어 있다 — 제품 동작 변경(129개 라우트 설명 문구)과 harness/가드 신설을 분리해서 기록했다. 실측 수치(157곳 중 129곳, 세부 54·53·4·14·4)가 CHANGELOG·swagger.md·`forbidden-response-codes.spec.ts` 헤더 세 곳 모두 동일해 근거가 일관된다.
- `forbidden-response-codes-guard.ts`(신규 저장소 가드)와 `forbidden-response-codes.spec.ts`(신규 대조군+모델 캐너리)의 헤더 주석은 "무엇을 대조하나" · "못 보는 것 두 가지"(설명에 남은 코드·서비스 거부) · "베이스라인은 0" 을 명시해, 이 가드가 보장하지 않는 방향까지 정직하게 적었다(과장된 보장 없음).
- 각 컨트롤러의 `@ApiForbiddenResponse({ description: forbiddenForRole(...) })` 치환 지점은 실제 `@Roles(...)` 데코레이터의 역할과 일치한다(예: `workflow-test-datasets.controller.ts` 의 `update`/`remove` 는 `@Roles('editor')` + `FORBIDDEN_EDITOR_OR_NOT_OWNER` 로 가드 코드와 서비스 거부 문구를 함께 실었고 실제 데코레이터도 `editor`). 표본 점검한 파일들에서 코드-주석-데코레이터 3자 불일치는 발견되지 않았다.
- `workspaces.controller.ts` · `integrations.controller.ts` 모두 옛 로컬 상수(`FORBIDDEN_MEMBER_ROUTE`/`FORBIDDEN_MEMBER` 등)에 대한 잔존 참조가 없다(`grep` 로 전수 확인) — 이름 치환이 깨끗하다.

## 요약

이번 변경(29개 컨트롤러의 403 설명을 공용 헬퍼 `forbiddenForRole`/`FORBIDDEN_NOT_A_MEMBER` 로 통일 + `lowestRequiredRole` 추출 + 신설 저장소 가드 `forbidden-response-codes`)은 문서화 관점에서 매우 꼼꼼하게 처리됐다. 새 함수마다 "왜"를 설명하는 JSDoc이 있고, 그 서술이 실제 소비처(`RolesGuard.assertMember`, 신규 가드)의 코드와 대조해도 정확했다. `spec/conventions/swagger.md` §5-4 와 `CHANGELOG.md` 두 항목이 이미 이번 PR 범위 안에서(코드 스코프 밖이지만) 함께 갱신되어 있어 "새 관례 추가 시 관례 문서·변경 이력 갱신" 요구를 충족한다. 발견한 두 건은 모두 INFO 등급으로, 오래되어 틀린 주석이 아니라 새 헬퍼 경유 사실을 조금 더 언급하면 좋을 미세한 보강 지점이다. 문서화를 이유로 병합을 막을 사항은 없다.

## 위험도

NONE
