# 문서화(Documentation) 리뷰

이 리뷰는 브랜치 전체 누적 diff(원자적 `delete()` 전환 구현 + 이전 `/ai-review` 라운드
`review/code/2026/09/21/10_54_47` 의 fix-and-resolve 사이클 전체)를 대상으로 한다. 직전
라운드가 이미 CHANGELOG 누락(WARNING #3)·리터럴 중복(WARNING #2)·vacuous 테스트(WARNING
#1)를 지적했고, 뒤이은 4개 커밋(`74a9e714b`·`5bbdf753d`·`8504d52c0`·`429432129`)이 그것을
조치했다고 `RESOLUTION.md` 가 주장한다. 이번 라운드에서는 그 조치 결과를 실제 파일 상태와
대조해 재검증했다.

## 검증 방법

저장소 파일을 뮤테이션하지 않고 `Read`/`grep`/`git log`/`git show` 로만 실제 현재 상태를
확인했다 — `git status --short` 는 이 리뷰 세션 자체의 미커밋 산출 디렉터리
(`review/code/2026/09/21/11_32_06/`) 외에는 클린했다.

## 발견사항

- **[INFO]** `throwIntegrationNotFound()` JSDoc 의 "파일 전체 7곳" 주장을 실측 검증 — 정확함
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:606-618` (JSDoc + 헬퍼 정의)
  - 상세: `grep -n throwIntegrationNotFound`로 호출부 7곳(602/740/769/803/1191/1219/1480: `findById`·
    `update`·`remove`(두 판정)·`rotate`(두 판정)·`requireEntity`)을 확인했고, `Integration not found`
    리터럴은 헬퍼 정의 안 1곳(616)에만 남아 있다. WARNING #2(maintainability) 조치가 주장대로 완결됐다.
  - 제안: 없음(검증 통과, 조치 불요).

- **[INFO]** `broadcastCredentialChange` 직전 주석의 정정(INFO #1) 확인 — 정확함
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:815-816`
  - 상세: 옛 API(`remove(entity)` 후 `entity.id` unset 가능성) 근거를 인용하던 주석이
    `delete(criteria) 는 entity 를 변형하지 않지만... 요청 파라미터 id 를 쓰는 편이 명확하다`로
    정정됐다. 결론(파라미터 `id` 사용)은 그대로이고 근거만 현재 API 에 맞게 갱신되어 오래된
    주석 문제가 해소됐다.
  - 제안: 없음.

- **[INFO]** `CHANGELOG.md` 신규 항목의 교차 인용을 실측 검증 — 정확함
  - 위치: `CHANGELOG.md:3-42` (`## Unreleased — 동시 DELETE 두 건이 integration.deleted...`)
  - 상세: 항목이 인용하는 두 개의 사실 주장을 직접 확인했다 — (1) `spec/2-navigation/4-integration.md:1494`
    의 advisory lock 기각 사유("lock 보유 중 HTTP 요청")가 실제로 그 문구 그대로 존재하고, (2)
    `WorkspacesService.removeMember()`(무락 `findOne`→가드→`remove(member)`→`MEMBER_REMOVED` 감사)와
    `leaveWorkspace()`(트랜잭션 안 `pessimistic_write` 재조회, 진 쪽은 `NOT_A_MEMBER` 403)의 코드 형태
    설명이 `codebase/backend/src/modules/workspaces/workspaces.service.ts` 실제 코드와 일치한다.
    형제 헬퍼 `throwTriggerNotFound()`(`triggers.service.ts:412`)·`throwScheduleNotFound()`
    (`schedules.service.ts:151`)도 실재해 통합 서비스 헬퍼 도입 근거가 지어낸 것이 아님을 확인했다.
  - 제안: 없음(형제 4건과 동일한 3단 구성, 판별력 실측 수치까지 정확 — 조치 불요).

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 트래커 항목의
  줄 번호 자기참조(`4813`) 검증 — 정확함
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4813`
  - 상세: 이 PR 이 확장한 문서 갭 항목(`1-workflow-list.md`§2.6·`data-flow/12-workspace.md`§1.10·
    `3-schedule.md`§4·`4-integration.md`§9)이 실제로 정확히 4813줄에 있고, `documentation.md`
    (직전 라운드, 10_54_47) INFO #2 가 인용한 `L4813-4820` 범위와도 정확히 일치한다. 새로 추가된
    6번째 자리(`removeMember()`) 항목(4803행)도 grep 0→1 상태 변화가 실측대로다.
  - 제안: 없음.

- **[INFO]** RESOLUTION.md 의 조치 전 위치 인용(`:1175`, `:1197`)이 최종 파일의 실제 줄 번호
  (`:1176`, `:1198`)와 1줄씩 어긋난다 — 사소하며 조치 불요
  - 위치: `review/code/2026/09/21/10_54_47/RESOLUTION.md` 조치 항목 표, WARNING #1 행
  - 상세: 이 인용은 직전 SUMMARY.md 가 생성된 시점(커밋 `707e89dec` 이후, `74a9e714b` 이전)의
    파일 상태를 가리키는 것으로 보이며, 실제 최종 코드(`integrations.service.spec.ts:1176`,
    `:1198`)와는 1줄 차이가 난다. 이미 종결된 리뷰 라운드의 사후 기록이라 재작업 대상이 아니고,
    RESOLUTION.md 자체가 불변 이력(append-only 성격)이라 지금 고칠 필요도 없다.
  - 제안: 없음(참고 기록). 향후 유사 RESOLUTION 작성 시 조치 커밋 이후 시점의 최종 줄 번호로
    재확인하는 습관을 들이면 이런 미세한 드리프트를 피할 수 있다.

- **[INFO]** `spec/2-navigation/4-integration.md` §9 의 "동시 삭제 → 두 번째 404" 서술 공백은
  여전히 남아 있으나 이번 diff 의 범위가 아니다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4813-4821`
  - 상세: developer 는 `spec/` 쓰기 권한이 없고, 이 PR 은 그 갭을 트래커 스코프에 새로 추가하는
    것으로 마무리했다(직전 `--impl-prep` consistency-check W3 도 비차단으로 처분). 새로 지적할
    사항이 아니다.
  - 제안: 없음(등재 상태 유지로 충분).

## 요약

직전 `/ai-review` 라운드(10_54_47)가 찾은 documentation WARNING(`CHANGELOG.md` 누락)과
maintainability WARNING(`RESOURCE_NOT_FOUND` 리터럴 7곳 중복)이 후속 커밋 `8504d52c0`·
`5bbdf753d` 로 조치됐다는 `RESOLUTION.md` 의 주장을 코드·CHANGELOG·spec·형제 모듈 파일을
직접 열어 전수 재검증했고, 모두 실측과 일치했다. 새 CHANGELOG 항목이 인용하는 spec Rationale
문구, 형제 서비스의 헬퍼 존재, 트래커 줄 번호 자기참조까지 지어낸 근거 없이 실재와 맞았다.
새로 도입된 헬퍼 JSDoc·delete() 도입부의 인라인 주석·테스트 JSDoc 모두 변경된 코드와
정확히 일치하며 오래된 주석은 발견되지 않았다. 남은 유일한 문서 갭(`4-integration.md` §9)은
developer 권한 밖으로 적절히 트래커에 등재된 상태이고, RESOLUTION.md 의 사소한 줄 번호 드리프트
1건은 이미 종결된 사후 기록이라 조치가 필요 없다. Critical/Warning 없음.

## 위험도

NONE
