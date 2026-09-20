# 문서화(Documentation) 리뷰 — sched-recalc-unit

## 검토 범위

- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — cron/timezone 재계산 happy-path 단위 테스트 2건 + JSDoc 추가 (핵심 변경)
- `plan/in-progress/sched-recalc-unit.md` — 신규 plan 문서
- `review/consistency/2026/09/20/14_01_01/*` — `--impl-prep` consistency-check 산출물(자동 생성 리포트) 8개

## 발견사항

- **[INFO]** 새 JSDoc 블록의 위치가 서술 대상과 한 칸 어긋남
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — JSDoc 블록(게이트 419-426) → `scheduleRow` 팩토리 함수(게이트 427-438) → 첫 `it(...)`(게이트 440)
  - 상세: 419-426 의 JSDoc 은 "위 방어 분기의 정상 쪽" · "무엇으로 불렸는지까지 본다" 등 뒤따르는 **두 테스트 케이스**의 설계 근거를 설명하는데, 정작 바로 아래에 오는 선언은 `scheduleRow` 라는 순수 데이터 팩토리 함수다. JSDoc 컨벤션상 이 블록은 바로 다음 선언(함수)을 문서화하는 것으로 읽히기 쉽지만 내용은 함수가 아니라 그 아래 두 `it()` 블록 전체를 겨냥한다. 실제로 파일을 열어 대조한 결과 코드 자체(주석 내용·인용된 cross-reference·`computeNextRuns` 호출 인자)는 정확했고, 이는 순수 배치상의 가독성 이슈다.
  - 제안: 섹션 코멘트로는 통상 문제없으나, 팩토리 함수 자체에 대한 한 줄("반복되는 schedule row 를 만든다, override 로 필드만 바꿔치기")과 두 테스트 각각의 rationale 을 분리하면 "무엇을 설명하는 주석인지" 가 더 명확해진다. 필수 수정은 아님.

- **[INFO]** cross-reference(교차 참조) 실측 확인 — 모두 정확함
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:420-424` (JSDoc)
  - 상세: 신규 JSDoc 이 인용하는 세 대상을 직접 열어 대조했다 — (1) `plan/complete/schedule-cron-flake.md` 존재, (2) `review/code/2026/09/20/12_45_31` 세션 디렉터리 및 그 `SUMMARY.md` WARNING 1(연말 ~2분 거짓 통과, false GREEN) 실재, (3) `codebase/backend/test/schedule-trigger.e2e-spec.ts:301` 의 `it('D. PATCH cron → nextRunAt 재계산', ...)` 실재하며 그 자체 JSDoc(280-297행)도 "닫는 자리는 `computeNextRuns` 를 spy 로 보는 단위 테스트다" 라고 이 작업을 정확히 예고하고 있다. 새 단위 테스트의 인자 단언(`computeNextRuns` 가 갱신 후 cron/timezone 으로 호출됨)도 `schedules.service.ts` 의 실제 `update()` 구현(`if (dto.cronExpression) schedule.cronExpression = ...` 후 `computeNextRuns(schedule.cronExpression, schedule.timezone, 1)`)과 일치함을 확인했다. 결함 없음 — 정확성 확인 목적의 INFO.

- **[INFO]** README/CHANGELOG/API 문서/설정 문서 업데이트 불요 확인
  - 위치: 전체 변경분
  - 상세: 이번 변경은 `spec_impact: none` 이 명시된 순수 단위 테스트 추가이며, 서비스 로직·API 계약·환경변수·설정 스키마 변경이 전혀 없다(plan 의 "비대상" 섹션이 이를 명시). README·API 문서·CHANGELOG·설정 문서 갱신 대상 없음.

- **[INFO]** plan 체크리스트 상태와 실제 git 이력 일치
  - 위치: `plan/in-progress/sched-recalc-unit.md` 게이트 51-59 (체크리스트)
  - 상세: `[x]` 항목 3개(impl-prep, 테스트+뮤턴트, TEST WORKFLOW)와 커밋 해시(`75d6b5db3`)를 실제 `git log`(사용자 제공 gitStatus)와 대조 — 일치. 남은 `[ ]` 항목("`/ai-review` 수렴", "`--impl-done`", "트래커 해소·`plan/complete/` 이동")은 이 리뷰 자체가 그 첫 항목을 수행 중인 상태로, 문서 서술과 실제 진행 단계가 정합적이다. plan 라이프사이클 규약(`plan/체크박스=실제 상태`, `plan_impact` 리스트 형식) 위반 없음.

## 요약

이번 변경은 문서화 관점에서 양호하다. 새로 추가된 두 단위 테스트는 각각 rationale 을 담은 JSDoc/인라인 주석을 갖추고 있고, 인용한 교차 참조(선행 plan·리뷰 세션·e2e 스펙 파일)를 전부 직접 열어 대조한 결과 모두 실재하며 서술과 일치했다. 특히 새 JSDoc 이 "왜 이 e2e 만으로는 부족한가"(연말 ~2분 창)와 "무엇으로 호출됐는지까지 검증해야 하는 이유"를 근거 있게 설명하고 있어 다음 사람이 맥락 없이도 의도를 재구성할 수 있다. 유일한 지적은 JSDoc 블록이 팩토리 함수 바로 위에 놓여 있어 "무엇을 문서화하는 주석인지"가 함수/테스트 그룹 중 어느 쪽인지 시각적으로 살짝 모호하다는 배치상의 INFO 뿐이며, 서비스 로직·API·설정 변경이 없어 README/API 문서/CHANGELOG 갱신도 불필요하다. Critical/Warning 없음.

## 위험도

NONE
