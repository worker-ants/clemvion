# 변경 범위(Scope) 리뷰 — trigger-canary-hardening (누적 diff, origin/main...HEAD)

## 검토 방법

`plan/in-progress/trigger-canary-hardening.md` 가 스스로 선언한 4개 항목(① 트리거 비밀 컬럼
3중 사본 repo-guard · ② `TriggerDto.workflow`(schedule) 양성 커버리지 3자리 · ③ 캐너리 두 파일
주석 표기 정리 · ④ e2e teardown `secret_store` 고아 row 근거 정정)을 기준으로, `git diff
origin/main...HEAD`(16개 실질 대상 + 리뷰/컨시스턴시 산출물, +9,616/-58 상당)의 각 파일·hunk가
그 4개 항목 중 어디에 대응하는지 1:1로 대조했다. 코드 diff 6개 파일은 `git diff` 로 직접 원문을
열어 대조했고(프롬프트가 파일 1~3, 9~10 을 크기 제한으로 생략했기 때문), 나머지는 프롬프트에
실린 unified diff 게이트 번호를 그대로 인용했다.

## 발견사항

- **[INFO]** 코드 변경 6개 파일은 전부 4개 항목 중 정확히 하나에 대응하고, 그 밖의 영역(특히
  프로덕션 코드)을 전혀 건드리지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`(신규
    123줄, 항목①), `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts`
    (신규 226줄, 항목①), `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`
    (항목③ — 원문자→아라비아 숫자 통일 + 자리 수 산문 삭제 + `MIRROR_SOURCES`/`nullable-type-lie-cast`
    등 근거 보강, `it`/`describe` 본문은 무편집), `codebase/backend/test/schedule-trigger.e2e-spec.ts`
    (항목②, `expectTriggerWorkflowRef` 3곳 — 프롬프트 게이트 273~280·391~395·427~432),
    `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` 및
    `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`(항목④, `afterAll` 상단 JSDoc
    정정 — 프롬프트 게이트 151~167).
  - 상세: `git diff origin/main...HEAD --stat -- 'codebase/backend/src/modules/**'` 로 실측한
    결과 프로덕션 모듈 코드(`triggers.service.ts` 등)는 diff 에 0건이다. 코드 diff 6개 파일
    전부가 `test/`·`__tests__/`·`shared/testing/` 아래에 있어 devtime/테스트 인프라 범위를
    벗어나지 않는다. `schedule-trigger.e2e-spec.ts` 의 신규 import(`expectTriggerWorkflowRef`)
    는 그 3개 신규 호출 지점에서 실사용되어 미사용 임포트가 아니다.
  - 판단: 범위 이탈 없음.

- **[INFO]** `plan/in-progress/trigger-canary-hardening.md`(신규 408줄)와
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(+203줄)의 대규모 편집은 코드가
  아니라 이 4개 항목의 **착수 전 실측 → 실행 → 6라운드 `/ai-review`+`--impl-done` 대응 이력**을
  그대로 기록한 트래커 갱신이다. `plan/in-progress/harness-review-gate-followups.md`(+9줄)와
  `plan/in-progress/spec-conventions-engine-error-code-surface.md`(+7줄)도 마찬가지로 이번
  배치에서 나온 checker 지적(다른 트래커 항목과의 "다른 양" 혼동 경고)을 등재하는 포인터
  각주다.
  - 위치: `plan/in-progress/trigger-canary-hardening.md`(전체 신규), `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (항목 4건 신규 등재 + 기존 4건 `[x]` 해소 각주), `plan/in-progress/harness-review-gate-followups.md`(게이트 1093~1101),
    `plan/in-progress/spec-conventions-engine-error-code-surface.md`(게이트 121~127).
  - 상세: 신규 등재 4건(`TriggersService.delete()` 오기 3곳 · `2-trigger-list.md` `code:` 갭 ·
    repo-guard `code:` 미등재 · 단건 조회 커버리지 · `--impl-prep` 번들 절단)은 전부 이번
    배치의 리뷰 라운드에서 나온 발견을 "developer 권한 밖(`spec/` 편집)이라 직접 고치지 않고
    등재만 한다"는 CLAUDE.md 경계를 지킨 처리다. `spec/**` 를 직접 편집한 흔적은 diff 어디에도
    없다(`git diff --stat` 로 `spec/` 매치 0건 확인).
  - 판단: 범위 이탈 아님 — 오히려 권한 경계를 넘지 않고 등재만 한 근거로 읽힌다.

