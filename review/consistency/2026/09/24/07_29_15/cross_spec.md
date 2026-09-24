# Cross-Spec 일관성 검토 — `spec/5-system` (impl-prep)

검토 대상 작업: `removeMember()` owner 보호 가드의 TOCTOU 수정
(`plan/in-progress/member-owner-toctou.md`, `spec_impact: none`).
target 문서 자체는 이번 PR 로 바뀌지 않으므로, 본 검토는 **현재 커밋된
`spec/5-system` (특히 `1-auth.md` §3.2 † · `2-api-convention.md` · `3-error-handling.md`)이
다른 영역과 이미 정합적인지, 그리고 계획된 구현이 그 정합을 깨뜨릴 여지가 있는지**를 확인한다.

## 발견사항

- **[INFO]** `CANNOT_REMOVE_OWNER` 가 중앙 에러 카탈로그(`3-error-handling.md` §1)에 미등재
  - target 위치: `spec/5-system/1-auth.md` §3.2 각주 † (line 377-381) — `CANNOT_REMOVE_OWNER` 를
    `removeMember()` 의 대상-조건 거부 코드로 정의
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1 (에러 코드 공용 카탈로그). 같은 워크스페이스
    멤버십 계열 코드 중 `CANNOT_ASSIGN_OWNER` 는 §1.9 에 도메인-참조 패턴으로 등재돼 있으나
    (line 226), `CANNOT_REMOVE_OWNER` · `OWNER_ROLE_PROTECTED`(`data-flow/12-workspace.md:139`) ·
    `SOLE_OWNER_CANNOT_LEAVE`(`data-flow/12-workspace.md:189`) 세 코드는 등재돼 있지 않다
  - 상세: `3-error-handling.md` 자체가 이 갭을 이미 알고 있다 — §1.9 Rationale(line 660)에
    "그 외 workspace role/membership 관리 코드(`SOLE_OWNER_CANNOT_LEAVE` 등)는 별도 pass" 라고
    명시적으로 유예해 두었다. 즉 이번 PR 이 만든 갭이 아니라 **기존에 알려진, 의도적으로 미룬
    상태**다. 모순은 아니지만 코드가 실제로 호출하는 에러 코드와 카탈로그 문서 사이의 완결성
    격차이며, 지금 손대는 경로가 정확히 이 코드를 던지는 지점이라 동기화 기회로 겹친다
  - 제안: 이번 PR 의 스코프는 아니다(plan §F 가 이미 "권한 검사 순서 오라클" 등 인접 사안을
    별도 트래커로 분리했고, 이 갭도 같은 성격). `spec_impact: none` 판단을 바꿀 근거는 아니며,
    별도 소규모 spec PR(§1.9 후속 "별도 pass")로 `CANNOT_REMOVE_OWNER`·`OWNER_ROLE_PROTECTED`·
    `SOLE_OWNER_CANNOT_LEAVE` 세 코드를 함께 등재하는 편이 낫다

## 정합성 확인 (충돌 없음, 기록용)

- **DELETE 엔드포인트 계약**: `data-flow/12-workspace.md:141` (`DELETE
  /api/workspaces/:id/members/:memberId | owner/admin | ... owner 는 제거 불가. 본인 제거는
  자가 탈퇴(leaveWorkspace)로 위임`) 이 `1-auth.md` §3.2 † 와 정확히 같은 계약을 서술한다.
  `2-navigation/9-user-profile.md:378` 도 동일 엔드포인트를 같은 의미로 가리킨다. 세 문서가
  이미 한 방향을 가리키고 있어 이번 구현이 계약을 바꾸지 않는다는 plan 의 전제(§C)와 일치한다.
- **동시성 메커니즘은 스펙이 강제하지 않음**: `data-flow/12-workspace.md` 는 형제 엔드포인트
  `DELETE /api/workspaces/:id`(line 188)와 `POST /api/workspaces/:id/leave`(line 189)에 대해서는
  "비관적 락 트랜잭션" 메커니즘을 명시하지만, 지금 고치는 `DELETE
  .../members/:memberId`(line 141)에는 메커니즘을 전혀 기술하지 않는다 — 결과("owner 는 제거
  불가")만 계약이다. 따라서 plan 이 택한 무락 조건부 `delete()` + fallback read 방식은 이 문서와
  모순되지 않는다(메커니즘이 spec 의 규율 대상이 아니므로 "새 락을 들이지 않는다" 선택이 다른
  영역의 명시적 잠금 순서 규약과 충돌할 여지도 없다 — 잠금 순서 규약이 적용되는 경로 자체가
  아니다).
- **RBAC/데이터 모델**: `1-data-model.md:124` 의 `role` enum(`owner/admin/editor/viewer`) 과
  `1-auth.md` §3.1/§3.2 의 역할 정의가 일치한다. 이번 PR 은 enum 이나 `WorkspaceMember` 필드를
  건드리지 않는다.
- **감사 로그**: `data-flow/1-audit.md:75` 의 `member.removed`(`removeMember`·`leaveWorkspace`,
  `details.mode='removed'|'left'`) 액션 정의는 이번 변경으로 바뀌는 응답 코드·트리거 조건과
  무관하다(가드가 막는 경로는 audit 기록 이전에 403 으로 끝난다).
- **API 컨벤션**: `2-api-convention.md` §3 은 DELETE 를 멱등(O)으로 분류한다. 이번 수정은 반복
  호출 시 응답을 토글시키지 않는다(승격 완료 후에는 일관되게 `CANNOT_REMOVE_OWNER`) — 위반 없음.

## 요약

target(`spec/5-system`, 특히 `1-auth.md` §3.2·`3-error-handling.md`)은 이번에 착수하는
`removeMember()` TOCTOU 수정과 관련해 `data-flow/12-workspace.md`·`2-navigation/9-user-profile.md`·
`1-data-model.md` 와 이미 정합적이며, 계획된 구현은 스펙이 규율하지 않는 "메커니즘" 층위의
변경이라 계약 문서와 충돌하지 않는다(`spec_impact: none` 판단은 타당). 유일한 관찰 사항은
`CANNOT_REMOVE_OWNER`/`OWNER_ROLE_PROTECTED`/`SOLE_OWNER_CANNOT_LEAVE` 가 중앙 에러 카탈로그에
아직 등재되지 않은 기존 갭으로, 문서 자신이 이미 "별도 pass" 로 유예해 둔 것이라 이번 PR 을
막을 이유는 아니다.

## 위험도

LOW
