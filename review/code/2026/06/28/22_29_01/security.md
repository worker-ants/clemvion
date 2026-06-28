# 보안(Security) 리뷰 결과

리뷰 대상: chat-channel e2e XFF 수정 (Discord/Slack/External-Interaction e2e + helpers/e2e-client-ip.ts)

---

### 발견사항

- **[INFO]** 하드코딩된 JWT 시크릿 fallback 값 존재
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` L725
  - 상세: `const JWT_SECRET = process.env.JWT_SECRET ?? 'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7';` — 해당 값은 기존 파일에 이미 존재하던 패턴으로, 이번 diff의 신규 도입이 아니다. 파일 주석("do-not-use-in-prod")과 plan 문서 모두 e2e 전용임을 명시하며, 환경변수 미주입 시 docker-compose.e2e.yml 구성 값으로만 사용된다. 운영 환경에서는 실제 JWT_SECRET 환경변수가 주입되므로 이 fallback 값은 적용되지 않는다. 그러나 fallback 문자열 자체가 소스 코드에 남아 있으면 코드 검색·스캔 도구가 오탐할 수 있고, 해당 시크릿이 공개 저장소에 노출될 경우 e2e 환경의 토큰 위조 가능성이 존재한다.
  - 제안: 이번 diff의 변경 범위가 아니므로 차단 대상은 아니다. 향후 개선 사항으로, fallback 없이 환경변수 필수화(`process.env.JWT_SECRET!`)하거나 e2e 설정 파일에서만 관리하는 방식을 고려한다.

- **[INFO]** XFF 헤더 스푸핑을 테스트 코드에서 직접 수행
  - 위치: `codebase/backend/test/helpers/e2e-client-ip.ts` 전체, 각 e2e 스펙의 `.set('x-forwarded-for', nextE2eClientIp())` 호출부
  - 상세: 테스트가 클라이언트 IP를 위조하는 X-Forwarded-For 헤더를 직접 설정한다. 이는 의도된 설계이며 — plan 문서가 설명하듯 e2e 환경에서 ingress가 없어 XFF가 없는 상황을 운영과 동형으로 만들기 위한 것이다. 보안 위험은 **제품 코드**가 XFF를 신뢰하는 방식에 달려 있으며, 이번 diff는 테스트 코드만 수정한다. 제품 코드의 trust-proxy 설정 및 XFF 검증 로직은 이번 리뷰 범위 밖이다.
  - 제안: 제품 측 `PublicWebhookThrottleGuard` / `extractClientIpFromHeaders`가 신뢰할 수 있는 프록시 소스(CF-Connecting-IP 또는 ingress 고정 홉)만 XFF로 수용하는지 별도 검토 권장. 테스트 자체는 RFC 5737 TEST-NET-3(`203.0.113.0/24`) 대역을 사용해 실 IP와 충돌하지 않으므로 적절하다.

- **[INFO]** Slack 서명 검증용 하드코딩 시크릿
  - 위치: `codebase/backend/test/chat-channel-slack.e2e-spec.ts` L355
  - 상세: `const SLACK_SIGNING_SECRET = 'e2e-test-signing-secret-32chars-abc';` — 기존 파일에 이미 존재하던 값으로 이번 diff의 신규 도입이 아니다. e2e 전용 테스트 시크릿으로 명백히 명명되어 있으며, 실제 Slack signing secret과 무관하다.
  - 제안: 현행 유지. 차단 불필요.

- **[INFO]** DB 직접 삽입에서 평문 패스워드 해시 사용
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` L664
  - 상세: `'x'`를 `password_hash` 필드에 직접 삽입한다. 이는 기존 패턴이며 e2e 픽스처 전용으로, 실제 인증 흐름을 거치지 않는 테스트 데이터다. 운영 데이터와 격리된 e2e DB에서만 동작한다.
  - 제안: 현행 유지. 차단 불필요.

---

### 요약

이번 변경은 전적으로 e2e 테스트 인프라 수정으로, 제품 코드(보안 경계)에는 영향을 주지 않는다. 핵심 변경인 `nextE2eClientIp()` 헬퍼는 RFC 5737 예약 대역을 사용해 rate-limit 버킷 collapse를 방지하는 명확한 목적을 가지며, 보안 취약점을 새로 도입하지 않는다. 기존 파일에 있던 하드코딩된 JWT fallback 및 Slack 서명 시크릿은 e2e 전용임이 명시되어 있고 이번 diff에서 신규 추가된 것이 아니다. 전체적으로 신규 보안 위험은 없으며, 발견된 모든 항목은 INFO 등급의 기존 패턴이다.

---

### 위험도

NONE
