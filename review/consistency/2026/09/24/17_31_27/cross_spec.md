# Cross-Spec 일관성 검토 — `spec/5-system` (--impl-prep)

## 범위와 방법

target 은 `spec/5-system` 전체(17개 파일 + `_product-overview.md`)이나, 조립 프롬프트는
컨텍스트 예산으로 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 세 파일만
전문을 실었고 나머지 15개는 절단됐다. 절단된 파일을 "내용 없음" 으로 간주하지 않고,
실제 구현 배경(이 --impl-prep 이 `nestjs-v12-coordinated-upgrade` 플랜의 착수 전 검토이며
`auth-guard-reflection-hardening` 플랜과 직결된다는 점)에 맞춰 아래를 **직접 `Read`/`grep`
으로 열어 대조**했다:

- `spec/5-system/1-auth.md`(전문) · `2-api-convention.md`(전문) · `3-error-handling.md`(§1 카탈로그 전체)
- `spec/data-flow/12-workspace.md`(§1.5 워크스페이스 전환·RBAC 표·"멤버십 검증은 가드 1곳에서" Rationale)
- `spec/2-navigation/9-user-profile.md`(§6.1 API 표 — 이메일 변경·세션·초대 엔드포인트)
- `spec/2-navigation/6-config.md`(§A.4 AuthConfig 권한·엔드포인트)
- `spec/conventions/error-codes.md`(§3 historical-artifact 레지스트리)
- `spec/conventions/audit-actions.md`(§2 시제 분류·레지스트리)
- `spec/5-system/14-external-interaction-api.md`(terminal-revoke 부트 가드 대목)
- `plan/in-progress/nestjs-v12-coordinated-upgrade.md`·`auth-guard-reflection-hardening.md`(이 검토가 실제로 무엇을 준비하는지)

## 발견사항

이번 대조에서 **CRITICAL·WARNING 급 cross-spec 모순은 발견하지 못했다.** 아래는 모두 확인만 하고 이상이 없었던 항목이며, 참고용으로 남긴다.

- **[INFO]** RBAC 매트릭스(§3.2) — Admin 멤버 삭제·Auth Config 권한 분리는 이미 정합
  - target 위치: `1-auth.md` §3.2 표 + 각주("Admin 멤버 삭제의 대상 제약")
  - 충돌 대상: `data-flow/12-workspace.md`(§3.2 "admin | ✓ (owner 제외)") · `2-navigation/9-user-profile.md`(§4.2) · `2-navigation/6-config.md`(§A.4 권한 문단, "Auth Config: Owner/Admin = CRUD, Editor/Viewer = R")
  - 상세: 세 문서 모두 동일한 서술("Admin 은 멤버 제거 가능하되 대상이 Owner 면 거부", "Auth Config Reveal 은 Admin+ 전용")을 공유한다. 이는 과거(2026-07-28) CRITICAL 이 이미 여기서 발견·정정된 이력이 있고(`1-auth.md` Rationale "§3.2 '멤버 관리' 행의 Admin 열 정정" 참조), 최근 커밋(`#1384`·`#1385`, 2026-09-24 — `removeMember` 인가 순서·owner 승격 TOCTOU 가드)도 **동일한 문서화된 결과**(대상=Owner 면 거부)를 유지한 채 구현 순서만 바꿨을 뿐이라 spec 과 불일치하지 않는다(두 커밋 모두 `spec_impact: none`, 그리고 이미 이 저장소의 해당 시점 `--impl-prep`/`--impl-done` cross_spec 라운드에서 검토됨).
  - 제안: 조치 불요. 새로 발견된 모순이 아니라 기존에 이미 닫힌 사안임을 확인했다.

- **[INFO]** 에러 코드 카탈로그의 domain-SoT 위임 구조 — 등재처와 SoT 가 어긋나지 않음
  - target 위치: `3-error-handling.md` §1.2.1·§1.9·§1.10·§1.11 등 "도메인 spec 참조" 절들
  - 충돌 대상: `data-flow/12-workspace.md` §1.9, `conventions/error-codes.md` §3(historical-artifact), `conventions/audit-actions.md` §2
  - 상세: `1-auth.md`/`3-error-handling.md`가 인용하는 코드(`ALREADY_A_MEMBER`/`already_a_member` lowercase 분리, `CANNOT_ASSIGN_OWNER`, `WORKSPACE_TYPE_MISMATCH`, 초대 흐름 lowercase historical-artifact 5종)가 `conventions/error-codes.md` §3 레지스트리·`data-flow/12-workspace.md` §1.9 실제 서술과 문자 그대로 일치한다. 감사 액션 시제 규약(§4.1 카탈로그)도 `conventions/audit-actions.md` §2 레지스트리와 완전히 일치한다(`trigger.notification_secret_rotated` 등 3종의 "과거분사" 분류·근거 포함).
  - 제안: 조치 불요.

