# 유지보수성(Maintainability) Review — EIA 종결 이벤트 `durationMs` 배관 (최종 라운드, `10_34_51`)

## 방법론 노트

프롬프트 번들에서 `execution-engine.service.ts`/`.spec.ts` diff 가 크기 제한으로 생략돼 있어, 저장소를 `Read`/`Bash grep`으로 직접 열어 현재 `HEAD`(브랜치 `claude/eia-terminal-payload`, 최근 커밋 `6bedc7e3c`) 기준 실제 소스를 대조했다. 이 PR 은 이미 두 차례 ai-review 라운드(`review/code/2026/08/15/09_58_24`, `review/code/2026/08/15/10_18_38`)를 거쳤고 각각 CRITICAL/WARNING 을 `RESOLUTION.md`로 조치했다. 이번 라운드는 (1) 그 조치가 실제 소스에 반영됐는지 재확인하고, (2) 새로 남은 유지보수성 관점 항목이 있는지 독립적으로 점검했다.

## 이전 라운드 조치 재확인 (fix 반영 확인됨)

- `driveCallStackResume` 완료 경로(`execution-engine.service.ts:2576-2577`, emit `:2593`)가 형제 5경로와 동일하게 `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;` 로 전환되어 있음을 확인 — `10_18_38` 라운드 side_effect WARNING(음수 클램프 우회)이 해소됨.
- `chat-channel.dispatcher.ts:534-535, 572-573, 589-590` 세 곳 모두 `(event.payload as { durationMs?: number | null })` 로 캐스팅 폭이 `types.ts` 의 nullable 확장과 일치함을 확인 — `10_18_38` W8 조치 반영됨.

## 발견사항

- **[INFO]** `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스에 동일한 5줄 설명 주석이 글자 그대로 3중 복제돼 있다
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:392-396`, `:415-419`, `:433-437`
  - 상세: "producer 는 항상 이 키를 싣고 값을 모르면 null" / "그런데 `?` 는 유지한다(consumer 계약)" 설명 블록이 세 필드 선언 앞에 verbatim 반복된다. 세 인터페이스가 물리적으로 떨어져 있어 한쪽만 고치고 다른 쪽을 놓치는 drift 위험이 있다. 직전 라운드(`10_18_38`)가 이미 같은 항목을 INFO 로 지적했고 그 이후 커밋에서도 손대지 않은 상태 — 재차단 사유는 아니나 여전히 유효한 관찰이다.
  - 제안: 한 곳(예: `EiaCompletedEvent`)에 canonical 설명을 두고 나머지 둘은 `retry-turn.service.ts:893` 의 `// 조건 밖 — … (engine 과 동일 처방)` 처럼 "짧은 문장 + 정본 참조" 로 축약.

- **[INFO]** raw `RETURNING` 행에서 `duration_ms` 를 뽑는 3~4줄 스니펫이 5곳에 verbatim 반복된다
  - 위치: `execution-engine.service.ts:1045-1049`(`cancelParkedExecution`), `:1180-1184`(`markWebChatIdleTimeout`), `:2858-2862`(`markExecutionCancelled` — `emitCancellationEvent` 호출부), `:2908-2912`(`markQueueWaitTimeout`), `:3361-3365`(`finalizeStalledExhausted`)
  - 상세: `toFiniteNumber((result.raw as Array<Record<string, unknown>> | undefined)?.[0]?.duration_ms) ?? null` 형태가 5개 함수에 동일하게 복제돼 있다. `09_58_24` 라운드 RESOLUTION(W5)에서 "얇은 헬퍼로 감싸면 QueryBuilder 체인 호출부가 오히려 읽기 어려워진다. 6번째가 생기면 재검토"로 이미 보류된 상태이며, 지금도 정확히 5곳으로 그 판단 시점과 개수가 동일해 재론할 근거가 없다.
  - 제안: 재론 불필요. 6번째 raw UPDATE 취소 경로가 추가되면 `extractReturningDurationMs(result)` 1-라인 헬퍼 승격을 재검토.

