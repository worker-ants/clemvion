# Rationale 연속성 검토 — `spec/5-system/` (--impl-prep)

## 검토 범위와 방법

번들에는 `spec/5-system/1-auth.md` 전문(라인 25~919, 자체 `## Rationale` 포함)만 실렸고 나머지
17개 파일은 컨텍스트 예산 초과로 절단됐다. 절단된 파일 중 이번 게이트가 실제로 근거로 삼는
`spec/5-system/6-websocket-protocol.md`(§1.2·§1.3·§4.6·§6.1·§9.2 + `## Rationale`)는
`plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 가 명시적으로 지목하고 있어
디스크에서 직접 `Read` 했다(1263줄 전체 확인, 특히 §1067~1166 의 `## Rationale`). 이 두 문서를
중심으로, 번들에 함께 실린 관련 spec(`0-overview.md`·`1-data-model.md`·
`2-navigation/9-user-profile.md` 등)의 `## Rationale` 발췌와 대조했다. 나머지 15개 절단 파일
(예: `4-execution-engine.md`·`14-external-interaction-api.md` 등)은 이번 판정과 직접 관련된
교차 참조(R10/R15/R19, §7.4 분산 실행 등)만 소스에서 확인했고 전문은 읽지 않았다 — 아래 "위험도"
판단은 이 범위 한정이다.

## 발견사항

이번 라운드에서 CRITICAL/WARNING 급 Rationale 연속성 위반은 발견되지 않았다. 확인한 요지는
다음과 같다.

- **[INFO] `R-ws-socket-lifetime-binds-token` 과 착수 예정 구현 계획의 정합** — 이미 확인됨, 조치 불요
  - target 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 전체 (구현 설계)
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` §
    `R-ws-socket-lifetime-binds-token`(결정 2026-09-02, 커밋 `6ffadb1f4`) 및 §1.2·§6.1·§9.2 본문
  - 상세: plan 이 서술한 "타이머 둘(사전통지 exp-60s·만료 exp)", "emit 후 disconnect", "서버발신
    `disconnect()` 는 Socket.IO 자동 재연결을 트리거하지 않으므로 프론트가 명시적 `connect()`
    필요", "닫는 범위는 자연 만료뿐 — 명시적 revoke(비번 변경·`token_reuse_detected`)는 이미
    발급된 access token 을 무효화하지 못하므로 그 소켓은 자연 `exp`(최대 15분)까지 산다, 여기서
    넓히지 않는다"는 서술은 Rationale 의 **기각된 대안**(emit-only·명령별 재검증 guard·won't-do)
    목록·"닫지 않는 것" 범위 명시·60초 lead time 근거와 문구 단위로 일치한다. `1-auth.md` §2.3
    (refresh family revoke 가 access token 을 무효화하지 않는 stateless JWT 전제)와도 모순 없다.
    plan 이 새 메커니즘(즉시 revoke 전파 등)을 은근히 도입하지도 않았다.
  - 제안: 없음 — 계획대로 진행 가능. 구현 중 "즉시 종료" 요구가 생기면 그것은 본 Rationale 이
    명시적으로 범위 밖으로 못 박은 **별개 결정**이므로, plan 을 조용히 확장하지 말고 새
    Rationale 항목으로 planner 턴을 거칠 것.

- **[INFO] `1-auth.md` 자체 Rationale 은 이번 스코프에서 내적 일관성 유지** — 조치 불요
  - target 위치: `spec/5-system/1-auth.md` 전체 본문 + `## Rationale`(§551~916)
  - 상세: 최근 커밋(`84f59cc9c` 계정 잠금 알림 정정 등)이 표 문구를 뒤집을 때마다 예외 없이
    실측 표·기각 대안·출처(`#issue`, `--impl-done` 세션)를 동반한다. §3.2 Admin 정정,
    §2.3.D 재인증 정합화, §4.1.A/4.1.B 등도 모두 "번복이 아니라 구체화" 를 명시적으로 못박고
    이전 규칙(L379 LoginHistory 분류 등)의 불변을 재확인한다. 관련 spec
    (`2-navigation/9-user-profile.md` §Rationale "`/profile` 편집 인터랙션의 분리")과도
    §1.1.B 이메일 변경 흐름이 상호 참조로 정합돼 있다.
  - 제안: 없음.

## 요약

이번 --impl-prep 게이트의 실질 대상인 `ws-token-expired-socket-lifetime-impl` 구현 계획은
`6-websocket-protocol.md` 의 `R-ws-socket-lifetime-binds-token`(기각된 대안·범위 경계 포함)과
`1-auth.md` §1.4·§2.3 의 토큰/세션 불변식을 정확히 따르고 있어, 기각된 대안의 재도입이나
무근거 번복, invariant 우회는 발견되지 않았다. `1-auth.md` 자체도 최근 정정 이력 전부가
Rationale 를 동반한 정당한 구체화/정정이다. 다만 `spec/5-system/` 의 나머지 15개 절단 파일은
이번 판정 범위 밖이므로, 이 보고서를 "spec/5-system/ 전체가 Rationale 연속성 문제 없음" 의
근거로 확장 해석하지 말 것.

## 위험도

NONE
