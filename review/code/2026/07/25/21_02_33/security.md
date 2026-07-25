# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `abort` 리스너 정리(cleanup) 보장 주석이 실제 동작보다 과장되어 있음 — cascade 가 여러 번 재사용되는 upstream signal 에 리스너를 계속 누적시킬 수 있음(경계는 있음, 회귀는 아님)
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1212` (및 `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:841`)
  - 상세: 주석은 "the listener is removed when the controller settles (timeout, **completion**, or this same abort)" 라고 적혀 있으나, 실제 코드 상 정상 완료(2xx 등) 경로는 `finally { clearTimeout(timer); }` 만 수행하고 `controller.abort()` 를 호출하지 않는다(`cafe24-api.client.ts:1230-1247`, `makeshop-api.client.ts:859-872` 확인). 즉 `controller.signal` 의 `'abort'` 이벤트는 (a) timeout 만료, (b) upstream abort, (c) 진입 시 이미 aborted 인 경우에만 발화하고, **정상 완료 시에는 발화하지 않는다.** 따라서 `upstream.addEventListener('abort', onUpstreamAbort, { once: true })` 로 등록된 리스너는 그 호출이 timeout 도 abort 도 겪지 않고 성공으로 끝나면 `upstream`(즉 `context.abortSignal`, 실행 단위로 공유됨) 에 그대로 남는다. `executeWithRateLimit`/재시도 루프가 같은 `opts.signal` 로 재귀 호출될 때마다, 그리고 워크플로 루프 노드가 같은 execution 안에서 이 handler 를 반복 호출할 때마다 리스너가 하나씩 쌓일 수 있다. 각 리스너는 `once:true` 라 upstream 이 실제로 abort 될 때 한 번씩만 발화하고 끝나므로 무한 누적은 아니고 해당 execution 의 생명주기(호출 횟수)로 경계 지어지지만(bounded), 대량의 외부 API 호출을 포함하는 장기 실행 워크플로에서는 메모리 사용량이 불필요하게 늘어날 수 있다.
  - 제안: (1) 주석에서 "completion" 부분을 제거하거나 정확히 기술할 것. (2) 원한다면 정상 완료 경로에서도 `upstream.removeEventListener('abort', onUpstreamAbort)` 를 명시적으로 호출해 리스너를 즉시 해제하는 편이 더 견고하다. 다만 이 패턴은 `http-request.handler.ts:400-423` 에 이미 존재하는 pattern 을 그대로 복제한 것이라(주석의 "Identical to `http-request.handler.ts`" 는 실제로 정확함), 이번 diff 가 새로 만든 결함이 아니라 기존에 받아들여진 패턴을 두 커머스 client 로 대칭 확장한 것이다 — 이번 PR 단독으로 차단할 사안은 아니라고 판단해 INFO 로 분류한다.

## 점검한 영역과 결론

- **인젝션**: 이번 diff 는 URL/path 조합 로직(`buildRequestParts`, `stringifyPathValue`, `encodeURIComponent`)을 변경하지 않는다. 새로 추가된 코드는 `AbortSignal` 객체를 `fetch()`/`RequestInit.signal` 로 그대로 전달할 뿐 문자열 보간이 없어 인젝션 표면이 없다.
- **하드코딩된 시크릿**: 신규 diff 라인에 시크릿·토큰·자격증명 리터럴 없음. 테스트 파일의 `access-token-1`/`csecret` 류는 기존 fixture(diff 밖, 전체 파일 컨텍스트에만 존재)이며 이번 변경으로 추가되지 않았다.
- **인증/인가**: `context.abortSignal` 은 실행 엔진 내부에서 생성·주입되는 값이며 사용자 입력으로 직접 조작되지 않는다. handler → client 로의 단순 전달(pass-through)이라 인가 우회 경로가 새로 생기지 않는다. `signal` 이 없을 때 `undefined` 를 그대로 넘기도록 명시적으로 테스트되어 있어(신호를 "발명"하지 않음), 외부 실행 컨텍스트가 없는 호출(connection test 등)이 의도치 않게 abort 대상이 되는 경로도 차단돼 있다.
- **입력 검증**: 사용자 입력 경로(`fields`, `mall_id`/`shop_uid` 정규식 검증)는 이번 diff 의 대상이 아니며 변경되지 않았다.
- **OWASP Top 10 / 가용성**: 위 INFO 항목(리스너 누적) 외 특기사항 없음. cascade 가 단방향(상위 signal → 하위 controller)으로만 흐르고, 타 실행(execution)/타 테넌트의 signal 과 섞일 여지가 없다 — 각 호출은 자신만의 `AbortController` 를 새로 만든다.
- **암호화**: 관련 변경 없음.
- **에러 처리**: 에러 매핑/로그 경로(`mapClientErrorToOutput`, `logUsage`)는 변경되지 않았고 `signal` 값 자체가 에러 메시지·로그에 노출되지 않는다.
- **의존성 보안**: 신규 의존성 없음. `AbortController`/`AbortSignal` 은 Node 표준 전역 API.
- **plan 문서(파일 9, 10)**: 코드가 아닌 추적 문서/제안 문서이며, SIGTERM/workflow-timeout 발 abort 를 `cancelled`/`failed` 중 어느 쪽으로 분류할지에 대한 정책 결정을 `project-planner` 로 명시적으로 위임하고 있다 — 현재 `ShutdownStateService` 가 `abortSignal` 을 전혀 참조하지 않는다는 점(grep 0건)을 근거로 지금 당장의 경합(race)은 없다고 기록되어 있으며 이는 코드 검토 범위에서도 타당하다(이번 diff 의 신규 `signal` 배선은 `ParallelExecutor`/사용자 cancel 경로만을 대상으로 하고 shutdown/workflow-timeout 경로와 아직 연결되지 않는다).

## 요약

이번 변경은 Cafe24/MakeShop API 클라이언트에 `context.abortSignal` 을 자신의 per-call timeout `AbortController` 로 cascade 시키는 기능(취소 전파)과 그에 대한 대칭적 단위 테스트, 그리고 관련 plan 문서 갱신으로 구성된다. 인젝션·시크릿 노출·인가 우회·입력 검증 약화 등 전형적인 보안 결함은 발견되지 않았다. 유일하게 짚을 만한 점은 upstream abort 리스너 정리가 "정상 완료" 시에는 실제로 발동하지 않아 주석의 서술이 다소 과장돼 있고, 동일 execution 내 다수의 외부 호출(재시도·루프)에서 리스너가 경계는 있지만 누적될 수 있다는 것인데, 이는 이번 PR 이 새로 만든 결함이 아니라 이미 `http-request.handler.ts` 에 존재하는 패턴을 그대로 복제한 것이라 심각도가 낮다. 전반적으로 안전한 변경이다.

## 위험도

LOW
