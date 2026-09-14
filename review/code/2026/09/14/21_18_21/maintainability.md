# 유지보수성(Maintainability) 리뷰

## 검토 범위

`git diff origin/main...HEAD` 기준 `codebase/backend` 내 15개 파일(신규 3 · 수정 12)을 확인했다.
이 PR 은 여러 라운드의 `/ai-review` 를 거치며 반복 수정된 상태이고, 이전 라운드
(`review/code/2026/09/14/18_17_44`)가 지적한 `buildFallbackChannel`/`buildMergedChannel` 중복,
`{ chatChannel?: { inboundSigningRef?: string } }` 인라인 캐스트 중복, `RESOURCE_NOT_FOUND`
리터럴 중복은 이번 diff 에서 각각 `buildChannel`/`extractInboundSigningRef`/`assertTriggerFound`
로 실제로 해소된 것을 확인했다 — 아래 발견사항은 그 이후에도 남아 있거나 이번 라운드에
새로 생긴 항목만 다룬다. `review/**` 하위 산출물(과거 리뷰 리포트)은 코드가 아니므로 이 리뷰
대상에서 제외했다.

## 발견사항

- **[WARNING]** `TriggersService.update()` 가 트랜잭션 클로저를 안으로 삼켜 더 길어지고 책임이 늘었다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:579-629` (`this.triggerRepository.manager.transaction(async (m) => {...})` 블록), 메서드 전체는 `:498-679`
  - 상세: `update()` 는 origin/main 대비 163줄→182줄로 늘었고, 이번 PR 이 그 안에 "advisory lock 획득 → 재읽기 → presence 게이트 재계산 → config 병합 → 저장 대상 결정 → save" 를 담은 40줄짜리 트랜잭션 콜백을 추가로 심었다. 이 메서드는 이미 스케줄 타입 가드·인증 검증·notification/interaction 병합·chatChannel 재조회·감사 로그까지 담당하는 다책임 메서드였는데, 이번 변경으로 "동시성 제어" 라는 또 다른 관심사가 같은 함수 본문에 인라인으로 얹혔다. 트랜잭션 콜백 내부에 3중 폴백(`config ?? fresh?.config ?? trigger.config ?? {}`)과 `assertTriggerFound` 재호출까지 있어, 이 함수 하나를 온전히 이해하려면 스코프를 두 단계(메서드 → 콜백) 오가야 한다.
  - 제안: 트랜잭션 콜백 본문을 `private mergeAndSaveLocked(m, trigger, workspaceId, defined, ...)` 형태의 private 메서드로 뽑으면, `update()` 본문은 "이 지점에서 락 안에서 병합·저장한다" 한 줄 호출로 줄어들고, 락 로직 자체는 독립적으로 읽고 테스트할 수 있는 단위가 된다. `trigger-config-lock.ts` 의 `rewriteTriggerConfigLocked` 와 같은 결의 추출.

- **[INFO]** 락 안 재읽기 결과가 메서드 스코프의 `let` 변수를 통해 클로저 밖으로 되돌려진다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:544` (`let previousInboundSigningRef = extractInboundSigningRef(trigger.config);`), `:593-594` (트랜잭션 콜백 안에서 재대입), `:662` (콜백 밖에서 사용)
  - 상세: `previousInboundSigningRef` 는 트랜잭션 밖에서 요청 시작 시점 값으로 초기화됐다가, 트랜잭션 콜백 안에서 재읽은 행의 값으로 재대입되고, 콜백이 끝난 뒤(`setupChatChannel` 호출 시점)에 다시 읽힌다. 이 변수의 "최종 값이 무엇인지" 를 알려면 코드를 위→콜백 안→콜백 밖 순서로 세 지점을 따라가야 한다 — 값의 출처가 지역적이지 않다. 트랜잭션이 예외로 실패하면(예: `endpointPath` UNIQUE 충돌) 이 변수는 요청 시작 시점 값에 머무는데, 그 경우 뒤 코드는 애초에 실행되지 않으므로 버그는 아니지만, "언제 어떤 값인가" 를 읽는 사람이 직접 추적해야 하는 부담이 있다.
  - 제안: 트랜잭션 콜백이 `{ saved, previousInboundSigningRef }` 를 함께 반환하도록 바꾸면, 바깥 스코프의 `let` 재대입 없이 단일 대입으로 값의 흐름이 위→아래로만 흐르게 된다. 시급하지 않음 — 현재도 정확하며, 가독성 개선 여지 수준.

