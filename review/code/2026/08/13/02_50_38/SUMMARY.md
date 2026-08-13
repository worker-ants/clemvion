# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, `developer` 가 `spec/` 을 직접 수정하는 절차 위반(CLAUDE.md read-only 규약)이 이번 라운드에서 `15-chat-channel.md` 1건에서 `telegram.md` 로 **확산**됐다(scope WARNING). 그 외 핵심 구현(`ChatChannelDedupService` + `HooksService` 배선)은 spec-대조·보안·부작용·테스트 전 축에서 LOW 로 안정적이다. forced whitelist(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과가 실제로 확보되었으므로 whitelist 미이행에 의한 낮은 판정 은닉은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | `developer` 가 `spec/` read-only 규약을 어기고 spec 을 직접 수정 — 1차 라운드가 지적한 `15-chat-channel.md` 위반이 되돌려지지 않은 채, 이번 라운드에서 `telegram.md` 로 위반이 한 파일 더 확산됨. 내용 정확성 자체는 구현과 일치하나 권한·절차 위반. | `spec/5-system/15-chat-channel.md:88`, `spec/4-nodes/7-trigger/providers/telegram.md:235-236` | 두 spec 정정이 project-planner 턴 또는 사후 `consistency-check --spec` 승인을 거쳤는지 확인. 커밋/PR 설명에 감사 추적 명시 |
| 2 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec/5-system/15-chat-channel.md` CCH-NF-03 "구현" 절이 이번 PR 이 삽입한 CCH-SE-02 dedup 게이트를 반영 못해 "parseUpdate 직후 한도 초과 시" 서술이 더 이상 정확하지 않음. 코드는 의도된 설계(dedup 을 rate-limit 보다 앞에 배치)로 맞고, spec 서술만 낡음. | `spec/5-system/15-chat-channel.md:113` (CCH-NF-03 "구현:" 절) | 코드는 그대로 두고 CCH-NF-03 "구현:" 절을 "parseUpdate 직후(CCH-SE-02 dedup 게이트 통과 후) 한도 초과 시 …" 로 갱신. project-planner 턴에서 처리 |
| 3 | requirement | `CHANGELOG.md` 신규 항목의 "provider 파서 4종"이 사실과 다름 — 실제로 `idempotencyKey` 를 채우는 파서는 telegram/slack/discord **3종**뿐(grep 전수 확인) | `CHANGELOG.md:5` | "provider 파서 4종" → "provider 파서 3종"으로 정정 |
| 4 | maintainability | `HooksService.handleChatChannelWebhook`(257-692행, 436줄)가 이미 다중 책임 함수인데 이번 PR 의 CCH-SE-02 dedup 게이트(328-345행)로 조기-return 게이트가 하나 더 늘어남. 새 블록 자체는 기존 rate-limit 게이트와 구조 동일해 즉각 리팩터링 강제 수준은 아니며, 직전 라운드에서 "다음 게이트 추가 시 추출"로 조건부 유예된 판단을 재확인 | `codebase/backend/src/modules/hooks/hooks.service.ts:257-692`, 신규 `:328-345` | 유예 조건(다음 게이트 추가) 도달 시 파싱 후 게이트 체인을 `runInboundGates(...)` 류 private 헬퍼로 추출 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture/maintainability | Redis "원자 연산 + fail-open + 개별 Logger" 골격 클래스가 3개째(`ChatChannelDedupService`/`ChatChannelRateLimiterService`/`PublicWebhookQuotaService`) — 생성자가 사실상 동일 복제 | `chat-channel-dedup.service.ts:39-46` vs `chat-channel-rate-limiter.service.ts:34-42` | 4번째 유사 클래스 등장 시 공통 베이스(`RedisFailOpenGuard`/`resolveRedisClient` 헬퍼) 추출 검토 — 지금은 조치 불요(이미 조건부 유예) |
| 2 | security | `idempotencyKey` 에 길이 제한 없이 Redis 키를 구성 — provider 인증·컨트롤러 바디 크기 제한을 통과해야만 도달 가능한 좁은 표면 | `chat-channel-dedup.service.ts:9`(`makeChatDedupKey`), 호출부 `hooks.service.ts:339` | 급하지 않음. 필요 시 상한 길이 clamp 하드닝 고려 |
| 3 | maintainability/documentation | `'CHAT_CHANNEL_DEDUP_REDIS'` DI 토큰이 프로덕션에서 provide 되지 않는 테스트 전용 훅인데, 형제 클래스(`ChatChannelRateLimiterService`)와 달리 그 사실을 알리는 설명 주석이 없음 | `chat-channel-dedup.service.ts:39-46` | 형제 클래스와 동일한 한 줄 주석 추가 |
| 4 | maintainability/documentation | `handleChatChannelWebhook` 상단 JSDoc 파이프라인 요약(1~5단계)이 신규 dedup 단계·기존 rate-limit 단계를 반영하지 않음 | `hooks.service.ts:243-256` | docstring 에 "3.5 CCH-SE-02 dedup" · "3.6 CCH-NF-03 rate-limit" 추가 |
| 5 | testing | dedup 윈도우 상수(30초)·키 포맷(`cc:dedup:<triggerId>:<idempotencyKey>`)이 테스트에서 리터럴로 pin 되지 않음 — 구현·테스트가 같은 심볼을 참조해 숫자/포맷 자체의 회귀는 못 잡음(형제 파일과 동일한 기존 관례) | `chat-channel-dedup.service.ts:6-9,12`, 대응 `chat-channel-dedup.service.spec.ts:34-40` | 리터럴 단언(`toBe(30)`, `toBe('cc:dedup:t:u')`) 한 줄씩 추가. 우선순위 낮음 |
| 6 | testing | `RedisConnectionProvider` 폴백 분기(3번째 `??`) 와 e2e(실제 중복 POST) 커버리지 부재 — 둘 다 직전 라운드에서 이미 사유와 함께 유예된 재확인 사안 | `chat-channel-dedup.service.ts:39-46`; `hooks.service.spec.ts:1227-1271` | 조치 불요(이미 유예). 재지적 방지 목적 기록 |
| 7 | documentation | `slack.md`/`discord.md` 의 동일 계열 dedup 서술이 `telegram.md` 만큼 SoT 백링크·구현일자 각주를 갖추지 못해 provider 문서 3종 상세도가 불균일. 사실 오류는 아님 | `spec/4-nodes/7-trigger/providers/discord.md:324`, `spec/4-nodes/7-trigger/providers/slack.md:301` | 다음에 세 provider 문서를 함께 만질 때 SoT 백링크 한 줄씩 추가해 상세도 통일 |
| 8 | scope | `hooks.service.spec.ts` 에 `@nestjs/common` import 가 두 줄로 중복 선언(`Logger` 별도 import) — lint 는 통과하나 불필요한 diff 노이즈 | `hooks.service.spec.ts:11` (기존 블록은 `:4-10`) | 다음에 이 블록을 만질 때 하나로 병합 |
| 9 | maintainability | `hooks.service.spec.ts` 안에 warn-spy 복원 방식이 3가지로 공존(직접 `mockRestore()` 2건 vs 신규 `try/finally` 1건) | `hooks.service.spec.ts:961,1138,1251` | 급하지 않음. 다음에 만질 때 `try/finally` 로 통일 |
| 10 | side_effect/scope | 직전 리뷰 라운드(`02_38_41`) 산출물 12개(SUMMARY/RESOLUTION/8개 reviewer md/meta.json/`_retry_state.json`)가 이번 diff 에 신규 파일로 함께 커밋됨 — 런타임 부작용 없음, `_retry_state.json` 은 "pending" 스냅샷을 영구 기록해 다소 오해 소지 | `review/code/2026/08/13/02_38_41/**` | 조치 불요. 참고 기록 |
| 11 | maintainability | `ChatChannelModule` 상단 docstring "모듈 구조" 열거에 `ChatChannelRateLimiterService`/`ChatChannelDedupService` 가 여전히 누락(사전 존재 stale) | `chat-channel.module.ts:22-32` | 우선순위 낮음. 다음에 만질 때 갱신 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 인증 이후에만 dedup 도달, 파라미터화된 Redis 호출, fail-open 은 기존 관례와 일관. idempotencyKey 길이 미제한은 좁은 표면(INFO) |
| architecture | LOW | 레이어 분리·모듈 경계·DI 방향 문제 없음. Redis fail-open 클래스 3중 복제·guard 누적은 조건부 유예 유지(INFO) |
| requirement | LOW | spec-구현 line-level 일치, 엣지케이스(Slack view_submission 빈 키)까지 방어 확인. CHANGELOG 오기·CCH-NF-03 spec-drift 2건 WARNING |
| scope | MEDIUM | 핵심 diff 는 단일 목적에 수렴하나, developer 의 spec/ 직접 수정이 1차→2차 라운드에 걸쳐 확산(WARNING) |
| side_effect | LOW | 신규 Redis 키 네임스페이스·`HooksService` 생성자 변경 모두 호출자 영향 없음을 grep 으로 재확인. 극단적 실패창은 기존 트레이드오프 반복 |
| maintainability | LOW | 코드 품질 전반 양호. `handleChatChannelWebhook` 비대화 지속(WARNING, 조건부 유예), 나머지는 INFO 다수 |
| testing | LOW | 단위+호출부 통합 이원화로 회귀 포착력 확보, 직전 WARNING(호출부 warn 미검증) 조치 확인. 남은 갭은 전부 INFO(리터럴 pin 부재 등) |
| documentation | LOW | 직전 WARNING 2건(telegram.md stale, CHANGELOG 누락) 정확히 조치됨을 재검증. slack/discord 문서 상세도 불균일만 INFO 로 잔존 |

## 발견 없는 에이전트

없음 — 8개 forced reviewer 전원이 최소 INFO 이상의 발견사항을 보고했다.

## 권장 조치사항

1. **[scope WARNING]** `spec/5-system/15-chat-channel.md`, `spec/4-nodes/7-trigger/providers/telegram.md` 두 파일의 spec 직접 수정이 project-planner 위임 절차를 거쳤는지 확인하고, 아니라면 사후 승인 근거를 기록. 이후 developer 턴에서 spec 변경 필요 시 반드시 멈추고 위임할 것.
2. **[SPEC-DRIFT]** `spec/5-system/15-chat-channel.md:113` CCH-NF-03 "구현:" 절을 실제 게이트 순서(parseUpdate → dedup → rate-limit)에 맞게 갱신 — project-planner 턴에서 처리 (코드 revert 아님, spec 갱신).
3. **[requirement WARNING]** `CHANGELOG.md:5` "provider 파서 4종" → "3종"으로 정정.
4. **[maintainability WARNING]** `handleChatChannelWebhook` 게이트 체인 추출은 다음 게이트 추가 시점까지 유예 유지 — 지금 조치 불요, 트리거 조건만 기억.
5. INFO 항목들(리터럴 pin 부재, DI 토큰 설명 주석, JSDoc 동기화, provider 문서 상세도 등)은 후속 정리 백로그로 남기고 급하게 처리하지 않는다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **제외**: 표 (reviewer · 이유, 6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(Redis SET NX EX 1회 추가) 저성능 영향 낮음 |
  | dependency | 신규 외부 의존성 없음 |
  | database | SQL/DB 스키마 변경 없음 |
  | concurrency | 신규 동시성 프리미티브 없음(기존 Redis NX 원자 연산 재사용) |
  | api_contract | 공개 API 계약 변경 없음(내부 게이트 배선) |
  | user_guide_sync | 사용자 가이드 문서 영향 없음 |
