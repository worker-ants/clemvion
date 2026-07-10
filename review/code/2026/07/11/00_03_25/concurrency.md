# 동시성(Concurrency) 코드 리뷰 — EIA/WS continuation 명령 ↔ 대기 노드 표면 매트릭스 가드

검토 대상 핵심 파일: `execution-engine.service.ts`(`resolveWaitingNodeExecutionId` 확장 +
`assertCommandMatchesWaitingSurface` 신설), `waiting-surface-guard.ts`(순수 함수),
`hooks.service.ts`(`forwardToInteractionService` graceful catch), `interaction.service.ts`
(docstring만), e2e/unit 테스트. 코드 자체(`execution-engine.service.ts`)뿐 아니라
`claimResumeEntry`·`dispatchResumeTurn`·`resumeFromCheckpoint` 등 신규 가드가 의존하는
기존(비변경) 동시성 계약도 함께 추적해 신규 가드가 그 계약을 바꾸는지 실증했다.

## 발견사항

- **[WARNING] 신규 가드가 publish 이전 non-atomic 검증 윈도우를 한 단계(노드 조회) 더 넓힌다 — §5.6 "second-arrival 409" 직렬화 보장이 (기존부터 완전하지 않았던 채로) 소폭 더 느슨해질 수 있다**
  - 위치: `execution-engine.service.ts:5150-5222`(`resolveWaitingNodeExecutionId` → `assertCommandMatchesWaitingSurface`)
  - 상세: 변경 전 흐름은 `find(WAITING_FOR_INPUT row)` → (row 수 검증) → `return rows[0].id` → 호출부가 즉시 `continuationBus.publish(...)`, 즉 초기 스냅샷 읽기와 publish 사이에 async gap 이 1단계였다. 변경 후에는 `find` → `assertCommandMatchesWaitingSurface` 내부의 `this.nodeRepository.findOne(...)`(신규 DB round-trip) → 표면 판정 → `return` → `publish`, 총 async gap 이 2단계로 늘었다. 세 단계(찾기·노드조회·publish) 전체가 하나의 트랜잭션이나 row-lock(`SELECT ... FOR UPDATE`, advisory lock 등)으로 묶여 있지 않다 — 즉 순수 TOCTOU(check-then-act) 구간이다.
    `spec/5-system/14-external-interaction-api.md §5.6`(EIA-NF-05)은 "같은 execution 의 같은 노드에 두 inbound 명령이 동시에 들어오면 second-arrival 은 409 STATE_MISMATCH 가 된다(첫 명령이 이미 waiting_for_input → resumed 전이를 일으켜 상태가 바뀐 뒤)"를 **레이스가 아니라 명시적 직렬화**라고 서술한다. 그러나 실제 구현에서 이 "직렬화"는 오직 **publisher 의 `find()` 가 0-row 를 관측할 만큼 첫 명령의 비동기 worker claim(`claimResumeEntry`)이 이미 완료돼 있어야** 성립한다(BullMQ enqueue 는 fire-and-forget이고 클라이언트는 실제 claim 완료를 기다리지 않는다). 두 명령이 정말로 거의 동시에 도착하면(둘 다 첫 worker claim 이 끝나기 전에 각자의 `find()` 를 실행) **둘 다 같은 단일 WAITING row 를 관측**하고, 둘 다 표면 검증도 통과(같은 스냅샷이므로)해 **둘 다 publish** 된다 — 이 경우 두 클라이언트 모두 동기 202(enqueue 성공) 응답을 받고, 실제 승자/패자 결정은 순전히 `claimResumeEntry`의 조건부 UPDATE(`affected=1`)에 의해 뒤늦게(비동기적으로) 이루어진다. 패자 쪽은 client 에 이미 202 가 나간 뒤라 §5.6 이 약속하는 **명시적 409 STATE_MISMATCH**를 받지 못하고, `claimResumeEntry`가 `false`를 반환하며 조용히 discard 된다(§7.5 JSDoc "ack-and-discard").
    이 특성 자체는 **이 PR 이전부터 존재**했다(기존 `resolveWaitingNodeExecutionId`도 `find→publish` 사이에 이미 1단계 async gap 이 있었으므로 완전한 결정론은 원래도 없었다). 이번 PR 이 바꾸는 것은 **그 레이스 윈도우의 폭**이다 — `nodeRepository.findOne` 이라는 추가 DB round-trip이 두 번째(또는 그 이후) 명령의 publish 시점을 조금 더 늦춰, "첫 명령의 claim 이 아직 안 끝난 상태에서 둘 다 publish 되는" 창을 근소하게 넓힌다.
  - 왜 CRITICAL 이 아닌가: 데이터 무결성은 깨지지 않는다. `dispatchResumeTurn`이 실제 핸들러를 고를 때 쓰는 `persistedInteractionType`은 publish 시점에 계산된 어떤 값도 재사용하지 않고, claim 성공 **이후** `resumeFromCheckpoint`가 `context.nodeOutputCache`(rehydrate 로 새로 읽은 DB 상태)에서 다시 파생한다(`execution-engine.service.ts:1699-1707`). 또한 stale 하게 통과된 job 이라도 `claimResumeEntry`가 그 job 이 담고 있는 **구체적 `nodeExecutionId`**로 조건부 UPDATE(`WHERE id=:id AND status='waiting_for_input'`)를 하므로, 그 사이 해당 row 가 이미 resume/취소/re-park 되어 상태가 바뀌었다면 `affected=0`으로 안전하게 discard 된다(다른 row 로 잘못 적용될 수 없음 — job 이 캡처한 id 로만 매칭). 즉 "이중 실행 0" 불변식과 "표면 불일치 시 오처리 금지"라는 이 PR의 핵심 목표는 그대로 보존된다. 영향받는 것은 **패자 클라이언트가 받는 응답의 종류**(명시적 409 vs 조용한 202+무반응)뿐이다.
  - 제안: (a) 이 폭 넓힘이 실질적으로 문제되는지(예: 텔레그램/슬랙처럼 빠르게 중복 이벤트가 오는 채널에서 관측 가능한 빈도인지) 별도로 실증하지 않았다면, plan 후속 체크리스트나 spec Rationale 에 "second-arrival 직렬화는 timing-dependent 이며 claimResumeEntry 가 최종 정합성 보장, 패자는 202+silent discard 로 끝날 수 있음"을 명시할 것. (b) 가능하면 e2e 06 C-2 계열 테스트(동시 재개 2건 병렬)에 "표면 불일치 명령 + 정상 명령이 동시에 도착"하는 케이스를 추가해 실제 관측되는 응답 조합(둘 다 202/둘 다 409/202+409)을 문서화하면 향후 회귀 추적에 도움이 된다.

