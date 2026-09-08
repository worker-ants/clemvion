# 변경 범위(Scope) 리뷰

## 사전 확인

`git diff --stat origin/main...HEAD` (3커밋: `03f665c63`·`9ab43690a`·`05b899d1f`, 51개 파일,
+2674/-123)를 prompt 번들과 대조 — 완전히 일치한다. 세 커밋을 각각 `git show --stat`/`git diff`
로 열어 스코프를 직접 대조했다(prompt 가 잘라낸 파일 12·13·20·21·23·24·26·28·29·31·33 포함).

`plan/in-progress/spec-followups-batch-b.md` 가 B-1~B-8 여덟 항목을 사전에 명시적으로 선언했고,
25개 코드/plan 파일 각각이 그중 정확히 하나에 대응한다(파일 목록·매핑은 자체 리뷰 산출물
`review/code/2026/09/08/12_53_08/scope.md` 가 이미 표로 고정해 뒀고, 이번 라운드에서 재확인해도
어긋나지 않는다). 나머지 26개 파일은 두 후속 커밋이 새로 만든 리뷰/컨시스턴시 산출물
(`review/code/2026/09/08/12_53_08/**`, `review/consistency/2026/09/08/{12_21_11,13_22_38}/**`)
이다 — 이 저장소 관례상 `review/**` 는 gitignore 대상이 아니라 커밋되는 프로세스 증빙이다
(CLAUDE.md 저장 위치 표).

## 발견사항

- **[INFO]** 두 후속 커밋(`9ab43690a`·`05b899d1f`)이 원래 B-1~B-8 계획서에 없던 파일들을
  건드린다 — `CHANGELOG.md` 신설, `http-exception.filter.ts`/`workspaces.service.ts` 등에 대한
  **직전 라운드 자기 자신의 코드 리뷰 발견사항**(Warning 1·INFO 7건) 및 **직전 컨시스턴시
  체크 발견사항**(Warning 2건) 반영.
  - 위치: `CHANGELOG.md`(신설 항목), `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts`(파라미터화), `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`(술어 수정), `codebase/backend/src/modules/integrations/integration-oauth.service.{cafe24,makeshop}.spec.ts`(표면 파라미터화), `plan/in-progress/spec-followups-batch-b.md`(`spec_impact` 정정)
  - 상세: 원 계획서 체크리스트에 `/ai-review` + Critical/Warning fix 가 이미 항목으로 있고, CLAUDE.md 는 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"라고 명시한다. 확인한 각 변경은 **같은 PR 이 이번에 새로 만든 코드**(가드·spec·CHANGELOG 미기재)에 대한 자기 지적의 처리이며, 무관한 파일·기능으로 번지지 않았다. `git show <commit>` 로 세 커밋을 각각 열어 대조한 결과 계획서·RESOLUTION.md 가 서술한 처분(수정/won't-do)과 실제 diff 가 1:1로 일치한다.
  - 제안: 조치 불요 — 프로젝트가 명시적으로 상시 승인한 워크플로(구현 직후 리뷰→수정 루프)이며, 범위 이탈이 아니라 그 루프의 정상 산출물이다.

- **[INFO]** `production-build-devdep.spec.ts` 의 `it.each` 파라미터화가 이번 배치 이전부터 있던
  기존 테스트(`repo-guards 는 빌드 대상이 아니다`)까지 함께 재작성한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts` — `describe` 최상단 `buildFiles` 캐싱 + `it.each([...])` 통합
  - 상세: B-2 가 같은 파일에 세 번째 동형 `it()` 을 추가하자 리뷰(INFO#3/#4/#10)가 "같은 형태 3회 반복"을 지적했고, 그 지적이 겨냥한 파일이 정확히 이 파일이라 리팩터 범위가 그 파일 밖으로 번지지 않았다. 기존 테스트를 건드리지 않고는 파라미터화가 불가능한 구조이므로 무관한 리팩토링이 아니라 이번 diff 가 만든 중복을 접는 불가피한 결과다.
  - 제안: 조치 불요.

- **[INFO]** 파일 수 기준으로 이번 diff 의 절반 이상(51개 중 26개)이 리뷰/컨시스턴시 산출물이고
  실제 코드/plan 변경은 19개 파일에 그친다.
  - 상세: 이는 이 프로젝트의 명시된 저장 관례(`review/code/**`, `review/consistency/**` 커밋)의 결과이며 스코프 이탈이 아니다. 다만 향후 diff 통계만으로 "변경 규모"를 판단하면 실제 코드 변경 비중을 과대평가하지 않도록 유의할 필요가 있다는 점만 기록한다.
  - 제안: 조치 불요.

그 외 B-1~B-8 각 항목 diff 는 plan 이 지시한 범위(예: `PROJECT.md` 표 2행 이동, `tsconfig.build.json` exclude 1줄, `integration-oauth.service.ts` import 1줄 + 표현 2개 치환, `workflow-versions.service.ts` 타입명 1곳 개명)에 정확히 그친다. 계획에 없는 기능 확장·무관한 파일 수정·의미 없는 포맷팅·미사용 임포트·의도치 않은 설정 변경은 발견되지 않았다. `integration-oauth.service.ts` 의 import 개행은 새 심볼(`pgErrorConstraint`) 추가로 인한 prettier 의 자연스러운 결과이지 드라이브바이 포맷팅이 아니다.

## 요약

이 PR(3커밋, 51개 파일)은 사전에 선언된 `plan/in-progress/spec-followups-batch-b.md` B-1~B-8 여덟 항목과, 그 항목들이 만든 코드에 대한 같은 PR 내 리뷰(`/ai-review`, `--impl-prep`/`--impl-done` 컨시스턴시 체크) 발견사항의 처리로 완전히 설명된다. `git show`로 세 커밋을 개별 대조한 결과 계획서·RESOLUTION.md 의 서술과 실제 diff 가 어긋나는 자리를 찾지 못했다. 리뷰 산출물이 파일 수의 과반을 차지하지만 이는 프로젝트가 명시한 커밋 관례이고, 자기 자신의 코드에 대한 리뷰-수정 루프도 CLAUDE.md 가 상시 승인한 강제 워크플로다. 실질적인 스코프 이탈, 계획 외 리팩토링, 무관한 파일 수정은 발견되지 않았다.

## 위험도

NONE
