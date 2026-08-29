# 정식 규약 준수 검토 — spec/5-system/ (impl-done)

## 스코프 확인 (검토 전 실측)

`git diff origin/main...HEAD --name-only` 로 확인한 결과, 이번 브랜치(`claude/cause-c2-canary`, eslint10-upgrade)는
**`spec/5-system/` 하위 파일을 전혀 변경하지 않았다.** 변경된 파일은 다음 뿐이다:

- `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` (테스트 확장)
- `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (주석만 추가, 로직 무변경)
- `codebase/backend/src/nodes/data/code/code.handler.spec.ts` (테스트 확장)
- `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` (신규 테스트)
- `plan/in-progress/deps-peer-gating-and-eslint10.md`, `review/code/**` (plan/review 산출물)

프롬프트에 번들된 `spec/5-system/3-error-handling.md` §6.3.1(`Error.cause` 부착 기준)과 그 Rationale 항목은
**이미 origin/main 에 병합된 상태**(커밋 `44346ec81` / `1a522d1a6`, #1230)이며 이번 diff 의 산출물이 아니다.
따라서 본 검토는 (a) 이번 diff 가 기존에 확정된 §6.3.1 규약을 올바르게 따르는지, (b) 번들에 포함된 3개
전체본(`1-auth.md`/`2-api-convention.md`/`3-error-handling.md`) 자체가 `spec/conventions/**` 를 따르는지를
확인했다.

## 발견사항

이번 diff 범위 내에서 CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.

- **[INFO] `eslint-disable` 억제 주석 형식이 §6.3.1 규정과 정확히 일치**
  - target 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:105`
  - 관련 규약: `spec/5-system/3-error-handling.md` §6.3.1 — "붙이지 않을 때는
    `eslint-disable-next-line preserve-caught-error -- <사유>` 로 억제하고 **무엇을 왜 감추는지**를
    주석에 남긴다"
  - 상세: 실제 코드가 `// eslint-disable-next-line preserve-caught-error -- cause 보존 시 crypto
    에러 상세가 Activity API 로 노출됨 (SS-SE-05, #814 근거)` 형태로, 규약이 요구하는 형식(룰 이름 +
    `--` + 사유)과 "무엇을 왜 감추는지" 서술을 그대로 충족한다. 위반이 아니라 **모범 준수 사례**로
    기록해 둔다 (변경 없음 요구).

- **[INFO] `Error.cause` 판정축(C1/C2)이 REST 봉투 규약과의 경계를 명시적으로 분리**
  - target 위치: `spec/5-system/3-error-handling.md` §6.3.1 상단 blockquote
  - 관련 규약: `spec/5-system/2-api-convention.md` §5.3(에러 응답) · `spec/conventions/error-codes.md`
    (envelope SoT 분리 원칙)
  - 상세: §6.3.1 은 "REST 표준 봉투 경로에는 이 절을 적용하기 전에 §2/§5.3 을 먼저 본다 — 그쪽은 원문
    echo 를 조건 없이 금지한다" 고 스스로 적용 범위를 한정해, `Error.cause`(내부 객체 구성)와
    `error.code`/`message` 봉투 필드(외부 wire 계약)를 혼동하지 않도록 규약 간 SoT 경계를 지켰다.
    위반 없음, 참고 기록.

- **[INFO] (이번 diff 와 무관, 사전 존재) `spec/5-system/2-api-convention.md` 등 7개 파일에 명시적
  `## Overview` 헤더가 없음**
  - target 위치: `spec/5-system/2-api-convention.md` (title 직후 바로 `## 1. 기본 원칙` 로 진입,
    `## Overview` 헤더 부재). 동일 패턴이 `_product-overview.md`·`11-mcp-client.md`·
    `16-system-status-api.md`·`6-websocket-protocol.md`·`5-expression-language.md`·
    `7-llm-client.md` 에도 있다 (전체 `spec/5-system/*.md` 18개 중 7개).
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성(Overview/본문/Rationale) 권장"
  - 상세: "권장" 항목이라 CRITICAL 은 아니며, `1-auth.md`·`3-error-handling.md`(이번 diff 가 참조하는
    두 문서)는 이미 `## Overview` 를 갖춰 규약을 따른다. `2-api-convention.md` 는 결여돼 있으나 이는
    이번 eslint10-upgrade 작업이 만든 drift 가 아니라 **기존부터 있던 상태**이고, 본 diff 는 이 문서를
    전혀 건드리지 않았다.
  - 제안: 이번 PR 의 fix 대상은 아니다. 문서 구조 정리가 필요하면 별도 `project-planner` 턴에서
    7개 파일에 대해 일괄 처리하는 편이 낫다 (이번 diff 의 diff-base 기준 신규/변경 사항이 아니므로
    이 리뷰의 BLOCK 사유로 사용하지 않는다).

- **범위 밖 확인 — `ExpressionError` 하위 클래스의 `.name` vs 클래스 식별자 불일치는 신규 아님**
  - 이번 diff 의 신규 테스트(`error-shape.spec.ts`, `expression-resolver.service.spec.ts` `it.each`)가
    `cause.name`(예: `'ExpressionSyntaxError'`)과 export 되는 클래스 식별자(`SyntaxError`,
    `ReferenceError`, `TypeError` — JS 전역 이름과 동명)를 함께 단언한다. 이 이름 불일치 자체는
    `codebase/packages/expression-engine/src/errors.ts` 에 이미 존재하던 설계(전역 이름 충돌을 피하려고
    `.name` 을 `'Expression' + 클래스명` 으로 별도 지정)이며 이번 diff 가 새로 만든 것이 아니다
    (`git log -S EXPR_FUNCTION_ERROR` 로 pre-existing 확인). `spec/conventions/error-codes.md` 는
    `error.code`(UPPER_SNAKE_CASE 문자열)의 명명만 규율하고 JS 클래스/`.name` 식별자는 규율 대상이
    아니므로 정식 규약 위반이 아니다.

## 요약

이번 브랜치의 실제 변경분은 `spec/5-system/` 을 전혀 건드리지 않았고(§6.3.1 은 선행 PR #1230 에서 이미
확정), diff 가 만지는 코드(테스트 확장 3건 + 주석 1건)는 그 §6.3.1 이 요구하는 `eslint-disable` 억제
문구 형식·"C1/C2 판정축을 REST 봉투와 분리" 원칙을 정확히 따르고 있다. 번들에 전체본이 포함된
`1-auth.md`/`2-api-convention.md`/`3-error-handling.md` 를 조회해도 명명·에러코드 카탈로그·SoT 분리
원칙(`spec/conventions/error-codes.md`)과 상충하는 지점은 없었다. 유일하게 눈에 띈 문서 구조 편차
(`2-api-convention.md` 등 7개 파일의 `## Overview` 헤더 부재)는 이번 작업과 무관한 기존 상태라 이번
diff 의 정식 규약 준수 판정에는 영향을 주지 않는다.

## 위험도

NONE
