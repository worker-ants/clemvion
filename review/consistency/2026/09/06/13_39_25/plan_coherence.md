# Plan 정합성 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 방법

- target(`spec/5-system/`) 델타는 이번 라운드도 0개 파일 — 정상(코드 전용 diff). 실제
  구현 diff(15파일/약 1,800줄)는 워킹트리를 절대경로로 직접 대조했다
  (`git diff origin/main...HEAD --stat -- codebase/`).
- 직전 라운드(13:18:59, `--spec` 모드, target=`plan/in-progress/spec-draft-review-citations-enforcement.md`)
  이후 새로 랜딩한 커밋 `0f689bb7e`(13:39:10, `--spec` 게이트 BLOCK:NO 확인 후 반영)를
  `git show`로 전문 대조했다 — 이 커밋이 이번 라운드가 새로 봐야 할 유일한 델타다.
- 프롬프트 번들이 예산으로 절단한 `spec/conventions/review-citations.md` ·
  `spec/conventions/spec-impl-evidence.md`(둘 다 이번 커밋의 실제 변경 대상이지만
  `spec/5-system/` 스코프 밖이라 번들에 아예 없음)는 워킹트리에서 직접 `git show`/`Read`로
  전문을 읽어 대조했다 — "번들에 없다"를 "변경 없다"의 근거로 쓰지 않았다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md`(1,154줄, 이번 세션의 실질
  SoT)와 `plan/in-progress/spec-draft-review-citations-enforcement.md`(신설, 138줄)를 전문
  읽고, 지난 6개 라운드(10:13~12:53)의 `plan_coherence.md` 이력과 대조해 "이미 알려진 것"과
  "이번 라운드가 새로 봐야 하는 것"을 구분했다.

## 발견사항

- **[INFO]** 직전 WARNING(12:53:29 — "3축 중 JSDoc 축 등재 지시 누락")이 이번 커밋으로 해소됨
  - target 위치: (참고) `review/consistency/2026/09/06/12_53_29/plan_coherence.md` WARNING 1건
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 375~408행(제목 "신규
    검출 **3축**"으로 정정, 처방에 3축 표 신설) · `plan/in-progress/spec-draft-review-citations-enforcement.md`(신설, `--spec` 게이트 `13_18_59` BLOCK:NO로 사전 검증됨)
  - 상세: 12:53:29 라운드는 plan 항목 제목이 "2축"인데 진단 문단은 3개 가드를 나열해
    JSDoc 축의 등재 지시가 누락됐다고 지적했다. `0f689bb7e`가 (1) plan 제목을 "3축"으로
    정정, (2) 처방을 3행 표로 교체, (3) JSDoc 축은 별도 draft
    (`spec-draft-review-citations-enforcement.md`)가 **선행 집행 완료**했다고 명시, (4)
    `CHANGELOG.md` 제목도 같은 이유로 "검출 2축"→"검출 3축" 정정, (5)
    `review-citations.md`/`spec-impl-evidence.md`에 실제로 `dto-jsdoc-citation*.ts`를 축
    단위로 등재 — 지적된 5개 갭이 모두 대응 커밋으로 닫혔다. 재발 없음.
  - 제안: 없음(기록용).

- **[INFO]** §5.4 "구조·이름 축" 미등재·`User` 7컬럼 노출 금지 규범 문장 부재 — 변화 없이 계속
  추적 중 (신규 갭 아님)
  - target 위치: `spec/5-system/2-api-convention.md` §5.4 「검증 층」(frontmatter `code:`,
    본문 표) · `spec/1-data-model.md §2.1`(User)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 375~424행("신규
    검출 3축을 §5.4 「검증 층」과 `code:` 에 등재" 중 남은 두 축) · 426~436행("`User` 민감
    7컬럼의 응답 노출 금지를 규약 문장으로")
  - 상세: 두 항목 모두 10:13→10:53→11:27→11:55(4차 재확인, WARNING)→12:28(INFO로 하향, "이미
    plan 이 정확히 추적 중"으로 판정) 이후 지금까지 상태 변화가 없다. 이번 커밋(`0f689bb7e`)의
    범위는 review-citations.md 축만이라 이 둘을 건드리지 않으며, plan 본문도 "이 항목에 남은
    것은 §5.4 쪽 두 축"이라고 스스로 명시해 범위를 정확히 좁혀 두고 있다. 새로운 미해결
    결정 우회나 후속 항목 누락이 아니라 **이미 계획된 다음 planner 턴의 실행 대기**다.
  - 제안: 없음(별도 조치 불요) — 다음 planner 턴에서 두 항목을 함께 집행 권장(보안 인접
    게이트 사각지대이므로 우선순위 유지).

- **[INFO]** `spec-draft-review-citations-enforcement.md`의 마지막 종결 조건은 이 라운드의
  번들만으로는 검증되지 않는다 — 직접 대조로 별도 확인함
  - target 위치: `plan/in-progress/spec-draft-review-citations-enforcement.md` 134행 — `- [ ]`
    "`--impl-done` 재실행으로 Critical 해소 확인" (유일한 미체크 항목)
  - 관련 plan: 동일 문서, 그리고 이번 라운드 자신(`review/consistency/2026/09/06/13_39_25`,
    `target_path: spec/5-system/`)
  - 상세: 이 세션의 8개 `--impl-done` 라운드(00:01부터 13:39까지)는 전부 `target_path:
    spec/5-system/`로 고정돼 있고, 이 커밋이 실제로 고친 `spec/conventions/review-citations.md`
    · `spec/conventions/spec-impl-evidence.md`는 그 스코프 밖이라 번들(`<git diff … --
    code_areas>`)에도, spec 본문 섹션에도 실리지 않는다. 즉 이 라운드의 checker 가 번들
    안에서만 판단했다면 위 종결 조건을 검증할 근거가 애초에 없다. (본 checker 는 워킹트리를
    절대경로로 직접 읽어 변경안 A/B/C·자매 plan 동기화가 전부 커밋에 반영됐음을 확인했다 —
    위 첫 번째 항목 참조.) 다만 `.claude/hooks/_lib/review_guard.py`의 SPEC-CONSISTENCY
    게이트(`_spec_linked_changes`)는 target_path 스코프와 무관하게 "변경된 `codebase/`
    파일이 어떤 spec 의 `code:` glob 에 걸리는가"만 저장소 전역으로 보므로, 이 라운드가
    BLOCK:NO 로 끝나면 harness 차단 자체는 걸리지 않는다 — 위험은 harness 우회가 아니라
    "그 체크박스를 닫아도 되는 근거를 이 라운드의 checker 가 번들만으로는 재현할 수 없다"는
    점 하나다.
  - 제안: 그 체크박스를 닫을 때는 이 라운드 산출물이 아니라(스코프 밖) 직접 실측(위 확인
    내용) 또는 `spec/conventions`를 포함하는 별도 `--impl-done` 산출물을 근거로 남길 것을
    권장. 차단 사유 아님.

- **[INFO]** `spec-draft-api-convention-verifier-registration.md` → `plan/complete/` 이동
  권고 — 여전히 미집행 (비구속, 반복 확인)
  - target 위치: (참고) `plan/in-progress/spec-draft-review-citations-enforcement.md` 113~123행
    「함께 처리할 것」 3번
  - 관련 plan: `plan/in-progress/spec-draft-api-convention-verifier-registration.md`
  - 상세: 13:18:59 라운드가 이미 "열린 체크박스 0건, PR #1289 로 완료"를 실측 확인했고
    이번 라운드도 파일 상태에 변화가 없음을 재확인했다. target 자신도 이 항목을 종결
    조건이 아니라 권고로 명시하므로 구속력 문제는 없다.
  - 제안: 없음(그대로 두어도 무방, 이동은 별도 정리 커밋에서).

## 확인했으나 충돌 없음으로 판정한 항목

- **미해결 결정 우회 여부**: `0f689bb7e`는 "자기-반증형 소정정" 예외를 시도하지 않고
  `CLAUDE.md`의 5개 조건 중 조건 1("developer 자신이 그 문서에 썼다")이 `git blame`상
  깨진다는 것을 커밋 메시지에 명시한 뒤 planner 턴으로 전환해 spec 을 고쳤다 — 절차 위반
  없음.
- **선행 plan 미해소 여부**: `spec-draft-nullable-notation-followups.md`의 다른 열린 항목들
  (Flyway `mixed=true`, 트리거 비밀 스트립 선언화, `CanvasSaveResultDto` 타입, §5.4 스윕
  2차 등)은 이번 커밋의 변경 범위(`review-citations.md`/`spec-impl-evidence.md`/가드 내부
  리팩터)와 겹치지 않아 전제 훼손이 없다.
- **후속 항목 누락 여부(다른 plan)**: `user-entity-exposure`·`user-secret-absence`·
  `dto-jsdoc-citation`·`USER_SECRET_KEYS`로 `plan/in-progress/` 전체를 저장소 파일시스템
  기준으로 훑었을 때, 이 두 plan(`spec-draft-nullable-notation-followups.md`,
  `spec-draft-review-citations-enforcement.md`) 외에 이번 변경을 참조하거나 이번 변경으로
  무효화되는 다른 plan 파일은 없다.

## 요약

이번 라운드가 새로 봐야 할 유일한 델타(`0f689bb7e`)는 직전 라운드(12:53:29)가 지적한
WARNING을 정확히 그 지적대로(축 단위 표기 정정 + JSDoc 축 별도 draft로 선행 집행 + 자매
plan·CHANGELOG 동기화) 해소했고, 절차상으로도 자기-반증형 소정정 예외를 오용하지 않고
planner 턴을 정식으로 열었다. 남아 있는 두 개의 열린 항목(§5.4 구조·이름 축 등재, `User`
7컬럼 노출 금지 규범 문장)은 4차 재확인 이후 상태 변화가 없는, 이미 plan 이 정확히 소유·
추적 중인 후속 작업이라 신규 결함이 아니다. 유일한 프로세스상 관찰은 `spec-draft-review-
citations-enforcement.md`의 마지막 종결 조건("--impl-done 재실행 확인")을 이 특정 스코프
(`spec/5-system/`)의 번들만으로는 재현할 수 없다는 점인데, 직접 워킹트리 대조로 실질적
해소를 이미 확인했고 harness SPEC-CONSISTENCY 게이트도 스코프 불일치로 우회되지 않는다.
미해결 결정을 우회한 사례, 선행 plan 의 전제를 무너뜨린 사례, 다른 plan 의 후속 항목을
무효화한 사례는 발견되지 않았다.

## 위험도

NONE
