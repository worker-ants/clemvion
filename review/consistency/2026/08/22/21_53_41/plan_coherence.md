# Plan 정합성 검토 — plan_coherence

검토 모드: --impl-prep, target=`spec/5-system/` (실제 작업 초점: `plan/in-progress/rerun-input-resolution-extract.md` —
`ExecutionsService.reRun` 입력 해석 블록 추출 + `plan/in-progress/masked-marker-test-gaps.md` 를 `complete/` 로 이동)

## 발견사항

- **[WARNING]** `masked-marker-test-gaps.md` 를 `complete/` 로 이동하기 전 그 문서 자신의 잔여
  체크박스 2개를 명시적으로 `[x]` 처리하는 단계가 새 plan 의 작업 목록에 없다
  - target 위치: `plan/in-progress/rerun-input-resolution-extract.md` `## 작업` 체크리스트
    (`masked-marker-test-gaps.md 를 complete/ 로 이동` 항목과 `함께 처리` 절)
  - 관련 plan: `plan/in-progress/masked-marker-test-gaps.md` 의 마지막 두 체크박스
    `- [ ] TEST WORKFLOW 4단계 + 타입체크 ratchet` / `- [ ] /ai-review`
  - 상세: 새 plan 의 "함께 처리" 절은 *"#1196 안에서 했어야 했다"* 며 이 두 체크박스가
    실제로는 완료된 단계(리뷰·머지 통과)인데 표기만 누락됐다고 정확히 진단하고,
    `plan-lifecycle.md §3`("이동만 담은 별 PR 분리 금지")를 근거로 이번 PR 에 실어
    처리하겠다고 밝힌다(§3 문구 실측 확인함, 일치). 그런데 `## 작업` 체크리스트 자체에는
    "`masked-marker-test-gaps.md` 를 `complete/` 로 이동" 한 줄만 있고, 그 직전에
    *그 문서의 두 체크박스를 `[x]` 로 갱신한다*는 하위 단계가 명시돼 있지 않다.
    `plan-lifecycle.md §3` 의 이동 조건은 "모든 체크박스 `[x]`"이고, 이 저장소는 실제로
    "체크박스 = 실제 상태" 불변식을 여러 세션에서 반복 위반해 온 이력이 있다(plan 이동 시
    표기 누락). `plan_guard.py::_all_checkboxes_done` 은 이런 상태를 감지하는 soft nudge를
    갖고 있지만, 이동 자체를 하드 블록하지는 않는다.
  - 제안: `rerun-input-resolution-extract.md` 의 체크리스트에 "`masked-marker-test-gaps.md`
    의 마지막 두 체크박스를 `[x]` 로 갱신" 을 이동 직전의 별도 하위 항목으로 명시하거나,
    최소한 이동 커밋 diff 에서 그 두 줄이 함께 바뀌는지 커밋 전 확인 단계를 적어 둘 것.

## 참고 확인(문제 없음으로 판정)

- `spec-sync-external-interaction-api-gaps.md` 의 "마커 재제출 거부 PR 의 이월 항목" 절에서
  `ExecutionsService.reRun` 137줄·6책임 항목(`- [ ]`, 실측 141줄)은 유일하게 "지금 착수
  가능"한 미해결 항목이고, 새 plan(`rerun-input-resolution-extract.md`)이 정확히 그 항목만
  겨냥한다 — 트래커 문면("다음에 손댈 때 입력 해석 블록을 private 헬퍼로")과 실제 diff(40줄
  → `resolveManualOverrideInput` private 메서드 추출)가 일치한다. 같은 절의 나머지 미해결
  항목(swagger 길이-예외 §3, `execute` 엔드포인트 DTO 승격, `findMaskedResubmissions` 유예)은
  각각 planner 턴/미래 DTO 승격 기회/미래 소비처 증가라는 별도 트리거를 명시적으로 기다리는
  중이라 이번 plan 과 충돌하지 않는다.
- `masked-reject-callers-guard.ts` 는 파일 단위 AST 식별자 스캔이라(`executions.service.ts`
  가 여전히 base `resolveTriggerParameters` 를 직접 부르지 않고 wrapper 만 부르는 구조는
  유지됨) 호출부가 `reRun` 본문에서 새 private 메서드로 옮겨가도 허용목록·판정 로직에
  영향이 없다 — 새 plan 이 스스로 이 위험을 인지하고 M3 뮤테이션으로 검증하겠다고 명시한
  것과 일치하는 결론이다.
- `spec/5-system/14-external-interaction-api.md` §R17 은 wrapper 호출부를 "두 엔드포인트"
  (`POST /executions/:id/re-run`, `POST /workflows/:id/execute`) 단위로 서술하며 메서드 내부
  구조(어느 private 메서드가 부르는지)까지는 규정하지 않는다 — 순수 추출로 엔드포인트 동작이
  바뀌지 않으므로 spec 본문 갱신 불요라는 새 plan 의 `spec_impact: none` 판단과 일치한다.
  `code:` frontmatter 에도 이미 `executions.service.ts` 가 등재돼 있어 신규 파일 등재도 불요.
- `masked-marker-test-gaps.md`·`spec-sync-external-interaction-api-gaps.md` 에 대한
  `pending_plans:` 참조는 `14-external-interaction-api.md` 한 곳뿐이고 대상은 트래커
  (`spec-sync-external-interaction-api-gaps.md`)이지 `masked-marker-test-gaps.md` 가 아니다
  — 후자를 `complete/` 로 옮겨도 끊어지는 spec 참조가 없다.
- `review_guard.py:63` freshness 판정이 "가장 최근에 변경된 **codebase 파일** 기준"이라는
  새 plan의 주장은 해당 파일 docstring 원문("it postdates the newest changed codebase
  file")과 일치 — plan-only 커밋이 리뷰를 stale 화하지 않는다는 근거가 유효하다.

## 요약

`rerun-input-resolution-extract.md` 는 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)
가 지목한 유일한 미해결·즉시착수 가능 항목(`reRun` 리팩터)을 정확히 겨냥하고, 대상 spec
(`14-external-interaction-api.md` §R17)이 요구하는 계약(엔드포인트 단위 wrapper 호출, CI 가드
허용목록)을 건드리지 않는 순수 추출이라 `spec_impact: none` 판단이 타당하다. 유일한 절차적
허점은 `masked-marker-test-gaps.md` 를 `complete/` 로 옮기기 전 그 문서 자신의 잔여 체크박스
2개를 `[x]` 로 갱신하는 단계가 새 plan 의 작업 목록에 명시적으로 없다는 점이며, 이는
`plan-lifecycle.md §3` 이동 조건과 이 저장소가 반복 겪은 "체크박스 ≠ 실제 상태" 패턴에 걸릴
수 있는 실질적이지만 낮은 위험이다. 그 외 미해결 결정과의 충돌, 선행 plan 미해소, 후속 항목
누락은 발견되지 않았다.

## 위험도
LOW
