# 변경 범위(Scope) 리뷰 — patch-body-followups

## 검증 방법

- `git diff --stat origin/main...HEAD` 로 실제 변경 파일 21개 전수를 프롬프트의 "리뷰 대상 파일" 16~21개 목록과 대조 — 일치 확인.
- HEAD(`ea1fd0cba`) 기준. 저장소 트리에 쓰기/뮤테이션 없음 — 읽기 전용으로 진행(`git diff --stat` 만 실행).

## 발견사항

- **[INFO]** `nodes.service.spec.ts` 의 신규 단위 캐너리가 plan §방향 항목 3(노드 `description` 캐너리)이 명시한 필드보다 넓게, `containerId` 까지 같은 테스트에서 함께 단언한다.
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.spec.ts:230-246`(diff 게이트 기준)
  - 상세: plan(`plan/in-progress/patch-body-followups.md` §방향 항목 3)은 "노드 `description` · 인증 설정 `ipWhitelist` 에 «명시적 null 은 로드한 값을 지운다»" 라고만 적었는데, 실제 추가된 테스트는 `Object.assign(existing, { description: 'memo', containerId: 'box-1' })` 로 기존 값을 세팅하고 `description: null, containerId: null` 을 함께 PATCH 해 `toMatchObject({ description: null, containerId: null })` 로 두 필드를 한 번에 검증한다. `containerId` 는 이번 PR 이 건드리지 않은 기존 nullable 필드라 회귀 위험은 없고 코드 변경도 수반하지 않지만, plan 문서가 선언한 캐너리 범위보다 테스트 자산이 한 단계 넓다.
  - 제안: 실질적 해는 아니므로 우선순위는 낮다. 굳이 정리한다면 `containerId` 단언을 별도 `it` 로 분리하거나, plan §방향 항목 3 문구에 "containerId 도 같은 테스트에서 함께 고정" 한 줄을 보태 문서-테스트 정합을 맞추면 된다.

## 범위 정합성 확인 (문제 없음, 근거로 기록)

- **DTO 변경 3건**(`UpdateWorkflowDto.description`, `UpdateNodeDto.description`, `UpdateAuthConfigDto.ipWhitelist`) 은 `nullable: true` + `T | null` 로만 바뀌었고, 다른 필드·데코레이터·엔드포인트는 건드리지 않았다 — plan §방향 항목 1과 정확히 일치.
- **`omit-undefined.ts`** 변경은 JSDoc 4줄 추가뿐 — 함수 시그니처·로직·`export` 표면 무변경. plan §방향 항목 4(헬퍼 JSDoc) 그대로.
- **테스트 추가 5건**(`auth-configs.service.spec.ts`, `auth-config-ip-whitelist.dto.spec.ts`, `node-dto-validation.spec.ts`, `nodes.service.spec.ts`, `workflow-dto-validation.spec.ts`, `patch-partial-body.e2e-spec.ts`) 은 전부 이번 세 필드의 null 처리·OpenAPI 선언을 검증하는 신규 `it`/`describe` 추가이며, 기존 테스트 본문·assertion 은 일절 수정되지 않았다(순수 append). 신규 import(`contractForDto`)는 세 파일 모두 새 테스트에서 실제로 쓰인다 — 미사용 임포트 없음.
- **CHANGELOG.md** 항목 1건은 이번 세 필드의 OpenAPI 변경만 서술 — 다른 절 재정렬·문구 수정 없음.
- **plan 신설/수정 2건**: `plan/in-progress/patch-body-followups.md` 신설(프로젝트 관례상 작업 plan 필수)과 `spec-draft-nullable-notation-followups.md` 의 트래커 항목 좁히기(원문 취소선 보존)·새 항목 추가는 이번 작업이 종결·개시하는 백로그 항목과 정확히 대응한다. 새로 등재한 "NOT NULL → 500" 항목은 **트래킹만** 하고 실제 수정을 이번 PR에 끼워 넣지 않았다 — 스코프 확장을 스스로 차단한 설계.
- **`review/consistency/2026/09/27/15_19_25/**` 8개 파일**(SUMMARY·meta.json·5개 checker 리포트·`_retry_state.json`)은 프로젝트 규약(`developer` 는 구현 착수 직전 `consistency-check --impl-prep` 의무)에 따른 산출물이며, BLOCK:NO 로 종료된 정상 세션 로그다 — 무관한 파일이 아니라 필수 절차의 증거물이다.
- 포맷팅만 바뀐 diff hunk, 불필요한 주석 편집, 사용하지 않는 import, 설정 파일 변경은 발견하지 못했다.

## 요약

`git diff --stat origin/main...HEAD` 로 확인한 21개 변경 파일 전부가 plan 문서(`plan/in-progress/patch-body-followups.md`)가 선언한 세 가지 축 — (1) 워크플로·노드 `description`, 인증 설정 `ipWhitelist` 의 nullable 요청 필드 선언을 실제 런타임 동작에 맞춤, (2) 그 선언을 고정하는 단위/e2e/선언 캐너리, (3) CHANGELOG·plan·필수 impl-prep 컨시스턴시 산출물 — 안에 정확히 들어간다. NOT NULL→500 이라는 별도 결함 클래스를 발견했음에도 이번 PR 에 끼워 넣지 않고 트래커에만 등재한 점, executions `findById` 이슈도 조사만 하고 수정은 다음 항목으로 넘긴 점은 오히려 스코프를 스스로 절제한 사례다. 유일한 관찰은 `nodes.service.spec.ts` 캐너리가 plan 문구보다 한 필드(`containerId`) 더 넓게 단언한다는 것인데, 코드 변경을 수반하지 않는 무해한 테스트 확장이라 INFO 수준이다.

## 위험도

NONE
