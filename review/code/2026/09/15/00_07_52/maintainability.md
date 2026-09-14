# 유지보수성(Maintainability) 리뷰 — trigger-config-lost-update (11라운드)

## 검토 범위

`plan/in-progress/trigger-config-lost-update.md` 가 기록한 10라운드 리뷰 이력 위에서, 최신 커밋
(`91b816498`, C1 fix)까지 반영된 최종 diff 를 대상으로 확인했다. 특히 이전 라운드(`18_17_44`)의
maintainability WARNING/INFO 4건이 이번 diff 에서 실제로 해소됐는지를 코드로 직접 대조했다.

## 이전 라운드 지적의 해소 확인 (재발 아님 — 긍정적 확인)

- `buildFallbackChannel`/`buildMergedChannel` 중복(18_17_44 WARNING#6) → `chat-channel-binder.service.ts`
  가 `buildChannel(freshConfig, setupResult?)` 단일 함수로 합쳤다. 성공/실패 두 경로가 이 함수
  하나를 공유해 drift 위험이 사라졌다.
- `{ chatChannel?: { inboundSigningRef?: string } }` 인라인 캐스트 3중 복제(18_17_44 WARNING#7) →
  `extractInboundSigningRef()` 로 추출돼 `chat-channel-binder.service.ts`·`triggers.service.ts`
  두 자리(3회 호출) 모두 이 함수를 쓴다 — 실측 확인(`grep`).
- `RESOURCE_NOT_FOUND` 리터럴이 네 곳에 복제돼 있었다는 자기 지적(파일 내 주석) → `assertTriggerFound`
  / `throwTriggerNotFound` 로 한 곳(`triggers.service.ts:403`)에만 남았다.
- "락 없이 스냅샷 통째 쓰기" 패턴(3곳)이 `rewriteTriggerConfigLocked` 공용 함수로, "하위 키 위에
  머지" 패턴(4곳: `rotateBotToken`·`normalizeNotificationSecretRef`·`revokePerTriggerToken`·
  `promoteRotatedNotificationSecrets`)이 `mergeIntoFreshSubKey` 공용 헬퍼로, `manager.transaction`
  mock 배선(6개 스펙 파일 대상)이 `withTransactionMock` 공용 유틸로 각각 수렴했다 — 전부 중복을
  줄이는 방향이다.

## 발견사항

- **[INFO]** `TriggersService.update()` 가 182줄로, 트랜잭션 클로저 한 겹만큼 중첩이 늘었다 — 이미 트래커에 등재된 항목
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:540`-`721` (`update()`), 특히 `621`-`670` 의 `this.triggerRepository.manager.transaction(async (m) => { … })` 블록
  - 상세: `update()` 는 origin/main 기준 164줄이었고 이번 PR 로 221줄(주석 포함, 실질 로직도 증가)이 됐다. 검증(스케줄 타입 분기·notification/chatChannel 안전성 검사)과 락-재읽기-병합-저장 트랜잭션, 그리고 커밋 후 후속 처리(감사·schedule 동기화·secret 정규화·chatChannel setup 재조회)가 한 메서드 안에 이어져 있어 진입점 하나가 지는 책임이 많다. `plan/in-progress/trigger-config-lost-update.md:599` 가 이미 "트랜잭션 클로저를 `mergeAndSaveLocked(...)` 로 분리 — 다음 편집 때"로 후속 등재해 둔 항목과 정확히 일치한다.
  - 제안: 이번 배치를 막을 사유는 아니다. 트래커의 계획대로 다음 편집 시 트랜잭션 클로저(락 획득 → 재읽기 → `mergeExternalConfig` → `Object.assign` → `save`)를 `mergeAndSaveLocked(manager, id, workspaceId, mergeFn)` 형태의 사설 헬퍼로 뽑으면 `update()` 자체는 "검증 → 위임 → 후처리" 세 단으로 얇아진다.

- **[INFO]** `SchedulesService.update()` 회귀 스펙에 거의 동일한 fixture 리터럴이 4벌 반복된다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — "name·isActive 함께" / "trigger 필드 미변경" / "name 만" 세 신규 케이스(diff 게이트 `499`~`580` 부근) + 기존 "isActive 만" 케이스
  - 상세: 네 테스트 모두 `scheduleRepo.findOne.mockResolvedValue({ id, workspaceId, isActive, cronExpression, timezone, triggerId, trigger: {...} })` 리터럴을 통째로 복제하고 `dto`·기대값만 바꾼다. 분기 매트릭스(둘 다 변경/둘 다 미변경/단독 변경)를 명시적으로 펼친 의도는 좋지만(과거 "단독 분기만 있으면 퇴행 통과" 지적을 스스로 방어), 다음에 `Schedule` 목(mock) 형태가 바뀌면 네 곳을 함께 고쳐야 한다.
  - 제안: 급하지 않음. `makeScheduleWithTrigger(overrides)` 같은 지역 팩토리 하나로 공통 필드를 뽑고 `it.each([[patch, expectedTriggerPatch], ...])` 로 테이블화하면 다음 필드 추가 시 한 곳만 고치면 된다.

- **[INFO]** `withTransactionMock` 내부 4개 위임 클로저(`findOne`/`remove`/`save`/`update`)가 "옵셔널 캐스트 후 있으면 위임, 없으면 폴백" 패턴을 각각 손으로 반복한다
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:103`-`126`
  - 상세: 네 클로저 모두 `const xMock = triggerRepoMock.x as (...) | undefined; return xMock ? xMock(...) : fallback;` 형태다. 이 파일 자체는 6개 스펙 파일에 흩어져 있던 배선을 한 곳으로 모은 좋은 리팩터(JSDoc 이 그 근거를 실측과 함께 적어 뒀다)라 이 지적은 그 안의 사소한 잔여 중복이다.
  - 제안: 필요하면 `function delegate<A extends unknown[], R>(fn: unknown, args: A, fallback: R): R | undefined` 류의 제네릭 헬퍼로 단순화할 수 있다. 시그니처가 메서드마다 달라(인자 개수·순서) 일반화 이득이 크지 않을 수 있어 급하지 않음.

- **[INFO]** 새로 추가된 일부 인라인 주석이 한 줄로 길게 이어져 주변 문단형 주석의 줄바꿈 관례와 다르다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:512`, `:706` (`// setupChatChannel 은 별도 \`rewriteTriggerConfigLocked\`(락 안 재읽기·머지) 로 …`)
  - 상세: 이 파일의 대다수 JSDoc/인라인 주석은 대략 90자 내외에서 줄을 바꾸는데, 이 두 줄은 그보다 길게 한 줄로 남아 있다(기존 `// setupChatChannel 은 별도 triggerRepository.update 로 …` 문구에 용어만 갈아 끼운 흔적). 가독성에 실질적 지장은 크지 않다.
  - 제안: 조치 불요 수준. 다음에 이 근처를 편집할 때 줄바꿈만 맞추면 된다.

## 확인했지만 지적하지 않은 것

- `chat-channel-input-rules.ts`/`trigger-config-lock.ts`/`endpoint-path-conflict-wrap-guard.ts` 신규·수정 함수들은 각각 단일 책임, 명확한 이름(`triggerConfigLockKey`, `rewriteTriggerConfigLocked`, `mergeIntoFreshSubKey`, `isManagerTriggerSave`), 매직 넘버 없음(락 타임아웃은 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 상수)을 확인했다 — 문제 없음.
- 극도로 긴 JSDoc/주석 밀도는 이 저장소 전반(예: `sanitizeForResponse`, `CHANGELOG.md` 다른 항목)에서 이미 확립된 컨벤션이라 이 PR 만의 이탈이 아니다.
- `ChatChannelBinderService.setupChatChannel()` 은 여전히 약 240줄이지만, 이번 PR 은 클로저를 3개에서 2개(`survivesWithFresh`, `buildChannel`)로 오히려 줄였다 — 18_17_44 라운드가 우려한 "클로저 3개 증가"가 실현되지 않고 반대로 개선됐다.

## 요약

10라운드에 걸친 반복 리뷰 끝에, 이번 최종 diff 는 스스로 지적했던 중복(락 없는 스냅샷 통째 쓰기 3곳, 하위 키 머지 4곳, chat-channel 바인더의 두 클로저, `inboundSigningRef` 추출 3곳, `RESOURCE_NOT_FOUND` 리터럴 4곳, 트랜잭션 mock 배선 6개 파일)을 전부 이름 있는 공용 함수/헬퍼로 수렴시켜 순중복을 줄이는 방향으로 마무리됐다. 남은 항목은 전부 INFO 급이며, 그중 가장 눈에 띄는 `TriggersService.update()` 182줄 문제는 이미 이 PR 의 plan 트래커(§후속)에 "다음 편집 때 `mergeAndSaveLocked` 로 분리"라고 등재돼 있어 새로 발견한 것이 아니라 이미 알려진 채무다. 테스트 fixture 중복 몇 곳과 사소한 주석 줄바꿈 불일치도 차단 사유가 아니다.

## 위험도

LOW
