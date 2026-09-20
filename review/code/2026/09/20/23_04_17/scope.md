# 변경 범위(Scope) 리뷰

## 검토 방법

`git log --oneline origin/main..HEAD` (7개 커밋) + `git diff origin/main...HEAD --stat` (45개 파일,
전부 신규 추가, +2553/-4)로 실제 누적 diff를 프롬프트의 unified diff와 대조했다 — 완전히 일치한다.
`triggers.service.ts`·`triggers.service.spec.ts`의 diff는 저장소 파일을 직접 `git diff`로 재확인해
프롬프트 인용과 바이트 단위로 동일함을 확인했다(뮤테이션 없음, 읽기 전용). `-4` 삭제분은
`plan/in-progress/spec-draft-nullable-notation-followups.md`의 caveat 문장 2줄을 취소선 처리로
대체한 것뿐이다(원문 보존 — 프로젝트 관례와 일치).

## 발견사항

- **[INFO]** 핵심 코드 변경은 목표 결함 하나에 정확히 국한됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (게이트 1085-1101)
  - 상세: `git diff`로 재확인한 결과 추가분은 advisory lock 획득 후 `m.findOne` 재조회 + `!fresh` 시
    404 + `.catch`의 `NotFoundException` passthrough 한 줄, 총 14줄 순수 삽입뿐이다. import 변경,
    기존 코드 재배치·포맷팅 변경 없음.
  - 제안: 조치 불요.

- **[INFO]** 이번 라운드(2라운드 WARNING 조치 커밋 `ba904cdfe`)도 스코프가 정확히 지적된 갭에만 국한됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (게이트 3810-3874, 4051-4055)
  - 상세: 직전 라운드(`22_39_21`) testing WARNING이 지적한 "락 안 재조회의 `workspaceId` 스코프를
    아무 테스트도 단언하지 않는다"만 정확히 메웠다 — `freshFindOne` 콜백이 인자를 받도록 확장하고
    `freshFindOptions`를 헬퍼 반환값에 추가한 뒤, 기존 404 테스트 안에 `where: { id, workspaceId }`
    단언 한 줄을 추가한 것이 전부다. 기존 테스트 케이스 순서·내용 변경 없음, 다른 `it()` 블록에는
    손대지 않았다.
  - 제안: 조치 불요.

- **[INFO]** `review/**` 24개 파일(그룹 2·3)이 diff 대부분(45개 중 39개)을 차지하지만 범위 이탈이 아니다
  - 위치: `review/code/2026/09/20/22_07_23/**`(12개), `review/code/2026/09/20/22_39_21/**`(17개),
    `review/consistency/2026/09/20/21_43_47/**`(8개)
  - 상세: `CLAUDE.md`는 developer가 구현 착수 직전 `consistency-check --impl-prep`을, 구현 완료 후
    `/ai-review`를 상시 승인된 강제 절차로 규정하고, `review/`는 gitignore 대상이 아니므로 그 산출물이
    커밋에 포함되는 것이 정상 워크플로다. `plan/in-progress/trigger-dup-delete.md` 체크리스트가 이
    경로들과 정확히 대응하는 절차 실행을 명시한다. 이 판정은 직전 두 라운드의 scope 리뷰
    (`review/code/2026/09/20/22_07_23/scope.md`, `review/code/2026/09/20/22_39_21/scope.md`)와
    일관된다.
  - 제안: 조치 불요.

- **[INFO]** plan/tracker 문서 수정은 이번 세션이 발견·조치한 사실에만 국한된 순수 추가·체크박스 토글
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (게이트 4583-4589 신규 불릿,
    4760 체크박스 토글, 4767-4784 정정 각주 + 신규 항목, 4792-4796 caveat 취소선 처분)
  - 상세: 기존 서술의 재작성·삭제 없이 신규 항목 삽입, 완료 체크박스 토글, 반증된 문장의 취소선 보존
    (원문 유지 + 정정 병기)만 있다 — CLAUDE.md 취소선 규약과 일치하는 형태다.
  - 제안: 조치 불요.

- **[INFO]** (경계 사례, 차단 사유 아님) 트래커 정정 문구가 아직 존재하지 않는 `plan/complete/trigger-dup-delete.md` 경로를 선인용
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 4767("`plan/complete/trigger-dup-delete.md` 가 `TriggersService.remove()` 를 고쳐...")
  - 상세: 실제로 `plan/in-progress/trigger-dup-delete.md`는 아직 `plan/in-progress/`에 있고(확인:
    `find plan -iname trigger-dup-delete.md` → in-progress 경로만 존재), 그 plan 자신의 체크리스트
    마지막 줄("트래커 항목 해소 + 이 plan `plan/complete/`로")도 미체크(`[ ]`) 상태다. 이는 스코프
    이탈(무관한 파일·기능 추가)이 아니라 아직 일어나지 않은 이동을 앞당겨 서술한 사소한 내용
    정확성 문제이며, `documentation`/`plan_coherence` 렌즈 소관에 더 가깝다. 참고 목적으로만 기재한다.
  - 제안: `plan/complete/`로 이동하는 마무리 커밋에서 자연히 해소되므로 이번 라운드에서 조치 불요.

- 기타 스코프 이탈·불필요 리팩토링·포맷팅 혼입·무관한 임포트/주석/설정 변경: **미발견**.
  - `trigger-delete-concurrency.e2e-spec.ts`는 완전한 신규 파일이며, 형제 `workflow-/workspace-delete-concurrency.e2e-spec.ts`와 동일한 패턴(advisory lock을 테스트가 직접 쥐어 재현)을 재사용한 것으로 작업 대상과 정확히 일치한다.
  - `CHANGELOG.md` 추가는 형제 두 커밋(`4a9828afe`/`ae4fbc374`)이 세운 3단 구성 관행을 그대로 따르며, 이 changelog 항목이 다루는 코드 변경과 1:1 대응한다.
  - 45개 파일 전부 diff 상 순수 추가(삭제 4줄은 취소선 대체뿐)이고, 기존 라인의 재배치·재포맷·불필요한 주석/임포트 정리는 0건이다.

## 요약

누적 diff(origin/main..HEAD, 7커밋·45파일·+2553/-4)는 `TriggersService.remove()`의 동시 DELETE 감사
중복 결함 하나를 겨냥한 최소 코드 변경(구현 14줄, 단위 테스트 2건+워크스페이스 스코프 단언 보강,
신규 e2e 파일)과 그에 직결된 plan/tracker 부기, 그리고 프로젝트 규약이 강제하는 `--impl-prep`
consistency-check·`/ai-review` 2라운드의 정상 산출물(`review/**` 24개 파일)로 구성된다. 핵심 코드·
테스트 파일은 `git diff`로 직접 재확인한 결과 전부 순수 추가이며 기존 로직 재배치·포맷팅 변경·
불필요한 리팩토링·무관한 임포트/주석 정리는 없다. 유일한 경계 사례는 트래커 정정 문구가 아직
`plan/in-progress/`에 있는 plan을 `plan/complete/` 경로로 선인용한 것인데, 이는 스코프 이탈이 아니라
plan 이동 시점 전의 사소한 서술 문제라 차단 사유가 아니다. 범위 이탈 징후를 발견하지 못했다.

## 위험도

NONE
