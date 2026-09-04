# 요구사항(Requirement) 리뷰 — `QueryExecutionDto.workflowId` 죽은 쿼리 파라미터 제거 (누적 diff)

## 검증 방법

저장소 트리는 뮤테이션하지 않고 `Read`/`Grep`/`Bash`(read-only)로 실제 소스(컨트롤러·서비스·부모
DTO·spec·frontend·e2e)를 대조했다. 추가로 `jest`로 변경된 두 테스트 파일
(`validation.pipe.spec.ts`, `swagger-dto-contract.spec.ts`)을 직접 실행해 통과를 확인했고,
CHANGELOG/가드 JSDoc/plan 문서가 공유하는 정량 주장(`Api*` 필드 1,095개, `@Transform` 동반
17개)을 `grep -rEo` 기반 독립 재계산으로 교차검증했다. 리뷰 대상은 이 diff 가 누적한 37개
파일 전체(핵심 코드 변경 4개 + plan 1개 + 이전 두 리뷰 라운드(`18_34_04`, `18_56_22`) 및
consistency-check(`18_51_26`) 산출물 32개)이며, 뒤의 32개는 이미 커밋된 산출물이라 이번
리뷰는 그 결론이 실제 코드와 여전히 정합하는지를 중점 재검증했다. `git status --short` 로
저장소가 이 세션의 리뷰 산출 디렉터리(`review/code/2026/09/04/19_14_29/`) 외에 클린함을
확인했다 — 뮤테이션 없음.

## 독립 재검증 결과 (교차검증 완료, 전부 일치)

- `executions.controller.ts:91-115` `findByWorkflow` — `@Query() query: QueryExecutionDto` 는
  `workflow/:workflowId` 경로 아래에서만 쓰이며, 이 파일 전체에서 `QueryExecutionDto` 의
  유일한 소비처다(`grep -rn QueryExecutionDto codebase/backend/src`).
- `executions.service.ts:746-756` `findByWorkflow` — 구조분해가 정확히
  `{page, limit, sort, order, status}` 만이고 `query.workflowId` 를 읽지 않음. CHANGELOG/DTO
  JSDoc 의 "서비스가 읽지 않는다" 주장과 일치.
- `spec/2-navigation/14-execution-history.md:345,352-357` — "목록 API 쿼리 파라미터" 표는
  `page/limit/sort/order/status` 만 정의하고 `workflowId` 를 약속한 적이 없음 — 제거가 spec
  이 문서화한 계약을 위반하지 않는다(spec fidelity 위반 없음).
- `codebase/frontend/src/lib/api/executions.ts:87-93,204-209` `ExecutionListParams`/`getByWorkflow`
  — `workflowId` 필드 없음, 경로 파라미터로만 전달. 프런트 미전송 주장과 일치.
- `codebase/backend/src/common/pipes/validation.pipe.ts:29-32` — 전역 `APP_PIPE`
  (`app.module.ts:202`)로 등록된 `CustomValidationPipe` 가 실제로
  `whitelist:true, forbidNonWhitelisted:true` — "미지 쿼리 키 → 400" 주장의 근거가 실재.
