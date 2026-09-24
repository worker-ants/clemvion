# Rationale 연속성 검토 — `spec/5-system` (--impl-prep)

대상: `plan/in-progress/member-auth-order.md` (removeMember 권한 검사 순서 재배치) vs
`spec/5-system/1-auth.md`·`spec/5-system/3-error-handling.md`·`spec/data-flow/12-workspace.md` 의 `## Rationale`.

## 발견사항

- **[WARNING]** 처방이 "한 라우트가 opt-in 수동 체크를 잊으면 재발한다" 는, 이 저장소가 이미 두 번 명시적으로 근거로 삼은 실패 유형을 다시 쓰면서 그 긴장을 인지하지 않는다
  - target 위치: `plan/in-progress/member-auth-order.md` §B "처방"(38~64행, 특히 44~49행 코드블록과 60~64행 "조회를 두 번 돌리지 않는다") 및 §E "하지 않는 것"(88~100행)
  - 과거 결정 출처:
    - `spec/data-flow/12-workspace.md` `## Rationale` → "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관 (2026-08-08)" — **기각된 대안**: "73개 라우트에 `@Roles('viewer')` 부착" (기각 사유: "opt-in 모델의 연장이라 74번째 라우트에서 같은 누락이 재발한다")
    - `spec/5-system/1-auth.md` `## Rationale` → "부트 캐너리 — `@WorkspaceId()` reflection 자가검증 (fail-closed, 2026-08-09)" §(b) — `SetMetadata`+`Reflector` opt-in 마커를 "**재기각**"하며 그 근거로 "다음 라우트에서 같은 누락이 재발한다 — 이 저장소가 이미 최소 2회 겪었다" 를 명시
  - 상세: 두 Rationale 은 **동일한 결론**을 두 번 반복해서 못 박았다 — 워크스페이스/멤버십 검증을 "라우트마다 사람이 기억해서 붙이는" 방식(데코레이터든 마커든)은 구조적으로 신뢰할 수 없고, 실제로 이 저장소에서 최소 2회 재발했다는 것이 기각의 근거다. `member-auth-order.md` 가 고치려는 버그 자체가 바로 그 실패 유형의 구체 사례다 — `removeMember()` 는 이미 `assertAdmin` 이라는 "사람이 넣은" 검사를 갖고 있었지만 **순서**가 틀려 존재 오라클이 됐다. 이번 처방(§B)은 같은 계열의 해법이다: `getMemberRole` 을 이 메서드 맨 앞에 **수동으로** 끼워 넣는다. 구조적으로 이 라우트가 가드 커버리지 밖(`@Param('id')`, `@WorkspaceId()` 미사용)에 있다는 점(§E 인지)까지 고려하면, "가드가 경로 파라미터 워크스페이스도 보게 할 것인가" 라는 구조적 대안이 이미 존재하고 그것이 바로 위 두 Rationale 이 반복해서 선호한 방향(마커/opt-in 대신 부팅 캐너리 같은 구조적 보장)인데, plan 은 그 방향을 검토·기각하는 논증 없이 그냥 "이 PR 스코프 아님" 으로 미루고 이번에는 또 다른 수동 패치를 채택한다. 두 Rationale 을 인용도, 반박도 하지 않은 채 같은 실패 계열의 처방을 반복하는 것 자체가 연속성 문제다 — 다음에 유사한 멤버 관리 라우트가 추가되면 같은 누락이 세 번째로 재발할 조건이 그대로 남는다.
  - 제안: §B 또는 §E 에 위 두 Rationale 을 명시적으로 인용하고 "왜 이번엔 수동 패치가 맞는가"(예: `/switch`·`leaveWorkspace` 가 이미 같은 수동 패턴을 쓰고 있어 신규 패턴이 아니라 기존 관행 확장이라는 점 — 아래 두 번째 발견 참고)를 한 문단으로 못박을 것. 그리고 §E 에서 별 항목으로 등재하기로 한 "13-라우트 축" 항목의 스코프에 "가드/reflection 확장 같은 **구조적** 해법을 우선 검토하고, 그것이 불가하다는 결론이 나올 때만 라우트별 수동 체크를 표준 패턴으로 승인한다" 는 조건을 넣을 것 — 그래야 부트 캐너리 Rationale 의 "opt-in 재기각" 판단과 정합한 결정 경로가 만들어진다.

