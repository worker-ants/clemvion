# 요구사항(Requirement) 리뷰 — 이전 라운드(`18_34_04`) WARNING 3건에 대한 후속 조치 검증

## 배경

이번 diff 는 새 기능이 아니라 **이전 code-review 라운드(`review/code/2026/09/04/18_34_04`)가 낸
WARNING 3건(W1 api_contract/side_effect · W2 testing · W3 requirement)에 대한 RESOLUTION**이다.
실질 코드 변경은 여전히 `QueryExecutionDto.workflowId`(죽은 쿼리 파라미터) 제거이고, 이번 diff 가
추가하는 것은 (a) `validation.pipe.spec.ts` 회귀 테스트, (b) CHANGELOG 문구 축소, (c) plan 종결조건
문장 재작성, (d) 두 리뷰 라운드(`18_34_04` code-review, `18_51_26` consistency-check)의 산출물
커밋이다. 대부분의 리뷰 대상 파일(파일 6~25)은 새 코드가 아니라 **과거 리뷰 라운드의 결과물이
`review/**`에 커밋된 것**이므로, 그 자체는 요구사항 충족 여부의 검증 대상이 아니라 검증에 참고할
1차 자료로 취급했다.

## 검증 방법 (저장소 뮤테이션 없음 원복 완료)

`Read`/`Grep`/`Bash`(read-only)로 diff 파일과 소비처(서비스·컨트롤러·spec·plan)를 대조했고, RESOLUTION.md
가 주장하는 뮤테이션 결과(`forbidNonWhitelisted: true → false` 시 RED 1 / GREEN 4)를 **직접 재현**했다:

1. `codebase/backend/src/common/pipes/validation.pipe.ts` 를 스크래치 디렉터리(`/private/tmp/claude-501/.../scratchpad/validation.pipe.ts.orig`)에 먼저 백업.
2. `sed -i` 로 `forbidNonWhitelisted: true` → `false` 로 치환 후 `npx jest src/common/pipes/validation.pipe.spec.ts` 실행 → **정확히 RED 1 / GREEN 4** (RESOLUTION.md 주장과 일치).
3. `cp` 로 즉시 원복 후 재실행 → **GREEN 5/5**. `diff` 로 바이트 동일함을 확인. `git status --short` 최종 확인 — 저장소에 잔여 변경 없음(내 세션 리뷰 디렉터리만 untracked).

추가로 `findByWorkflow`(`executions.service.ts:746-757`), `spec/2-navigation/14-execution-history.md:335-357`,
`app.module.ts:202`(`APP_PIPE` 로 `CustomValidationPipe` 전역 등록 확인), `validation.pipe.ts:75-78`
(`toValidate` — `type` 필드(`query`/`body`)는 파이프 로직에서 전혀 분기하지 않으므로 신규 테스트가
`type: 'query'` 로 못박아도 실제 파이프 동작을 정확히 대표함)를 직접 열어 diff·CHANGELOG·plan 의
모든 정량 주장을 재확인했다 — 전부 일치했다.

## 발견사항

### [INFO] W1/W2/W3 세 WARNING 모두 실측 검증상 완전히 해소됨

- 위치: `codebase/backend/src/common/pipes/validation.pipe.spec.ts:84-108`(W2), `CHANGELOG.md:14-24`(W1),
  `plan/in-progress/spec-draft-nullable-notation-followups.md:368-379`(W3) — 전부 게이트 기준.
