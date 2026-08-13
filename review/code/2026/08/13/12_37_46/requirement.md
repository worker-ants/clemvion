# 요구사항(Requirement) 리뷰

## 발견사항

- **[WARNING]** `spec/2-navigation/4-integration.md` 가 cafe24 install endpoint Redis 키의 "SoT" 를 여전히 §9.8 로 지목 — 본 diff 가 `4-cafe24.md` 에서 승격시킨 §4.4 와 어긋난다.
  - 위치: `spec/2-navigation/4-integration.md:1294` (원본 파일 실제 줄 번호, Read 로 직접 확인)
  - 상세: 이번 diff 는 `spec/4-nodes/4-integration/4-cafe24.md` §9.8 끝의 콜아웃을 바꿔 "두 Redis 키(`cafe24:install:fail:*` · `cafe24:install:nonce:*`)의 **normative 정의는 본문 §4.4**" 라고 명시하고, `spec/conventions/redis-keys.md` §3 인벤토리의 포인터도 `Cafe24 §9.8` → `Cafe24 §4.4` 로 갱신했다. 그런데 같은 저장소의 `spec/2-navigation/4-integration.md:1294` 는 여전히 "상수(`INSTALL_FAIL_THRESHOLD=10`, `INSTALL_FAIL_WINDOW_SEC=600`)·**키 구성·degradation 의 SoT** 는 [Spec Cafe24 §9.8] Rate limiting note 와 '관련 코드 상수' 테이블" 이라고 못박고 있다. §4.4 자신은 "용도·TTL·degradation 은 이 절이 SoT" 라고 선언하므로, 두 문서가 **같은 대상(키 구성·degradation)의 SoT 를 서로 다른 절로 지목**하는 상태가 됐다 — 이번 PR 이 의도적으로 고치려던 "이중 SoT/모호한 normative 위치" 문제의 새 인스턴스다. `redis-keys.md` 는 갱신했지만 `2-navigation/4-integration.md` 라는 자매 포인터는 갱신 대상에서 누락됐다.
  - 제안: `2-navigation/4-integration.md:1294` 의 "SoT 는 §9.8" 문구를 "SoT 는 §4.4(정의) / §9.8(설계 근거)" 형태로 갈라 갱신 — 코드 변경이 아니라 spec 문서 간 정합성 문제이므로 `project-planner` 가 spec draft 로 반영해야 한다. (참고: 같은 파일 line 858 의 "§9.8 Rate limiting note 가 SoT" 는 알고리즘 설명(Layer1/2 threshold 로직) 자체를 가리키는 것이라 §9.8 이 그대로 유효 — line 1294 만 문제.)

- **[INFO]** `4-cafe24.md` 신설 §4.4 (Redis 키 정의)가 "## 4. 실행 로직" 서브섹션으로 들어갔는데, install endpoint(`POST /api/3rd-party/cafe24/install/:installToken`, `third-party-oauth.controller.ts`)는 §4 가 다루는 **노드 handler 12-step 실행 흐름**과 다른 관심사(OAuth 설치 플로우)다. 내용 자체는 정확하지만 목차상 "노드 실행 로직을 읽으러 온 사람이 install endpoint Redis 키를 §4.4 에서 만난다"는 배치는 다소 어색하다.
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §4.4 (`### 4.4 Private 앱 install endpoint 의 Redis 키 (normative)`)
  - 제안: 기능상 문제는 아니므로 필수는 아니나, 후속 정리 시 install endpoint 전용 절(예: 별도 `## 9.x` 아래 또는 §5.8 인접)로 옮기는 것을 고려할 수 있다.

## 검증 완료 (문제 없음 확인)

