# 요구사항(Requirement) 충족 리뷰 — trigger-config lost update (advisory lock + 락 안 재읽기)

## 검증 방법 (요약)

- `chat-channel-binder.service.ts`(전체) · `trigger-config-lock.ts`(전체) · `triggers.service.ts`(`update`/`rotateBotToken` 관련 구간)를 `Read` 로 직접 열람 (프롬프트가 3개 파일에 대해 "전체 파일 컨텍스트 없음"을 경고했기 때문).
- `spec/5-system/15-chat-channel.md` R-CC-21/R-CC-22 및 frontmatter `code:` 목록을 `Read`/`Grep` 으로 대조.
- `codebase/backend`에서 `npx tsc -p tsconfig.build.json --noEmit` (오류 0) 과 `npx jest triggers.service.spec.ts` (128 passed / 1 skipped) · `npx jest chat-channel-binder.service.spec.ts` (4 passed, 이 PR 이 건드리지 않은 파일이라 회귀 여부만 확인) 를 직접 실행해 정적/동적으로 검증.
- 저장소에는 어떤 파일도 쓰거나 mutate 하지 않았다 (`git status --short` 로 확인 — 리뷰 세션 산출 디렉터리 2개 외 변경 없음).

## 발견사항

- **[WARNING]** `[SPEC-DRIFT 아님 — 진짜 커버리지 갭]` 신규 파일 `trigger-config-lock.ts` 가 `spec/` 어떤 문서의 `code:` frontmatter glob 에도 걸리지 않는다 — `spec/5-system/15-chat-channel.md` 가 이미 `chat-channel-*.ts` 같은 glob 을 쓰는 이유(R-CC-22)가 정확히 "새 `triggers/` 파일이 명시 나열/부분 glob 에서 계속 누락된다"인데, 이번 PR 이 만든 파일이 그 glob(`chat-channel-*.ts` / `dto/**/chat-channel-*.dto.ts` / `trigger-callback-url*.ts`)에도, 다른 어떤 spec 문서의 `code:` 목록에도 안 걸린다(`grep -rn "trigger-config-lock" spec/` 0건).
  - 위치: `spec/5-system/15-chat-channel.md`(frontmatter `code:` 블록, 파일 앞부분) / 신규 파일 `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(파일 전체)
  - 상세: `review_guard`의 spec-linked 술어는 `code:` 목록/glob 매칭에 의존한다(R-CC-22 본문). 이 파일만 단독으로 바뀌는 후속 변경은 `--impl-done` spec-linked 요구를 받지 않게 된다 — R-CC-22 가 이미 세 번(#1317·#1319·#1320) 겪은 패턴의 네 번째 재발이다. `plan/in-progress/trigger-config-lost-update.md` §D 의 `--impl-prep` INFO 등재(advisory lock 키 인벤토리 문서 부재)는 "문서가 없다"는 더 넓은 문제만 짚었고, "이 특정 파일이 어떤 glob 에도 안 걸린다"는 구체적 갭은 별도로 남아 있다.
  - 제안: `spec/`은 developer 권한 밖이므로 코드 수정 대상은 아니다. planner 턴에서 `spec/5-system/15-chat-channel.md`(또는 advisory-lock 선례가 있는 `spec/5-system/4-execution-engine.md`) 의 `code:` 에 `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 를 명시 추가하거나 glob 을 확장할 것을 plan §D `--impl-prep` INFO 목록에 함께 등재 권고.

