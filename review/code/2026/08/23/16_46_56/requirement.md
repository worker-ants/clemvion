# 요구사항(Requirement) 충족 리뷰 — assistant-mask-leak

## 조사 방법

프롬프트에 전문이 잘린 4개 코드 파일(`explore-tools.service.ts`·`.spec.ts`)과 4개 spec 문서
(`4-ai-assistant.md`·`14-external-interaction-api.md`·`_product-overview.md`·`egress-masking.md`)
를 `Read`로 직접 열어 diff 와 대조했다. `mask-sensitive-fields.util.ts`/`.spec.ts`는 프롬프트에
전문이 포함돼 있어 그대로 사용했다. 실제로 `codebase/backend`에서 대상 두 spec 파일
(`explore-tools.service.spec.ts`, `mask-sensitive-fields.util.spec.ts`)을 `jest`로 실행해 36/36
GREEN을 확인했고, plan이 주장한 M2 뮤테이션(`DEFAULT_SENSITIVE_KEYS`에서 token 계열 8개 제거)을
직접 재현해 유틸 레벨 캐너리 8건이 RED로 떨어지는 것과 `explore-tools.service.spec.ts`는 GREEN을
유지하는 것(겹친 값-축 레이어가 방어를 대신함)을 독립적으로 재확인했다. 뮤테이션은 커밋된
워크트리를 대상으로 `cp` 백업 후 되돌렸으며(`git checkout`/`reset` 미사용), 되돌린 뒤
`git status --porcelain`으로 원상복구를 확인했다.

## 발견사항

이번 라운드에서 CRITICAL/WARNING 급 결함을 찾지 못했다. 상세 근거는 아래와 같다.

- **[INFO]** 기능 완전성·spec fidelity 모두 line-level 로 일치 확인됨
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:97-112`
    (`redactAssistantFields`), `:510`, `:528` (두 소비처)
  - 상세: `redactAssistantFields`의 `deepRedactSecrets(maskSensitiveFields(v))` 합성 순서(키
    먼저, 값 나중)가 JSDoc 주석이 서술하는 그대로 동작함을 실행 결과로 확인했다 — apiKey/
    Authorization/token/password/clientSecret/context.apiKey 6개 기존 단언이 전부 `'***'`로
    바뀐 값과 실제 실행 결과가 일치했고(`npx jest` GREEN), 신설된 두 캐너리(값 축:
    `error.message`의 `Bearer …` 및 URI userinfo 마스킹, 키 축: `csrf_token`/`auth_token`/
    `session_token`/`csrfToken` 계열)도 그대로 통과했다. 이 두 소비처(`toNodeExecutionEnvelope`,
    `toExecutionEnvelope`) 외에 `inputData`/`outputData`/`error`를 노출하는 지점이 전체 파일에
    더 없음을 확인했다(파일 전체 Read, grep 대조).
  - `spec/3-workflow-editor/4-ai-assistant.md:259-266`(§4.1.1 본문 + scoping/키축/잔여갭 3개
    caveat 블록), 같은 파일 `:1432`(확정된 결정 사항 표, 취소선+대체 서술), `spec/5-system/
    14-external-interaction-api.md:1646-1668`(§R17 "잔여 ③" flip + 취소선 보존), `spec/
    2-navigation/_product-overview.md:265`(EH-NAV-04 구현 상태 갱신), `spec/conventions/
    egress-masking.md`(§1 표 2행 + `code:` frontmatter 2건 + §3 실례 기록) — 6곳 전부 코드
    구현과 정확히 일치하는 서술로 갱신돼 있었다(직접 Read로 대조). 2차 `--spec` consistency
    check(`16_21_45`)가 지적한 WARNING 5건(EH-NAV-04 과소서술·scoping 누락·`:1429` 결정 메모
    표 stale·egress-masking 표 미등재·트래커 W1이 자매 값 축을 삼킬 위험)이 전부 해소된
    상태로 반영돼 있음을 각 위치에서 확인했다.
  - `spec/conventions/egress-masking.md`의 `code:` frontmatter에 `explore-tools.service.ts`·
    `mask-sensitive-fields.util.ts` 두 파일이 추가돼 있고, `handler-output.adapter.ts`(자매
    표면)는 `maskSensitiveFields(r.config ?? {})`를 기본 인자(`DEFAULT_SENSITIVE_KEYS`)로
    호출하므로 이번 PR의 token 계열 8개 확장을 **코드 변경 없이** 자동으로 상속함을
    grep으로 확인했다 — plan이 "자매 표면은 키 축만 자동으로 넓어진다"고 기술한 내용과
    일치한다.
  - 제안: 없음(정보성 확인).

- **[INFO]** 엣지 케이스·에러 시나리오는 기존 스위트가 이미 포괄 — 이번 diff가 깨뜨리지 않음
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts` 전체
    (`null`/`undefined`/primitive 미throw, 순환 참조 `[Circular]`, 4자 이하 값 `'****'`,
    비-string 값 `'****'`, 원본 비-mutation)
  - 상세: 이 diff는 `DEFAULT_SENSITIVE_KEYS`에 리터럴 8개를 추가하고 대소문자 케이스는
    `.map(k => k.toLowerCase())`로 정규화되므로 기존 엣지 케이스 동작에 영향이 없다.
    `getExecutionDetails`/`getWorkflowExecutions`의 UUID 검증·workspace/scope 경계·running/
    waiting 부분 타임라인·2-depth 자손 힌트 등 이 파일의 나머지 동작도 diff 범위 밖이며
    관련 테스트가 그대로 GREEN이다.
  - 제안: 없음.

