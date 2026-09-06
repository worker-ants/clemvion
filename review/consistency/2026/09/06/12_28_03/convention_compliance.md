# 정식 규약 준수 검토 — convention_compliance

> 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
> `spec/5-system/` 자체의 스코프 델타는 0파일이다(정상 — 코드 전용 PR). 본 검토는 실제
> 구현 diff(`codebase/backend/**` 12파일 / 1,396+10줄, `User` 엔티티 컬럼 노출 방어 —
> `workflow-versions.service.ts` 투영 수정, 정적 AST 가드 2종, 런타임 이름 기반 가드,
> 관련 e2e 3건)가 `spec/conventions/**`(특히 `swagger.md`) 를 따르는지를 대상으로 한다.
> 프롬프트 번들이 예산 절단으로 `<git diff>`·`spec/conventions/**` 본문을 전부 생략했으므로
> (274개 conventions 파일 0건 적재), `git -C <워킹트리> diff origin/main...HEAD --
> 'codebase/**' 'spec/**' 'plan/**'` 와 관련 `spec/conventions/*.md`·`spec/5-system/
> 2-api-convention.md` 를 절대경로로 직접 읽어 실측했다.
>
> 이 스코프는 이미 4라운드(`10_13_23`→`10_53_50`→`11_27_54`→`11_55_37`) convention_compliance
> 검토를 거쳤다. 본 라운드는 그 사이 새로 반영된 커밋(`96d3856a9`~`72c0bcc13`)의 diff를
> 재실측해 이전 지적의 처분 여부와 잔여 항목의 유효성을 재확인했다.

## 발견사항

