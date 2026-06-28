# 요구사항(Requirement) Review

## 발견사항

### **[INFO]** webhook-trigger.e2e-spec.ts 미수정 공개 요청의 latent 버킷 합산 위험
- 위치: `plan/in-progress/fix-chat-channel-e2e-xff.md` §영향 파일, `webhook-trigger.e2e-spec.ts`
- 상세: plan 에서 "webhook-trigger 공개 ~5건은 위 3개 수정 후 단독으로 10/분 한도 내 → 미수정" 으로 명시하고 실제로 런이 green 임을 확인했다. 그러나 `webhook-trigger.e2e-spec.ts` 의 공개 요청(test A: `auth_config_id IS NULL`, test B2·C: 인증 없음 경로)이 XFF 없이 전송되므로, 세 파일 모두 `nextE2eClientIp()` 를 적용한 후에도 이 파일의 요청들은 여전히 `UNIDENTIFIED_IP_BUCKET` 으로 집계된다. 현재는 한도 내이지만 다른 파일의 공개 요청이 늘어나거나 순서가 변경되면 재발할 수 있는 순서 의존성(ordering bomb)이 잠재한다. plan 의 판단(현재 green + 스코프 분석 검증)은 합리적이나, 추후 신규 공개 e2e 추가 시 동일 문제가 재현될 수 있다.
- 제안: 현재는 INFO 수준이며 즉각 조치 불필요. 단, `webhook-trigger.e2e-spec.ts` 의 공개 `/api/hooks/*` POST 에도 `nextE2eClientIp()` 를 점진적으로 추가하는 것을 고려한다.

### **[INFO]** `nextE2eClientIp()` 의 JSDoc spec 참조 정확성
- 위치: `/codebase/backend/test/helpers/e2e-client-ip.ts` 내 JSDoc
- 상세: "정책 SoT: [spec/7-channel-web-chat/4-security.md §4·R6]" 참조가 정확하다. spec 을 직접 확인한 결과 `§4` 가 공개 webhook 남용 방어(rate-limit·크기 제한) 섹션이고, `R6` 가 "공개 webhook IP 미식별 — 단일 공유 버킷 완화 한도" 로 D-12 결정을 포함하며, `UNIDENTIFIED_IP_BUCKET` 의 SoT 임이 확인됐다. 참조 정확함.

### **[INFO]** Slack e2e 의 `url_verification` 테스트 기대값 이완
- 위치: `codebase/backend/test/chat-channel-slack.e2e-spec.ts` L419
- 상세: `url_verification` 테스트가 `expect([200, 401]).toContain(res.status)` 로 200 또는 401 모두 허용한다. 이는 코드의 의도적 설계("본 e2e 는 signing path 분기만 확인")이지만, 테스트로서의 진단 가치가 낮다. 기능적 의도와 구현이 일치하며 버그는 아니다. `inboundSigningRef` 없는 별도 trigger 로 200 경로를 명확히 검증하는 케이스가 이미 같은 파일(`inboundSigningRef 미설정 trigger 는 signing skip`) 에 있으므로 기능 완전성은 확보돼 있다.

### **[INFO]** `e2e-client-ip.ts` JSDoc spec 참조에서 `public-webhook-quota.service.ts` 경로 참조
- 위치: `/codebase/backend/test/helpers/e2e-client-ip.ts` L14 ("src/modules/hooks/public-webhook-quota.service.ts")
- 상세: JSDoc 에 상대 경로 `src/modules/hooks/public-webhook-quota.service.ts` 를 직접 인용했는데 해당 파일에 `UNIDENTIFIED_IP_BUCKET` 이 정의되어 있음을 코드로 확인했다. 참조가 정확하다.

## 요약

이번 변경은 D-12 (#770) 에서 도입된 `PublicWebhookThrottleGuard` 의 단일 공유 버킷 완화 한도가 e2e 환경에서 XFF 헤더 부재로 인해 모든 공개 webhook 요청을 하나의 버킷으로 집계해 발생하는 429 회귀를 수정한다. `nextE2eClientIp()` 헬퍼(RFC 5737 TEST-NET-3, 파일별 카운터 격리)를 신설하고 3개 영향 파일(Slack 6건, Discord 5건, External Interaction 5건)의 공개 `/api/hooks/*` POST 전체에 고유 XFF 를 부여해 per-IP 버킷 분리를 실현했다. 제품 코드·D-12 보안 결정은 무변경이며 테스트 환경만 운영과 정합화한다. spec 참조(§4·R6)가 정확하고, 기능 완전성·엣지 케이스(254 wraparound)·반환값 모두 올바르다. `webhook-trigger.e2e-spec.ts` 미수정이 잠재적 ordering 의존성을 남기지만 현재 green 이고 plan 에서 명시적으로 인식·검증한 합리적 판단이다. Critical/Warning 발견사항 없음.

## 위험도

NONE