- 상세:
  - **W2(testing)**: `18_34_04` testing.md 가 "이 breaking 동작(200→400)을 고정하는 자동화 테스트가
    없다"고 지적하며 "e2e negative case 추가, **또는** `CustomValidationPipe` whitelist 거부 유닛
    테스트 추가"를 제안했다. 이번 diff 는 후자를 택했고, 위 재현으로 그 테스트가 실제로 `forbidNonWhitelisted`
    축을 물고 있음을 직접 확인했다 — 공허한 테스트(vacuous test)가 아니다.
  - **W3(requirement/plan)**: "열려 있는 것은 넷"이라는 하드코딩 문장이 이 diff 로 다시 어긋난다는
    지적에 대해, 숫자를 고치는 대신 **문장 자체를 제거**하고 "`## 후속` 의 미체크 체크박스가 단일
    진실"이라는 캐비엇으로 바꿨다. `awk`로 `## 후속` 섹션의 `- [ ]` 개수를 직접 세어 **2개**임을,
    하단 추적 표도 정확히 2행만 미종결임을 확인했다 — 재발 방지까지 포함한 근본 수정(항목을 닫을
    때마다 숫자를 별도로 갱신해야 하는 구조적 원인 자체를 제거).
  - **W1(api_contract/side_effect)**: "저장소 밖 클라이언트는 관측 범위 밖"이라는 caveat 이 CHANGELOG
    에 실제로 추가됐고(`> **이것은 "저장소 안에서 미발견" 이지 "소비자 부재 확인" 이 아니다.**`),
    "⚠️ 배포 시 확인" 문구도 확인했다.
- 제안: 없음 — 세 항목 모두 조치 완료로 판단.

### [INFO] 핵심 코드 변경(`QueryExecutionDto.workflowId` 제거)은 spec 본문과 line-level 로 일치

- 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` 전체(게이트 1-39) vs
  `spec/2-navigation/14-execution-history.md:345`("목록 API 쿼리 파라미터" 표, `page`/`limit`/`sort`/`order`/`status` 5개만 정의).
- 상세: spec 본문을 직접 열어 대조한 결과 diff 의 JSDoc 인용이 정확했다 — `workflowId` 는 spec 이
  약속한 적이 없는 필드였고, `findByWorkflow`(`executions.service.ts:750-756`)도 그 값을 구조분해하지
  않는다(직접 확인). 즉 이 제거는 spec-drift 도, code-drift 도 아니라 **이미 존재하던 code>spec 여분
  표면을 제거해 spec 과 더 가깝게 정렬**시킨 케이스다. spec 문서 자체를 수정할 필요도 없다(양쪽 다
  옳았고 코드만 넓었던 경우).
- 제안: 없음.

### [INFO] `type: 'query'` 메타데이터는 파이프 로직에서 실제로 소비되지 않는다 — 테스트 대표성엔 문제 없음

- 위치: `codebase/backend/src/common/pipes/validation.pipe.spec.ts:96`(신규 테스트의 `{ metatype: NarrowDto, type: 'query' as const }`) vs `codebase/backend/src/common/pipes/validation.pipe.ts:18-42`(`transform` 구현 — `type` 파라미터 미사용).
- 상세: `CustomValidationPipe.transform` 은 `ArgumentMetadata` 에서 `metatype` 만 구조분해하고 `type`
  (`body`/`query`/`param` 등)은 전혀 읽지 않는다 — 검증 동작이 query/body 구분 없이 동일하게 적용된다.
  따라서 신규 테스트가 `type: 'query'` 로 표기해도 실제로는 `body` 타입으로 돌려도 결과가 같다.
  이는 **테스트가 거짓으로 대표성을 주장하는 결함이 아니다** — 실제 소스가 그렇게 설계돼 있어(단일
  전역 파이프, type-무관 whitelist), 신규 테스트가 `workflowId` 쿼리 시나리오를 정확히 대표한다.
- 제안: 없음 (확인용 기록).

CRITICAL/WARNING 은 발견되지 않았다.

## 요약

이번 diff 는 직전 요구사항 리뷰(`18_34_04`)가 낸 WARNING 3건(테스트 부재·plan stale 서술·CHANGELOG
관측범위 모호성)에 대한 조치이며, 세 항목 모두 코드/문서를 직접 열람하고 특히 W2 는 **뮤테이션을
독립 재현**(`forbidNonWhitelisted: true→false` → RED 1/GREEN 4, 원복 후 GREEN 5/5, `git status`
클린 확인)해 실제로 해소됐음을 확인했다. 핵심 코드 변경(`QueryExecutionDto.workflowId` 제거)은
`findByWorkflow` 서비스·spec 본문(`14-execution-history.md:345`)과 line-level 로 정확히 정렬되며,
spec 위반이나 spec-drift 는 없다. 새로 발견된 결함은 없다.

## 위험도

NONE
