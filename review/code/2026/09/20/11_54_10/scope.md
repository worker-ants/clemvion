# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 리뷰 대상에 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 외 harness 산출물 8건(`plan/in-progress/schedule-cron-flake.md`, `review/consistency/2026/09/20/11_21_16/*` 7개)이 함께 포함됨
  - 위치: `plan/in-progress/schedule-cron-flake.md` 전체, `review/consistency/2026/09/20/11_21_16/{SUMMARY.md,_retry_state.json,convention_compliance.md,cross_spec.md,meta.json,naming_collision.md,plan_coherence.md,rationale_continuity.md}`
  - 상세: 이 파일들은 프로젝트 컨벤션이 요구하는 필수 절차(작업 plan 문서 + `--impl-prep` consistency-check 산출물)이며, `CLAUDE.md` 의 저장 위치 표(plan → `plan/in-progress/`, 일관성 검토 산출물 → `review/consistency/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)와 정확히 일치한다. plan 체크리스트에도 `--impl-prep` 항목이 `[x]` 로 기록돼 있어 이 산출물들이 그 실행 결과임이 자기-정합적으로 확인된다. 즉 "의도 이상의 변경"이 아니라 워크플로가 규정한 부수 산출물이다.
  - 제안: 조치 불요 — 스코프 위반 아님, 참고용으로만 기재.

## 확인했으나 위반이 아닌 항목

- **cron 리터럴 변경 범위**: diff 는 `describe('Schedule trigger (e2e)', ...)` 안의 단일 `it('D. PATCH cron → nextRunAt 재계산', ...)` 블록에만 국한된다(unified diff 헝크 2개, 각각 case D 시작부와 본문). 같은 파일의 다른 케이스(A~C, C-2, C-3, E~J)는 전혀 손대지 않았다 — plan `plan/in-progress/schedule-cron-flake.md` 의 "비대상" 절이 명시한 "같은 파일의 다른 cron 케이스" 원칙과 정확히 일치한다.
- **변경 내용 대 plan 「할 것」 대조**: plan 은 정확히 두 가지를 지시한다 — (1) 생성 cron 을 `*/1 * * * *` 와 겹칠 수 없는 값(`0 0 1 1 *`)으로 교체, (2) PATCH 응답 `nextRunAt` 이 호출 시점부터 약 1분 이내인지 단언 추가. 실제 diff 는 이 두 가지(cron 리터럴 교체 1줄 + `patchedAt` 변수 1줄 + 신규 단언 2줄)와 그 근거를 설명하는 JSDoc/인라인 주석만 포함하며, 서비스 코드(`schedules.service.ts` 등)나 다른 e2e 파일은 건드리지 않았다. 지시받은 범위를 정확히 구현했다.
- **불필요한 리팩토링/기능 확장/포맷팅/임포트/설정 변경**: 해당 없음. 새로 추가된 두 줄의 `expect` 외에 로직 재구성·헬퍼 추출·import 추가 등은 없다.
- **주석 변경**: 새 JSDoc 블록과 인라인 주석 1줄이 추가됐으나 전부 이번 수정(왜 cron 값을 바꿨는지, 새 단언이 무엇을 보완하는지)을 직접 설명하는 근거 주석이며, 기존 무관 주석의 삭제·수정은 없다.

## 요약

이 변경은 `schedule-trigger.e2e-spec.ts` 의 「D. PATCH cron → nextRunAt 재계산」 케이스 하나에 국한되어 있고, plan 문서(`plan/in-progress/schedule-cron-flake.md`)가 명시한 두 가지 수정(cron 리터럴 교체 + 판별력 보강 단언 추가)과 정확히 일치한다. 같은 파일의 다른 케이스, 서비스 코드, spec 문서는 전혀 건드리지 않았다. 함께 포함된 plan 문서와 consistency-check 산출물들은 프로젝트가 규정한 필수 워크플로 부산물로, 저장 위치·명명 모두 컨벤션과 일치해 스코프 이탈로 볼 근거가 없다. 범위 관점에서 지적할 CRITICAL/WARNING 은 없다.

## 위험도

NONE
