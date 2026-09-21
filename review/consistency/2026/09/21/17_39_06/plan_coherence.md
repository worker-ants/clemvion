# Plan 정합성 검토 — `spec/5-system` (--impl-prep)

## 검토 범위와 방법
target 번들은 컨텍스트 예산 초과로 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 세 파일만
본문이 실렸고 나머지 15개 파일은 절단됐다. `plan/in-progress/**` 65개 전부도 프롬프트에서 생략돼
있어, 이번 검토는 착수 대상 plan(`webauthn-dup-delete.md`)과 그 트래커
(`spec-draft-nullable-notation-followups.md`), `1-auth.md` 의 `pending_plans`(`spec-sync-auth-gaps.md`),
그리고 `webauthn`/`credential` 키워드로 교차 조회한 나머지 in-progress plan 을 직접 `Read`/`grep` 해
확인했다.

## 발견사항

- **[INFO]** WebAuthn credential DELETE 자체의 "동시 삭제 → 두 번째 404" 서술 사이트가
  트래커 열거에 없다
  - target 위치: `spec/5-system/1-auth.md:498` (`DELETE /api/auth/2fa/webauthn/credentials/:id` 행,
    현재 "204" 만 서술)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
    "삭제 엔드포인트를 적는 spec 들에 «동시 삭제 → 두 번째 404» 서술이 없다" 항목
    (2026-09-21 기준 자리 목록: `1-workflow-list.md` §2.6 · `data-flow/12-workspace.md` §1.10/§1.6 ·
    `3-schedule.md` §4 · `4-integration.md` §9 · `9-user-profile.md` §6.1 ·
    `6-config.md` §A(auth-configs) · `6-config.md` §Model Config)
  - 상세: 이 목록은 이미 닫힌 auth-configs·model-config 의 DELETE 행(`6-config.md:267,284`)을
    포함하지만, 그 두 항목의 스펙 문구는 실제로는 아직 갱신되지 않은 상태다(확인함 — 여전히
    "삭제" 로만 서술). 즉 트래커는 "코드 수정 완료" 와 "spec 문구 갱신" 을 의도적으로 분리해
    별도 배치로 미룬다. 이번 PR 이 닫으면 아홉 자리 결함 클래스 전체(워크플로/워크스페이스/
    트리거/스케줄/통합/멤버/auth-config/model-config/webauthn)가 완료되는데, `1-auth.md:498`
    의 WebAuthn 자체 DELETE 행은 이 열거에 애초에 없어 재열거 시 빠뜨리기 더 쉽다.
  - 완화 요인: 같은 트래커 항목이 "집행 시 그 시점의 해소된 코드 경로를 기준으로 재열거할 것
    — 아래 목록은 스냅샷이지 고정 목록이 아니다" 라고 명시해 둬, 실행 시점에 전수 재조사를
    요구한다. 따라서 목록 누락 자체가 실행을 막지는 않지만, 재열거 지시가 없었다면 놓쳤을
    자리다.
  - 제안: 이번 PR 완료 시점에 트래커의 해당 항목에 `1-auth.md §5`(WebAuthn credential DELETE)
    를 아홉 번째 자리로 명시 추가해, "재열거" 가 실제로 이 자리를 다시 찾아내는지에 의존하지
    않게 한다. developer 는 `spec/` 을 직접 못 고치므로 이 갱신은 planner 턴이 되어야 하고,
    지금 당장 처리할 필요는 없다(현재 plan 의 `spec_impact: none` 과 상충하지 않음).

## 확인했지만 문제 없음(참고용)

- `webauthn-dup-delete.md` §0 의 결정 1(동시성 e2e 헬퍼는 전용 PR 로 추출)·결정 2(`affected`
  판별자 유틸은 추출하지 않음)는 실측과 함께 **이미** 트래커
  (`spec-draft-nullable-notation-followups.md`)에 개별 항목으로 등재돼 있다 — 체크리스트의
  "결정 1/2 을 트래커에 등재" 는 착수 시점에 선이행됐다.
- `spec-sync-auth-gaps.md`(target 의 `pending_plans`)에 남은 미해결 항목(LDAP/SAML 미구현,
  `workflow.executed` 보존정책 보류, `login_history` 축 미결 등)은 WebAuthn credential 삭제와
  무관해 충돌하지 않는다.
- 7번째(`auth-configs`, #1374)·8번째(`model-config`, #1375) 선행 PR 은 git log 상 이미 머지돼
  있어, 이 plan 이 가정하는 "형제 여덟 완료" 전제는 충족된다.
- `backend-lint-gate-broken-on-main.md` 의 `updateExecutionStatus` self-deadlock 호출 스택 감사가
  `webauthn.service.ts` 의 기존 `.transaction(` 블록을 이미 훑어 안전함을 확인한 상태라(2026-08-30
  종결), 이번 PR 의 트랜잭션 설계와 충돌할 선행 미해결 사항이 없다.
- `auth-guard-reflection-hardening.md` 등 그 외 in-progress plan 은 WebAuthn/credential 을 언급하지
  않아 겹치는 결정이 없다.

## 요약
착수 게이트(§0)의 두 결정이 실측과 함께 이미 트래커에 등재돼 있고, 선행 PR(7·8번째)도 머지
완료 상태라 이 plan 이 전제하는 조건은 모두 충족돼 있다. 유일하게 짚을 점은 "동시 삭제 → 두
번째 404" 스펙 서술 부채를 추적하는 트래커 항목의 2026-09-21 스냅샷 목록에 WebAuthn 자신의
DELETE 엔드포인트(`1-auth.md:498`)가 빠져 있다는 것인데, 같은 항목이 실행 시점 재열거를
명시해 둬 실질 위험은 낮다. 전반적으로 plan-target 정합성은 양호하다.

## 위험도
LOW