- `public-webhook-quota.service.ts`: `MINUTE_WINDOW_SEC`/`HOUR_WINDOW_SEC` docstring 을 "슬라이딩 윈도우" → "fixed-window" 로 수정한 것은 실제 구현(`incrWithWindow` 의 `INCR`+`EXPIRE ... NX` — TTL 이미 있으면 no-op, window 미연장)과 line-level 로 일치. 같은 파일 `incrWithWindow` docstring(기존, 미변경)과도 자기 정합적이며, `spec/5-system/12-webhook.md:346-347` (`wh:rl:min/hour` 를 "fixed-window" 로 명시)과도 일치. 순수 주석 변경이라 함수 시그니처·반환값·에러 경로에 회귀 없음.
- 자매 서비스 교차검증: `ChatChannelRateLimiterService`(`chat-channel-rate-limiter.service.ts`) · `OutboundNotificationRateLimiterService`(`outbound-notification-rate-limiter.service.ts`) 둘 다 이미 "fixed-window" 로 정확히 기술 — plan 의 "형제는 멀쩡했다" 주장을 grep 으로 재확인.
- `spec/5-system/15-chat-channel.md` CCH-SE-02 요구사항 행에서 메커니즘 상세(Redis `SET NX EX 30`, 키 포맷)를 제거하고 `data-flow/14 §2.2` 로 위임한 것을 실제로 `spec/data-flow/14-chat-channel.md:190-197` 에서 확인 — 키 포맷(`cc:dedup:{triggerId}:{idempotencyKey}`)·TTL(30초)·게이트 순서(parseUpdate 직후, rate-limit 앞)·fail-open 정책이 모두 그대로 있다. `ChatChannelDedupService`(`chat-channel-dedup.service.ts`) 실제 구현도 `SET key 1 EX 30 NX`, 키 `cc:dedup:${triggerId}:${idempotencyKey}`, fail-open(+warn)으로 spec 과 line-level 일치. R-CC-20(Rationale)의 키 리터럴 유지도 확인.
- `spec/4-nodes/4-integration/4-cafe24.md` 신설 §4.4 표의 TTL/threshold 값을 실제 코드와 대조: `Cafe24InstallRateLimitService.INSTALL_FAIL_THRESHOLD=10`, `INSTALL_FAIL_WINDOW_SEC=600` / `Cafe24InstallNonceCache.TTL_SEC=10*60`, 키 포맷 `cafe24:install:nonce:{mall_id}:{timestamp}:{hmac 앞8자}` — 모두 spec 표와 일치.
- `spec/conventions/redis-keys.md` §3 인벤토리의 cafe24 포인터를 `§9.8` → `§4.4` 로 갱신한 것 포함, in-repo 문서 전체를 도는 `spec-link-integrity` 가드(`codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`)를 직접 실행 — **13/13 PASS** (DEAD/ANCHOR 위반 0건). 신설 `#44-private-앱-install-endpoint-의-redis-키-normative` 앵커를 포함해 이번 diff 가 건드린 모든 상호참조가 실제로 resolve 됨을 확인.
- `plan/in-progress/backend-lint-gate-broken-on-main.md`: 3개 체크박스([ ]→[x]) 각각의 "완료" 서술이 실제 코드/spec 상태와 일치함을 위에서 개별 검증. 파일 전체를 스캔해 남은 미해결 항목(`- [ ]`, 5건: LIKE 메타문자 공유 상수화·선재 테스트 공백 2건·idempotency fail-open 관측·`intercept()` 리팩터·admission 자리)이 여전히 존재해 `status: in-progress` frontmatter 는 정확 — 조기 `status: complete` 전환 오류 없음. 이 diff 가 건드린 3항목은 별도 요약 체크리스트(`## 체크리스트`, PR #1104 전용)와는 무관한 섹션(`## 후속`)에 있어 동기화 대상 이중 목록 문제도 없음.
- TODO/FIXME/HACK/XXX 신규 주석 없음. 함수 시그니처·에러 코드·기본값·검증 규칙·상태 전이 변경 없음(코드 diff 는 주석 2줄뿐).

## 요약

리뷰 대상은 (a) `public-webhook-quota.service.ts` 의 순수 docstring 정정 1건과 (b) 그 정정을 촉발한 plan 항목 완료 기록, (c) 그 항목들과 함께 처리된 spec 구조 개선 2건(`4-cafe24.md` §9.8→§4.4 normative 이관, `15-chat-channel.md` CCH-SE-02 이중 SoT 축약)이다. 코드 변경은 기능적으로 무해하고 구현과 정확히 일치하며, spec 변경들도 실제 구현(TTL·키 포맷·fail-open 정책)과 line-level 로 검증됐고 링크 무결성 가드도 13/13 통과했다. 다만 `4-cafe24.md`/`redis-keys.md` 에서 옮긴 SoT 지정을 `2-navigation/4-integration.md:1294` 라는 자매 포인터에는 반영하지 못해 "동일 대상을 두 절이 SoT 로 지목"하는 새 불일치가 하나 남았다 — 이번 PR 이 고치려던 문제 클래스의 축소된 재발이라 WARNING 으로 표시한다. 그 외에는 CRITICAL 급 발견 없음.

## 위험도

LOW
