# Rationale 연속성 검토 — `spec/5-system` (--impl-done)

대상: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (+ 대응 unit/e2e 테스트) —
`removeMember()` 판정 순서 재배치(`plan/in-progress/member-auth-order.md`). scope(`spec/5-system`)
델타는 0(코드 전용 PR). 비교 대상 Rationale: `spec/5-system/1-auth.md` §3.2 정정(2026-07-28) ·
`spec/data-flow/12-workspace.md` §"멤버십 검증은 가드 1곳에서"(2026-08-08) · `spec/5-system/1-auth.md`
§"부트 캐너리"(2026-08-09) · `spec/5-system/3-error-handling.md` §1.2.

본 라운드는 동일 plan 의 `--impl-prep`(`review/consistency/2026/09/24/10_22_24`)
`rationale_continuity` **WARNING 1**(risk MEDIUM) 에 대한 후속 확인이다.

## 발견사항

없음 (CRITICAL/WARNING 없음). 이전 라운드 WARNING 1 은 실측상 해소됐다 — 근거는 아래 요약.

- **[INFO]** 이전 WARNING 의 해소가 실제 diff 로 반영됐는지 재확인 완료 — 기록용
  - target 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:814-906`
    (`removeMember` 본문·주석), `plan/in-progress/member-auth-order.md` §B-2(94~119행)
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` `## Rationale` → "멤버십 검증은 가드
    1곳에서 — `@Roles()` 와 무관 (2026-08-08)" — 기각된 대안 "73개 라우트에 `@Roles('viewer')`
    부착"(사유: "opt-in 모델의 연장이라 74번째 라우트에서 같은 누락이 재발한다")
  - 상세: 10_22_24 라운드는 "`removeMember` 에 수동 멤버십 체크를 끼워 넣는 처방이, 이
    저장소가 두 번(§"멤버십 검증은 가드 1곳에서" · §"부트 캐너리") 명시적으로 근거를 남기며
    기각한 opt-in/수동-체크 계열과 같은데 plan 이 그 Rationale 을 인용·반박하지 않는다"고
    지적했다. 실측 결과 `member-auth-order.md` §B-2 가 그 WARNING 을 **직접 인용**하고 세
    근거로 반박한다: (1) 기각 대상은 "73개 라우트 전체에 마커를 붙이는 체계적 처방"이지 이
    PR 은 그런 일반화를 자처하지 않고 13-라우트 축을 별 항목으로 분리했다(§E), (2) 2026-08-08
    결정의 모집단은 `handlerConsumesWorkspaceId`(= `@WorkspaceId()` 소비)로 **연산적으로**
    정의돼 있고 `removeMember`(`@Param('id')` 사용)는 애초에 그 모집단 밖이었다 — 위반이
    아니라 대상 밖, (3) `assertAdmin` 은 이미 비-멤버를 거부하고 있었다(`role` falsy 분기) —
    이번 변경은 새 인가 층이 아니라 기존 인가의 **재배치**(무엇을 판정하느냐가 아니라 언제
    판정하느냐). `/switch`·`leaveWorkspace` 가 이미 같은 서비스-계층 `NOT_A_MEMBER` 패턴을
    쓴다는 선례도 인용해(`3-error-handling.md:49`) "신규 패턴 도입"이 아니라 "기존 3번째
    채널의 정합화"로 재프레이밍했다. 13-라우트 축 후속 항목에는 "구조적 해법(가드/reflection
    확장)을 **먼저** 검토하고, 불가할 때에만 라우트별 수동 체크를 표준 패턴으로 승인한다"는
    조건이 명시적으로 걸려 있어(`plan/in-progress/spec-draft-nullable-notation-followups.md`
    4926~4953행), 10_22_24 가 요구한 "이 PR 이 13개에 같은 패치를 복제하는 선례로 읽히지
    않게 조건화" 요구도 충족한다.
  - 제안: 없음(이미 반영됨). 다만 13-라우트 축 항목이 실제로 착수될 때, 구조적 해법이
    채택되든 기각되든 그 결론은 `data-flow/12-workspace.md` §"멤버십 검증은 가드 1곳에서"의
    "적용 범위"를 갱신하는 spec Rationale 항목으로 남겨야 한다(현재는 plan 트래커에만 있다) —
    그래야 다음 사람이 "멤버십 검증이 가드 1곳으로 수렴한다"는 문장을 읽고 `workspaces.controller.ts`
    의 13개 라우트도 그 안에 있다고 오해하지 않는다.