- **[INFO]** 존재-검증 헬퍼를 리터럴 `null` 인자로 호출해 "그냥 던지기" 용도로 재사용한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1243` (`if (!wrote) this.assertTriggerFound(null);`)
  - 상세: `assertTriggerFound(row)` 는 원래 "조회 결과가 있으면 좁혀서 돌려주고, 없으면 던진다" 는 계약의 헬퍼다(`:356-364`, DB 조회 직후 호출하는 용도로 도입됨). 여기서는 조회를 한 것이 아니라 `rewriteTriggerConfigLocked` 가 돌려준 `wrote: boolean` 이 `false` 일 때 404 를 내고 싶어서, 그 계약을 우회해 상수 `null` 을 인자로 넣어 "던지기만 하고 반환값은 버리는" 용도로 쓰고 있다. 동작은 맞지만, 호출부만 보면 "왜 항상 `null` 을 넘기나" 가 즉시 읽히지 않아 주석이 그 이유를 대신 설명해야 했다.
  - 제안: `private assertTriggerFound(...)` 옆에 인자 없는 `private throwTriggerNotFound(): never` 를 하나 더 두거나, `assertTriggerFound` 를 오버로드해 `wrote: boolean` 을 직접 받는 형태(`assertWrote(wrote)`)로 만들면 호출부에서 의도가 즉시 드러난다. 급하지 않은 소규모 개선.

- **[WARNING]** 신규 테스트 헬퍼 안에서, 뒤에 정의될 `at()` 과 동일한 provider 검색 로직이 그 앞에 인라인으로 한 번 더 반복된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3708-3719`
  - 상세: `ChannelListenerRegistry` provider 를 교체하는 코드(3708-3714)가 `providers.findIndex((pr) => 'provide' in pr && (pr as { provide: unknown }).provide === X)` 술어를 직접 인라인으로 쓰고, 바로 다음 줄(3715-3719)에서 정확히 같은 술어를 `const at = (token) => providers.findIndex(...)` 로 이름을 붙여 이후 `ChannelAdapterRegistry`·`SecretResolverService` 교체에 재사용한다. `at` 이 "이 파일에서 provider 를 토큰으로 찾아 교체하는 표준 방법" 이라는 것이 그 다음 두 줄에서 드러나는데, 정작 첫 사용처(`ChannelListenerRegistry`)만 그 패턴을 따르지 않아 같은 함수 안에서 두 가지 스타일이 섞인다.
  - 제안: `const at = ...` 선언을 위로 올려 `ChannelListenerRegistry` 교체도 `providers[at(ChannelListenerRegistry)] = ...` 로 통일한다. 순수 테스트 헬퍼 내부라 리스크는 없지만, 같은 파일 안에서 반복되는 3번째 provider 교체 자리이니 한 형태로 맞추는 편이 다음에 4번째 자리를 추가할 사람에게 일관된 본보기가 된다.

## 긍정적으로 확인한 점 (참고)

