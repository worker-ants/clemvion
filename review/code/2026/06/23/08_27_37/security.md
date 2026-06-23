# 보안(Security) 리뷰 — M-8 1단계 review fix

리뷰 대상 커밋: `ac804f2a4510631b552dcbd96fa6d7a2dc2a91c8`
생성일: 2026-06-23

---

## 발견사항

### [INFO] 테스트 코드에 실제 토큰 형식 값 사용
- 위치: `codebase/frontend/src/lib/api/__tests__/triggers.test.ts` — `rotateBotToken` 테스트 케이스 (라인 260)
- 상세: `"123456:ABCDEF"` 값이 테스트 fixture 로 사용됨. 이는 Telegram Bot Token 형식(`{botId}:{secret}`)과 동일하다. 현재 값 자체는 실제 자격증명이 아닌 명백한 플레이스홀더이므로 하드코딩된 시크릿에 해당하지 않는다. 단, 향후 실제 토큰 값을 테스트에 직접 붙여 넣는 관행이 생길 경우 위험도가 높아질 수 있다.
- 제안: 현재 값 유지 가능. 추가적으로 `"TEST_BOT_TOKEN"` 또는 `"<TEST_TOKEN>"` 같이 실제 포맷처럼 보이지 않는 플레이스홀더를 사용하면 향후 실수 방지에 도움이 된다.

### [INFO] 민감 정보(`secret`, `token`) 테스트 fixture 평문 노출
- 위치: `codebase/frontend/src/lib/api/__tests__/triggers.test.ts` — `rotateNotificationSecret`/`revokeInteractionToken` 테스트 (라인 245, 254)
- 상세: `secret: "sek"`, `token: "itk_xyz"` 가 테스트 mock 응답으로 하드코딩되어 있다. 이는 단순 테스트 픽스처이며 실제 자격증명이 아니다. 테스트 파일에서 이중 envelope 언래핑 로직(`res.data.data`) 검증이 목적이므로 보안 위험 없음.
- 제안: 현행 유지. 테스트 환경 전용 픽스처임이 명확하다.

### [INFO] `TriggerListParams` 타입 narrowing — 입력 검증 강화 (긍정적 변경)
- 위치: `codebase/frontend/src/lib/api/triggers.ts` — `TriggerListParams` 인터페이스 (라인 86-93 기준)
- 상세: `type?: string` / `status?: string` 에서 `type?: "webhook" | "schedule" | "manual"` / `status?: "active" | "inactive"` 로 좁혀짐. 컴파일 타임 입력 제한이 강화되어 잘못된 쿼리 파라미터 주입 가능성이 줄어든다.
- 제안: 긍정적 변경. 현행 유지.

### [INFO] 기존 보안 이슈 — `endpointPath` 클라이언트 UUID 생성 (pre-existing, 변경 없음)
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` — `createMutation` 내 `endpointPath`
- 상세: 이번 커밋에서 변경된 사항이 아님. `crypto.randomUUID()` 로 클라이언트가 엔드포인트 경로를 생성하며, 서버 UUID 강제 미적용은 이전 리뷰(RESOLUTION.md INFO #2)에서 known-deferred W1으로 분류되었다. 클라이언트 생성 UUID 는 예측 불가(충분한 엔트로피)하지만, 서버 측에서 강제 생성하는 것이 ownership 관점에서 더 안전하다.
- 제안: `trigger-review-deferred-fixes.md` W1 트랙에서 후속 처리. 이번 변경 범위 밖.

### [INFO] 기존 보안 이슈 — `botToken`/`inboundSigningPlaintext` 평문 전송 (pre-existing, 변경 없음)
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` — `createMutation.mutationFn`
- 상세: 이번 커밋에서 변경된 사항이 아님. HTTPS 전제 하에 전송 구간 암호화로 보호됨. 서버 로그 마스킹은 backend 관심사로 분류(RESOLUTION.md INFO #3).
- 제안: 현행 유지. backend 로그 마스킹 검토는 별도 이니셔티브.

---

## 요약

이번 커밋은 순수 behavior-preserving 리팩터의 review fix 단계로, 유닛 테스트 신설·타입 narrowing·JSDoc 추가·주석 명확화만 포함한다. 신규 보안 취약점이 도입되지 않았으며, 테스트 파일의 mock 픽스처(토큰 형식 유사값·secret 문자열)는 모두 명백한 플레이스홀더로 실제 자격증명이 아니다. `TriggerListParams` 타입 narrowing은 입력 제한을 강화하는 긍정적 변경이다. 기존에 이미 인지되어 deferred 처리된 보안 사항(`endpointPath` UUID, 민감 필드 평문 전송)은 이번 변경과 무관하게 pre-existing 상태로 유지된다.

---

## 위험도

NONE