- **[INFO]** `assertAdmin()` 호출을 근거로 든 기존 Rationale 서술 3곳이 이번 리팩터로
  낡았다는 점은 이미 developer 가 인지·처리 완료
  - target 위치: `spec/5-system/1-auth.md:551`(§3.2 정정 노트) ·
    `spec/5-system/3-error-handling.md:46`(`ADMIN_REQUIRED` 발행처 서술) · 동 파일 `:49`
    (`NOT_A_MEMBER` 발행 경로 열거)
  - 과거 결정 출처: `spec/5-system/1-auth.md` §3.2 "멤버 관리 행의 Admin 열 정정
    (2026-07-28)" — "`WorkspacesService.removeMember()` 는 `assertAdmin(workspaceId,
    requesterId)` 만 요구한다"는 실측을 근거로 인용; `3-error-handling.md` §1.2 카탈로그
  - 상세: `removeMember` 가 이제 `assertAdmin()`을 호출하지 않고 `getMemberRole` +
    `throwAdminRequired()`/`throwNotAMember()`를 직접 쓰므로, 위 세 서술의 **결론**
    ("Admin 이 멤버 삭제 가능"·`ADMIN_REQUIRED`/`NOT_A_MEMBER`의 의미)은 그대로 참이지만
    **근거로 인용된 호출 경로 문구**가 낡았다. `spec/` 은 developer 쓰기 권한 밖이라 자기
    반증형 소정정 대상도 아니다(§3.2 노트는 developer 가 쓴 문장이 아니고, 예고·트리거
    문장도 아니다). `plan/in-progress/spec-draft-nullable-notation-followups.md`(4974~4989행)에
    planner 항목으로 정확히 이 세 자리·이유가 등재돼 있어 누락되지 않는다.
  - 제안: 없음(이미 등재됨). planner 턴에서 처리 시 위 항목을 그대로 근거로 쓰면 된다.

## 요약

`removeMember()` 판정 순서 재배치는 기각된 대안을 이유 없이 재도입하지 않는다 — 오히려
직전 `--impl-prep` 라운드가 지적한 "두 번 기각된 opt-in/수동-체크 패턴의 재도입" 우려에 대해
plan 문서(`member-auth-order.md` §B-2)가 관련 Rationale 둘을 직접 인용하고, "이 라우트가애초에
그 결정의 모집단 밖이었다"·"새 인가 층이 아니라 기존 인가의 재배치다"·"`/switch`·`leaveWorkspace`
선례와 동형이다"라는 세 근거로 논증한 뒤 설계를 실제로 조정했다(admin 판정을 owner 판정
앞으로). 13-라우트 커버리지 축이라는 더 큰 구조적 질문은 열려 있지만, 이 PR 스코프 밖으로
명시적으로 분리되었고 "구조적 해법 우선 검토" 조건이 걸린 별도 backlog 항목으로 등재돼 있어
연속성 단절이 아니다. `CANNOT_REMOVE_OWNER → ADMIN_REQUIRED` wire 코드 변경(비-admin 멤버가
owner 를 지목하는 좁은 경로)은 §3.2 각주("Admin 의 멤버 삭제…")가 admin 을 주어로 적고 있어
그 서술과 충돌하지 않는다. `assertAdmin()` 호출을 근거로 든 기존 Rationale 서술 3곳의 drift 는
developer 권한 밖으로 올바르게 planner 항목으로 넘겨져 있다. 남은 리스크는 "13-라우트 축"이
실제로 닫힐 때 그 결론이 spec Rationale(현재는 plan 트래커에만 있음)에도 반영돼야 한다는
절차적 당부뿐이다.

## 위험도

LOW
