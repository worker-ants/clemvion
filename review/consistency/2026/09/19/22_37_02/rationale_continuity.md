# Rationale 연속성 검토 — `spec/4-nodes/4-integration/` (SSRF 가드 통합, `--impl-done`)

## 검토 대상 재구성

scope(`spec/4-nodes/4-integration/`) 델타는 0개 파일이다(`plan/in-progress/ssrf-guard-integration-unify.md` frontmatter
`spec_impact: none`). 실제 변경은 `codebase/backend/src/nodes/integration/http-request/http-safety.ts` ·
`.../send-email/smtp-host-guard.ts`(신설, `common/utils/smtp-host-guard.ts` 대체) · `integrations.service.ts` ·
`send-email.handler.ts` · 두 유저 가이드 `.mdx` 등 14개 파일 / 696줄 diff다. 이번 검토는 "이 diff 가 spec `## Rationale`
이 이미 확정한 결정·원칙을 지키는가" 를 확인했다. 동일 scope 의 `--impl-prep` 라운드(`review/consistency/2026/09/19/21_02_09`)
와 코드 리뷰 3라운드(`21_38_32` → `22_00_32` → `22_24_32`, 전부 Critical 0 수렴)가 이미 이 축을 폭넓게 다뤘으므로, 본
라운드는 그 결과를 실제 최종 코드와 대조해 재확인하는 형태로 진행했다.

## 발견사항

### 정합 확인 — 위반 없음