- **[INFO]** 부트 캐너리(`assertWorkspaceIdReflectionWorks`) 서술 — 이번 nestjs12 업그레이드가 직접 건드릴 지점인데 spec 간 수치·근거가 정합
  - target 위치: `1-auth.md` §Rationale "부트 캐너리 — `@WorkspaceId()` reflection 자가검증"
  - 충돌 대상: `data-flow/12-workspace.md` §"멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관"(73건 실측·fail-open 근거)
  - 상세: 두 문서가 상호 참조(anchor)하며 "캐너리가 세는 집합(전체 `@WorkspaceId()` 소비 라우트) ≠ 73건(그중 `@Roles()` 없는 부분집합)"이라는 동일한 구분을 양쪽에서 일관되게 서술한다. `nestjs-v12-coordinated-upgrade.md` §C 가 "부트 캐너리의 소비 라우트 수를 업그레이드 전/후로 비교"를 요구하는데, 그 근거로 인용하는 spec 서술 자체는 self-consistent 하다 — 즉 구현 착수 시 spec 쪽에서 추가로 정정할 것은 없다.
  - 제안: 조치 불요. (실행 시 유의할 점은 spec 문제가 아니라 구현 검증 문제이므로 plan 항목 그대로 진행)

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 ② 가 이미 라이브 spec 에 반영된 것으로 보임 (경계상 cross-spec 소관 아님)
  - target 위치: `2-api-convention.md` §2.2 "예외 — 인증 상태 전이·capability 액션" 행
  - 충돌 대상: `plan/in-progress/spec-draft-nullable-notation-followups.md` ② 절이 제안하는 "세 번째 예외 조항" 변경안 텍스트
  - 상세: 플랜 초안이 제안하는 문구가 현재 `2-api-convention.md` §2.2 표에 **문자 그대로 이미 존재**한다. spec 자체의 모순은 아니지만, planner 백로그 문서가 이미 적용된 변경을 "미적용 draft" 로 들고 있어 다음 사람이 중복 작업을 할 위험이 있다. 이 판단은 본 checker 의 소관(cross-spec 영역 간 모순)보다는 plan-coherence 영역에 더 가깝다 — 같은 세션에서 병행 실행되는 `plan_coherence` 체커가 검출하는 것이 정확한 자리라 판단해 CRITICAL/WARNING 이 아닌 INFO 로만 남긴다.
  - 제안: `plan_coherence` 체커 결과와 교차 확인. 만약 거기서도 못 잡으면 plan 문서의 ② 절을 "적용 완료" 로 갱신하거나 `plan/complete/` 로 이관 검토.

## 요약

`spec/5-system`(특히 전문이 실린 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)은 데이터 모델·API 계약·요구사항 ID·RBAC·계층 책임 모든 축에서 다른 영역(`data-flow/12-workspace.md`·`2-navigation/9-user-profile.md`·`2-navigation/6-config.md`·`conventions/error-codes.md`·`conventions/audit-actions.md`)과 대조한 결과 **새로 발견된 모순이 없다**. 이는 우연이 아니라, 각 파일이 과거 CRITICAL 발견(예: §3.2 Admin 열 정정, 계정 잠금 알림 문구 정정, `410` 기본값 미신설 등)을 Rationale 로 남기고 상호 anchor 참조를 정교하게 유지해 온 결과로 보인다. 이번 --impl-prep 이 실제로 준비하는 작업(NestJS 12 업그레이드 중 `RolesGuard`/`@WorkspaceId()` reflection 안전성 재검증)과 관련된 spec 서술(부트 캐너리·73건 부분집합 구분)도 두 문서 간 정합이 확인되어, 구현 착수를 막을 spec 층위의 문제는 없다. 유일하게 언급할 만한 것은 cross-spec 영역이 아니라 plan-coherence 영역에 걸친 경계 사례(이미 적용된 변경이 여전히 "draft" 로 남아 있는 백로그 항목)뿐이다.

## 위험도

NONE
