# 유지보수성(Maintainability) 리뷰 — trigger-config-lost-update

## 검토 범위

실제 애플리케이션 코드 변경(14개 소스/테스트 파일 + 신규 e2e)을 대상으로 했다.
`review/code/**`·`review/consistency/**` 하위의 과거 라운드 산출물(파일 20~231)은 이번
PR 의 changeset 에 함께 실려 있지만 코드가 아니라 이전 리뷰 라운드의 markdown 리포트이므로
"가독성/네이밍/함수 길이/중첩/매직넘버/중복/복잡도" 관점 적용 대상이 아니다 — 리뷰 대상에서
제외했다(이 판단 자체는 이전 라운드 `scope.md` 도 동일하게 내렸다).

## 발견사항

- **[WARNING]** `TriggersService.update()` 가 이번 PR 로 더 길어지고 책임이 하나 늘었다 — lock/재읽기/병합/저장 트랜잭션이 메서드 본문에 그대로 인라인됐다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:540-721` (`update()`), 특히 `606`-`671` (`this.triggerRepository.manager.transaction(async (m) => {...})` 블록)
  - 상세: `update()` 는 이 PR 이전에도 163줄(스키마 검증 · notification/chatChannel 안전성 검사 · authConfig 검증 · config 병합 · 저장 · 감사 · schedule 동기화 · secret 정규화 · chatChannel setup · 응답 정화)을 한 메서드에 담고 있었는데, 이번 PR 이 "advisory lock 획득 → 락 안 재읽기 → ref 보존 게이트 재계산 → config 병합 → save" 라는 또 하나의 완결된 책임을 `.transaction(async (m) => {...})` 콜백으로 그대로 그 안에 얹어 총 182줄(+약 60줄)로 늘렸다. 같은 PR 이 `mergeIntoFreshSubKey`·`assertTriggerFound`·`throwTriggerNotFound`·`findByIdForUpdate` 는 별도 private 메서드로 뽑아냈으면서, 정작 가장 새롭고 복잡한 블록(락 획득 · 두 config 출처 중 선택 · 보존 게이트 재계산 · 저장 대상 조립)은 `update()` 본문 안 익명 콜백으로 남겨 그 안에서만 일관성이 깨졌다.
  - 제안: 이 트랜잭션 블록을 `trigger-config-lock.ts` 의 `rewriteTriggerConfigLocked` 처럼 별도 private 메서드(예: `saveUpdatedTriggerLocked(trigger, workspaceId, config, notification, interaction, safeChatChannel, defined)`)로 뽑으면, `update()` 자체는 "검증 → 저장 위임 → 후속 부수효과" 흐름만 남아 스캔 범위가 줄고, 그 저장 로직만 별도로 단위 테스트하기도 쉬워진다.

- **[INFO]** `ChatChannelBinderService.setupChatChannel()` 이 여전히 매우 길다 — 이번 PR 은 개선(2→1 클로저 통합)과 확장(신규 클로저 1개)을 동시에 했다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:87-323` (`setupChatChannel`), 클로저는 `209`(`survivesWithFresh`)·`226`(`buildChannel`)
  - 상세: 이 메서드는 이미 이전 라운드(`review/code/2026/09/14/18_17_44/maintainability.md`)에서 "매우 길고 로컬 클로저가 많다"는 INFO 를 받은 자리다. 이번 PR 은 그 지적이 겨눴던 `buildFallbackChannel`/`buildMergedChannel` 중복(WARNING#6)을 `buildChannel` 하나로 성공적으로 통합해 반은 해소했지만, 동시에 `survivesWithFresh` 게이트 재계산 클로저를 새로 추가해 메서드 자체 길이는 오히려 237줄로 늘었다. 개선 방향은 맞으나 함수 하나가 지는 인지 부하는 줄지 않았다.
  - 제안: 조치 불요(차단 사유 아님) — 다만 이전 라운드가 제안한 "presence-gate 재계산 + config 조립을 메서드 밖 모듈 레벨 순수 함수로 뽑기"가 이번에도 미착수 상태로 남아 있다는 점은 계속 추적할 가치가 있다.

- **[INFO]** `withTransactionMock` 의 `manager` 스텁이 같은 위임 패턴을 5번 반복한다
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:104-132` (`findOne`/`delete`/`remove`/`save`/`update` 각 `jest.fn(...)`)
  - 상세: 다섯 메서드 모두 "바깥 `triggerRepoMock` 의 동명 메서드를 함수 타입으로 캐스트 → 있으면 위임, 없으면 기본값" 이라는 동일한 3줄짜리 형태를 손으로 반복한다. 시그니처(인자 개수·기본 반환값)가 조금씩 달라 완전한 중복은 아니지만, 여섯 번째 위임 메서드가 추가될 때 같은 형태를 또 손으로 베낄 자리다.
  - 제안: 급하지 않음(테스트 전용 헬퍼, 위험 낮음). 필요하면 `delegate<T>(mock: Record<string, unknown>, name: string, fallback: T)` 류의 제네릭 헬퍼로 다섯 줄을 하나의 호출로 접을 수 있다.

- **[INFO]** 프로덕션 코드 JSDoc 에 과거 `/ai-review` 라운드 경로가 다수 리터럴로 박혀 있다 — 이 저장소의 기존 관례이지만 코드:주석 비율이 이번 PR 에서 특히 높다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 전체(184줄 중 대부분이 JSDoc), `triggers.service.ts:606-671`(락 트랜잭션 블록의 주석/코드 비율이 약 45:20줄)
  - 상세: 이 패턴(`/ai-review` `review/code/2026/09/14/HH_MM_SS` 관점 등급 인용) 은 이 저장소가 "결정의 배경·근거를 코드/문서에 남긴다"는 원칙을 이미 강하게 따르고 있어 새로 도입된 스타일은 아니고, 각 인용이 실제로 반증 가능한 실측(뮤턴트 카운트 등)과 함께 있어 근거 없는 서술도 아니다. 다만 `trigger-config-lock.ts` 한 파일 안에서만 인용이 최소 8곳이라, 이 리뷰가 참조하는 `review/code/2026/09/14/*` 디렉터리들이 훗날 정리·아카이브되면(이 저장소의 `plan/complete/archive/from-*` 관례처럼) 코드 안의 그 근거들이 검증 불가능한 죽은 포인터로 남을 위험이 있다. 차단 사유는 아니다.
  - 제안: 조치 불요. 다만 이 축적 속도(파일당 인용 밀도가 계속 느는 추세)를 감안하면, 장기적으로는 인용 문자열 자체보다 "무엇을 실측했는가"의 요지를 주석에 남기고 원 리뷰 경로는 부가 정보로 두는 편이 리뷰 산출물 보존 정책과 덜 결합된다.

## 긍정적으로 확인한 점 (참고)

- 이전 라운드(`18_17_44`)가 지적한 **`buildFallbackChannel`/`buildMergedChannel` 중복 WARNING#6** 이 `buildChannel` 하나로 통합돼 해소됐다 (`chat-channel-binder.service.ts:226-249`).
- **`extractInboundSigningRef`** (`chat-channel-input-rules.ts:247-250`) 는 세 자리에 흩어져 있던 동일한 인라인 캐스트(`{ chatChannel?: { inboundSigningRef?: string } }`)를 이름 있는 순수 함수 하나로 정확히 대체했고, `triggers.service.ts`·`chat-channel-binder.service.ts` 양쪽이 실제로 그 함수를 재사용한다.
- **`touchLastTriggeredAt`** (`hooks.service.ts`) 은 두 호출부에 복제돼 있던 동일한 주석+코드 5줄을 한 곳으로 모았고, 그 복제가 실제로 이 PR 이 잡은 결함(`review/code/2026/09/14/19_44_08` testing CRITICAL#2)의 원인이었다는 근거까지 JSDoc 에 남겼다 — 중복 제거가 장식이 아니라 재발 방지 근거를 갖췄다.
- `triggers.service.ts` 의 `mergeIntoFreshSubKey`/`assertTriggerFound`/`throwTriggerNotFound`/`findByIdForUpdate` 네 private 헬퍼는 각각 단일 책임 · 명확한 이름 · 존재 이유를 설명하는 JSDoc 을 갖추고 있고, `rotateBotToken`·`revokePerTriggerToken`·`normalizeNotificationSecretRef`·`promoteRotatedNotificationSecrets` 네 자리가 `mergeIntoFreshSubKey` 를 공유해 "하위 키 기준 병합"이라는 반복되던 형태를 한 곳으로 모았다.
- 매직 넘버 없음 — `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`, e2e 의 `RATE_LIMIT_FROM_A/B`·`SETTLE_MS` 모두 의미가 드러나는 이름의 상수로 선언되고 존재 이유가 주석에 있다.
- 네이밍이 목적을 잘 드러낸다 (`triggerConfigLockKey`, `acquireTriggerConfigLock`, `rewriteTriggerConfigLocked`, `mergeIntoFreshSubKey`, `withTransactionMock`).

## 요약

이번 변경은 네 곳(과 후속으로 더 발견된 일곱 곳)에 흩어져 있던 "락 없이 스냅샷을 통째로 되쓰는" 패턴을 `trigger-config-lock.ts` 의 공용 함수들로 통합하는 방향이며, 그 과정에서 기존에 지적됐던 실제 중복(`buildFallbackChannel`/`buildMergedChannel`, `extractInboundSigningRef` 대상 인라인 캐스트 3곳, `touchLastTriggeredAt` 대상 5줄 복제)을 정확히 해소했다 — 유지보수성 관점에서는 순감소 방향의 리팩터다. 다만 그 통합 작업 자체가 `TriggersService.update()` 안에 새 트랜잭션 블록을 인라인으로 얹어 이미 길었던 메서드(163→182줄, 다중 책임)를 더 무겁게 만들었고, `setupChatChannel()`(237줄) 도 이전 라운드가 지적한 "너무 길다"는 상태를 벗어나지 못했다. 두 항목 모두 별도 private 메서드/모듈 레벨 함수로 뽑을 여지가 뚜렷하지만, 이번 PR 의 핵심 목적(동시성 lost-update 차단)을 막을 사유는 아니다. 그 외 매직 넘버·네이밍 컨벤션·테스트 헬퍼 위생은 모두 양호하다.

## 위험도

LOW
