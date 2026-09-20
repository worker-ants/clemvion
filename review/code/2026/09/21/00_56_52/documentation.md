# 문서화(Documentation) 리뷰 — schedule-dup-delete (3라운드, `00_56_52`)

## 검토 범위 및 방법

이번 diff(`origin/main...HEAD`, 6커밋·42파일)는 이미 두 차례 `/ai-review` 를 거쳤다
(`review/code/2026/09/21/00_06_01` → WARNING 4건 조치, `review/code/2026/09/21/00_37_06` →
WARNING 2건 조치). 실질 코드/문서 변경은 6개 파일로 좁다 — `CHANGELOG.md` ·
`codebase/backend/src/modules/schedules/schedules.service.ts` ·
`schedules.service.spec.ts` · 신규 `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts` ·
`plan/in-progress/schedule-dup-delete.md`(신규) · `plan/in-progress/spec-draft-nullable-notation-followups.md`(갱신).
나머지 36개는 `review/code/2026/09/21/{00_06_01,00_37_06}/**` · `review/consistency/2026/09/20/23_37_12/**` —
이전 라운드/consistency-check 산출물로, 이 저장소의 표준 워크플로가 커밋을 요구하는 메타 문서다
(직접 손으로 쓴 코드가 아니므로 "문서화 결함" 판단 대상이 아니라 그 안의 서술이 실물과 맞는지만 대조했다).

Read/Grep 으로 저장소를 직접 열어 diff 페이로드의 주장과 대조했다 — **저장소에 쓰기 작업을
수행하지 않았다.** `git status --short` 는 이 리뷰 세션이 새로 만든 `review/code/2026/09/21/00_56_52/**`
외 변경이 없음을 확인했다.

## 이전 두 라운드 WARNING 이 실제로 해소됐는지 — 실물 대조

- **1라운드 documentation WARNING (`CHANGELOG.md` 누락)** → `131296205` 로 추가됨. 현재
  `CHANGELOG.md:3-37` 에 형제 항목(트리거·워크플로)과 동일한 4단 구성(문제 → 판별자 차이 →
  고친 것 → 판별력 실측 → 남는 것)으로 존재함을 직접 읽어 확인.
- **2라운드 documentation WARNING (`CHANGELOG.md` 인접 항목 모순)** → `2879e88c7` 로 조치됨.
  `CHANGELOG.md:66-67` 에 "**2026-09-21 해소**: 위 스케줄 항목이 그 잔여를 닫았다..." 각주가
  원문(63-65행)을 지우지 않고 추가돼 있음을 확인했다 — 이 저장소가 `plan/in-progress/*.md`
  트래커에서 이미 쓰는 "해소 각주" 관례(취소선 없이 원문 보존)와 일치한다.
- **1라운드 maintainability WARNING(`NotFoundException` 리터럴 3중 복제)** → `69889f74e` 로
  `throwScheduleNotFound(): never` 헬퍼 추출. `schedules.service.ts:141`(`findById`),
  `:342`(트리거 삭제 판정), `:380`(방어 분기 판정) 세 곳 모두 이 헬퍼를 호출함을 확인. 형제
  `triggers.service.ts` 의 `throwTriggerNotFound()` 를 인용하는 JSDoc(`:145-150`)도 그 헬퍼가
  실제로 5개 호출부를 갖고 존재함을 grep 으로 재확인했다.
- **2라운드 concurrency WARNING(`!affected` 가 `0` 과 `null`/`undefined` 를 구분하지 않음)** →
  `2879e88c7` 로 두 판정 지점(`schedules.service.ts:342`, `:381`) 모두 `affected === 0` 명시
  비교로 전환됨을 확인. 인용된 근거(`trigger-config-lock.ts:255` `if (result.affected === 0)
  return false;`)도 실제로 그 줄에 존재해 인용이 정확하다.
- **2라운드 testing INFO 7(`scheduleRepo.remove` 미호출 단언 누락)** → 같은 커밋 계열에서
  `schedules.service.spec.ts` 의 0-affected 테스트에 `expect(scheduleRepo.remove).not.toHaveBeenCalled();`
  가 추가됨을 확인.

세 라운드에 걸쳐 코드 주석·JSDoc·CHANGELOG·테스트 docstring 이 인용하는 리뷰 라운드 경로와
WARNING/INFO 번호(예: `review/code/2026/09/21/00_06_01 maintainability WARNING 3`,
`00_37_06 concurrency WARNING 2`)를 각 라운드의 실제 `SUMMARY.md` 번호 매김과 대조했고 — 전부
일치한다. 지어낸 인용이나 번호 오기재는 발견되지 않았다.

## 발견사항

