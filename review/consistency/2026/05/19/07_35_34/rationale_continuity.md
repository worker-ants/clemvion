# Rationale 연속성 검토 — loop-count-policy plan

## 발견사항

- **[INFO]** warningRule 제거에 수반하는 i18n 매핑 삭제가 plan 작업 항목에 명시되어 있지 않음
  - target 위치: `plan/in-progress/loop-count-policy.md` §작업 항목, `frontend backend-labels.ts:328` 항 참조 부분
  - 과거 결정 출처: `spec/conventions/i18n-userguide.md §Principle 3` — "warningRules[].message 는 영문 SoT 로 두고, frontend `backend-labels.ts` 의 `WARNING_KO` 에 동일 PR 안에서 한국어 매핑을 등록한다"
  - 상세: target plan 의 작업 항목 중 `frontend backend-labels.ts:328 — "Count must be entered." ko 매핑 제거` 항이 이미 존재하므로 인지는 되어 있다. 그러나 해당 항목이 Principle 3 의 "동일 PR 안에서" invariant 를 충족하는 것인지 (삭제도 동일 PR 이어야 함) 는 명시적으로 기술되어 있지 않다. 이는 관계자가 놓칠 여지가 있는 삭제 방향의 invariant. Principle 3 의 자동 가드 (P1-B) 가 삭제 방향도 검출하는지 여부가 spec 에 명기되어 있지 않기 때문이다.
  - 제안: 작업 항목의 `backend-labels.ts` 항에 "i18n-userguide Principle 3 가드 통과 확인" 주석을 단문으로 덧붙이거나, 해당 항이 Principle 3 의 삭제 방향 적용임을 명시. 과도한 수정보다는 단문 주석으로 충분.

- **[INFO]** 기존 spec 의 "count 미설정" 에러 코드 행 제거 시 handler.validate 두 곳의 역할 구분 명시 필요
  - target 위치: `plan/in-progress/loop-count-policy.md` §결정 및 §작업 항목 (L57: "L170 에러 코드 표에서 count 미설정 행 제거")
  - 과거 결정 출처: `spec/4-nodes/1-logic/3-loop.md §6 에러 코드` 표 (L170) — "count 미설정(빈 문자열 / undefined) → warningRule (캔버스 배지) + handler.validate" 두 경로가 동시 기재되어 있음
  - 상세: `spec/4-nodes/1-logic/3-loop.md §6` 의 해당 행은 warningRule 만이 아니라 `handler.validate` 도 함께 담당 경로로 기술하고 있다. target plan 은 warningRule 제거를 결정했으나, zod `default('1')` 가 parse 전에 빈 값을 `'1'` 로 채우므로 `handler.validate` 의 "count 미설정" 검증도 사실상 발화 경로가 없다. plan 의 결정 근거에 이 점이 암묵적으로 포함되어 있지만, L57 의 "에러 코드 표에서 count 미설정 행 제거" 가 handler.validate 경로까지 정리하는 것인지 warningRule 경로만 정리하는 것인지가 명확하지 않다. 이는 구현 시 spec 표의 handler.validate 언급을 남겨둘지 말지에 대한 혼선으로 이어질 수 있다.
  - 제안: plan 의 해당 작업 항목에 "L170 행 전체 제거 (warningRule 와 handler.validate 양 경로 모두 zod default 로 인해 발화 불가)" 로 명시하거나, spec 갱신 시 handler.validate 경로는 별도 행으로 유지하되 warningRule 행만 제거하는 의도라면 그 구분을 plan 에 기술.

## 요약

target 문서(`plan/in-progress/loop-count-policy.md`)는 과거 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 시스템 invariant 를 위반하는 항목을 포함하고 있지 않다. `default('1')` 유지 + warningRule 제거 + spec Rationale 신설 결정은 `node-config-required-defaults-sweep` 후속 follow-up 에 기록된 결정 흐름과 정합하며, ai-review W-1 / consistency-check I-1 의 해소 경로로 합당하다. 발견된 두 항목은 모두 INFO 수준으로, i18n Principle 3 의 삭제 방향 적용 명시 여부와 에러 코드 표 제거 범위의 명확성에 관한 보완 제안이다. 기각된 대안(`default('')` 로의 변경)이 이유 없이 재도입된 흔적도 없으며, "최소 반복 1회 정책"을 새 Rationale 로 명문화하는 절차가 plan 에 포함되어 있어 결정 번복 시 Rationale 부재 패턴에도 해당하지 않는다.

## 위험도

LOW
