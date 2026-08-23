# Plan 정합성 검토 — spec/5-system/ (--impl-prep)

## 검토 맥락

현재 진행 중 작업은 `plan/in-progress/terminal-duration-sql-safety-net.md`
(worktree `eia-tracker-groom-7d0396`, `spec_impact: none`) — 정본 트래커
`spec-sync-external-interaction-api-gaps.md` 의 **W10**(`TERMINAL_DURATION_MS_SQL`
실 Postgres 값 검증 e2e 신설) + **W7**(컬럼명/타입 스키마 대조)을 집행하는 코드·테스트
전용 작업이다. spec 편집이 없으므로 target(`spec/5-system/`)과의 충돌 표면은 좁다.

## 발견사항

- **[INFO]** WebAuthn step-up 재인증 일반화가 "별도 plan 필요"로 spec 에 적혀 있으나 어떤 plan 도 추적하지 않음
  - target 위치: `spec/5-system/1-auth.md` §Rationale `1.1.B-4` ("WebAuthn 을 재인증
    수단으로 쓰는 것은 challenge/response step-up 흐름이 필요해 `verifyReauth` 가 현재
    미지원이며 … 그 일반화(challenge/response step-up 재인증)는 **아직 미착수다(별도 plan
    필요)**")
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` (동일 spec 의 pending_plans 트래커) —
    이 트래커는 LDAP/SAML·감사 로깅 갭만 추적하고 WebAuthn step-up reauth 는 항목이 없음.
    다른 `plan/in-progress/**` 전수(파일명 grep)에도 `webauthn`/`step-up`/`reauth` 계열
    제목의 plan 없음
  - 상세: spec 본문이 명시적으로 "별도 plan 필요"라고 선언한 항목인데, 그 spec 의 공식
    pending_plans 트래커(`spec-sync-auth-gaps.md`)에도, 다른 어떤 in-progress plan 에도
    등재돼 있지 않다. 이 저장소가 이미 반복적으로 겪은 "미룬 항목은 그 턴에 `plan/` 에
    적어라" 패턴의 사전 형태 — 지금은 등재 자체가 없어 재발견 비용이 매번 든다
  - 제안: 이번 작업 범위는 아니므로 즉시 조치는 불요. 다음에 `1-auth.md` 를 편집하는
    planner 턴에서 `spec-sync-auth-gaps.md` 에 한 줄 추가하거나, 별도
    `webauthn-stepup-reauth.md` plan 을 신설해 pending_plans 에 연결 권장

- **[INFO]** 신규 e2e 세이프넷이 `TERMINAL_DURATION_MS_SQL` 을 verbatim 고정 — 동일 트래커의 미해결 "duration_ms 필드 분리" 항목과 잠재 결합
  - target 위치: (해당 없음 — target 자체가 아니라 `terminal-duration-sql-safety-net.md`
    plan 본문의 검증 방식: "SQL 을 합성 행에 적용해 **정본 문자열 그대로** 태운다 — 테스트가
    SQL 을 재작성하면 검증 대상이 사라진다")
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §`⚠ duration_ms
    에 "대기 시간" 이 섞여 집계를 오염시킨다` (2026-08-15 등재, `10_34_51` W3) — 두 미해결
    체크박스: "프런트엔드 Duration 컬럼 4곳", 그리고 "순수 실행시간과 wall-clock 대기시간의
    **필드 분리** — 위 항목의 유일한 정답"
  - 상세: 필드 분리가 실행되면 `TERMINAL_DURATION_MS_SQL` 자체(또는 그 소비 경로)가
    바뀔 가능성이 높다. 지금 신설하는 e2e 는 의도적으로 SQL 원문을 그대로 태워 값의 **의미**
    (부호·단위·클램프)를 검증하므로, 그 SQL 이 나중에 필드 분리로 갈라지면 이 e2e 도 함께
    갱신 대상이 된다 — 이는 정상적인 테스트 결속(test coupling)이며 막을 필요는 없으나, 두
    작업이 서로를 인지하지 못한 채 별도로 진행되면 필드 분리 PR 이 이 신규 e2e 를 stale 로
    남길 위험이 있다
  - 제안: 차단 사유 아님. `terminal-duration-sql-safety-net.md` 완료 후 "트래커 W10·W7
    종결" 시, 트래커의 "필드 분리" 미해결 항목 옆에 "이 SQL 은 `TERMINAL_DURATION_MS_SQL`
    e2e 세이프넷(`webchat-idle-reaper.e2e-spec.ts` 또는 신설 파일)이 원문 고정하고 있으니
    필드 분리 시 함께 갱신" 한 줄을 남기면 향후 drift 를 막을 수 있음

## 결정 충돌·선행 미해소 없음

- 미해결 결정과의 충돌(①): target(`spec/5-system/1-auth.md`·`2-api-convention.md`·
  `3-error-handling.md`, 전문 확인)이 plan 의 "결정 필요" 항목(예:
  `ai-agent-tool-connection-rewrite.md` §1 도구 등록 모델 5건 TBD,
  `spec-sync-external-interaction-api-gaps.md` 의 workflow-assistant 마스킹 우선순위·
  `execute` 본문 여분 키 400 거부 등)을 우회해 일방적으로 결정한 흔적 없음 — 해당 결정
  항목들은 전부 target 영역 밖이거나 target 이 손대지 않는 절이다
- 선행 plan 미해소(②): `terminal-duration-sql-safety-net.md` 가 집행하려는 W10·W7 은
  `spec-sync-external-interaction-api-gaps.md` 에 그대로 미체크(`[ ]`) 상태로 남아 있고,
  2026-08-22 재판정(`codebase/backend/test/` 참조 0건 실측)도 "여전히 유효"로 확인했다 —
  plan 이 가정하는 전제(안전망 부재)와 트래커 현재 상태가 정합
- 후속 항목 누락(③): 이번 작업은 `spec_impact: none` 코드+테스트 전용이라 target spec
  문서에 서술 변경이 없다. 다른 plan 의 후속 항목을 무효화하거나 새로 만들 필요가 있는
  spec 변경은 이번 target 에 없음

## 요약

target(`spec/5-system/`) 중 전문이 주어진 세 파일(`1-auth.md`·`2-api-convention.md`·
`3-error-handling.md`)은 현재 진행 중인 `terminal-duration-sql-safety-net.md`(W10·W7 e2e
세이프넷, spec 무변경)와 직접 충돌하지 않는다. W10·W7 은 정본 트래커에 미해결로 정확히
남아 있고 이번 plan 이 그 문면 그대로 집행하므로 미해결 결정 우회나 선행 plan 미해소는
없다. 다만 (a) `1-auth.md` Rationale 이 "별도 plan 필요"라 명시한 WebAuthn step-up
재인증 일반화가 어떤 트래커에도 등재돼 있지 않은 점, (b) 신규 e2e 가 SQL 을 verbatim 고정해
같은 트래커의 미해결 "duration_ms 필드 분리" 항목과 향후 결합될 수 있는 점은 정보성으로
기록해 둘 가치가 있다. 둘 다 이번 작업을 막을 사유는 아니다.

## 위험도

LOW
