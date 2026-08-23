# 변경 범위(Scope) Review — masking-gate-consolidation (2차 라운드, `14_46_46`)

## 검토 맥락

이번 diff 는 origin/main 대비 누적 diff 로, 1차 `/ai-review`(`14_23_44`)가 남긴 WARNING 2건에
대한 developer 의 대응(테스트 보강 + 트래커 등재)까지 포함한다. 코드 3파일
(`background-runs.service.ts`·`executions.service.ts`·`redact-stored-error.ts`) 자체의
범위 적합성은 1차 scope 리뷰(`review/code/2026/08/23/14_23_44/scope.md`)가 이미 "타이트하게
머문다"고 판정했고, 이번 라운드에서 그 3파일에 대한 **추가 diff 는 없다**(1차 diff 와 동일
hunk). 이번 라운드의 실질 변경분은 다음 4가지다.

## 발견사항

- **[WARNING]** `spec/conventions/egress-masking.md` — `developer` 역할의 `spec/` 직접 수정이
  여전히 diff 에 남아 있음 (1차 라운드 WARNING #2 의 연장)
  - 위치: `spec/conventions/egress-masking.md:83`(취소선 처리된 문장), `:85`~`92`(신규 반증
    blockquote)
  - 상세: CLAUDE.md Skill 체계 표는 `developer` 쓰기 권한을 `codebase/**, plan/**,
    review/**/RESOLUTION.md` 로 한정하고 `spec/` 는 **read-only** 로 명시한다("구현 중 spec
    변경 필요 시 developer 는 멈추고 project-planner 위임"). 이번 라운드는 이 편집을 되돌리지
    않고, 대신 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 **새 항목**
    (게이트 321~332, "`developer` 의 자기-예측 반증형 spec 소정정 — 권한 경계를 정한다")을
    등재해 이 편집의 정당성 자체를 project-planner 판단으로 넘겼다. 새 항목 본문이 (a)/(b)
    두 옵션을 제시할 뿐 스스로 결정하지 않는다는 점에서 절차 이탈을 다시 저지르지는 않았지만,
    `spec/` 편집 자체는 여전히 diff 안에 존재하는 권한표 위반 상태다. 내용 정확성(9개
    reviewer + 5개 consistency checker 확인)과 절차 위반은 별개 축이라는 점에서, scope
    관점의 사실관계로는 계속 기록해 둔다.
  - 제안: 이미 트래커에 planner 판단 항목으로 넘어가 있으므로 이번 PR 을 막을 사안은 아니다.
    다음 라운드에서 project-planner 가 (a) 예외 명문화 또는 (b) 정식 이관 중 하나를 택해
    이 카브아웃을 닫을 것.

## 정합성 확인 (문제 없음)

- `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` — 1차 라운드 WARNING #1
  ("신설 헬퍼 co-located 테스트 부재")에 정확히 대응하는 범위로만 변경됐다. 신규 import
  (`redactNodeExecutionRow`, `redactStoredFieldsForResponse`, 게이트 2·5)는 모두 새로 추가된
  테스트에서 실제로 쓰이고, 기존 `describe('redactStoredDataForResponse', ...)` 블록 등
  기존 테스트는 한 글자도 건드리지 않았다(순수 append, `@@ -169,3 +171,131 @@`). 추가된
  `describe('redactNodeExecutionRow', ...)` 안의 `undefined` 방어 분기 캐너리(게이트
  289~300)는 scope.md 가 아니라 testing.md WARNING #2 가 지적한 별도 갭을 같은 김에
  메운 것인데, 이 역시 "1차 라운드가 지적한 결함을 고친다"는 이번 라운드의 선언된 목적
  범위 안이라 스코프 초과가 아니다.
  - 곁다리 리팩터링/포맷팅/임포트 정리 없음.
- `codebase/backend/src/shared/utils/redact-stored-error.ts` — 이번 라운드에서 diff 없음
  (1차 라운드에서 신설된 3개 함수 그대로, 구현 재수정 없음). WARNING #1 대응이 "테스트만
  추가"로 국한돼 헬퍼 구현을 다시 건드리지 않은 점이 범위를 타이트하게 유지한다.
- `plan/complete/masking-gate-consolidation.md`(신규, `plan/in-progress/` 에서 이동) —
  체크리스트 전항 완료 + 1차 `/ai-review` 처분 섹션(WARNING #1/#2 대응 근거)을 기록한
  것으로, plan lifecycle 규약("완료 후 `plan/complete/` 이동")과 "리뷰 후 마무리 커밋" 순서에
  부합한다. 임의 확장 없음.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 해당 트래커 항목 1건만
  체크(`[ ]`→`[x]`)+반증 근거 blockquote 로 국소 갱신(게이트 333~354)하고, 새 planner 판단
  항목 1건만 추가(게이트 321~332). 다른 트래커 항목은 무변경.
- `review/code/2026/08/23/14_23_44/**`(11개 파일)·`review/consistency/2026/08/23/13_55_36/**`
  (8개 파일) — CLAUDE.md 가 강제하는 `/ai-review`·`/consistency-check --impl-prep` 표준
  산출물이며, 규약 경로(`review/code/<...>/`, `review/consistency/<...>/`)를 그대로 따른다.
  이번 PR 브랜치 안에서 발생한 의무 절차의 부산물이지 임의 추가가 아니다(1차 scope
  리뷰도 동일 결론).
- 임포트/포맷팅/주석 단독 변경, 요청 밖 기능 확장, 무관 파일 수정은 발견되지 않았다.

## 요약

이번 2차 라운드 diff 는 1차 `/ai-review` 가 남긴 WARNING 2건 중 #1(신설 헬퍼 co-located
테스트 부재)을 테스트 파일 순수 추가로만 정확히 해소했고, #2(developer 의 `spec/` 직접
수정)는 되돌리는 대신 project-planner 판단 항목으로 트래커에 등재해 그 결정을 선점하지
않았다. 코드 3파일 자체는 이번 라운드에서 추가 변경이 없어 1차 scope 판정("타이트하게
머문다")이 그대로 유지된다. 유일한 잔존 이슈는 `spec/conventions/egress-masking.md` 가
여전히 developer 커밋 안에 남아 있다는 사실관계이며, 이는 새로 발생한 범위 이탈이 아니라
1차 라운드부터 이어진 채 명시적으로 planner 에게 이관된 상태다.

## 위험도

LOW
