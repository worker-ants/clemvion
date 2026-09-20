# Rationale 연속성 검토 — spec/2-navigation/ (impl-prep)

## 대상 변경 요약

`plan/in-progress/schedule-cron-flake.md` (spec_impact: `none`) — `schedule-trigger.e2e-spec.ts` 의 「D. PATCH
cron → nextRunAt 재계산」 케이스가 생성 cron(`0 10 * * *`, Asia/Seoul)과 PATCH cron(`*/1 * * * *`)의 다음
실행이 매일 09:59 KST 한 분간 우연히 같아져 거짓 실패하는 문제를, (1) 생성 cron 을 겹칠 수 없는 `0 0 1 1 *` 로
바꾸고 (2) PATCH 응답 `nextRunAt` 이 호출 시점부터 약 1분 이내인지 단언을 추가해 고친다. 서비스 코드
(`schedules.service.ts` 재계산 로직)는 변경하지 않는다.

이 변경은 `spec/2-navigation/2-trigger-list.md` 와 `spec/2-navigation/3-schedule.md` 양쪽의 `code:`
프런트매터에 등재된 `schedule-trigger.e2e-spec.ts` 를 건드리므로 두 문서의 Rationale 을 대조 범위로
잡았다.

## 발견사항

없음 — 아래 검토 관점 4가지 모두에서 충돌을 찾지 못했다.

- **기각된 대안의 재도입**: `3-schedule.md ## Rationale` 에는 이 e2e 케이스의 cron 선택이나 비교 방식에 대해
  과거에 검토·기각한 대안이 기록되어 있지 않다. `2-trigger-list.md R-17`(캐너리가 고정하는 것은 계약이 아니라
  구현이라는 원칙)과 결이 같은 방향이며 반대되지 않는다 — 오히려 "판별력 있는 비교로 교체"는 그 원칙(관찰
  가능한 실제 재계산 여부를 보라)에 부합한다.
- **합의된 원칙 위반**: 두 문서 어디에도 "특정 cron 값을 반드시 사용해야 한다"거나 "다음 실행 시각 비교는
  단순 부등 비교여야 한다"는 합의 원칙이 없다. `3-schedule.md §2.2.1`(표현 가능/불가 cron 패턴 표)·`§4`
  (`ScheduleDto` 응답 형태 註)에도 이 케이스의 fixture 선택을 구속하는 서술은 없다.
- **결정의 무근거 번복**: 대상 변경은 spec 문서를 전혀 수정하지 않는다(`spec_impact: none`) — "과거 결정을
  뒤집는" 행위 자체가 없다. 서비스 쪽 재계산 로직도 불변으로 명시했으므로 `3-schedule.md`의 "타임존
  fallback"(`SchedulesService.resolveTimezone`, §2.2)·"cron 파싱 실패 시 `-` 표시"(§2.1) 등 기존 동작 서술과도
  어긋나지 않는다.
- **암묵적 가정 충돌**: `3-schedule.md ## Rationale`의 `(workspace_id, next_run_at)` 인덱스 결정(§2026-09-04,
  data-model 발췌 부분)이나 `2-trigger-list.md R-17`의 "e2e 는 구현을 고정한다"는 관례는 오히려 이 수정이
  준수해야 할 기존 관행(뮤턴트 기반 판별력 확보, 서비스 코드 비대상 명시)과 일치한다. plan 자체가 "테스트
  (서비스 쪽 뮤턴트)"로 판별력을 검증하겠다고 명시해 이 관례를 따르고 있다.

## 참고 (경미, 비차단)

- `plan/in-progress/schedule-cron-flake.md`의 "비대상" 절이 `2-trigger-list.md`의 스케줄-트리거 응답 형태
  캐너리(§3 註, R-17)를 언급하지 않는다. 이번 수정은 「D. PATCH cron」 케이스에 한정되고 R-17 이 지키는
  "네 응답 형태(양성 4 + 생성 음성 1)" 케이스들과는 다른 단언(“달라졌는가”)을 건드리므로 충돌 소지는 낮지만,
  같은 파일(`schedule-trigger.e2e-spec.ts`)의 다른 case 를 건드리지 않는다는 점을 plan에 한 줄 명시해 두면
  향후 diff 리뷰에서 "이 케이스만 손댔다"를 더 빨리 확인할 수 있다. (INFO, 이번 판단에는 영향 없음)

## 요약

이번 impl-prep 대상은 `spec/2-navigation/` 의 spec 본문·Rationale 을 전혀 수정하지 않는 테스트 전용 수정이며,
바꾸려는 것도 "재계산이 일어났는가"를 판별하는 비교 방식이지 서비스 동작이나 spec 이 약속한 계약이 아니다.
`2-trigger-list.md`·`3-schedule.md` 의 Rationale·관련 spec(`1-data-model.md`) 발췌 전체를 훑었지만 이 변경이
기각된 대안을 재도입하거나, 합의된 설계 원칙을 위반하거나, 무근거로 과거 결정을 뒤집거나, 기록된 invariant를
우회하는 지점은 없었다. 오히려 기존 관례(e2e 캐너리는 구현을 고정하며 그 판별력은 뮤턴트로 검증한다)를
그대로 따르는 방향이다.

## 위험도

NONE