- **[WARNING]** `User` 엔티티 노출 방어 신규 검출 2축이 `swagger.md`/`2-api-convention.md`
  의 "두 검증자" 등재에서 여전히 빠져 있다 (재확인 — 이미 추적됨, 새 결함 아님)
  - target 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`
    (+ `.spec.ts`), `codebase/backend/src/shared/testing/user-secret-absence.ts` (+ `.spec.ts`)
  - 위반 규약: [`spec/conventions/swagger.md` §5-1](spec/conventions/swagger.md#5-1-응답-dto-위치)
    의 콜아웃("그 축은 런타임 짝인 `response-contract.ts` 가 문다 … 두 검증자의 경계는
    API 규약 §5.4 검증 층이 소유한다")과 [`spec/5-system/2-api-convention.md` §5.4
    "검증 층"](spec/5-system/2-api-convention.md#검증-층--이-규칙을-무엇이-강제하는가) 표
    ("그 자리를 **두 검증자**가 나눠 맡는다") — 실측(현재 워킹트리 재확인): 두 문서
    frontmatter `code:` 어디에도 `user-entity-exposure-guard*`·`user-secret-absence*` 가
    없고, §5.4 표는 여전히 `swagger-dto-contract-guard.ts`/`response-contract.ts` 두 줄뿐이다.
  - 상세: 이번 PR 은 `User` 엔티티 노출을 막는 제3의 축(구조 축, TypeORM 쿼리 정적 스캔)과
    제4의 축(이름 축, 응답 바디 런타임 부재 단언)을 신설했는데 두 spec 문서의 "정확히 두
    검증자" 서술·등재가 갱신되지 않았다.
  - **이미 추적됨**: `plan/in-progress/spec-draft-nullable-notation-followups.md` §후속에
    "신규 검출 2축을 §5.4 「검증 층」과 `code:` 에 등재" 항목(planner, 2026-09-06 등재)이
    미체크(`[ ]`) 상태로 존재하며, "개수 고정 문구를 다시 쓰지 말 것"까지 선행 지침으로
    적혀 있다. `spec/` 쓰기는 `project-planner` 소관이라 developer 가 직접 고치지 않은 것은
    워크플로상 올바르다.
  - 제안: 이번 PR을 막을 사유 아님. 다음 `project-planner` 턴에서 두 문서를 갱신할 때
    plan이 이미 지적한 대로 "N개 검증자" 같은 개수 고정 문구 대신 표로 나열해 다음 축이
    추가돼도 문구가 낡지 않게 할 것.

- **[INFO]** `User` 민감 7컬럼 응답 비노출 불변식의 SoT 가 여전히 코드에만 있다 (재확인 —
  이미 추적됨)
  - target 위치: `codebase/backend/src/shared/testing/user-secret-absence.ts`
    `USER_SECRET_KEYS` 배열
  - 관련 규약: [`spec/conventions/secret-store.md` §1.1`](spec/conventions/secret-store.md#11-비대상-필드도-응답-바디에는-나가지-않는다)
    은 Trigger·AuthConfig 계열에는 "비대상 필드도 응답 바디에는 나가지 않는다"를 규범
    문장으로 세웠으나(실측 재확인: 문구 그대로 존재), `User` 엔티티 7컬럼에는 대응 절이 없다.
  - **이미 추적됨**: 같은 plan 문서에 "`User` 민감 7컬럼의 응답 노출 금지를 규약 문장으로"
    항목이 미체크 상태로 별도 등재돼 있음을 재확인.
  - 제안: 다음 planner 턴에서 `spec/1-data-model.md §2.1` 또는 `secret-store.md §1.1` 에
    7컬럼 비노출을 규범 문장으로 명시하고 두 가드를 그 절의 `code:`/본문 링크로 연결.

## 정합성이 확인된 부분 (참고 — 전 라운드 대비 변화)

- **직전 라운드(`11_55_37`) WARNING #1 해소 확인**: `WorkspaceMemberDto.joinedAt` 의 JSDoc이
  내부 서사(§5.4 근거·실측 날짜·서비스 내부 동작)를 담고 있던 문제를 커밋 `72c0bcc13` 가
  고쳤다. 현재 코드는 `/** 멤버가 워크스페이스에 합류한 시각. 상시 존재하며, 값이 없으면
  `null`. */` 로 JSDoc을 최소화하고, 근거·실측·리뷰 인용은 바로 아래 `//` 주석으로
  옮겼다 — `swagger.md` §3("JSDoc은 공개 OpenAPI로 나간다 — 내부 서사를 담지 않는다")과
  `review-citations.md` §3(DTO JSDoc에는 리뷰 인용을 쓰지 않는다) 양쪽을 실측대로 준수.
- 같은 커밋이 전수 grep으로 찾아낸 **동종 위반 2곳**(`ScheduleTriggerWorkflowRefDto`·
  `TriggerWorkflowRefDto` 클래스 JSDoc, `#1291` 기원, 이 브랜치 diff 밖)은 손대지 않고
  plan에 별도 미체크 항목으로 등재했다 — `review-citations.md` §4("기존 인용은 소급 정리
  대상 아님")와 부합하는 처신이며, 착수 전 "클래스 JSDoc도 대상인가"를 §3 표가
  명시하지 않는다는 선행 질문까지 남겨 두어 재발을 막는다.
- 신규 리뷰 인용(예: `` `review/code/2026/09/06/10_13_22` Critical 1 ``, `` `review/code/
  2026/09/06/11_55_36` W1 ``)은 전부 전체 경로+날짜 형태로 `review-citations.md` §2의
  "권장" 형태를 따른다. bare `hh_mm_ss` 형태 없음.
  guard/spec 파일(`.ts`, DTO·컨트롤러 아님)의 `/** */` JSDoc에 인용을 담은 것도 §3
  예외(DTO·컨트롤러 한정)에 해당하지 않으므로 정상.
  - 예외: `review/consistency/...` 형태(파일명이 아니라 세션 디렉터리 경로)도 전체
    경로+날짜 요건을 충족한다.
- `user-entity-exposure-guard.ts` 는 여전히 "파서 순수 로직 vs 소비 spec 분리" 패턴을
  형제 가드(`nullable-type-lie-cast-guard.ts`·`swagger-dto-contract-guard.ts`)와 동일하게
  따르고, `*-guard.ts` / `*.spec.ts` 명명도 일치.
- `WorkflowVersionsService` 의 `CREATOR_PROJECTION` 상수화 + `WorkflowVersionCreatorDto`의
  OpenAPI 스키마와 대조하는 테스트는 `swagger.md` §5-1 "엔티티를 그대로 노출하지 말 것"의
  실질 시행 의도와 부합. 신규 e2e 3건(`audit-logs`·`workflow-crud`·`workspace-rbac`)이
  `assertMatchesContract`(선언 대조)·`expectNoUserSecrets`(이름 대조) 두 축을 함께 거는
  것도 §5.4 검증 층 표가 말하는 "서로 다른 것을 잡는 두 축" 구도와 일치.
- 신규 spec/조약 변경(`spec/**` diff 0파일)이 없어 명명·문서 3섹션 구조(Overview/본문/
  Rationale)·`0-` prefix·`_product-overview.md` 등 문서 구조 규약 위반 후보 자체가 없음.

## 요약

이번 diff는 4라운드에 걸친 반복 리뷰-수정 사이클을 거치며 `swagger.md`(§3 JSDoc/§5-1
응답 DTO)·`review-citations.md`(§2 인용 형태/§3 적용 범위)를 실측대로 준수하는 상태로
수렴했다. 직전 라운드가 지적한 유일한 신규 결함(`joinedAt` JSDoc 내부 서사 유출)은
`72c0bcc13` 커밋으로 정확히 처방대로(narrative를 `//`로 이동) 해소됐고, 그 과정에서
전수 grep으로 찾은 동종 사례 2건은 diff 밖이라 정당하게 plan에만 등재했다. 남은 두 항목
(신규 검출 2축의 conventions 등재 누락, `USER_SECRET_KEYS`의 spec 문장화 부재)은 모두
`project-planner` 소관인 `spec/**` 쓰기가 필요한 사후 작업으로 이미 plan에 정확히
추적되고 있어, 이번 PR 자체의 새로운 미등재 위반은 없다.

## 위험도

LOW
