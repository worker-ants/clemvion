# 테스트(Testing) 리뷰

## 검증 방법

`git diff origin/main...HEAD --stat -- codebase/` 로 실제 코드 변경분을 재확인했다(코드 4파일,
+36/-10). 4개 파일 각각을 직접 열어 diff 가 JSDoc·인라인 주석·Swagger `description` 문자열
바깥의 실행 문(statement)·조건식·시그니처·반환값을 전혀 건드리지 않았음을 재확인했다.

이 diff 는 이미 세 차례 리뷰 라운드(`19_25_39` → `19_36_12` → `20_05_07`)를 거쳤고, 그때마다
testing 리뷰가 "신규 테스트 불요·회귀 유효·위험도 NONE"으로 수렴했다. 이번 라운드의 유일한
신규 변경은 마지막 커밋(`a578366c7`)이 `re-run.dto.ts` 의 Swagger `description` 을
236자에서 **129자**로 더 압축한 것뿐이다(마커 정확 일치 캐비엇과 `SoT: EIA §R17` 링크는 유지).
독립 검증으로 이전 라운드가 "커버됨"으로 판정한 관련 spec 스위트를 실제로 재실행했다:

```
npx jest resolve-trigger-parameters.spec.ts workflows.controller.spec.ts \
  masked-reject-callers.spec.ts reject-masked-resubmission.spec.ts
```

→ `Test Suites: 4 passed, 4 total` · `Tests: 80 passed, 80 total` (직접 실행, 2026-08-22 현재
HEAD `a578366c7` 기준).

## 발견사항

- **[INFO]** 신규 테스트 불필요 — 재확인됨 (실행으로 검증)
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:37-71`
    (`REASON_TO_DETAIL`), `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:100-124`
    (`resolveTriggerParameters` JSDoc), `codebase/backend/src/modules/executions/dto/re-run.dto.ts:18-24`
    (`inputOverride` `@ApiPropertyOptional`), `codebase/backend/src/modules/workflows/workflows.controller.ts:317-325`
    (catch 블록)
  - 상세: 4곳 모두 diff 가 주석/JSDoc/Swagger `description` 문자열에만 걸려 있다. 새로
    문서화된 실제 동작 — 4가지 `reason`→`code` 매핑(`missing_required`/`coerce_failed`/
    `invalid_schema`/`masked_value_resubmitted`), `MASKED_VALUE_RESUBMITTED` 거부 배선,
    `details[]` 봉투 구성 — 은 위에서 재실행한 4개 spec 스위트(80 테스트)가 이미 커버하며
    diff 이후에도 GREEN 임을 직접 확인했다.
  - 제안: 없음.

- **[INFO]** 마지막 커밋(`a578366c7`, Swagger description 236→129자 추가 압축)이 어떤 테스트도
  깨지 않음 — 확인됨
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:19-22`
  - 상세: `ReRunRequestDto`/`re-run.dto`/`inputOverride` 를 직접 import 해 description 문자열을
    단언하는 spec 파일이 저장소에 없다(`grep -rln "re-run.dto\|ReRunRequestDto"
    codebase/backend/src --include="*.spec.ts"` 결과 0건). 서비스/컨트롤러 spec
    (`executions-rerun.service.spec.ts` 등)은 plain object 로 body 를 구성해 검증하므로 이
    필드의 캐비엇 텍스트 변경과 무관하다 — 즉 이번 추가 압축이 회귀시킬 수 있는 테스트가
    애초에 존재하지 않는다. OpenAPI 스냅샷 diff 테스트도 저장소에 없다.
  - 제안: 없음.

- **[INFO]** `masked-reject-callers-guard` 오탐 위험 — 재확인 (guard 소스 직접 대조)
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
    (`importsBaseFn`, `ALLOWED_DIRECT_CALLERS`), `resolve-trigger-parameters.ts:100-123`
  - 상세: base 함수 JSDoc 이 wrapper 이름 `resolveTriggerParametersRejectingMasked` 를
    언급하는데, 가드는 `ts.createSourceFile` 로 파싱한 뒤 `ts.isIdentifier` 노드(+element
    access 문자열 인자)만 판정 대상으로 삼는다 — JSDoc 텍스트는 trivia 라 식별자 노드를
    만들지 않는다. 또한 `resolve-trigger-parameters.ts` 자신은 `export function
    resolveTriggerParameters` **선언부**가 식별자로 잡히는 것을 이미 알고
    `ALLOWED_DIRECT_CALLERS`(가드 소스 32번째 항목)에 등재돼 있다. 재실행한
    `masked-reject-callers.spec.ts` 도 GREEN(위 80 테스트에 포함). 새 위험 없음.
  - 제안: 없음.

