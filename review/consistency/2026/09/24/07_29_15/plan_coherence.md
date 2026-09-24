# Plan 정합성 검토 — spec/5-system (--impl-prep, member-owner-toctou)

## 검토 대상

- Target: `spec/5-system` (17개 파일 번들, 핵심은 `1-auth.md`)
- 착수 plan: `plan/in-progress/member-owner-toctou.md` — `removeMember()` 의 owner 보호
  가드가 무락 `findOne` 위에 있어 TOCTOU 로 뚫리는 결함을, 새 락 없이
  `delete({ id, workspaceId, role: Not('owner') })` + `affected===0` 분기로 닫는 처방.
  `spec_impact: none` 선언.
- 소스 트래커: `plan/in-progress/spec-draft-nullable-notation-followups.md` L4905
  "`removeMember()` 의 owner 보호 가드가 TOCTOU 로 뚫린다 — 실측 확인됨" 항목.

## 발견사항

해당 없음 — CRITICAL/WARNING/INFO 어느 등급도 발견하지 못했다.

검토 근거:

1. **미해결 결정과의 충돌 (없음)**: 같은 트래커에 인접한 미해결 항목
   "`removeMember()` 의 권한 검사가 대상 조회·owner 판정보다 뒤에 있어 존재
   오라클이 된다" (L4859, 중간 우선순위, 별도 에러 코드 계약 변경 필요)를 target plan
   §F "하지 않는 것"에서 명시적으로 범위 밖으로 선언했다. 실제 코드
   (`workspaces.service.ts:795-834`)를 확인한 결과 이 plan의 처방은 `assertAdmin`
   통과 **이후**의 원자적 DELETE 단계에서만 술어를 추가하며, `assertAdmin` 이전의
   조회 순서(존재 → self-위임 → owner 403 → admin 403)는 건드리지 않는다 — 미해결
   항목이 서술하는 응답 3분기(404/`CANNOT_REMOVE_OWNER`/`ADMIN_REQUIRED`)를
   변경하거나 그 결정을 우회하지 않는다.
   또한 같은 트래커의 아직 열려 있는 "`workspaces.controller.ts` 200 vs 204" 항목
   (L4849)과도 무관한 계층(서비스 DELETE 문 vs 컨트롤러 HTTP status)이라 충돌하지
   않는다.

2. **선행 plan 미해소 (없음)**: 이 plan 이 전제하는 "형제 아홉(#1369~#1376) 무락 원자적
   DELETE 패턴"은 `plan/complete/member-dup-remove.md`·`integration-dup-delete.md`·
   `authconfig-dup-delete.md`·`modelconfig-dup-delete.md`·`webauthn-dup-delete.md`·
   `trigger-dup-delete.md`·`schedule-dup-delete.md` 로 전부 `complete/` 이동이
   확인된다 — 선행 조건 미해소 없음. `transferOwnership` 이 대상 행에
   `pessimistic_write` 를 쥔다는 처방의 전제도 코드 실측과 별개로 plan 자체가
   "검증할 주장"으로 명시(§B)하고 e2e 로 행사하도록 체크리스트(§E)에 넣어 두었다 —
   plan 문서 내에서 전제/검증 구분이 이미 되어 있다.

3. **후속 항목 누락 (없음)**: `spec/5-system/1-auth.md` §3.2 각주(†, L402-406)와
   Rationale "§3.2 '멤버 관리' 행의 Admin 열 정정"(L547-565)은 이미 "대상이 Owner 인
   경우 거부된다(`CANNOT_REMOVE_OWNER`)"만 서술하고 동시성 여부는 언급하지 않는다 —
   이 plan 의 처방은 그 문장을 동시성 하에서도 참으로 만드는 강화이지 문장 자체를
   바꾸지 않으므로 `spec_impact: none` 판단은 target 문서와 정합한다. 에러 코드
   (`CANNOT_REMOVE_OWNER`·`MEMBER_NOT_FOUND`)도 기존 값을 그대로 재사용하며 신규
   코드가 없어 `spec/5-system/3-error-handling.md` 갱신도 불요하다.
   `plan/in-progress/spec-sync-auth-gaps.md`·`auth-guard-reflection-hardening.md`
   (같은 auth 영역 in-progress plan 2건)를 전수 확인했으나 `removeMember`·
   `CANNOT_REMOVE_OWNER`·`workspaces.service` 를 참조하는 항목이 없어, 이 plan 의
   변경이 무효화하거나 새로 만들어야 할 후속 항목이 그 두 plan 에 없다
   (`grep -rl` 로 전체 `plan/in-progress/**` 대조 시 이 결함을 언급하는 파일은
   `member-owner-toctou.md` 와 소스 트래커 자신뿐이다).

## 요약

`member-owner-toctou.md` 는 자신이 닫으려는 결함을 등재한 트래커 항목(L4905)과
정확히 대응하고, 같은 트래커의 인접 미해결 항목(권한 검사 순서 오라클·204/200
불일치)을 일방적으로 건드리지 않도록 §F 에서 명시적으로 경계를 그었다. target
문서(`spec/5-system/1-auth.md`)의 기존 서술·Rationale 은 이 plan 의 `spec_impact: none`
판단과 충돌하지 않으며, 전제로 삼는 선행 PR(형제 아홉의 원자적 DELETE 패턴)은 모두
`plan/complete/` 로 확인된다. 같은 auth 영역의 다른 in-progress plan 두 건도 이
결함과 무관해 후속 항목 누락도 없다. Plan 정합성 관점에서 차단 사유 없음.

## 위험도

NONE