- `npx jest src/common/pipes/validation.pipe.spec.ts` → **5/5 pass**(기존 3 + 신규 2). 신규
  `describe('CustomValidationPipe — forbidNonWhitelisted')` 는 영어로 통일돼 있어(직전
  `18_56_22` W2 지적이 실제로 반영됨, 커밋 `22d1ec1ab`) 형제 테스트와의 언어 불일치가
  더 이상 없다. `body.code === 'VALIDATION_ERROR'` 단언도 실재(`18_56_22` INFO#12 반영 확인).
- `npx jest src/repo-guards/__tests__/swagger-dto-contract.spec.ts` → **19/19 pass**, 그중
  `'OpenAPI 선언과 TS 타입이 어긋난 필드가 없다'`(`toEqual([])`)가 실제 src 전체를 스캔해
  통과 — `@Transform` 예외가 실사례 없이도 분기를 안전하게 유지함을 재확인.
- 정량 주장 재계산: `grep -rEo "@ApiProperty(Optional)?\(" src` → **1095**,
  `grep -rEo "@Transform\(" src` → **17** — CHANGELOG·가드 JSDoc·plan 문서 세 곳이 공유하는
  숫자와 **정확히 일치**(grep 은 AST 파서와 카운팅 단위가 다를 수 있어 완전한 등가 증명은
  아니지만, 강한 교차 신호다).
- `plan/in-progress/spec-draft-nullable-notation-followups.md:245-330` — `## 후속` 의 미체크
  항목이 정확히 2개(§5.4 drift 2단계, `idx_schedule_next_run`)이고, 하단 `## 종결 조건` 표
  (`:375-380`)도 동일하게 2개 열림·2개 취소선(종결)으로 일치. 직전 라운드(`18_34_04`
  requirement WARNING — "넷"이 stale)는 숫자를 고치는 대신 **하드코딩 자체를 제거**하는
  방식으로 해소됐고(`:368-373`), 이번 재검증에서 실제로 낡지 않았음을 확인.
- e2e: `workflow-execution.e2e-spec.ts:108-133` 은 `workflowId` 를 쿼리로 보내지 않아 이
  diff 로 깨지지 않음. `workflow-assistant.e2e-spec.ts:65,165` 의 `.query({ workflowId })` 는
  **다른 엔드포인트**(워크플로우 어시스턴트 세션)이며 `QueryExecutionDto` 와 무관 — 오탐 아님을
  직접 대조 확인.
- 저장소 내 committed OpenAPI 스냅샷 없음, `codebase/packages`·`codebase/channel-web-chat`
  전수 grep 결과 `QueryExecutionDto`/`workflowId=` 쿼리 의존 없음 — 코드젠 소비자 부재 주장과
  일치.

## 발견사항

CRITICAL/WARNING 급 신규 결함은 발견되지 않았다. 앞선 두 리뷰 라운드가 제기한 WARNING
(신규 테스트 언어 불일치, plan "넷" stale 서술, 저장소 밖 클라이언트 breaking change)은
모두 이 누적 diff 안에서 실제로 해소된 상태임을 코드/문서 재확인으로 검증했다.

- **[INFO]** 저장소 밖 제3자 클라이언트의 200→400 breaking change 는 관측 범위 밖으로 남아 있다
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts`(전체 파일 컨텍스트,
    클래스 JSDoc) / `CHANGELOG.md`("영향" 절)
  - 상세: 저장소 내부 소비자(서비스·프런트·spec·e2e·OpenAPI 코드젠) 부재는 실측으로 재확인됐으나,
    저장소 밖에서 이 쿼리 파라미터를 계속 보내는 제3자 클라이언트가 있다면 배포 시점에 사전
    경고 없이 400 회귀를 겪는다. CHANGELOG 가 이를 "저장소 안에서 확인한 것"으로 명확히 좁히고
    "배포 시 확인" 문구까지 넣어 둔 것은 정직한 서술이며, 이 저장소가 API 버전 세그먼트를 쓰지
    않는 기존 정책과도 일관되어 이 diff 만의 신규 갭은 아니다. 두 이전 리뷰 라운드가 이미 같은
    결론(병합 가능, 배포 노트 권고)에 도달했다.
  - 제안: 코드 변경 불요. 이미 CHANGELOG 에 반영된 "배포 시 확인" 경고로 충분하다고 판단.

## 요약

핵심 변경(개념적으로 성립하지 않는 `QueryExecutionDto.workflowId` 쿼리 필터 제거)은 기능적으로
완전하고 안전하다 — 컨트롤러·서비스·부모 DTO·spec·frontend·e2e 전수 교차검증에서 잔존 참조나
파손되는 소비처가 없었고, 신규 회귀 테스트(`forbidNonWhitelisted` 거절 단언 + 대조군)를 직접
실행해 5/5 통과, 관련 가드 테스트도 19/19 통과를 확인했다. spec(`14-execution-history.md:345`)
은 애초에 이 필드를 약속한 적이 없어 spec-fidelity 위반이 없으며, CHANGELOG·DTO JSDoc·가드
JSDoc·plan 문서 네 곳이 공유하는 정량 주장(1,095/17/0)은 독립 grep 재계산으로 강하게 뒷받침된다.
앞선 두 리뷰 라운드가 지적한 WARNING(테스트 언어 불일치, plan "넷" stale 서술)은 이 누적 diff
안에서 실제로 반영·해소된 상태임을 재확인했다 — 새로 열린 항목 없음. 유일하게 남는 것은 저장소
밖 제3자 클라이언트에 대한 관측 불가능성(INFO, 비차단)뿐이다.

## 위험도

LOW