- 이전 라운드가 지적한 `chat-channel-binder.service.ts` 의 `buildFallbackChannel`/`buildMergedChannel` 쌍둥이 클로저 중복이 `buildChannel(freshConfig, setupResult?)` 하나로 실제로 합쳐졌다(`chat-channel-binder.service.ts:226-241`) — 성공·실패 경로가 이제 한 함수를 공유해, 이번 PR 이 스스로 경고했던 "한쪽만 고치고 다른 쪽을 놓치는 drift" 표면이 줄었다.
- `{ chatChannel?: { inboundSigningRef?: string } }` 인라인 캐스트가 `extractInboundSigningRef()`(`chat-channel-input-rules.ts:247-250`) 로 추출되어 `triggers.service.ts`·`chat-channel-binder.service.ts` 두 자리가 이제 이름 있는 단일 함수를 공유한다. 형태가 이후 바뀌어도 고칠 자리가 하나다.
- `hooks.service.ts` 의 `save(trigger)` 두 자리(웹훅 hot path, interaction ack)가 `touchLastTriggeredAt()` 사설 메서드 하나로 합쳐졌고(`:978-984`), 그 메서드가 컬럼 한정 `update()` 를 쓰도록 고정해 "왜 `save` 를 쓰면 안 되는가" 를 한 곳의 JSDoc 만 유지하면 되게 만들었다 — 회귀 테스트(`hooks.service.spec.ts`)도 두 호출부 모두에 대칭으로 추가됐다.
- `trigger-config-lock.ts` 의 새 프리미티브(`acquireTriggerConfigLock`/`rewriteTriggerConfigLocked`/`TRIGGER_CONFIG_LOCK_PREFIX`/`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)는 네이밍이 목적을 정확히 드러내고, 매직 넘버 없이 상수화됐다(삭제 락 타임아웃 `5_000`도 이름 있는 export).
- `endpoint-path-conflict-wrap-guard.ts` 의 AST 워크(콜백 경계에서 멈추는 조건)는 새 분기(`ts.isFunctionLike(cur) && !ts.isCallExpression(cur.parent)`)를 추가하면서도 기존 순회 구조를 재사용해 중첩이 늘지 않았고, 그 판단 근거를 주석으로 남겨 다음 변경자가 왜 그 경계인지 알 수 있게 했다.

## 참고 (절차 투명성, 이슈로 집계하지 않음)

리뷰 종료 시점에 `git status --short` 로 확인한 결과, 이 리뷰가 어떤 파일도 쓰거나 고치지
않았음에도 `codebase/backend/src/modules/triggers/triggers.service.ts` 에 다음 미커밋 변경
1줄이 관측됐다 (`git diff`):

```diff
-        throw err;
+        // MUTANT: swallow
```

(`remove()` 의 삭제 트랜잭션 `.catch` 안, 원본 기준 `:981` 부근). 병렬 fan-out 리뷰 규약이
경고한 "다른 reviewer 가 같은 워킹트리를 동시에 mutate" 상황으로 보인다 — 아마 testing/
concurrency 계열 리뷰어가 뮤테이션 테스트를 검증하는 중일 가능성이 높다. 이 리뷰는 해당
파일을 어떤 시점에도 Edit/Write 하지 않았고, 위 발견사항의 줄 번호·인용은 모두 이 뮤턴트가
적용되지 않은 것으로 보이는 시점의 Read 결과를 기준으로 한다(재확인 시 `:1243` 등 다른 인용
줄은 이 1줄 삽입과 무관해 오프셋 영향이 없다). `git checkout`/`git restore` 는 규약상 쓰지
않았다 — 이 변경이 다른 reviewer 의 진행 중 작업일 수 있어 되돌리면 그 작업을 지울 위험이
있다. 다음 라운드 진입 전 이 잔여 diff 가 남아 있다면 원래 작성자(뮤테이션 테스트를 수행 중인
reviewer)가 정리해야 한다.

## 요약

핵심 변경(`trigger-config-lock.ts` 신설 + 3개 쓰기 지점 배선)은 이전 라운드에서 지적된 중복(클로저 쌍둥이·인라인 캐스트·리터럴 문자열)을 실제로 해소하며 끝났고, 네이밍·상수화·테스트 구조는 기존 컨벤션과 일관된다. 다만 그 값을 얻는 과정에서 이미 길었던 `TriggersService.update()` 가 트랜잭션 클로저를 안으로 삼켜 더 길고 다층적인 메서드가 됐고(WARNING), 그 클로저 경계를 넘나드는 `let` 재대입 변수와, 검증 헬퍼를 `null` 인자로 우회 재사용하는 자리가 남아 있어(둘 다 INFO) 다음 변경자의 추적 비용이 소폭 늘었다. 신규 테스트 헬퍼 안에도 추출한 헬퍼 정의보다 앞서 같은 로직을 인라인으로 반복하는 작은 비일관(WARNING)이 하나 있다. 넷 다 동작을 바꾸지 않는 순수 가독성/구조 문제라 이번 배치를 막을 사유는 아니다.

## 위험도

LOW