- **[INFO]** 이연된 테스트 갭 2건 — 이번 diff 가 만든 새 갭이 아니며 트래커에 계류 중, 재확인
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    의 `findMaskedResubmissions`(직접 단위 테스트 부재), `resolve-trigger-parameters.ts` 의
    `throwIfAny` phase 경계(raw 통과 후 무관 필드 coerce 실패가 resolve 를 선점하는 경로의
    회귀 테스트 부재)
  - 상세: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 착수 조건과 함께
    명시적으로 계류 중이다(각각 "세 번째 소비처가 생기면", "보안 우회가 아니라 UX 엣지"). 이번
    diff 는 두 함수의 로직을 전혀 건드리지 않았으므로 커버리지 상태에 변화가 없다.
  - 제안: 조치 불요(이미 트래킹됨).

- **[INFO]** Swagger description 길이 가이드(`spec/conventions/swagger.md §3`, 50~150자)와
  마커 상수 동기화 모두 자동 검증 수단이 없음 — 트래커에 이미 등재, 재확인
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:19-22`,
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md:825-833`
  - 상세: 이번 라운드의 커밋(`a578366c7`)은 정확히 이 클래스의 문제를 스스로 지적하며
    발생했다 — 직전 라운드가 "예외(응답 필드)" 형식만 맞췄는데 `inputOverride` 는 요청
    필드라 그 예외의 문면 대상이 아니었다는 점을 이번 커밋이 잡아 길이 가이드 안(129자)으로
    들어갔다. 이 길이 규칙·예외 범위 어느 쪽도 lint 규칙이나 테스트로 강제되지 않는다(저장소
    전수 검색 결과 `repo-guards/` 에 swagger 관련 판정 로직 없음) — 이번처럼 사람/AI 리뷰가
    발견해야 한다. 이미 트래커에 "규약 문면이 현실보다 좁다"(`dryRun` 도 초과 상태)로 등재돼
    있어 새 결함은 아니다.
  - 제안: 이번 PR 범위 조치 불요. 향후 이 클래스의 반복 재발(이번이 벌써 두 번째 자체 교정)을
    줄이려면 `description` 길이를 검사하는 경량 정적 스크립트(예: `@ApiPropertyOptional`
    호출의 `description` 리터럴 길이를 AST 로 스캔)를 고려할 만하나, 이는 이 PR 의 스코프를
    넘는 인프라 제안이다.

## 요약

이번 라운드(`20_25_08`)의 신규 변경은 `re-run.dto.ts` Swagger `description` 을 129자로 더
압축한 것 하나뿐이며, 코드 4파일 전체가 실행 로직 변경 0줄인 순수 문서화 diff 라는 이전 세
라운드의 판정과 일치한다. 관련 spec 4개 스위트(`resolve-trigger-parameters.spec.ts`,
`workflows.controller.spec.ts`, `reject-masked-resubmission.spec.ts`,
`masked-reject-callers.spec.ts`, 합계 80 테스트)를 직접 재실행해 전부 GREEN 임을 독립적으로
재확인했고, 이번 압축을 단언하는 테스트가 애초에 존재하지 않아 회귀 위험도 없다.
`masked-reject-callers-guard` 가 JSDoc 의 wrapper 이름 언급으로 오탐하지 않음도 guard 소스
직접 대조 + 캐너리 재실행으로 재확인했다. 남은 테스트/도구 갭(`findMaskedResubmissions` 단위
테스트 부재, `throwIfAny` phase 경계 회귀 테스트 부재, Swagger description 길이·마커 동기화의
자동 강제 수단 부재)은 전부 이 PR 이전부터 있었고 트래커에 사유·착수 조건과 함께 명시적으로
기록돼 있어 이번 diff 의 신규 결함이 아니다. 추가로 작성해야 할 테스트는 없다.

## 위험도

NONE
