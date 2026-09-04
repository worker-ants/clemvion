# 변경 범위(Scope) 리뷰

## 검토 대상 요약

이번 변경 묶음(16개 파일)은 하나의 작업 흐름으로 수렴한다: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 열려 있던 developer 항목("`idx_schedule_next_run` 부분 조건 불일치")을 실측(`spec-draft-schedule-index.md`)으로 닫고, 그 결론을 `spec/1-data-model.md` §3 · `spec/data-flow/10-triggers.md` §2.1 두 미러 문서에 반영한 뒤, 실제 마이그레이션(`V110__schedule_workspace_next_run_index.{sql,conf}`)과 그 e2e 검증(`schedule-trigger.e2e-spec.ts`)으로 구현까지 이어진다. `review/consistency/2026/09/04/22_34_55/**` 는 그 spec 변경 직전에 의무적으로 수행한 `consistency-check --spec` 산출물이다.

각 파일이 이 단일 목표(스케줄 인덱스 전략 정정)에 얼마나 밀착돼 있는지를 기준으로 점검했다.

## 발견사항

- **[INFO]** §4 변경안(B) — 원 티켓과 무관한 인덱스(`trigger_id`) 문서화가 같은 draft 에 편승
  - 위치: `plan/in-progress/spec-draft-schedule-index.md:128-135` (`## 4. 변경안 (B) — 빠져 있던 (trigger_id) 행 추가`), 반영처 `spec/1-data-model.md:915` (`| Schedule | (trigger_id) | ...` 신규 행)
  - 상세: 이 draft 의 출처 티켓은 `(next_run_at, is_active)` 부분 인덱스 하나였다. §4 는 그것과 별개로, `V106` 이 이미 만들어 둔 `idx_schedule_trigger_id` 가 `spec/1-data-model.md` §3 표에 행으로 기재되지 않았던 **기존 문서화 공백**을 같은 PR 에서 함께 메운다. 코드·마이그레이션 변경은 없고(§4 는 문서 행 추가뿐), naming_collision/cross_spec checker 도 이미 "실체는 기존, 충돌 아님" 으로 확인했다. 기능적 위험은 없지만, 엄밀히는 원 티켓 범위 밖의 드라이브바이 수정이다 — "같은 표·같은 테이블이므로 함께 메운다"(§4 본문)는 근거가 명시돼 있어 의도적 판단으로 보이고, 별도 처리로 분리해도 손해가 없는 낮은 리스크 항목이다.
  - 제안: 현재 상태로 두어도 무방하나, 이런 부수 정정은 원 커밋 메시지/PR 설명에 "겸사겸사 V106 문서화 공백도 메움" 정도로 명시해 두면 향후 "이 행은 왜 이 PR 에 들어왔는가"를 다시 추적할 필요가 없다.

- **[INFO]** planner 산출물(spec 서술)과 developer 산출물(마이그레이션+e2e)이 한 changeset 에 공존
  - 위치: `plan/in-progress/spec-draft-schedule-index.md` frontmatter `owner: planner` vs `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` / `codebase/backend/test/schedule-trigger.e2e-spec.ts`
  - 상세: CLAUDE.md 역할 분리 원칙상 `spec/` 은 planner, `codebase/` 는 developer 담당이다. 이번 changeset 은 두 역할의 산출물을 함께 포함하지만, draft 문서 §6("이 draft 가 구현을 포함하지 않는 이유")이 "구현(V110)은 같은 PR 의 developer 단계에서 이어서 수행한다"고 명시적으로 선언해 두었고 실제로 그 선언대로 진행됐다 — spec 과 마이그레이션이 분리된 채 머지되는 drift 를 막기 위한 의도된 설계다. 범위 이탈이 아니라 오히려 이 저장소가 반복 경고해 온 "spec-코드 분리 drift" 를 막으려는 조치이므로 문제로 보지 않는다.
  - 제안: 없음 (참고용 기록).

## 위반 없음으로 확인된 항목

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.{sql,conf}` — 결정된 인덱스 교체(`(next_run_at, is_active)` → `(workspace_id, next_run_at)`) 하나만 수행. 주석이 길지만 이 저장소의 기존 관례(`plan/complete/refactor/05-database.md` 등 실측을 마이그레이션에 남기는 방식)와 일치하며 불필요한 서술이 아니다.
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` — 신규 `it()` 블록 하나만 추가, 기존 테스트 순서·내용 변경 없음. 검증 대상도 V110 이 만든 인덱스 존재/구 인덱스 삭제로 마이그레이션과 정확히 대응.
- `spec/1-data-model.md`, `spec/data-flow/10-triggers.md` — 각각 해당 인덱스를 서술하는 표 행 1개만 교체/추가. 포맷팅 노이즈나 무관 섹션 변경 없음.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 변경된 두 hunk 모두 이번에 닫는 항목(스케줄 인덱스) 본문과 그 종결조건 표 행에 국한. §2(auth 네임스페이스 예외)·§3(nullable DTO) 등 인접 섹션은 컨텍스트로만 노출됐을 뿐 diff 에 포함되지 않음 — 무관 수정 없음.
- `review/consistency/2026/09/04/22_34_55/**` — `spec/` 쓰기 직전 의무 절차(`consistency-check --spec`)의 표준 산출물이며 지정된 SoT 경로(`review/consistency/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)에 정확히 위치. 임의로 끼어든 파일이 아니다.
- import/설정 파일 변경 없음. 불필요한 리팩토링·주석 정리·포맷팅 전용 diff 없음.

## 요약

전체 changeset 은 "스케줄 인덱스 전략 정정" 이라는 단일 목표에 강하게 수렴하며, 의도 밖 리팩토링·기능 확장·무관 파일 수정·포맷팅 노이즈는 발견되지 않았다. 유일하게 짚을 만한 지점은 §4(`trigger_id` 행 추가)가 원 티켓 범위를 살짝 벗어난 드라이브바이 문서 보정이라는 점인데, 근거가 본문에 명시돼 있고 기능적 위험이 없어 INFO 수준에 그친다. planner/developer 산출물이 한 changeset 에 섞인 것도 draft 자체가 사전에 선언한 의도된 흐름이다.

## 위험도
NONE
