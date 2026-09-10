# 동시성(Concurrency) 코드 리뷰 — chat-channel PATCH 비밀 차단 (D-1·D-2·D-3)

## 발견사항

- **[WARNING]** 같은 트리거에 대한 동시 요청이 `Trigger.config` JSONB 를 잃어버릴 수 있다(lost update) — 이번 diff 가 그 위에 보안에 중요한 `inboundSigningRef` 보존 로직을 얹었다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 의 `previousInboundSigningRef` 캡처(526~528행), `setupChatChannel()` 의 최종 영속화(1203~1215행, `newConfig = {...trigger.config, chatChannel: mergedChannel}` → `triggerRepository.update(...)`).
  - 상세:
    - `update()` 는 `findById()` (491행)로 `trigger` 를 한 번 읽은 뒤, 그 in-memory 스냅샷을 `assertChatChannelAlreadySetUp` 검증·`previousInboundSigningRef` 캡처(526~528행, 이번 diff 신규)·`Object.assign` 병합·`triggerRepository.save()`(556행)·`recordAudit`·`syncScheduleActivation`·`normalizeNotificationSecretRef`·`setupChatChannel()` 까지 **하나의 요청 전체에 걸쳐 재사용**한다. 이 경로에는 여러 `await` 가 있고, `setupChatChannel` 내부에는 외부 chat provider(API) 호출(`adapter.setupChannel`, 1172행)까지 끼어 있어 창(window)이 짧지 않다.
    - `Trigger` 엔티티에는 `@VersionColumn()` 같은 낙관적 잠금이 없고(`entities/trigger.entity.ts` 확인 — 버전 컬럼 0건), 이 read-modify-write 전체를 감싸는 DB 트랜잭션이나 `SELECT ... FOR UPDATE` 행 잠금도 없다. `save()`/`triggerRepository.update()` 는 각자 자신이 들고 있던 in-memory `config` 스냅샷을 **통째로** 덮어쓴다.
    - 구체적 인터리빙: 같은 트리거에 대해 (a) `chatChannel` 을 포함하지 않는 PATCH B(예: `name` 변경만)와 (b) `chatChannel` 을 포함하는 PATCH A 가 겹치는 경우 — B 가 A 보다 먼저 `trigger.config` 를 읽었지만 `save()` 는 A 의 `setupChatChannel` 최종 쓰기보다 **나중에** 커밋되면, B 의 `save()` 가 A 가 방금 반영한 `config.chatChannel`(그리고 이번 diff 가 지키려는 `inboundSigningRef` presence)을 B 의 오래된 스냅샷으로 되돌려 쓴다. 이 diff 이전에는 이 필드가 "이번 호출에서 새로 쓴 경우만 실림" 이라 매 PATCH 마다 사라지는 **결정적 버그**였는데(그래서 CRITICAL 로 잡혀 이번에 고쳤다), 이번 수정은 그 결정적 버그를 "요청 시작 시점 스냅샷을 요청 끝까지 신뢰"하는 형태로 바꿨을 뿐이라, 단일 요청 관점에서는 옳지만 **동시 요청 관점에서는 여전히 레이스**다.
    - 파급: `ChatChannelInboundAuthenticator` 는 세 provider 모두 `if (!config.inboundSigningRef) return;` (fail-open) 이라고 리뷰 산출물(`review/code/2026/09/10/23_21_57/RESOLUTION.md` CRITICAL #1)이 이미 실측해 뒀다. 즉 이 레이스가 나쁜 순서로 발현되면, 이번 PR 이 막 닫은 "카드 편집 PATCH 한 번으로 인입 서명 검증이 fail-open 된다" 는 바로 그 결함이 **동시 요청 타이밍**을 통해 재발할 수 있는 경로가 남는다.
    - 같은 blind-overwrite 패턴이 `rotateChatChannelBotToken()`(1541~1550행, `config: { ...(trigger.config ?? {}), chatChannel: mergedChannel }`)에도 이미 존재해 이 아키텍처 자체는 이번 diff 가 새로 만든 것이 아니다 — 저장소 전체가 트리거 단위 낙관적 잠금/트랜잭션을 쓰지 않는 기존 패턴이다. 다만 이번 diff 는 그 위에 **보안 결정(서명 검증 fail-open 여부)** 을 얹었다는 점에서, 그 위험이 새로 표면화됐다.
  - 제안: (a) 트리거 단위 advisory lock 이나 `SELECT ... FOR UPDATE` 로 `update()`/`setupChatChannel()`/`rotateChatChannelBotToken()` 의 read-modify-write 구간을 직렬화한다(저장소 선례: `exec-intake PR2b 동시성 cap` 이 조건부 UPDATE 만으로는 TOCTOU 를 못 막아 advisory lock 을 도입한 사례). (b) 최소한 `config` 컬럼에 낙관적 잠금(버전 비교 후 재시도)을 추가한다. (c) 이번 PR 범위를 넘는 아키텍처 변경이면, 최소한 이 레이스를 회귀 테스트로 문서화(예: 두 `update()` 호출을 mock repository 로 인위적으로 인터리빙시켜 `inboundSigningRef` 소실을 재현)하고 후속 planner/개발 턴에 명시적으로 등재할 것을 권고한다. 현재 diff 의 `triggers.service.spec.ts` 신규 테스트는 전부 단일 `update()` 호출 기준이라 이 클래스의 결함을 검출하지 못한다.

## 확인된 것 — 문제 없음

- `secrets.rotate()`(`SecretResolverService`)는 키별 UPSERT 로 구현돼 있어(`secret-resolver.service.ts:129`) 개별 secret 쓰기 자체는 동시 rotate 호출에 대해 원자적이다 — 위 발견은 secret store 가 아니라 `Trigger.config` JSONB 컬럼 전체 교체 패턴에 대한 것이다.
- `create()`/`update()` 양쪽 모두 `await this.setupChatChannel(...)` 호출을 정상적으로 `await` 하고 있고, 이번 diff 에서 새로 추가된 비동기 호출(`assertChatChannelAlreadySetUp` 은 동기, `secrets.rotate` 게이팅 분기들) 중 누락된 `await` 는 없다.
- DTO 파일(`chat-channel-config.dto.ts`, `update-trigger.dto.ts`)과 컨트롤러 Swagger 설명 변경은 선언적 클래스/데코레이터 수정뿐이라 동시성 표면이 없다.
- 신규 테스트(`trigger-dto-validation.spec.ts`, `triggers.service.spec.ts`)는 `it.each`/개별 `it` 를 순차 실행하는 표준 패턴을 쓰고 있고 `test.concurrent` 등 병렬 실행 지시자를 쓰지 않아 테스트 자체의 상호 오염 위험은 없다.
- `Trigger` 엔티티에 `@VersionColumn` 이 없다는 사실 자체, 그리고 `rotateChatChannelBotToken()` 의 동일 blind-overwrite 패턴은 이번 diff 가 만든 것이 아니라 기존 아키텍처다 — 이번 diff 의 신규 결함으로 보고하지 않고, 이번 diff 가 그 기존 위험 표면 위에 보안 로직을 얹었다는 사실만 별도 항목으로 기록했다(위 WARNING).

## 요약

DTO 분리·서비스 검증 경로 분리 자체에는 동시성 결함이 없고, `async`/`await` 누락이나 명백한 데드락·경쟁조건도 diff 신규 코드 라인에서는 발견되지 않았다. 다만 이번 diff 가 고친 보안 결함(카드 편집 PATCH 후 `inboundSigningRef` 소실 → 인입 서명 fail-open)의 수정 방식이 **요청 시작 시점에 읽은 in-memory 스냅샷을 요청 끝까지(외부 API 호출을 포함한 여러 `await` 를 거쳐) 신뢰**하는 형태이고, `Trigger.config` 갱신 경로 전체(`update()`/`setupChatChannel()`/`rotateChatChannelBotToken()`)에 낙관적 잠금이나 행 잠금이 전혀 없어, 같은 트리거에 대한 동시 PATCH(또는 PATCH-와-rotate 동시 요청)가 이 필드의 존재 여부를 인터리빙에 따라 되돌릴 수 있다. 이는 저장소 전반에 이미 있던 패턴의 연장이라 이번 PR 단독의 신규 결함으로 보기는 어렵지만, 이번 PR 이 방금 닫은 CRITICAL(fail-open)과 정확히 같은 증상을 동시성 경로로 재발시킬 수 있다는 점에서 별도 후속 조치(트랜잭션/잠금 또는 최소한 회귀 테스트)가 필요하다고 판단해 WARNING 으로 기록한다.

## 위험도

MEDIUM