- **[INFO]** 자매 표면 값 축 잔여는 의도적으로 열어둔 상태이며 추적됨(범위 밖 처리가 정당)
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:237-249` (신규 미체크
    항목), `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:33-38`
  - 상세: `handler-output.adapter.ts`는 여전히 `maskSensitiveFields`만 걸고 `deepRedactSecrets`
    를 겹치지 않는다 — plan이 "그 값은 DB 저장·WS emit·표현식 echo로 흐르므로 값 축을 겹치면
    정상 워크플로를 깨뜨릴 위험이 있어 별건으로 분리했다"고 명시적으로 근거를 남기고 별도
    체크박스로 등재했다. 트래커 자신이 과거 지적한 "결합 항목을 한 체크박스로 닫으면 나머지가
    조용히 사라진다" 패턴을 피하려는 조치로 판단되며, 이번 PR의 범위(workflow-assistant LLM
    도구)를 벗어나지 않는다.
  - 제안: 없음(이미 트래커에 별도 항목으로 등재돼 있어 후속 추적 가능).

## 요약

`redactAssistantFields`가 `maskSensitiveFields`(키 축) 위에 `deepRedactSecrets`(값 축)를
올바른 순서로 중첩해 `explore-tools.service.ts`의 두 노출 지점(`toNodeExecutionEnvelope`,
`toExecutionEnvelope`) 모두를 방어하며, 이는 JSDoc·plan·spec이 서술하는 의도와 실제 실행
결과가 일치한다(직접 `jest` 실행 및 M2 뮤테이션 재현으로 검증). `DEFAULT_SENSITIVE_KEYS`
token 계열 8개 확장은 자매 표면(`handler-output.adapter.ts`)에도 코드 변경 없이 자동
상속되고, 그 자매 표면의 남은 값 축 갭은 의도적으로 분리해 별도 트래커 항목으로 정직하게
등재돼 있다. 무엇보다 이 PR은 spec SoT 두 문서(§4.1.1 `ED-AI-37`, EIA §R17 "잔여 ③")를
뒤집는 결정이었음에도, 1차 `--impl-prep` consistency check이 CRITICAL로 막았고, 같은 PR
안에서 planner 턴을 선행시켜 spec 본문 6곳(3개 문서 + egress-masking convention)을 코드와
동시에 동기화한 뒤 2차 `--spec` check을 BLOCK:NO로 통과시켰다 — spec-impl drift가 실시간으로
발생할 뻔한 지점을 정확히 프로세스로 막은 사례다. 코드·테스트·spec 세 축이 line-level로
서로 어긋나는 지점을 찾지 못했다.

## 위험도
NONE
