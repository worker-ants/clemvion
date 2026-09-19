# Plan 정합성 검토 — target: `spec/1-data-model.md` (§2.16 ModelConfig · §2.20 AssistantSession · Rationale "`code:` 에 전용 e2e 가드 셋")

> scope 인자는 `spec/2-navigation/` 였으나, 프롬프트의 `(main 추가)` 보정 블록에 따라 실제 대상은 `spec/1-data-model.md` 다
> (`--impl-prep`/`--impl-done` 이 `spec/` 최상위 파일을 scope 로 못 받는 한계 — `plan/in-progress/harness-review-gate-followups.md` §O 에 등재됨).
> 이 보고서는 그 지시를 따라 실제 대상 spec 기준으로 작성한다.

## 발견사항

없음 — CRITICAL·WARNING 급 정합성 위반을 찾지 못했다.

검토한 세 관점과 확인 내용:

1. **미해결 결정과의 충돌** — 이번 diff(`codebase/backend/test/entity-schema-declarations.e2e-spec.ts`, 테스트 전용)가 단언하는 두 기본값
   (`model_config.kind` = `'chat'`, `workflow_assistant_session.last_interaction_at` = `now()`)은 `spec/1-data-model.md` §2.16 · §2.20 의
   `default=` 서술과 정확히 일치한다(`DEFAULT 'chat'` V088, `DEFAULT now()` V019). `plan/in-progress/spec-draft-nullable-notation-followups.md`
   에 이 값들에 관한 "결정 필요" 로 남은 항목은 없다 — 유일한 근접 open 항목(줄 4903, LLM/S3 SSRF 가드 CGNAT 차단 여부)은 이 diff 와 무관한
   다른 컬럼·다른 서비스(`ssrf.util.ts`)를 다룬다.
2. **선행 plan 미해소** — 이 작업이 전제하는 두 선행 plan은 이미 `plan/complete/`로 종결돼 있다: `entity-column-declaration-drift.md`
   (컬럼 층 가드 도입, 4라운드 "수렴 예외"로 이번 빈칸을 넘김) · `spec-draft-spec-fact-orm-defaults.md`(두 `default=` 를 spec 표에 적음).
   둘 다 실재 확인(`ls plan/complete/*.md`). 선행 조건 미해소 없음.
3. **후속 항목 누락** — 이 작업이 닫는 트래커 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md` "컬럼 층 가드의 남은
   빈칸")은 `[x]` 로 표시되고 `plan/complete/column-guard-gaps.md`(2라운드 리뷰 수렴 — `review/code/2026/09/20/01_24_51`)를 인용한다.
   해당 plan 파일이 아직 `plan/in-progress/`에 있고 `plan/complete/`로 `git mv` 되지 않은 상태이지만, 이는 이 세션의 마무리 커밋에서
   함께 처리될 것으로 이미 명시돼 있고(위 회차 RESOLUTION W2), 그 패턴은 이 저장소의 정상 워크플로(plan 이동은 마무리 커밋)와 일치한다 —
   추가 조치 불필요. 이 diff 는 spec 문서를 바꾸지 않으므로(`spec_impact: none`, 테스트만 변경) 다른 spec/plan 의 후속 항목을 무효화하지도
   않는다.

부수적으로, 같은 워킹트리에 미커밋 상태로 남아 있는 `plan/in-progress/spec-draft-nullable-notation-followups.md`의 새 planner 항목
("`spec/2-navigation/` 목록 API 둘의 응답 형태 · 완료된 `pending_plans`")을 대조했다 — `review/consistency/2026/09/20/00_34_58` 의
convention_compliance WARNING 1·2, plan_coherence INFO 5(SUMMARY 전역 번호) 발견 내용과 정확히 일치하며, 이번 진짜 작업(column-guard-gaps)과
무관한 기존 spec 공백이라는 귀속도 `harness-review-gate-followups.md` §O 의 서술과 부합한다. 새로 등재할 사항 없음.

## 요약

이번 diff(테스트 전용, `spec_impact: none`)는 `spec/1-data-model.md` §2.16·§2.20 의 기존 `default=` 서술 및 그 Rationale("`code:` 에 전용
e2e 가드 셋")과 완전히 정합하며, 선행 plan(`entity-column-declaration-drift.md`·`spec-draft-spec-fact-orm-defaults.md`) 둘 다 이미 종결돼
전제 미해소가 없다. 유일한 절차적 특이점(scope 인자가 무관한 `spec/2-navigation/`이고 보정 블록으로 실제 대상을 지정한 것, 그리고 트래커가
아직 `plan/complete/`로 이동하지 않은 plan 파일을 인용하는 것)은 둘 다 `harness-review-gate-followups.md` §O 와 직전 리뷰 라운드(01_24_51 W2)에
이미 원인·처분이 명시적으로 기록돼 있어 새 CRITICAL/WARNING으로 재기할 사안이 아니다. Plan 정합성 관점에서 이 변경을 막을 이유가 없다.

## 위험도

NONE