- **[INFO] `hooks.service.ts` 의 `catch (err instanceof ConflictException)` 이 코드가 아닌 클래스로만 분기한다 — 현재는 안전하지만 결합이 느슨하다**
  - 위치: `hooks.service.ts` `forwardToInteractionService` 신규 try/catch
  - 상세: `this.interactionService.interact(ctx, dto)`를 `scope: 'in_process_trusted'`로 in-process 직접 호출한다. 이 경로는 HTTP 컨트롤러의 `IdempotencyInterceptor`(별도 파일, `IDEMPOTENCY_KEY_CONFLICT` 409 발생원)를 우회하므로, 현재 코드베이스 상 이 호출이 던질 수 있는 `ConflictException`은 오직 `dispatchContinuation`/`assertWaiting`이 만드는 `STATE_MISMATCH` 뿐임을 직접 추적 확인했다(`interaction.service.ts:410-448`). 즉 지금은 버그가 아니다. 다만 `catch` 가 `err.getResponse().error.code`가 아니라 `instanceof ConflictException`(클래스)만으로 판별하므로, 향후 `interact()` 내부에 다른 409 조건(예: idempotency 유사 로직)이 in-process 경로에도 추가되면 자동으로 이 catch 에 흡수되어 조용히 삼켜진다 — 이 파일 자신이 참조하는 §10.9 "silent skip 금지" 원칙과 방향이 어긋날 잠재 위험.
  - 제안: `if (err instanceof ConflictException && (err.getResponse() as any)?.error?.code === 'STATE_MISMATCH')`처럼 code 로 좁혀 방어적으로 만드는 것을 검토(강제 아님, 유지보수성 제안).