- **[INFO]** `TERMINAL_DURATION_MS_SQL` 의 int4 상한이 SQL 문자열 리터럴 안에 매직 넘버로 박혀 있다
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:89` (`LEAST(2147483647, …)`)
  - 상세: 숫자의 의미(Postgres `INTEGER`/int4 최댓값, ≈24.8일)는 바로 위 JSDoc(`:74-79`)과 `terminal-duration.spec.ts:126`에 잘 설명돼 있어 실질 위험은 낮지만, 상수 자체에는 이름이 없어 SQL 문자열만 보면 의미가 즉시 드러나지 않는다.
  - 제안: `const PG_INT4_MAX = 2147483647;` 로 이름을 붙여 템플릿에 보간. 강제 사항은 아님.

- **[INFO]** `x.durationMs = resolveTerminalDurationMs(x) ?? x.durationMs;` 자기참조 폴백 관용구 + emit 시점 동일 인자 재호출이 10곳 가까이 반복된다
  - 위치: `execution-engine.service.ts:639`(`row`), `:2412-2413`·`:2424`, `:3563-3564`·`:3575`, `:4753-4754`·`:4767`, `:4881-4882`·`:4886`, `:4942-4943`·`:4965`(`savedExecution`), `:4293-4294`(`reloaded`) / `retry-turn.service.ts:713-714`·`:730`, `:896`·`:907`, `:948-949`·`:971`
  - 상세: 계산부(`x.durationMs = resolveTerminalDurationMs(x) ?? x.durationMs`)와 emit 부(`durationMs: resolveTerminalDurationMs(x)`)가 같은 인자로 함수를 두 번 호출한다. `resolveTerminalDurationMs` 내부는 `typeof`+`Number.isFinite` 체크 한 줄뿐이라 성능 영향은 무시할 수준이고 값도 항상 동일하지만("계산 실패해도 기존 값 보존"이라는 의도가 코드만 봐서는 즉시 드러나지 않아), 처음 읽는 사람에게는 `f(x) ?? x.durationMs` 형태와 이중 호출이 함께 있어 잠깐의 혼동을 준다.
  - 제안: 최초 등장 지점 한 곳(`execution-engine.service.ts:639` 또는 헬퍼 docstring)에 "계산 실패 시 필드를 건드리지 않는다" 한 줄을 덧붙이면 나머지는 문맥으로 읽힌다. 계산부에서 얻은 값을 지역 변수에 담아 emit 에 재사용하면 이중 호출도 제거되나, 엔티티 타입이 4종(`row`/`execution`/`savedExecution`/`reloaded`)으로 갈려 헬퍼로 승격하는 이득은 크지 않다. 필수 조치 아님.

- **[INFO]** (컨텍스트, 이 PR 의 책임 아님) `execution-engine.service.ts`(8,745줄)·`execution-engine.service.spec.ts`(19,739줄)가 이미 매우 큰 단일 파일이다. 이 PR 은 각 파일에 수십 줄만 추가했을 뿐 구조를 바꾸지 않았고, 파일 분할은 이번 변경의 범위를 훨씬 벗어난다 — 다만 신규 추가되는 종결-경로 로직이 계속 이 파일에 누적되고 있다는 점은 장기적으로 유지보수 비용을 키운다.

## 요약

핵심 로직은 `resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL` 세 개의 작고 순수한 프리미티브(`terminal-duration.ts`, 93줄)로 잘 응집돼 있고, 함수 하나가 여러 책임을 떠안거나 조건문이 과도하게 중첩된 곳은 없다. 새 유틸의 JSDoc 은 "왜 이 헬퍼가 필요한가"·"왜 startedAt 을 낙관하지 않는가"·"왜 두 방어가 필수인가"를 실제 겪은 회귀와 함께 설명해 다음 편집자가 방어를 실수로 제거할 가능성을 낮춘다. 이전 두 라운드가 지적한 실질적 결함(취소 경로 방어 우회, dispatcher 타입 좁힘 불일치, JSON 파싱 불가, "9곳 중 6곳만 셈" 등)은 모두 이번 HEAD 에서 소스 레벨로 재확인해 해소됨을 검증했다. 남은 항목은 전부 INFO 급 세부 중복(주석 3중복·raw-returning 추출 5중복·매직 넘버 1건·자기참조 폴백 관용구 10회 반복)이며, 그중 다수는 이 PR 의 직전 리뷰 라운드에서 이미 근거와 함께 명시적으로 보류/미채택 결정이 난 항목이라 재차단 사유가 아니다. 전반적으로 유지보수성 리스크는 낮다.

## 위험도

LOW