- **[INFO]** `rewriteTriggerConfigLocked` 의 `Promise<boolean>` 반환값 — JSDoc `@returns` 는 "호출부가 «조용히 아무것도 안 했다»를 **관측할 수 있게** 하기 위해서"라고 설계 의도를 적었지만, 실제로 이 PR 의 3개 호출부(`chat-channel-binder.service.ts:256,293`, `triggers.service.ts:1120`) 중 어느 곳도 반환값을 받거나 로깅하지 않는다(`await rewriteTriggerConfigLocked(...)`, 반환값 미사용).
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:256`, `:293` / `codebase/backend/src/modules/triggers/triggers.service.ts:1120`
  - 상세: 트리거가 락 획득 사이에 삭제되면 함수는 조용히 `false` 를 반환하고 쓰기를 건너뛰는데, 그 사실이 로그에 남지 않는다. 기존(패치 전) `triggerRepository.update()` 호출도 동일하게 무응답(row 0건 갱신)이었으므로 **회귀는 아니고**, JSDoc 이 약속한 "관측 가능"이 이번 배치에서는 아직 실현되지 않았다는 문서-구현 간 사소한 괴리다.
  - 제안: 급하지 않음(best-effort 경로 특성상 무시해도 안전). 후속으로 `if (!(await rewriteTriggerConfigLocked(...))) this.logger.warn(...)` 한 줄을 3곳에 추가하면 JSDoc 의 약속과 실제 동작이 정확히 일치한다.

## 상세 검증 결과 (긍정 확인 — 발견사항 아님)

- **핵심 결함(fail-open) 수정 로직 정확성**: `survivesWithFresh(freshConfig) = inboundSigningRefSurvives || Boolean(freshConfig?.chatChannel?.inboundSigningRef)` 가 plan §B "정정" 섹션이 요구한 3항 OR(`providerIssuedStored || preservedInboundSigningRef || 락 안에서 다시 읽은 값`)와 정확히 일치. 성공 경로(`buildMergedChannel`)·실패 경로(`buildFallbackChannel`) 둘 다 이 술어를 공유해 대칭이다. `botTokenRef`는 트리거 ID 로 결정적으로 재유도되므로 게이팅이 불필요하다는 전제도 코드와 일치.
- **`rotateBotToken`이 같은 게이트를 갖지 않는 것은 의도**: 그 경로의 `mergedChannel.inboundSigningRef`(`triggers.service.ts:1099`)는 조건 없이 항상 포함되므로 presence 게이트 재계산이 애초에 불필요 — plan §B 체크리스트의 "실측: 갖지 않는다" 주장과 코드가 일치.
- **락 범위**: `rewriteTriggerConfigLocked`가 advisory lock 획득 → 같은 트랜잭션 안에서 `m.findOne`(커밋된 최신 행) → `merge()` → `m.update()` 순서로, 외부 HTTP 호출(`adapter.setupChannel`)은 세 호출부 모두 락 시작 **이전**에 이미 끝나 있어 plan §B가 명시한 "외부 호출을 락 밖에 둔다" 제약을 만족. `TriggersService.update()`/`create()`/`rotateBotToken()` 어디에도 이 호출을 감싸는 상위 트랜잭션이 없어 중첩 트랜잭션 우려도 없음.
- **창 1(‘update()’의 `save(trigger)`) 미해결은 문서화된 의도적 축소**: 코드 주석(`triggers.service.ts:525-534`)과 plan §D 가 "6개 케이스 RED 실측 → 되돌림" 근거·후속 항목 모양까지 일치해서 명시. 은폐된 회귀가 아니라 추적된 백로그.
- **테스트 배선 무결성**: `withTransactionMock` 이 `triggers.service.spec.ts` 안에서 Trigger repository provider 를 등록하는 **9곳 전부**(`createBaseProviders` 내부 1곳 + 명시적 8곳)에 적용됨을 전수 확인(`grep -n "getRepositoryToken(Trigger)"`  9건 = `withTransactionMock(` 9건, 1:1 대응). `manager.transaction` mock 은 콜백을 실제 실행하고 내부 `query`/`findOne`/`update` 를 바깥 repo mock 으로 위임 — `m.update(Entity, where, patch)` → `repo.update(where, patch)`로 인자 수를 정확히 맞춰 기존 단언(`triggerRepo.update.mock.calls[...][1]`)의 의미를 보존.
- **동적 검증**: `npx tsc -p tsconfig.build.json --noEmit` 오류 0 (변경된 3개 src 파일 포함). `npx jest triggers.service.spec.ts` → 128 passed / 1 skipped(구조적 anchor). `chat-channel-binder.service.spec.ts`(이 PR 미변경, teardown 전용) → 4 passed, 회귀 없음.
- **e2e 설계**: `trigger-config-lost-update.e2e-spec.ts` 가 advisory lock 을 테스트가 직접 쥐어 인터리빙을 결정론적으로 만들고, 대응표 두 행(①rateLimitPerMinute 생존 ②inboundSigningRef 생존)을 각각 단언 — 논리 추적 결과 두 단언 모두 fix 의 실제 동작과 정합. (라이브 Postgres/컨테이너가 없어 이 세션에서 직접 실행은 못 했으나, JSDoc 이 실측 RED/PASS 결과를 이미 기록.)
- **에러/엣지 케이스**: 재읽기 시점 트리거 삭제 → `false` 반환 + 쓰기 skip(문서화·의도적). `config` 컬럼이 `columns` 스프레드보다 뒤에 와서 호출부의 `columns` 가 실수로 `config` 를 덮어쓰는 경로 없음. `fresh.config ?? {}` 로 null 방어.
- **spec 본문 대조**: R-CC-21의 "`trigger.config` 에서 읽으면 안 된다"(함수 인자로 넘어온 in-memory `trigger`가 대상)와 락 안에서 DB 행을 새로 읽는 것(다른 출처)이 충돌하지 않는다는 plan §B 의 논증이 코드 주석·구현과 모두 일치. `spec/2-navigation/4-integration.md` 의 Cafe24 advisory-lock 기각 선례와의 대조(외부 호출을 락 밖으로 분리했다는 차이)도 `trigger-config-lock.ts` JSDoc 에 반영됨.

## 요약

동시 PATCH 가 `trigger.config`(특히 `chatChannel.inboundSigningRef`)를 잃어 인입 서명 검증이 fail-open 으로 되돌아가는 결함을 advisory lock + 락 안 재읽기로 닫는 수정이다. 핵심 알고리즘(`presence 게이트`를 컨테이너가 아니라 서브키 수준에서 락 안 재계산)은 `--impl-prep` WARNING#1 이 지적한 함정을 정확히 반영해 구현됐고, 세 쓰기 지점(성공·실패·rotateBotToken) 모두 동일 원칙으로 배선됐다. 테스트 배선(`withTransactionMock`)은 전수 확인 결과 빠짐없이 적용됐고 typecheck·유닛 테스트가 모두 통과한다. 남은 갭은 기능 결함이 아니라 (1) 신규 파일이 어떤 spec `code:` glob 에도 안 걸려 향후 단독 변경 시 리뷰 게이트를 못 받는 커버리지 문제(WARNING, planner 스코프)와 (2) 반환값 관측 affordance 가 아직 어느 호출부에서도 쓰이지 않는 사소한 문서-구현 괴리(INFO)뿐이다. 창 1(`update()`의 `save`)은 실측 근거와 함께 명시적으로 범위 밖으로 남겨졌고 은폐되지 않았다.

## 위험도

LOW