- **[정보 확인 — 발견사항 아님] "publisher 는 advisory, worker `claimResumeEntry` 가 최종 방어선" 계약은 이번 변경으로 바뀌지 않는다**
  - 신규 가드(`assertCommandMatchesWaitingSurface`)는 `claimResumeEntry`(`execution-engine.service.ts:973-1030`, 조건부 UPDATE 기반 원자 claim)를 전혀 건드리지 않는다. 다운스트림 라우팅(`dispatchResumeTurn` → `resumeTurnRegistry.selects()`)이 쓰는 `persistedInteractionType`도 claim 성공 **이후** 새로 rehydrate 된 DB 상태에서 계산되지, publish 시점에 이 가드가 읽은 값을 캐시해 재사용하지 않는다. 따라서 이 가드가 stale 한 스냅샷으로 통과(또는 거부) 판정을 내려도, 실제 오처리(이 PR 이 고치려는 "조용한 오처리" 버그)로 이어지는 경로는 없다 — 최악의 경우 다운스트림에서 `RESUME_CHECKPOINT_MISSING`(fail-closed)으로 다시 걸러지거나, 위 WARNING 처럼 silent discard 로 끝난다.
  - multi-instance 환경 관점: 이 가드는 인스턴스-로컬 캐시/메모리 상태를 전혀 두지 않고 매번 Postgres 를 직접 재조회한다(`find`/`findOne` 모두 fresh read). 따라서 "표면 판정이 stale 하다"의 원인은 인스턴스 수와 무관하게 **오직 read-time 과 실제 dispatch-time 사이의 TOCTOU**뿐이며, 인스턴스가 몇 대든 동일한 특성을 보인다 — 수평 확장에 특화된 추가 위험은 없다.

- **[INFO] `assertCommandMatchesWaitingSurface`의 node lookup 은 정적 워크플로 정의(`Node.type`)에 의존 — 실행 중 노드 정의 동시 편집은 스코프 밖**
  - 위치: `execution-engine.service.ts:406-409` (`this.nodeRepository.findOne({where:{id:row.nodeId}, select:{id,type}})`)
  - 상세: `row.nodeId`는 최초 `find()` 스냅샷에서 캡처된 값과 항상 짝을 이뤄 조회되므로 두 읽기 사이 정합성 자체는 문제없다. 다만 이론적으로 워크플로 편집기가 실행 중인 노드의 `type`을 변경하는 극단적 동시편집 시나리오는 이 가드가 다루지 않는다 — 이는 기존 아키텍처(실행 중 워크플로 정의 스냅샷/버저닝 정책)의 스코프이지 본 PR 이 새로 만드는 문제는 아니라 판단해 참고용으로만 기록.

## 요약

신규 publisher 사전 검증(`assertCommandMatchesWaitingSurface`)은 기존 `resolveWaitingNodeExecutionId`
chokepoint 뒤에 노드 조회 1회 + 표면 매트릭스 판정을 추가하는 순수 read-then-decide 로직으로,
락·세마포어·공유 가변 상태를 전혀 도입하지 않아 데드락·스레드 안전성 관점의 새 위험은 없다.
가장 중요한 질문("이 가드가 publisher-advisory / worker-`claimResumeEntry`-authoritative 계약을
바꾸는가")에 대해서는 코드 추적으로 **바꾸지 않는다**는 것을 확인했다 — `claimResumeEntry`의
조건부 UPDATE 와 `dispatchResumeTurn`의 fresh-read 기반 라우팅이 그대로 최종 정합성을 보장하므로,
이 가드가 stale 한 스냅샷으로 오판하더라도 데이터 오염(이 PR 이 고치려는 원래 버그)으로 이어지는
경로는 없다. 다만 이 가드가 `find → publish` 사이에 새 DB round-trip(노드 조회)을 끼워 넣으면서
publish 이전 non-atomic 구간이 한 단계 더 길어졌고, 이는 `spec §5.6`(EIA-NF-05)이 서술하는
"동시 도착 시 second-arrival 은 명시적 409"라는 보장이 — 애초에 완전한 결정론은 아니었지만 —
근소하게 더 느슨해질(패자가 409 대신 silent 202+discard 로 끝날 확률이 소폭 상승) 여지를 만든다.
데이터 무결성을 해치지 않는 UX/observability 급 사안이라 WARNING 으로 평가하고, spec Rationale
문서화 또는 회귀 e2e 보강을 권고한다. 부수적으로 `hooks.service.ts` 의 신규 `ConflictException`
catch 가 code 가 아닌 클래스로만 분기하는 점을 INFO 로 남긴다(현재는 안전, 결합도만 느슨).

## 위험도

LOW — CRITICAL 없음. 데이터 무결성을 보장하는 최종 원자 claim(`claimResumeEntry`) 계약은 그대로
유지됨을 코드 추적으로 확인했다. WARNING 1건(TOCTOU 윈도우 소폭 확장에 따른 second-arrival 응답
형태 변화 가능성)과 INFO 2건은 구현을 막을 사유가 아니며, spec 동기화/후속 e2e 보강 단계에서
문서화하면 충분하다.
