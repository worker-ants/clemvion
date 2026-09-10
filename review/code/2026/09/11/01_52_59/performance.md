# 성능(Performance) 코드 리뷰 — `impl-chat-channel-patch-token` (누적 diff, 2026-09-11 01:52:59 라운드)

## 개요

이번 라운드는 `origin/main` 대비 브랜치 전체 누적 diff(16 `codebase/**` 파일 + CHANGELOG·plan·이전 리뷰 산출물)를 대상으로 한다. 핵심 코드 변경은:

- `ChatChannelUpdateConfigDto` 신설 (`OmitType(ChatChannelConfigDto, ['botToken', 'inboundSigningPlaintext'])`) — PATCH 전용 DTO 분리 (D-1)
- `TriggersService.setupChatChannel`/`update`/`create` — `storeUserSuppliedSecrets` / `preservedInboundSigningRef` 옵션 도입, secret-store 쓰기 조건부 게이팅 (D-2)
- `assertChatChannelInputSafe` 오버로드 분리, `assertPatchCarriesNoSecrets`, `assertChatChannelAlreadySetUp` 신설 검증 함수
- 컨트롤러 Swagger 문서·slack adapter 주석·e2e 테스트 바디·문서(mdx)·`triggers.service.spec.ts`/`trigger-dto-validation.spec.ts` 테스트 보강 (마지막 커밋 `84a6aeaa8` 은 테스트 전용, 프로덕션 코드 변경 없음)

`chat-channel-config.dto.ts`, `triggers.service.ts` 전체를 직접 열어 확인한 결과, 신규 로직은 전부 이미 메모리에 로드된 단일 `trigger`/`chatChannel` 객체에 대한 상수 시간 분기·프로퍼티 접근·구조 분해이며, 반복문 안에서의 DB/외부 API 호출(N+1), 신규 블로킹 I/O, O(n²) 문자열 누적, 불필요한 대규모 객체 생성은 발견되지 않았다.

## 발견사항

- **[INFO]** PATCH 경로가 오히려 외부 I/O(secret-store) 왕복을 조건부로 줄인다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `setupChatChannel()` 내 `if (storeUserSuppliedSecrets) { await this.secrets.rotate(botTokenRef, ...) }` (`[쓰기 ①]`)와 `const providerIssuedPlaintext = storeUserSuppliedSecrets ? chatChannelCfg.inboundSigningPlaintext : undefined;` (`[쓰기 ②]`)
  - 상세: `update()` 는 `storeUserSuppliedSecrets: false` 로 호출하므로(`triggers.service.ts` `update()` 본문 `await this.setupChatChannel(saved, chatChannel, { storeUserSuppliedSecrets: false, preservedInboundSigningRef: previousInboundSigningRef })`), `chatChannel` 이 실린 PATCH 마다 종전 무조건 실행되던 `secrets.rotate()` 호출 최대 2회(bot token + provider-issued signing)가 생략된다. telegram 의 server-issued 재발급(`[쓰기 ③]`, `result.issuedInboundSigning`)만 게이팅 없이 유지되는데, 이는 CHANGELOG·JSDoc 3-쓰기 표가 명시한 의도된 설계다(telegram adapter 가 `setupChannel` 마다 새 `secret_token` 을 발급하므로 저장을 건너뛰면 인입이 전부 401).
  - 제안: 조치 불요 — 회귀 아님, 오히려 개선.

- **[INFO]** 신규 검증/게이팅 함수는 전부 O(1) — 필드 수(≤10) 고정 객체에 대한 프로퍼티 조회
  - 위치: `chat-channel-config.dto.ts` `ChatChannelUpdateConfigDto`(`OmitType` 파생, 모듈 로드 시 1회 메타데이터 생성) / `triggers.service.ts` `assertChatChannelInputSafe`(오버로드 2개) · `assertPatchCarriesNoSecrets` · `assertChatChannelAlreadySetUp` · `stripChatChannelPlaintext`(구조 분해 `{ botToken: _bt, inboundSigningPlaintext: _isp, ...rest }`)
  - 상세: `Record<string, unknown>` 캐스팅 후 `typeof x !== 'undefined'` 확인, `trigger.config` 프로퍼티 접근은 반복·재귀·정규식 백트래킹이 없는 상수 시간 연산이다. `update()`의 `previousInboundSigningRef` 캡처(`trigger.config as {...}` 캐스팅 후 optional chaining)도 이미 `findById`로 로드된 단일 객체에서만 값을 읽어 별도 DB 왕복이 없다.
  - 제안: 조치 불요.

- **[INFO]** `update()`/`create()` 재조회(`triggerRepository.findOne`)는 `chatChannel` PATCH 1건당 정확히 1회로 유지 — N+1 없음
  - 위치: `triggers.service.ts` `update()` 끝부분 `if (chatChannel) { await this.setupChatChannel(...); const refreshed = await this.triggerRepository.findOne({ where: { id: saved.id, workspaceId }, relations: ['workflow'] }); ... }`
  - 상세: 이번 diff 가 추가한 `assertChatChannelAlreadySetUp` 호출, `previousInboundSigningRef` 캡처는 이 재조회 앞에서 in-memory `trigger` 객체만 읽고 끝나며, 재조회 자체는 이전 라운드부터 존재하던 코드(diff 대상 아님)로 요청당 1회 그대로다. 반복문 안에서 이 재조회를 호출하는 경로는 없다.
  - 제안: 조치 불요.

## 확인된 것 — 위반 없음

- 반복문 내 DB/외부 API 호출(N+1) 패턴 없음.
- 불필요한 대규모 객체 생성·메모리 누수 소지 없음 — 모든 신규 객체는 필드 5~10개 수준 얕은 복사(`{ ...internalCfg, ...(result.configUpdates ?? {}), ... }` 류)이고 요청 스코프를 벗어나 보관되지 않는다.
- 캐싱이 필요한 반복 계산 없음 — 신규 검증 로직은 요청당 1회만 실행.
- 블로킹 동기 I/O 없음 — `secrets.rotate`, `adapter.setupChannel`, `triggerRepository.*` 전부 기존과 동일하게 `await` 로 처리.
- O(n²) 문자열 연결 없음 — 신규 에러 메시지·Swagger 설명은 전부 정적 리터럴/단일 template literal.
- 자료구조 선택 부적절 사례 없음.
- 지연 로딩 위반 없음 — `previousInboundSigningRef` 는 병합 직전 시점에만 추출.

## 요약

이번 누적 diff의 핵심(`ChatChannelUpdateConfigDto` 분리, `setupChatChannel` secret 쓰기 게이팅, 신규 검증 메서드들)은 모두 이미 메모리에 있는 단일 트리거/chatChannel 객체에 대한 상수 시간 분기이며, 신규 DB 쿼리·N+1 패턴·블로킹 I/O·비효율 자료구조·O(n²) 연산이 도입되지 않았다. 오히려 PATCH 경로에서 불필요했던 secret-store 왕복(최대 2회/요청)을 조건부로 생략하게 되어 외부 I/O 호출 수가 감소하는 방향의 변경이다. 마지막 커밋은 테스트 케이스 추가(`it.each` 10조합)만 포함하며 프로덕션 코드 변경이 없어 이 결론에 영향을 주지 않는다. 이전 두 라운드(`review/code/2026/09/10/23_55_23`, `review/code/2026/09/11/00_21_55`)의 성능 리뷰도 동일한 코드 경로를 검토해 NONE 으로 판정했고, 이번 라운드에서 그 결론을 뒤집을 근거는 발견되지 않았다. 성능 관점에서 이 PR을 막을 사유는 없다.

## 위험도

NONE
