# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff origin/main...HEAD` 로 누적 diff(120개 변경 파일, 32개 코드/문서 + 88개
`review/**` 산출물)를 직접 열어 확인했다. `codebase/**` 32개 실질 변경 파일은 모두 전문을,
`review/**` 는 `git diff --stat` 로 전량이 순수 신규 추가(0 삭제)임을 확인했다. 이 라운드는
5번째 코드 리뷰이므로, 직전 라운드(`review/code/2026/09/05/21_40_37/scope.md`)가 남긴 지적이
이번 diff 에서 실제로 해소됐는지도 `git show 7e85da873`(최신 커밋) 로 대조했다.

## 발견사항

- **[INFO]** `CHANGELOG.md` 의 이번 스윕 섹션 끝에 빈 줄이 두 번 연속 들어가 있다 — 문서
  나머지 섹션 경계(단일 빈 줄)와 다른 형태다.
  - 위치: `CHANGELOG.md:80-81` (`통과한다 — 양방향 래칫이다. (78 은 종전에 알려져 있던 10건보다 훨씬 크다.)` 바로 다음 두 줄, 그다음이 기존 `## Unreleased — GET /api/audit-logs …` 제목).
  - 상세: `git diff origin/main...HEAD -- CHANGELOG.md` 에서 새 섹션의 마지막 문단 뒤에 `+`(빈 줄) 두 개가 연속으로 추가됐음을 확인했다. 문서의 다른 섹션 경계는 전부 빈 줄 하나다. 렌더링에는 영향이 없고 순수 공백이라 위험도는 낮지만, 새 섹션을 이어붙이는 편집 중 남은 잔여물로 보인다.
  - 제안: 두 번째 빈 줄 제거. 사소하므로 이번 PR 을 막을 사유는 아니다.

- **[INFO]** `workflow-crud.e2e-spec.ts` 에서 같은 모듈(`workflow-response.dto.ts`)의
  `ExportWorkflowDto` 와 `WorkflowDto` 를 두 줄의 별도 `import` 문으로 선언한다 — 4라운드
  전(`18_23_02/scope.md`)부터 지적된 사소한 흠이 이번 라운드까지 그대로 남아 있다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:13-14` (`import { ExportWorkflowDto } from '...'` 다음 줄에 `import { WorkflowDto } from '...'`, 같은 경로).
  - 상세: 기능상 문제는 없다(중복 임포트나 사용하지 않는 임포트가 아니다 — 둘 다 실제로 소비된다). 4번의 코드 리뷰 라운드가 전부 이 지점을 INFO 로만 처분(조치 불요)해 왔고 이번 diff 도 그 판단을 바꿀 근거가 없다.
  - 제안: 조치 불요. 병합을 막을 사유 아님 — 참고용으로만 재확인.

- **[INFO]** 누적 diff 는 세 갈래의 서로 다른 "왜"(① 트리거 회전 secret 2-경로 유출 차단, ②
  5개 DTO 24필드 선언-실제 불일치 보정(wire 불변), ③ §5.4 검증 인프라 자체 확장 — `allowMissing`
  옵션, `contractForDto` 메모이제이션, 신규 3번째 축 `findOptionalNullableResponseFields` +
  78건 래칫)과 4라운드분의 리뷰 산출물(`review/code/**` 4개 세션, `review/consistency/**` 4개
  세션, 총 88개 파일)을 한 PR 에 담고 있다.
  - 위치: `CHANGELOG.md` 전체, `codebase/backend/src/modules/triggers/triggers.service.ts`(`sanitizeForResponse`), `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:222-311`, `review/code/2026/09/05/{18_23_02,19_08_18,20_45_37,21_40_37}/**`, `review/consistency/2026/09/05/{18_23_03,19_08_19,20_45_39,21_40_38}/**`.
  - 상세: 범위 위반은 아니라고 판단한다 — 각 갈래가 전부 "§5.4 스윕을 하다가 실측으로 드러난" 직접 인과관계를 갖고, CHANGELOG·`plan/in-progress/spec-draft-nullable-notation-followups.md` 가 그 서사를 일관되게 기록한다. `review/**` 88개 파일은 프로젝트 관례(코드 리뷰·일관성 검토 산출물은 `review/code/**`/`review/consistency/**` 에 커밋)에 정확히 부합하는 프로세스 산출물이지 은닉된 확장이 아니다. `git diff --stat` 로 `review/**` 쪽이 순수 신규 추가(삭제 0)임을 재확인했다. 다만 이후 `git log`/`git blame` 로 "이 커밋이 보안 픽스다" 를 추적할 때 다른 두 갈래(선언 보정·검증 인프라)의 노이즈에 가려질 수 있다는 점은 이전 라운드들이 이미 지적·처분(RESOLUTION #12: PR 제목·본문에 상위 과제명 명시)한 그대로다.
  - 제안: 조치 불요. 참고용 관찰만 재확인.

## 직전 라운드 지적의 처분 확인

`21_40_37/scope.md` 가 지적한 `schedule-trigger.e2e-spec.ts` `C-3` 테스트의 중복 주석
블록(같은 사실을 두 번 서술)은 최신 커밋(`7e85da873`)에서 실제로 제거됐음을
`git show 7e85da873 -- codebase/backend/test/schedule-trigger.e2e-spec.ts` 로 확인했다.
그 커밋 자체도 지적받은 두 항목(`TriggerDto` 계약 대조를 목록·PATCH 로 넓히자 드러난
`workflow` undeclared·`name` missing 결함)만 정확히 고쳤고, 무관한 파일 변경·drive-by
리팩토링·불필요한 임포트 정리는 관측되지 않았다.

## 요약

`sweep-response-contract` 브랜치의 누적 diff(`origin/main` 대비 32개 실질 변경 파일 + 88개
리뷰 산출물)는 §5.4 응답-계약 검증자 배선을 4→18 DTO 로 넓히는 작업을 뼈대로, 그 과정에서
실측으로 드러난 트리거 회전 secret 2-경로 유출 차단, 5개 DTO 24필드의 선언-실제 불일치
보정(wire 불변), 스스로 만든 §5.4 위반(금지 조합)의 정정과 재발 방지용 3번째 검증 축(78건
래칫) 신설로 구성된 응집력 있는 다단계 작업이다. `codebase/` 밖에 손댄 파일은 프로젝트
관례에 부합하는 `review/code/**`·`review/consistency/**` 산출물과 `plan/in-progress/` 트래커
뿐이며, `package.json`·`tsconfig`·CI 설정 등 무관한 설정 파일 변경은 없다. 4라운드에 걸쳐
반복 지적된 항목(테스트 부재·vacuous 가드·문서-코드 분리·strip 목록 비대칭 등)은 전부 다음
라운드에서 실제로 조치됐음을 각 RESOLUTION.md·최신 커밋 diff 로 교차 확인했고, scope 관점의
지적은 매 라운드 INFO 수준(사소한 import 분리·중복 주석·서로 다른 "왜"의 혼재)에 머물렀다.
이번 라운드에서 새로 발견한 것도 CHANGELOG 의 중복 빈 줄 하나뿐이며, 의도 이상의 변경·불필요한
리팩토링·요청 밖 기능 확장·무관한 파일 수정·포맷팅과 실질 변경의 혼입(사소한 예외 1건 제외)은
관측되지 않았다.

## 위험도

NONE