- **[INFO]** `review/code/2026/09/14/{11_27_40,11_52_13,12_17_14,12_37_01,13_04_49}/**` 및
  `review/consistency/2026/09/14/{10_44_37,11_27_47,11_52_23,12_17_21,12_37_09,13_04_59}/**`
  (도합 100여 파일)은 이번 브랜치의 이전 5라운드 `/ai-review` + `--impl-done` 실행 산출물이다.
  - 위치: `review/code/2026/09/14/*/*.md,*.json`, `review/consistency/2026/09/14/*/*.md,*.json`
  - 상세: CLAUDE.md 는 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`",
    "일관성 검토 산출물 → `review/consistency/...`" 로 저장 위치를 명시하고, "구현 완료 후
    자동 review/fix 는 상시 승인된 강제 의무"로 규정한다. 각 라운드 RESOLUTION.md 를 실제로
    열어 보면 라운드마다 실제 코드 뮤테이션 검증(전/후 GREEN·RED 표)을 동반한 정당한 fix
    사이클이었고, 코드 diff 는 매 라운드 최소 단위(if/throw 분리, 대조군 1건, 표기 정정 등)로
    그쳤다. 다만 **코드 변경과 harness 프로세스 산출물이 같은 커밋들에 섞여 있다**는 점은
    기록해 둔다 — MEMORY 의 "종결 순서는 코드 커밋 → 세션 → SUMMARY → 리뷰-only 커밋" 규칙과
    다르게, 이 배치는 라운드 2 RESOLUTION 스스로 "다음 배치에서 지킨다"고 자인할 만큼 코드
    +plan+리뷰 산출물이 같은 커밋에 반복적으로 묶였다. 이것은 커밋 위생 이슈이지 코드 변경의
    스코프 이탈은 아니다(각 라운드가 정확히 그 라운드가 지적한 결함만 고쳤음을 RESOLUTION 대조로
    확인).
  - 판단: 범위 이탈 아님(harness 의무 산출물이 정해진 위치에 쌓인 것). 커밋 위생(코드/plan/리뷰
    산출물 혼재)은 이 PR 이 이미 자체 인지·기록한 사항이라 새 지적으로 추가하지 않는다.

- **[INFO]** 6라운드 동안 코드에 실질적으로 가해진 변경은 전부 라운드 자신이 그 라운드에서
  지적받은 결함(vacuous 단언 1곳, 방어 분기 대조군 누락 4곳, docstring 서술-구현 불일치 등)에
  국한되고, 4개 항목이 애초에 요구하지 않은 새 기능·새 표면을 추가하지 않았다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts`
    (`describe('[대조군] readStringArrayConst ...')` 블록 — 분기↔대조군 대응표 7행 + `it()` 7개)
  - 상세: 이 대응표+대조군 세트는 항목①(3중 사본 정합 가드)의 판별력을 검증하기 위한 것으로,
    리뷰가 반복적으로 지적한 "JSDoc 이 N개를 약속하고 N-1개만 잠근다" 결함에 대한 직접 대응이지
    항목①의 범위를 넘는 신규 기능이 아니다(가드 자체의 공개 API·시그니처는 변경 없음).
  - 판단: 기능 확장(over-engineering) 아님 — 선언된 항목의 견고화.

포맷팅 전용 변경이 실질 로직과 뒤섞인 사례, 요청받지 않은 리팩토링, 무관한 파일·설정 변경,
불필요한 임포트 정리는 발견되지 않았다.

## 요약

누적 diff 전체(코드 6파일 + plan 4파일 + review 산출물 100여 파일)가 plan 문서 자신이 선언한
4개 항목과 그 항목들에 대한 6라운드 `/ai-review`/`--impl-done` 대응 이력에 정확히 대응한다.
`git diff --stat`로 프로덕션 모듈 코드(`codebase/backend/src/modules/**`) 변경 0건을 직접
확인했고, 실질 코드 변경은 신규 repo-guard 2파일(항목①)·기존 e2e/spec 파일 3~4곳의 주석/단언
추가(항목②·③·④)로 최소 표면에 그친다. `spec/**` 는 전혀 건드리지 않았고, 리뷰가 지적한 spec
결함은 직접 고치는 대신 권한 경계에 맞게 트래커 등재로만 처리했다. `review/code/**`·
`review/consistency/**` 산출물은 이 프로젝트의 "구현 완료 후 자동 review/fix" 상시 의무의
정당한 산출물이며 지정된 저장 위치 규약을 따른다. 유일하게 기록해 둘 절차적 관찰은 코드·plan·
리뷰 산출물이 같은 커밋에 반복 혼재된 점인데, 이는 이 PR 스스로 이미 인지·기록한 사항이고
코드 변경의 실질 스코프 이탈로 이어지지 않았다.

## 위험도

NONE