- **[INFO]** 기각된 대안(`SMTP_BLOCK_PRIVATE_HOSTS` 별도 opt-in 플래그)이 재도입되지 않았고, 그 잔재(stale 주석)가 이번 diff 로 제거됐다
  - target 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `testEmailTransport` 주석,
    `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts` 주석
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` → "SMTP SSRF 가드를 http/db 와 동일
    `ALLOW_PRIVATE_HOST_TARGETS` 로 통일" — "별도 opt-in 플래그(`SMTP_BLOCK_PRIVATE_HOSTS` 안)를 신설하는 대신 기존
    `ALLOW_PRIVATE_HOST_TARGETS`(HTTP Request / Database Query 가 이미 사용)를 재사용한다"
  - 상세: 두 주석이 실제로는 존재한 적 없는(구현되지 않은) `SMTP_BLOCK_PRIVATE_HOSTS` opt-in 을 가리키고 있었다. diff 는
    "SSRF 가드 (기본 ON) … `ALLOW_PRIVATE_HOST_TARGETS=true` 로만 끈다" 로 정정해, 기각된 대안의 이름이 코드에 남아
    있던 잔재를 지웠다 — 대안 자체를 되살리는 방향이 전혀 아니다. `plan/in-progress/spec-draft-nullable-notation-followups.md`
    체크리스트도 "`SMTP_BLOCK_PRIVATE_HOSTS` 는 … Rationale 이 기각한 대안의 이름이었다" 고 정확히 인용해 닫았다.
  - 제안: 없음 — 이미 올바르게 처리됨.

- **[INFO]** SMTP 가드를 `http-safety.ts` 구현으로 합친 것은 세 노드의 "SSRF posture 일관성" 을 반복적으로 못박은 기존
  Rationale 노선의 다음 단계이며, 새 결정이 아니다
  - target 위치: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` (신설, `assertSafeOutboundHostResolved` 재사용)
  - 과거 결정 출처: `1-http-request.md` §8.2 "SSRF 가드 전 인증 방식 적용" · §8.3 "SSRF 차단 메시지 일반화" (3-node
    비대칭을 결함으로 규정), `2-database-query.md` `## Rationale` "`DB_HOST_BLOCKED` 전용 SSRF 차단 코드 신설" ("세
    integration 노드의 SSRF posture 를 일관되게"), `2-navigation/4-integration.md` "SMTP SSRF 가드를 http/db 와 동일
    `ALLOW_PRIVATE_HOST_TARGETS` 로 통일"
  - 상세: 네 Rationale 모두 "HTTP/DB/Email 의 SSRF 차단 범위·플래그·메시지가 갈리는 것 자체가 결함" 이라는 하나의
    일관된 노선이다. 이번 구현이 고친 "SMTP 만 CGNAT 통과 / HTTP·DB 만 IPv4-mapped IPv6 통과" 이원화는 그 노선이 아직
    못 미친 지점이었고, `http-safety.ts` 판정 로직 하나로 합친 것(SMTP 가 이제 그 구현을 직접 import)은 자연스러운 완성이다.
    `nodes/core/error-codes.ts` 의 "`http-safety.ts` 가 HTTP/DB/Email 공용 SoT" 주석도 이번 변경으로 실제로 참이 됐다
    (`grep` 확인 — 주석·구현 모두 대조 완료).
  - 제안: 없음.

- **[INFO]** 차단 코드명·클라이언트 메시지 일반화(CWE-209) 원칙이 신규 코드 경로에서도 그대로 유지됨
  - target 위치: `http-safety.ts` `SSRF_BLOCKED_CLIENT_MESSAGE`, 신규 `SsrfBlockedError` 클래스, 두 `.mdx` 유저 가이드 diff
  - 과거 결정 출처: `1-http-request.md` §8.3 "SSRF 차단 메시지 일반화 — 정찰 면 축소" — "원본 상세는 `logger.warn` 만,
    Usage 로그도 일반화"
  - 상세: `SsrfBlockedError` 는 판정 여부를 메시지 접두어가 아니라 타입으로 가르기 위한 리팩터일 뿐, 클라이언트 노출
    메시지(`SSRF_BLOCKED_CLIENT_MESSAGE`)와 서버 전용 상세 메시지 분리 구조는 그대로다. 유저 가이드 diff("차단된 주소는
    오류 메시지에 나오지 않아요")도 이 원칙을 재확인하며 위반하지 않는다.
  - 제안: 없음.

### 경계 판단 — 위반은 아니나 근거 위치가 spec 밖에 있음

- **[INFO]** IPv4-mapped IPv6 를 막는 근거("품은 IPv4 대역으로 판정")와 NAT64/SIIT/6to4 를 의도적으로 막지 않는 경계가
  spec 의 `## Rationale` 이 아니라 코드 JSDoc·plan 에만 기록되어 있다
  - target 위치: `http-safety.ts` `mappedIPv4()` JSDoc, `plan/in-progress/ssrf-guard-integration-unify.md` §"비대상"
  - 과거 결정 출처: 해당 없음 — `1-http-request.md`/`2-database-query.md`/`3-send-email.md` 는 "IPv6 사설 대역" 이라고만
    적고 IPv4-mapped 표기를 명시하지 않는다(`grep "IPv4-mapped"` spec 4곳 전부 0건, 코드/CHANGELOG/plan 에서만 등장)
  - 상세: 이번 PR 은 이를 "spec 문장은 이미 맞고 코드만 어긋났다" (spec_impact: none) 는 전제로 처리했다 — "IPv6 사설
    대역" 이라는 일반 서술이 IPv4-mapped 를 포함하는지는 해석의 여지가 있지만, 실제로 그 표기가 사설/루프백/메타데이터에
    **그대로 닿는다는 실측**(`plan` §"실측") 근거가 있어 이 해석은 방어 가능하고, 세 차례 코드 리뷰(requirement 에이전트
    포함)가 동일 결론에 도달했다(`22_24_32` INFO 10: "spec 이 옳고 코드가 미달했던 것을 이번 PR 이 바로잡은 사례"). 즉
    **결정의 무근거 번복은 아니다** — 다만 "IPv4-mapped 는 막고 NAT64/SIIT/6to4 는 막지 않는다" 는 세밀한 경계가 spec
    Rationale 에는 없고 코드 JSDoc 에만 있어, 향후 spec 만 읽는 사람은 이 경계의 존재를 알기 어렵다.
  - 제안: 필수 아님(병합 차단 사유 아님). 이 plan 을 닫을 때 `1-http-request.md` §8(또는 공통 §Rationale)에 "IPv4-mapped
    IPv6 는 품은 IPv4 대역으로 판정, NAT64/SIIT/6to4 는 실측상 미도달이라 범위 밖(2026-09-19)" 한 줄을 추가하면, 이번
    코드 변경이 spec 에 새로 반영한 암묵적 계약이 다음 검토자에게도 명시된다.

- **[INFO]** SSRF 판정을 `SsrfBlockedError` 타입으로 discriminate 하는 신규 계약이 4개 기존 소비자에는 아직 적용되지
  않았으나, 이는 코드 리뷰 2라운드에서 "수렴 예외" 로 명시 처분되고 트래커에 등재된 상태다 — Rationale 연속성 위반이 아님
  - target 위치: `http-request.handler.ts` · `http-redirect.ts` · `database-query.handler.ts` · `database-connection-tester.ts`
    (blanket catch, `smtp-host-guard.ts` 만 `instanceof SsrfBlockedError`)
  - 과거 결정 출처: spec 자체가 아니라 프로젝트 컨벤션(developer SKILL §ISSUE FIX 정책의 "수렴 예외") — `review/code/2026/09/19/22_00_32/RESOLUTION.md`
    W2 에 처분 근거 기록, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 후속 항목 등재 확인(grep 완료)
  - 상세: 이는 spec `## Rationale` 의 결정을 뒤집거나 무시하는 것이 아니라, 코드 아키텍처 수준의 일관성 갭을 "동작 회귀
    없음 + 후속 항목 등재" 조건으로 명시 유예한 것이다. spec 은 이 구현 세부(예외 타입 discriminate 방식)를 서술하지
    않으므로 spec Rationale 연속성의 검토 대상 밖이다.
  - 제안: 없음(이미 트래커에 등재·재확인됨).

## 요약

이번 diff(SSRF 가드 통합, `http-safety.ts`/`smtp-host-guard.ts`)는 `spec/4-nodes/4-integration/` 세 노드 spec 과
`spec/2-navigation/4-integration.md` 가 반복적으로 확정해 온 "HTTP/DB/Email 의 SSRF 차단 범위·플래그·메시지는 하나로
통일한다" 는 원칙을 코드 쪽에서 완성한 작업이다. 과거 명시적으로 기각된 대안(`SMTP_BLOCK_PRIVATE_HOSTS` 별도 opt-in
플래그)은 재도입되지 않았고 오히려 그 이름을 가리키던 stale 주석이 이번에 제거됐다. 메시지 일반화(CWE-209)·차단
코드명 대칭(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`)·`ALLOW_PRIVATE_HOST_TARGETS` 단일 플래그 재사용
원칙도 모두 유지된다. `spec_impact: none` 전제("spec 문장은 이미 맞았고 코드가 미달했다")는 세 차례 독립 코드 리뷰가
동일하게 확인했으며 본 검토도 실측·JSDoc·테스트 대조로 이를 재확인했다 — 결정 번복이 아니라 기존 결정의 이행이다.
남은 항목은 전부 INFO 수준(IPv4-mapped/NAT64 경계를 spec Rationale 에도 옮겨 적을지, 타입 discriminate 계약을 4개
소비자로 확장할지)이며 모두 트래커에 이미 등재되어 있어 병합을 막을 사유가 없다.

## 위험도

NONE
