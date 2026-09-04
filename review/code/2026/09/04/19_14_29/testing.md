# 테스트(Testing) 리뷰 — `QueryExecutionDto.workflowId` 제거 (3라운드 누적분)

## 범위 요약

실질 코드 변경은 `QueryExecutionDto.workflowId`(죽은 쿼리 파라미터) 제거 1건이며, 이 필드가
전역 `forbidNonWhitelisted: true` 때문에 만드는 200→400 breaking 동작을 고정하는 테스트가
`codebase/backend/src/common/pipes/validation.pipe.spec.ts` 에 신규 추가됐다. 나머지 파일
(`CHANGELOG.md`, `swagger-dto-contract-guard.ts` JSDoc, plan 트래커, `review/**` 산출물)은
문서·주석·리포트이며 이번 라운드에서 새로 만든 테스트 갭은 없다. 이 diff 는 앞선 두 리뷰
라운드(`18_34_04` WARNING#2, `18_56_22` INFO 2건)의 지적을 순차 반영한 3번째 커밋
(`22d1ec1ab`)까지 포함한다.

## 검증 절차 (읽기 전용 + scratch 뮤테이션, 저장소 트리 무변경)

- `npx jest src/common/pipes/validation.pipe.spec.ts` → **5 passed**(직접 실행, 재구성 아님).
- `npx jest src/repo-guards/__tests__/swagger-dto-contract.spec.ts` → **19 passed** — `[대조군]
  @Transform 예외` 픽스처가 합성 클래스 문자열이라 실제 `workflowId` 필드 삭제와 무관하게
  그대로 GREEN.
- **뮤테이션 재검증(독립 재현)**: `mktemp -d` 로 받은 저장소 밖 scratch 디렉터리에
  `codebase/backend` 를 통째로 `cp` 하고, 그 사본에서만 `validation.pipe.ts` 의
  `forbidNonWhitelisted: true → false` 로 치환 후 재실행 → **1 failed(거절 단언) / 4 passed**.
  `RESOLUTION.md`/커밋 메시지가 주장한 "RED 1 / 4 pass" 와 정확히 일치. 저장소 원본은
  손대지 않았고(`git status --short` 로 확인, 결과: 이 리뷰의 `review/code/.../19_14_29/`
  산출물 외 변경 없음), 뮤턴트 사본은 scratch 에만 존재해 원복 불필요.
- `grep -rn QueryExecutionDto codebase/backend/{src,test}` — 이 DTO 를 참조하는 곳은
  `executions.service.ts`(주입)·`executions.controller.ts`(`@Query()`) 뿐, 어떤 `*.spec.ts`/
  `*.e2e-spec.ts` 도 `workflowId` 쿼리 필드를 참조하지 않음을 확인 — 필드 제거로 깨지는
  기존 테스트 없음(회귀 없음).
- `validation.pipe.ts`(`transform`) 를 읽어 `ArgumentMetadata.type` 이 실제로 **미사용**임을
  확인 — 신규 테스트의 `type: 'query' as const` 는 실제 라우팅 경로를 타지 않고 장식적
  의미만 있다(아래 INFO 참고).

## 발견사항

- **[INFO]** 새 테스트는 `CustomValidationPipe.transform()` 을 직접 호출하는 파이프 레벨
  유닛 테스트이고, `ArgumentMetadata.type: 'query'` 는 구현이 실제로 사용하지 않는 필드다
  (`transform(value, { metatype })` — `type` 은 구조분해되지 않음). 즉 이 테스트는
  "`GET /api/executions/workflow/:workflowId?workflowId=...` 요청이 실제로 400 을 낸다"는
  종단(엔드투엔드) 사실이 아니라 "`forbidNonWhitelisted: true` 인 파이프에 미선언 키를
  넣으면 400" 이라는 더 일반적인 사실만 고정한다. `APP_PIPE` 전역 등록(`app.module.ts`)과
  컨트롤러의 `@Query() query: QueryExecutionDto` 배선은 별도로 코드 리딩으로만 확인됐고
  자동화 테스트로 고정되지 않았다.
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.spec.ts` (신규
    `describe('CustomValidationPipe — forbidNonWhitelisted', …)` 블록)
  - 상세: 앞선 두 리뷰 라운드(`18_34_04` W2, `18_56_22` INFO)가 이미 이 트레이드오프를
    지적·수용했고(엔드포인트 전용 e2e 보다 전역 파이프 유닛 테스트가 오히려 넓은 회귀
    커버리지), 이번 라운드에서 그 판단을 재검토할 새 근거는 없다. 3라운드 연속 같은
    잔여 갭을 반복 지적하는 대신 **격하 유지**가 맞다고 판단했다 — 이미 "병합 가능"
    판정이 두 번 났고 이번 diff 가 그 판단의 근거를 바꾸지 않았다.
  - 제안: 조치 불요(INFO, 필수 아님). 후속으로 종단 보증이 필요해지면
    `workflow-execution.e2e-spec.ts` 에 `?workflowId=<uuid>` → 400 negative 케이스 1건.

- **[INFO]** `narrowMeta` 를 `{ metatype: NarrowDto, type: 'query' as const }` 상수로 뽑아
  두 `it` 이 공유한다 — `pipe.transform()` 은 인자를 변형하지 않아(순수 변환) 격리는
  안전하다. 다만 첫 번째 테스트가 `narrowMeta` 객체 자체를 mutate 하는 코드로 바뀌면
  두 번째 테스트가 오염될 잠재 여지가 있다(현재는 아님). 조치 불요, 참고만.

- **[INFO]** 회귀 테스트 유효성 재확인 — 위 검증 절차에서 실행한 두 스위트(24 tests)
  모두 GREEN, `QueryExecutionDto` 참조 grep 결과 기존 테스트 무영향 확인. 이번 diff 가
  기존 테스트를 stale 하게 만든 곳은 없다.

CRITICAL/WARNING 없음. 이전 라운드가 지적한 핵심 갭("200→400 breaking 동작을 고정하는
테스트 부재")은 이번 diff 로 실질적으로 메워졌고, 독립 재실행으로 뮤테이션 결과가
문서 주장과 정확히 일치함을 확인했다.

## 요약

핵심 변경은 죽은 쿼리 파라미터 제거이고, 그 부작용(전역 `forbidNonWhitelisted` 로 인한
200→400)을 고정하는 신규 유닛 테스트 쌍(`validation.pipe.spec.ts`)이 이번 diff 에 포함돼
있다. 직접 재실행으로 5개 테스트 GREEN, scratch 사본 뮤테이션으로 "거절 단언만 RED(1),
나머지 4 GREEN" 이 정확히 재현됨을 저장소를 건드리지 않고 확인했다. `QueryExecutionDto`
를 참조하는 기존 테스트가 전혀 없어 회귀도 없다. 남은 잔여 갭은 "엔드포인트 종단(HTTP
라우팅 포함) negative e2e 부재" 하나뿐이며, 이는 두 차례 리뷰에서 이미 INFO 로 격하되고
합리적 트레이드오프로 수용된 사안이라 이번 라운드에서도 격상할 근거가 없다.

## 위험도

LOW