- **[INFO]** 공유 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md:4773`)의
  `SchedulesService.remove()` 항목이 여전히 `- [ ]`(미해소)로 남아 있다 — **의도된 미완료, 새 발견 아님**
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4773-4783`
  - 상세: 이 PR(`plan/in-progress/schedule-dup-delete.md`)의 도입부가 "이 트래커 항목을 닫는다"
    고 명시하지만, 이번 diff 는 그 체크박스 자체를 아직 갱신하지 않았다. 다만 같은 plan 자신의
    체크리스트(`schedule-dup-delete.md` 하단)에도 `- [ ] /ai-review → 수렴`,
    `- [ ] --impl-done → BLOCK: NO`, `- [ ] 트래커 항목 해소 + 이 plan plan/complete/ 로` 세
    항목이 똑같이 미체크 상태로 남아 있어, **세션 마무리 단계에서 함께 처리될 예정임이 plan
    자체에 이미 적혀 있다.** 이 사실은 이미 2라운드 documentation 리뷰(`00_37_06` INFO,
    통합 SUMMARY INFO 9)가 짚었고 그때도 "차단 사유 아님"으로 처분됐다 — 라운드 사이에 상태
    변화가 없으므로 새 결함이 아니라 같은 미완료 상태의 재확인이다.
  - 제안: 조치 불요(비차단). `/ai-review` 가 수렴하고 `--impl-done` 이 통과하는 세션 마무리
    시점에 트래커 4773 줄을 `[x]` + "**2026-09-21 해소**" 형태의 각주로 갱신하고
    `plan/in-progress/schedule-dup-delete.md` 를 `plan/complete/` 로 이동할 것 — 형제 항목
    (트리거, `:4760-4771`)이 실제로 그 형태로 정리된 선례가 바로 위에 있다.

## 그 외 확인 사항 (문제 없음)

- **인라인 주석 정확성**: `schedules.service.ts` 의 신규/수정 주석(트리거 `affected` 판정자
  선택 이유, CASCADE 로 판정 기준이 형제와 다른 이유, `.catch` 에서 `NotFoundException` 을
  먼저 분리하는 이유, `=== 0` 명시 비교의 근거, 방어 분기가 도달 불가한 이유)을 실제 엔티티
  (`schedule.entity.ts` 의 `onDelete: 'CASCADE'`, `triggerId` NOT NULL)와 실제 제어 흐름에
  대조 — 모두 일치한다.
- **테스트 문서화**: `schedules.service.spec.ts` 신규 두 테스트의 JSDoc·인라인 주석이 각각
  인용하는 리뷰 근거(1라운드 testing WARNING 1·2, 2라운드 testing INFO 7)가 실제 그 라운드
  산출물의 서술과 정확히 일치한다.
- **e2e 신규 파일**: `schedule-delete-concurrency.e2e-spec.ts` 헤더 JSDoc 이 "네 번째 짝"이라
  인용하는 `trigger-/workflow-/workspace-delete-concurrency.e2e-spec.ts` 세 파일이 모두
  `codebase/backend/test/` 에 실존함을 확인했다.
- **spec 문서 격차**: `spec/2-navigation/3-schedule.md` 에는 여전히 "동시 삭제 → 두 번째 요청
  404" 서술이 없음을 grep 으로 재확인했다(`2-trigger-list.md:318` 에만 있음). 이는 이미
  `plan/in-progress/spec-draft-nullable-notation-followups.md:4795` 에 등재돼 있고 이번 diff
  자체가 그 스코프에 `3-schedule.md §4` 를 추가했다 — 모순이 아니라 알려진 침묵이며 새 결함이
  아니다.
- **README/설정 문서/API(Swagger) 문서/예제 코드**: 신규 환경변수·설정 옵션·공개 API 표면
  변화가 없어 해당 없음. `schedules.controller.ts` 의 `DELETE /api/schedules/:id` 데코레이터는
  이번 diff 에 포함되지 않았다.
- **CHANGELOG 형식 일관성**: 신규 항목이 최상단(`## Unreleased` 첫 섹션)에 위치하고, 형제
  세 항목(트리거·워크플로·워크스페이스 통합)과 동일한 4단 구성을 그대로 따른다.

## 요약

3라운드째 리뷰에서 앞선 두 라운드가 지적한 documentation 관련 WARNING(CHANGELOG 누락, CHANGELOG
인접 항목 모순)은 모두 실물 대조로 해소가 확인됐다 — 원문을 지우지 않고 "해소 각주"를 붙이는
이 저장소의 기존 관례를 그대로 따랐다. 코드 주석·JSDoc·CHANGELOG·테스트 docstring 이 서로,
그리고 세 라운드에 걸친 리뷰 산출물·엔티티 정의·spec 문서와 인용 관계까지 정확히 일치해 오래된
주석이나 근거 없는 인용은 발견되지 않았다. 유일하게 남는 것은 공유 백로그 트래커의 체크박스
미해소인데, 이는 plan 자신이 세션 마무리 단계 작업으로 이미 명시한 의도된 미완료 상태이고 앞선
라운드에서도 비차단으로 처분된 것과 상태 변화가 없다. 신규 CRITICAL/WARNING 은 없다.

## 위험도

NONE
