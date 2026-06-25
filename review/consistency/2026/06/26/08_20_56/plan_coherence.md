# Plan 정합성 검토 결과

검토 대상: `03 M-1: integration-oauth.service.ts install 보일러플레이트 4종 helper 추출 완료`
관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/refactor/03-maintainability.md` § M-1

---

### 발견사항

- **[WARNING]** plan 상태 미갱신 — M-1 항목이 `[ ] 미착수` 로 남아 있음
  - target 위치: 구현 diff 전체 (4개 private helper 추출 완료, lint/build/unit/e2e PASS, ai-review RISK LOW)
  - 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/refactor/03-maintainability.md:132-156` `### M-1 [Major] handleInstall vs handleMakeshopInstall` — 현재 `- [ ] 미착수`
  - 상세: 구현이 완료되어 검증(7409 unit / 214 e2e PASS)까지 끝났으나 plan 체크박스가 아직 `[ ]` 상태다. 다른 완료 항목(C-2, C-4, M-2, m-1, m-3, m-4)은 모두 `[x]` 로 마킹되고 커밋 hash·branch·검증 결과를 plan 본문에 기록했다.
  - 제안: plan M-1 체크박스를 `[x]` 로 전환하고, branch 명(`claude/refactor-03-m1-oauth-install-dedup-...`)·커밋 hash·검증 결과(lint/build/unit 7409/e2e 214 PASS)·ai-review 결과(RISK LOW, W4 테스트 보강)를 다른 완료 항목과 동일한 형식으로 기록.

- **[INFO]** 구현 방식이 plan Option A 의 "전면 `IntegrationInstallConfig` 주입" 대비 더 보수적인 "partial helper 추출" 을 택했으나, plan 의 핵심 요구사항(HMAC 빌더 caller-selected 격리·에러 코드 provider 별 유지·callback 공통화는 02 M-2 위임)은 모두 준수됨
  - target 위치: `integration-oauth.service.ts` 추가된 4 helper — `assertInstallTimestampFresh`, `assertInstallNonceNotReplayed`, `buildIntegrationDetailRedirectUrl`, `persistReauthorizeState`
  - 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/refactor/03-maintainability.md:139-152` Option A 상세
  - 상세: plan Option A 는 `IntegrationInstallConfig = { hmacMessageBuilder, errorCodePrefix, authorizeUrlBuilder, redirectPolicy }` 를 주입하는 전면 파이프라인을 제안했다. 실제 구현은 HMAC 빌더 및 authorizeUrl 빌더는 공통화하지 않고 오직 timestamp 가드·nonce 가드·redirect URL 빌더·state 영속화만 추출했다. plan 이 명시한 핵심 제약 ("HMAC 빌더는 provider 주입 함수로 격리", "에러 코드 prefix 는 provider 별 유지", "handleCallback 공통화는 02 M-2 위임")은 전부 지켜졌다. diff 내 JSDoc 주석도 이 설계 결정의 근거를 명시("makeshop HMAC 빌더는 caller-selected 로 유지 — `VERIFY` 마킹"). 위반 없음. 단 plan 본문이 Option A 의 full interface 제안과 실제 구현 범위의 차이를 설명하는 메모가 없으므로, plan 갱신 시 "HMAC 빌더·authorizeUrl 빌더는 추출 대상 제외(VERIFY 미확정 보존)" 를 명기하면 추후 독자 혼선 방지에 유용.
  - 제안: plan 갱신 시 INFO 수준 주석 추가 — 강제 아님.

- **[INFO]** planner 위임 미해소 spec stale 항목 (m-1 에서 이월된 항목과 무관하나 동일 서비스 파일 영향 가능)
  - target 위치: 구현이 `integration-oauth.service.ts` 를 수정함
  - 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/refactor/03-maintainability.md:288` `- [ ] (planner 위임) spec 텍스트 stale console.warn 처방 정정`
  - 상세: m-1 plan 항목에서 planner 위임으로 기록된 spec stale(`1-ai-agent.md §6.2.c.fallback` 등 console.warn → logger.warn 정정)은 본 M-1 구현과 파일이 겹치지 않아 충돌 없음. 단 planner 위임이 여전히 미해소 상태임을 확인.
  - 제안: 추적 메모 수준 — 본 PR 범위 밖.

---

### 요약

plan/in-progress/refactor/03-maintainability.md M-1 항목이 `[ ] 미착수` 로 남아 있는 것이 유일한 실질적 불일치다. 구현 내용 자체는 plan 의 핵심 제약(HMAC 빌더 caller-selected 유지·에러 코드 provider 별 보존·callback은 02 M-2 위임)을 모두 준수하며, 미해결 결정을 우회하거나 선행 plan 조건을 무시한 흔적이 없다. plan 체크박스 갱신 및 완료 기록 추가가 필요한 상태이며, 이는 다른 refactor 항목들(C-2, C-4, m-1, m-3, m-4)이 모두 따른 완료 기록 패턴과 동일하게 처리하면 된다.

---

### 위험도

LOW
