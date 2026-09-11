# Plan 정합성 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 발견사항

- **[WARNING]** `15-chat-channel.md` 의 "배선 전 관측값" 서술 3곳이 이번 PR 로 stale 해지는데, 그 정정(planner PR)이 어디에도 실행-항목으로 등재돼 있지 않다
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1(375행) · §5.4.1.1(426행) · §5.4.1.2(411~416행) — 세 자리 모두 *"위 「`code` 없음」은 **배선 전 관측값**이다"* / *"그 PR 이 머지되기 전까지 이 문단은 '아직 안 실린다' 를 서술할 뿐"* 이라고 적혀 있다(실측 확인).
  - 관련 plan: `plan/in-progress/impl-details-code-wiring.md` — "1라운드/2라운드/3라운드 리뷰 처분" 섹션의 `SPEC-DRIFT`(W1) 논의. 3라운드에서 *"세 자리 전부 '배선 전 관측값' 이다 → documentation 이 맞다. planner PR 대상은 3곳(§5.4.1.2 는 필수, 나머지 2곳은 일관성)"* 이라고 명시적으로 결론 내렸다.
  - 상세: 이 PR 의 코드(`triggers.service.ts` 13곳 + `password.util.ts` 2곳)가 이미 `details[].code` 를 배선했으므로, target 문서가 서술하는 *"아직 배선 전"* 상태는 이 PR 이 머지되는 순간 거짓이 된다. plan 은 이 사실을 3라운드에 걸쳐 정확히 진단했지만, 그 결론(*"planner PR 대상은 3곳"*)이 (a) `impl-details-code-wiring.md` 자체의 체크리스트 항목으로도, (b) 장기 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 로도 옮겨지지 않았다 — grep 결과 두 파일 어디에도 "배선 완료"/"배선 전 관측값" 문구를 앵커로 삼은 후속 항목이 없다. 이 plan 문서가 `complete/` 로 이동하면 3라운드에 걸친 이 진단은 review round 산문 속에만 남고 실행 가능한 항목으로는 사라진다.
  - 제안: `impl-details-code-wiring.md` 체크리스트(또는 `spec-draft-nullable-notation-followups.md`)에 *"`15-chat-channel.md` §5.4.1(375)·§5.4.1.1(426)·§5.4.1.2(411-416) — '배선 전 관측값'/'아직 안 실린다' 문구를 배선 완료 기준으로 정정 (planner)"* 항목을 명시적으로 추가한다. plan 을 `complete/` 로 옮기기 전에 반드시 반영.

- **[WARNING]** `authConfigId` details 에 top-level 특화 코드와 `details.code` 를 동시에 실은 것이 target §5.3 "둘을 겹쳐 쓰지 않는다" 규칙과 충돌할 수 있는데, 그 판정을 요구하는 planner 결정이 durable 하게 등재돼 있지 않다
  - target 위치: `spec/5-system/2-api-convention.md` §5.3 "도메인 세부 사유를 어디에 싣는가" — *"둘을 겹쳐 쓰지 않는다 — top-level 을 특화 코드로 바꾸면서 같은 사유를 `details[].code` 에도 넣으면 소비자가 어느 쪽으로 분기할지 갈린다."*
  - 관련 plan: `plan/in-progress/impl-details-code-wiring.md` "3라운드 리뷰 처분" — *"`code: ErrorCode.INVALID_FIELD` 를 실은 13자리 중 12곳은 top-level 이 상태 기본값 `VALIDATION_ERROR` 이고, `authConfigId` 한 곳만 특화 코드 `AUTH_CONFIG_NOT_FOUND` 다 … 그 판정은 §5.3 을 고치는 **planner 결정**이다. developer 가 코드로 선점하면 규약을 코드가 정하는 셈이 된다."*
  - 상세: 실측(`git diff origin/main...HEAD -- codebase/backend/src/modules/triggers/triggers.service.ts`)으로 확인 — 이 PR 이 `assertAuthConfigInWorkspace` 에 `details: { field: 'authConfigId', code: ErrorCode.INVALID_FIELD }` 를 새로 추가했고, 같은 예외의 top-level 은 기존 특화 코드 `code: 'AUTH_CONFIG_NOT_FOUND'` 그대로다. plan 은 이 조합이 §5.3 "겹쳐 쓰지 않는다" 위반 소지가 있다고 스스로 지적하며 *"이 PR 에서 developer 단독으로 결정 못 한다"* 고 명시했음에도, (1) 코드는 되돌리지 않은 채 그대로 두었고 — 코드 사이트에도 이 미해결 상태를 알리는 주석이 없다 — (2) 그 planner 결정 필요성이 `spec-draft-nullable-notation-followups.md` 등 장기 트래커에 등재돼 있지 않다(grep `AUTH_CONFIG_NOT_FOUND` 전체 저장소 검색 결과 `impl-details-code-wiring.md` 산문에만 존재). target 문서 자체도 "field 를 실으면 code 도 싣는다" 규약화 문단이 "field 없는 진단 payload" 예외만 명시할 뿐, "field 있음 + top-level 이 이미 특화 코드" 조합의 처리를 명확히 규정하지 않아 이 경계가 spec 상으로도 실제 모호하다.
  - 제안: (a) `authConfigId` 사이트에 이 미해결 상태를 가리키는 주석(또는 이번 처럼 트래커 항목 앵커)을 남기고, (b) `spec-draft-nullable-notation-followups.md` 에 *"`authConfigId` — top-level 특화 코드 + `details.code=INVALID_FIELD` 동시 존재가 §5.3 '겹쳐 쓰지 않는다' 위반인지 planner 판정 필요"* 항목을 신설해 이 plan 이 `complete/` 로 이동해도 결정 필요 상태가 유실되지 않게 한다.

## 요약

이 브랜치의 target(`spec/5-system/`)은 diff 상 0건 변경이라 target 자체가 plan 의 미해결 결정을 일방적으로 뒤집는 사례는 없다. 다만 이번 PR 의 근거 plan(`impl-details-code-wiring.md`)이 3라운드에 걸친 자체 리뷰에서 두 가지 target-관련 후속 조치 — (1) `15-chat-channel.md` 세 자리의 "배선 전" 서술이 머지 즉시 stale 해진다는 SPEC-DRIFT, (2) `authConfigId` 의 top-level 특화 코드와 `details.code` 동시 존재가 target §5.3 의 명시 금지 규칙과 충돌할 수 있어 planner 판정이 필요하다는 점 — 을 정확히 진단해 놓고도, 그 결론을 체크리스트나 장기 트래커 같은 durable 한 자리로 옮기지 않았다. 두 항목 모두 review round 산문 속에서만 존재해 이 plan 이 `complete/` 로 이동하는 순간 유실될 위험이 있다. 코드 자체의 정합성(뮤테이션·e2e 검증)은 plan 이 스스로 꼼꼼히 확인했으므로 이 보고서는 그 부분을 재검토하지 않았다.

## 위험도
MEDIUM