- **[INFO]** 처방이 신규 패턴이 아니라 기존 관행(`/switch`·`leaveWorkspace`)의 확장이라는 점이 plan 에 근거로 인용되지 않았다
  - target 위치: `plan/in-progress/member-auth-order.md` §B (51~64행 "왜 이것이 완전한 차단인가")
  - 과거 결정 출처: `spec/5-system/1-auth.md` §5 API 엔드포인트 표 — `POST /api/auth/workspaces/:id/switch` 행("대상 멤버십 검증(비멤버 `403 NOT_A_MEMBER`) 후 … 재발급") 및 `spec/5-system/3-error-handling.md` §1.2 `NOT_A_MEMBER` 카탈로그("전환·탈퇴·멤버십 확인 경로")
  - 상세: `NOT_A_MEMBER` 카탈로그 자체가 이미 "전환(`/switch`)·탈퇴(`leaveWorkspace`)" 두 경로에서 정확히 같은 모양(`:id` 경로 파라미터로 워크스페이스 지정, 가드 커버리지 밖, 서비스 레벨에서 명시적 멤버십 체크 후 403)의 처리를 문서화하고 있다. plan 의 §B 는 `assertMembership`(기존 헬퍼, 889/902행 언급)을 재사용하는 것으로 보이는데도 이 선례를 근거로 들지 않아, 위 WARNING 항목에서 지적한 "신규 수동 패치" 로 읽힐 여지를 스스로 키운다. 실제로는 기존 3개 채널(전환·탈퇴에 이은 3번째) 중 하나를 정합화하는 것에 가깝다.
  - 제안: §B 에 "이 패턴은 `/switch`·`leaveWorkspace` 가 이미 쓰고 있는 `NOT_A_MEMBER`(§1.2) 처리와 동형이다" 한 문장을 추가해, 위 WARNING 이 요구하는 "왜 수동 패치가 맞는가" 논증의 근거로 삼을 것.

- **[INFO]** `NOT_A_MEMBER` 카탈로그(§1.2)의 발행처 열거가 구현 이후 stale 해지는 것을 developer 가 이미 인지하고 planner 항목으로 넘겼다 — 연속성 자체는 문제 없으나 누락 방지용 확인
  - target 위치: `plan/in-progress/member-auth-order.md` §E 99~100행("`NOT_A_MEMBER` 카탈로그 설명의 경로 열거에 이 자리를 추가하는 것 … planner 항목으로 등재한다") 및 체크리스트 109행
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` §1.2 `NOT_A_MEMBER` 행 — 현재 "전환·탈퇴·멤버십 확인 경로" 만 열거, `removeMember` 미포함
  - 상세: 이것은 규칙 위반이 아니라(§ CLAUDE.md `developer` 는 `spec/` write 불가) 올바른 처리다. 다만 "멤버십 확인 경로" 라는 기존 문구가 이미 `removeMember` 를 포함하는 것으로 **오독**될 소지가 있어(§C 관측표의 "구분 불가" 결과와 맞물려), planner 항목 생성 시 이 문구를 "멤버십 확인" 이 정확히 무엇을 가리켰는지(발행 당시 커밋/근거) 재확인하지 않으면 카탈로그가 조용히 부정확해질 수 있다.
  - 제안: planner 항목에 §A 실측표(현재 emission site 3종: 전환·탈퇴·`removeMember`)를 그대로 인용해 §1.2 갱신 시 근거로 쓸 것.

## 요약

`member-auth-order.md` 는 RBAC 매트릭스(§3.2, Admin 열 CRUD)·`CANNOT_REMOVE_OWNER` 각주·`NOT_A_MEMBER`(403) 코드 의미·"존재 누설 방지" 철학(MODEL_CONFIG/ALERT_RULE cross-kind 404 동형) 등 spec 본문·기존 Rationale 과 충돌하지 않으며, 카탈로그 갱신을 developer 권한 밖으로 올바르게 넘긴다. 다만 처방의 핵심 메커니즘(개별 메서드에 수동 멤버십 체크를 끼워 넣는 것)이, 이 저장소가 **두 번** 명시적으로 근거를 남기며 "재발한다" 고 기각한 opt-in/수동-체크 패턴과 같은 계열이라는 점을 plan 이 인지·반박하지 않는다 — 정확히 그 실패 유형이 이번에 고치려는 버그 자체였다는 점에서 이 누락은 가볍지 않다. `/switch`·`leaveWorkspace` 선례를 근거로 들면(관행의 확장으로 재-프레이밍) 상당 부분 해소되지만, 그 인용이 plan 에 없고 "13-라우트 축" 후속 항목이 구조적 해법을 우선 검토하도록 조건화돼 있지도 않다.

## 위험도

MEDIUM
