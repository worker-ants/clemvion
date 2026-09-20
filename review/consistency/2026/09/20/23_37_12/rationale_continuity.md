# Rationale 연속성 검토 — `spec/2-navigation` (impl-prep, plan/in-progress/schedule-dup-delete.md)

## 대상 요약

검토 대상은 `SchedulesService.remove()` 의 동시 DELETE 중복 감사 결함을 고치는 착수 전 plan
(`plan/in-progress/schedule-dup-delete.md`, `spec_impact: none`)이며, 같은 결함 클래스를 먼저 닫은
두 선행 PR — `4a9828afe`(workflows, #1369) · `4067bf777`(triggers, #1370) — 의 패턴을 스케줄 삭제
경로에 확장 적용하는 설계다. `spec/2-navigation` 번들(특히 `2-trigger-list.md` §3·§4, `3-schedule.md`
§3·§4)의 Rationale 을 기준으로 대조했다.

## 발견사항

### 없음 — CRITICAL/WARNING 급 충돌 미검출

plan 의 설계를 기존 Rationale/본문 invariant 와 대조한 결과, 기각된 대안의 재도입이나 합의 원칙
위반은 발견되지 않았다. 오히려 세 지점에서 기존 Rationale 을 정확히 재사용·확장하고 있다:

1. **판정 기준 — "0행 매치 = 이미 처리됨"**: plan §B 가 채택한 "락 안에서 `m.delete(Trigger, triggerId)`
   의 `affected` 를 본다, 0 이면 404" 는 `2-trigger-list.md §3` 동시 쓰기 직렬화 Rationale 의 문장
   "재읽기가 비면 쓰지 않고, 병합 쓰기가 **0행에 매치**되면 쓰지 못한 것으로 취급한다" 를 그대로
   재사용한 것이다. 새 원칙을 만들지 않고 기존에 문서화된 invariant 를 삭제 경로에 적용했다 —
   번복이 아니라 일관 적용.
2. **동시 삭제 시 두 번째 요청 = 404**: `2-trigger-list.md §4.4` "동시 삭제: 두 클라이언트가 동시에
   같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`" 가 이미 확립한 결과를, plan 은
   스케줄 화면 삭제 경로에도 동일하게 적용한다. 이는 `§4.3` 의 명시적 대칭 선언 — "Schedule 화면에서
   삭제하는 경로도 동일 결과 (data-flow §1.4 가 양방향 동기화 SoT)" — 이 이미 요구하는 바이므로,
   spec 을 다시 쓰지 않고도 `spec_impact: none` 으로 남길 근거가 spec 본문에 이미 있다. 선행 PR
   `4a9828afe` 가 워크플로 축에 같은 논리(§4.4 선례 인용 → `spec_impact: none`)를 쓴 것과 정합된다.
3. **금지된 대안을 다시 채택하지 않음**: plan "이 PR 이 하지 않는 것" 절이 "BullMQ `removeJob` 중복은
   그대로 둔다 — 고치려면 외부 호출을 락 안에 넣어야 한다(**금지된 형태**)" 라고 명시한다. 이는
   `§3` 의 "외부 provider 호출은 락 밖이다 — 락 안은 재읽기와 쓰기뿐이다. Cafe24 토큰 갱신이 같은
   락을 기각한 사유(*lock 보유 중 HTTP 요청이 DB 커넥션 점유를 늘린다*)" 를 정확히 인용하며 그
   기각된 대안(외부 호출을 락 안으로)을 재도입하지 않겠다고 스스로 선언한 것 — 오히려 모범적인
   연속성 사례다.

### [INFO] 반복되는 일반 원칙이 아직 이름 붙은 Rationale 항목으로 없다

- target 위치: `plan/in-progress/schedule-dup-delete.md` 상단 표("자리 | 상태" — workflows/triggers/
  schedules 세 번째 닫힘, integrations 남음)와 §A·§B 전체.
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md §3` 동시 쓰기 직렬화 절 + `§4.4` 결과·에러 절.
- 상세: "동시 삭제 판정은 락 보호 하위에서 실제로 지운 행이 있었는지(`affected`)로 하며, 삭제
  대상 엔터티 자신의 행 수(특히 FK CASCADE 로 먼저 사라질 수 있는 하위 엔터티)로는 판정하지
  않는다" 는 원칙이 이번까지 세 번(workflows, triggers, schedules) 같은 형태로 재발견·재적용되고
  있다. 이 원칙 자체는 어느 spec 문서에도 **일반 원칙으로 이름 붙여 기록**되어 있지 않고, 매번
  개별 커밋 메시지(#1369, #1370)와 이번 plan 문서에만 흩어져 있다. plan 자신도 "그 PR 들이 «마지막»
  이라고 적을 때마다 리뷰가 남은 자리를 찾아냈다" 고 적어, 이 반복이 이미 한 번 문제였음을 인지하고
  있다. `IntegrationsService.remove()` 가 트래커에 네 번째 자리로 남아 있어(plan §서두 표), 같은
  탐색이 또 반복될 여지가 있다.
- 제안: 이번 PR 이 spec 을 건드리지 않는 것(`spec_impact: none`)은 §4.4 선례로 충분히 정당하지만,
  이 기회에 (이번 PR 이 아니어도 좋으니) `2-trigger-list.md §3` 동시 쓰기 직렬화 Rationale 에
  "판정자는 락이 보호하는 쓰기의 `affected`", "CASCADE 로 사라지는 하위 행 자체는 판정자가 될 수
  없다(양쪽 다 0행이 되는 함정)" 를 일반 원칙으로 한 문단 추가해 두면, `IntegrationsService.remove()`
  차례에서 또 새로 도출할 필요가 없어진다. 강제 사항은 아니며 INFO 로 남긴다.

## 요약

이번 plan 은 `spec/2-navigation` 의 기존 Rationale(§3 동시 쓰기 직렬화의 "0행 매치 판정", §4.4 "동시
삭제 시 두 번째는 404", §4.3 "Schedule 화면 삭제도 동일 결과")을 뒤집거나 우회하지 않고, 오히려 그
문서화된 invariant 를 스케줄 삭제 경로까지 정확히 확장 적용한다. 기각된 대안(외부 호출을 락 안에
넣는 것)을 스스로 인용하며 재도입하지 않겠다고 밝힌 점도 연속성 관점에서 긍정적이다. CRITICAL/WARNING
급 충돌은 없고, 반복되는 일반 원칙을 spec Rationale 에 명문화해 두라는 INFO 한 건만 남긴다.

## 위험도

NONE
