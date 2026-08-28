# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base origin/main)

## 검토 대상 diff 요약

실제 코드 변경분(`git diff origin/main...HEAD -- code_areas`)은 다음 3파일뿐이다:

- `codebase/backend/package.json` — 미사용 devDependency `@eslint/eslintrc` 제거
- `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` — `cause: err` 보존을 잠그는 신규 테스트 1건 추가
- `codebase/backend/src/nodes/data/code/code.handler.spec.ts` — 동형의 신규 테스트 1건 추가

프로덕션 코드(`expression-resolver.service.ts:317`, `code.handler.ts:454`)의 `cause: err` 자체는 이번 diff 이전(선행 eslint 9→10 상향 커밋)에 이미 존재했고, 이번 변경은 그 동작을 회귀로부터 잠그는 테스트 추가일 뿐이다. `spec/5-system/**.md` 문서 자체는 이번 diff 에서 전혀 수정되지 않았다.

`nodes/data/code/code.handler.ts` 는 `spec/5-system/*.md` 의 `code:` frontmatter 어디에도 등재돼 있지 않다(참조는 `4-execution-engine.md:1700` 텍스트 인용뿐) — review target(`spec/5-system/`) scope 밖 코드다. `expression-resolver.service.ts` 는 `spec/5-system/5-expression-language.md` 의 `code:` 에 등재돼 scope 안이다.

## 발견사항

- **[INFO] `spec/conventions/**` 대부분이 컨텍스트 예산으로 절단됨 — 검토 신뢰도 caveat**
  - target 위치: 본 bundle 의 "정식 규약 모음(spec/conventions/)" 섹션 전체
  - 위반 규약: 해당 없음(target 문서 결함이 아니라 본 checker 입력 조립의 한계)
  - 상세: `audit-actions.md` · `cafe24-api-catalog/_overview.md` · `cafe24-api-catalog/category.md` 3개를 제외한 **나머지 전체**(`error-codes.md`, `node-output.md`, `execution-context.md`, `swagger.md`, `redis-keys.md`, `secret-store.md`, `spec-impl-evidence.md`, `cafe24-api-catalog/*` 잔여 전부, `makeshop-api-catalog/*` 전부 등)가 "본문 생략됨 — 컨텍스트 예산 초과" 로 절단되어 있다. 공교롭게도 이번 diff 가 건드리는 영역(에러 wrapping/`cause`)과 가장 밀접한 `error-codes.md`·`node-output.md`·`execution-context.md` 가 전부 절단 대상에 포함된다.
  - 제안: 본 checker 의 "위반 없음" 판정은 위 3개 절단 문서에 대해서는 **본문을 실제로 대조하지 못한 상태**에서 나온 것임을 명시한다. 다만 diff 자체가 새 에러 코드·새 필드·새 output shape 를 도입하지 않는 순수 테스트/의존성 정리이므로 실질적 위반 가능성은 낮다고 판단한다(§아래 요약). 기존에 알려진 프로젝트 메모(`consistency --spec 기본 예산이 conventions 를 통째로 떨군다`)와 동일한 클래스의 재발이므로, orchestrator 측에서 이 checker 호출에 한해 conventions 청크 예산을 상향하거나 관련 파일만 별도 청크로 강제 포함하는 것을 검토할 만하다(규약 자체보다 harness 조정 사안).

- **[INFO] `spec/5-system/5-expression-language.md` 가 `## Overview` 대신 `## 1. 개요` 사용 (pre-existing, 이번 diff 무관)**
  - target 위치: `spec/5-system/5-expression-language.md` 최상단 섹션 (18번째 줄 `## 1. 개요`)
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 하단 — "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
  - 상세: 같은 target 영역의 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 는 리터럴 `## Overview` 헤딩을 쓰는 반면, `5-expression-language.md` 는 `## 1. 개요`로 시작한다. `## Rationale` 은 존재(544번째 줄)하므로 3섹션 구성 자체는 지켜지고 있고 위반은 헤딩 리터럴 표기 차이뿐이다. 이번 PR 의 diff 범위(테스트 2건 + devDependency 제거)는 이 파일의 본문을 전혀 건드리지 않았으므로 이번 변경이 만든 새 위반이 아니라 기존 상태다.
  - 제안: 이번 PR 의 fix 대상은 아니다. 추후 `5-expression-language.md` 를 편집하는 작업에서 `## Overview` 로 통일하거나, 문서 구조 규약이 실제로 "Overview" 리터럴을 요구하지 않고 한국어 동의어(`## 1. 개요`)를 허용하는 것이라면 규약 문서 쪽에 명문화하는 것을 고려.

## 요약

이번 diff(`eslint10-upgrade`)는 미사용 `@eslint/eslintrc` devDependency 제거와, 이미 존재하던 `cause: err` 보존 동작을 잠그는 방어적 테스트 2건 추가로 구성된 순수 chore/test 변경이다. `spec/5-system/**.md` 문서 자체는 수정되지 않았고, 새 API endpoint·에러 코드·응답 포맷·DTO/Swagger 데코레이터를 도입하지 않으므로 명명·출력 포맷·API 문서 규약 위반 표면이 존재하지 않는다. 유일한 실질적 caveat 은 이번 bundle 조립에서 `error-codes.md`·`node-output.md`·`execution-context.md` 를 포함한 `spec/conventions/**` 대부분이 컨텍스트 예산으로 절단되어, 그 문서들 본문 대조는 수행하지 못했다는 점이다(diff 의 성격상 실질 위험은 낮다고 판단). 부가로 `5-expression-language.md` 의 헤딩 표기가 형제 문서와 다르다는 pre-existing INFO 를 발견했으나 이번 PR 범위 밖이다.

## 위험도
NONE
