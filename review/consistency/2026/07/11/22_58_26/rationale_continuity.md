# Rationale 연속성 검토 — spec-draft-webchat-truncation-total-count

## 검토 대상
- target: `plan/in-progress/spec-draft-webchat-truncation-total-count.md`
- 관련 spec: `spec/7-channel-web-chat/1-widget-app.md` (§2, §R8) · `spec/4-nodes/6-presentation/0-common.md` (§4, §10.4)
- 관련 이력: `plan/complete/widget-presentation-restore.md` (#901, Rationale R1~R3), `plan/in-progress/webchat-widget-presentation-followups.md`

## 조사 방법
프롬프트에 첨부된 Rationale 발췌(다수 무관 영역 포함)는 target 이 다루는 웹채팅/presentation truncation 주제를 포함하지 않아, `spec/7-channel-web-chat/1-widget-app.md`·`spec/4-nodes/6-presentation/0-common.md`·관련 완료/진행 plan 을 직접 열람해 대조했다.

## 발견사항

이번 target 은 CRITICAL/WARNING 급 연속성 위반이 발견되지 않았다. 오히려 과거 결정이 명시적으로 예약해 둔 후속 절차를 정확히 따르고 있다.

- **[INFO] 후속 tracker 와의 명시적 연결은 양호 — 종결 처리 시 체크박스 동기화만 유의**
  - target 위치: target 문서 `## 배경` (L34)
  - 과거 결정 출처: `plan/in-progress/webchat-widget-presentation-followups.md` "착수 조건" (L32-36) 및 `plan/complete/widget-presentation-restore.md` §6 (L111-115)
  - 상세: `widget-presentation-restore.md`(#901) Rationale 은 "총 개수 노출" 을 버그 수정과 분리해 별도 트래커(`webchat-widget-presentation-followups.md`)로 이관하며 "표면 확장이라 planner 의 표시 계약 결정이 선행돼야 한다" 고 명시했다. target 은 정확히 그 선행 결정(§2 표시 계약 정의)을 수행하는 spec draft로, 과거 결정을 뒤집는 것이 아니라 그 결정이 예정한 다음 단계를 실행하는 것이다. 다만 followups 문서의 "위젯 truncation 배너에 총 개수 노출" 체크박스가 아직 미체크 상태(L15)이므로, 이 spec 변경이 머지되고 developer 구현까지 완료되면 followups 문서의 해당 항목을 체크(또는 완료 이관)해야 두 문서 간 상태 drift 가 생기지 않는다.
  - 제안: 본 PR(spec+구현) 완료 시 `webchat-widget-presentation-followups.md` 의 해당 체크박스를 갱신하거나, 완료 후 `plan/complete/`로 이관하는 후속 작업을 developer 단계 체크리스트에 남겨둔다.

## 교차 검증 상세 (참고, 위반 아님)

- **기각된 대안 재도입 여부**: 없음. `1-widget-app.md §R6`(eager-start 채택, lazy 기각), `§R9`(single-flight coalesce 채택, Idempotency-Key/await-cancel-restart 기각) 등 기존 기각 대안 중 target 이 재도입하는 항목 없음. target 은 이 결정들과 무관한 표시 계층(truncation 배너 텍스트)만 다룬다.
- **합의된 원칙 위반 여부**: 없음. `0-common.md §4/§10.4` 는 `{rowsTotalCount|itemsTotalCount}` 를 "잘리기 전 총 개수"로 이미 규범 정의하고 있고, `1-widget-app.md §R8` 은 `truncation` 메타를 `output.{rowsTruncated|itemsTruncated}` 와 "동등 메타"로 흡수해 노출하라고 이미 규정한다. target 의 §2/§R8 갱신은 이 기존 규범을 소비 측(위젯 UI)에서 완전히 활용하는 확장이지, 규범을 우회하거나 새 wire 계약을 만드는 것이 아니다(target 스스로 "wire·§10.4 무변경" 명시, 실측과 일치).
- **결정의 무근거 번복 여부**: 없음. §2 문구 변경("노출한다" → "총 개수와 함께 노출한다")에는 "메인 편집기 run-results 와 parity" 라는 근거가 붙어 있고 §R8 에 1절을 추가하는 것으로 Rationale 갱신도 동반한다 — 번복이 아니라 확장이며 근거 기재 요건을 충족한다.
- **암묵적 가정 충돌 여부**: 없음. `widget-presentation-restore.md` R2/R2-a 가 확정한 "표시-전용 presentation 노드는 durable thread 미영속(라이브 세션 한정)" invariant 를 target 은 건드리지 않는다 — target 의 스코프는 AI `render_table` 경로의 이미 흡수된 메타(`rowsTotalCount`) 소비 확장이며, standalone 노드 복원 범위 확장이 아니다. target 의 "스코프 경계" 절(carousel 잘림 배너는 별개 미구현 항목, 본 PR 이 새로 만든 gap 아님)도 `webchat-widget-presentation-followups.md` 의 기존 항목 분류와 정확히 일치해, 오히려 기존 스코프 경계를 재확인·강화한다.

## 요약
target spec draft 는 `#901`(widget-presentation-restore) 완료 시 Rationale R1~R3 가 명시적으로 유보하고 `webchat-widget-presentation-followups.md` 로 이관해 둔 "표시 계약 선행 결정" 요구를 정확히 이행하는 문서다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았으며, `1-widget-app.md §R8`·`0-common.md §4/§10.4` 의 기존 규범과도 완전히 정합한다. 유일한 권고 사항은 실행 완료 후 followups 트래커의 체크박스 동기화(추적 문서 간 drift 방지)이며 이는 Rationale 연속성 위반이 아니라 후속 관리 절차에 대한 참고 사항이다.

## 위험도
NONE
