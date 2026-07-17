# 유지보수성(Maintainability) 리뷰 결과

대상: `worldGenRef` 단일화 리팩터(use-widget.ts) + 회귀 테스트 추가(use-widget-eager-start.test.ts) + plan 문서 갱신.

## 발견사항

- **[WARNING]** `start()`↔`applyConfig()` 의 "세대 재검증 대칭" 주석이 실제 코드 구조와 다름
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003/codebase/channel-web-chat/src/widget/use-widget.ts` — `applyConfig` 내부, `const outcome = await seedWaitingFromStatus(clientRef.current, saved); ... if (outcome !== "continue") return; openStream(saved, "0");` 구간(주석: "`start()` 의 세대 재검증과 대칭"). `start()` 쪽 대응 구간은 `const outcome = await seedWaitingFromStatus(client, session); if (outcome !== "continue") return; if (worldGenRef.current !== gen) return; openStream(session, "0");`.
  - 상세: `start()`는 `seedWaitingFromStatus` 호출 직후 `outcome` 체크에 더해 `if (worldGenRef.current !== gen) return;` 를 한 번 더 명시적으로 수행하며, 주석에서 "아래 gen 검사와 중복이 아니다"(즉 `finalizeEnded` 의 `endedRef` dedup 조기 return 이 `teardownSession`/gen 증가를 건너뛰는 특정 케이스를 잡기 위함)라고 스스로 정당화한다. 그런데 `applyConfig()`는 **동일한 지점에서 이 두 번째 명시적 gen 재검증이 없다** — `outcome` 체크만으로 끝난다. 그럼에도 주석은 "start()의 세대 재검증과 대칭"이라 적어, 실제로는 비대칭인 두 함수를 대칭이라 서술한다. `outcome==="continue"`일 때 대부분의 경우 gen 불변과 사실상 동치이긴 하나, `await`는 항상 최소 한 번 microtask 를 양보하므로 그 사이 다른 콜백이 `teardownSession()`을 호출할 이론적 여지가 남는다. 이 diff의 핵심 주제 자체가 "세 호출부 중 하나만 우연히 보호되고 나머지는 무방비였다"(`02_04_13` CRITICAL#1)는 비대칭 패턴을 근절하는 것이므로, 새로 통합한 가드에서 동일한 형태의 비대칭이 (문서상으로는 "대칭"이라 주장된 채) 남는 것은 이번 리팩터의 취지와 어긋난다.
  - 제안: `applyConfig`에도 `openStream(saved, "0")` 직전에 `if (worldGenRef.current !== gen) return;` 를 추가해 `start()`와 문자 그대로 대칭을 맞추거나, 정말 불필요하다고 판단되면 "대칭" 표현을 지우고 "outcome 체크만으로 충분한 이유"를 정확히 기록할 것.

- **[WARNING]** 테스트 파일에 이름이 바뀐 개념(`startGenRef`)의 stale 참조가 남음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:216` 부근 — "복원된 세션이 이미 terminal → ENDED 전이 + SSE 미오픈 + storage 부활 없음" 테스트 상단 JSDoc: `` `start()`는 startGenRef로 우연히 보호됐으나 이 경로는 무방비였다. ``
  - 상세: 이번 diff는 `use-widget.ts` 안에서 `startGenRef`를 가리키는 주석 문구를 전부 "세대 가드"/`worldGenRef` 로 교체했다(예: `` `start()` 는 startGenRef 로 우연히 보호됐으나 `` → `` `start()` 는 세대 가드로 우연히 보호됐으나 ``). 그런데 정확히 같은 문장이 테스트 파일에도 그대로 남아 있고 이 diff에서 갱신되지 않았다. 지금 소스 어디에도 `startGenRef`라는 식별자가 존재하지 않으므로(리네이밍 완료), 이 문구는 이제 존재하지 않는 옛 이름을 가리키는 죽은 참조다. `plan/complete/*` 아카이브 문서의 `startGenRef` 언급은 append-only 역사 기록이라 문제가 아니지만, 능동적으로 유지되는 테스트 파일의 JSDoc은 리네이밍 대상이었어야 한다.
  - 제안: 해당 JSDoc의 `startGenRef` → "세대 가드"(또는 `worldGenRef`)로 갱신해 구현-테스트 간 용어 일관성을 맞출 것.

- **[WARNING]** `useTokenRefresh`의 독립적인 `cancelledRef` 가드가 이번 `worldGenRef` 통합에서 누락되어, "단일 진실" 주장과 실제 커버리지 사이 괴리
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003/codebase/channel-web-chat/src/widget/use-token-refresh.ts` (이번 diff 비대상 파일) vs. `use-widget.ts`의 `worldGenRef` JSDoc(`"위젯의 모든 비동기 경로(webhook POST · getStatus · interact)는..."`, `"무효화 지점은 두 곳뿐이다"`).
  - 상세: `worldGenRef` JSDoc은 "종전 3종의 무효화 트리거"(startGenRef·sessionRef 동일성·cancelled 지역 플래그)를 하나로 합쳤다고 서술하고, `endedRef`를 왜 합치지 않는지는 명시적으로 근거를 남긴다. 그러나 이미 분리돼 있는 `useTokenRefresh` 훅은 **동일한 성격의 4번째 독립 가드**(`cancelledRef`, `use-token-refresh.ts:41,90-97`)를 여전히 쓰고 있고, 이는 이번 통합 논의에서 전혀 언급되지 않는다. `cancelledRef`는 **언마운트에서만** true 가 되며, `teardownSession()`(새 대화·대화 종료·SSE terminal 이 공유하는 choke point)이 호출돼도 세팅되지 않는다 — `teardownSession()`은 `clearRefreshTimer()`(다음 예약된 타이머만 취소)와 `clearSession()`(storage 삭제)만 수행한다. 따라서: 토큰 갱신 `setTimeout`이 발화해 `refreshToken()`이 in-flight인 동안 사용자가 "새 대화"를 시작하면, teardown은 그 in-flight 요청 자체를 막지 못한다. 응답이 뒤늦게 도착하면 `cancelledRef.current`가 여전히 `false`이므로 `.then()`이 그대로 진행되어 `sessionRef.current`를 옛 세션 데이터로 덮어쓰고(살아있는 새 세션을 덮어쓸 수 있음) `saveSession(...)`으로 방금 지운 storage를 되살릴 수 있다 — 이는 이번 diff가 webhook POST·getStatus·interact 세 경로에서 명시적으로 고친 것과 동형(同形)인 "종료 세션 storage 부활" 버그가 네 번째(토큰 갱신) 경로에는 남아있을 가능성을 시사한다. 이 항목은 diff가 직접 건드린 파일 밖이라 확정적 결함이라 단정하지는 않으나, 리팩터의 "단일 진실(single source of truth)" 주장이 `use-widget.ts` 국소 범위에서만 성립하고 위젯 전체 시스템 관점에서는 성립하지 않는다는 점에서 유지보수성 문서 정확성 문제이며, 실제 레이스 여부는 동시성/정확성 관점 검토로 별도 확인이 필요하다.
  - 제안: `useTokenRefresh`가 `worldGenRef`(또는 동등 세대값)를 주입받아 `refreshToken().then()` 진입 시 재검증하도록 확장하거나, 최소한 `endedRef`처럼 "왜 이 가드는 통합 대상에서 제외했는지"를 plan 문서/JSDoc에 명시적으로 기록할 것.

- **[INFO]** 신규 테스트의 `fetchMock` 보일러플레이트가 기존 5~6개 테스트와 거의 동일하게 중복(이번 diff 고유 문제 아님, 기존 관행 지속)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1487-1521` — "seed in-flight 중 SSE terminal → stale 응답이 ended 위젯을 부활시키지 않는다" 테스트의 `fetchMock`.
  - 상세: embed-config reject·webhook POST 202 envelope 블록이 파일 내 다른 여러 테스트(예: "복원된 세션이 이미 terminal", "버퍼 만료 재동기화", "race fix: getStatus")와 거의 문자 그대로 동일하며, `statusCalls` 카운터로 GET 응답을 단계별로 분기하는 패턴도 "버퍼 만료 재동기화" 테스트와 구조적으로 같다. `installFetch`/`installControllableSse` 헬퍼가 있지만 GET status 커스터마이즈는 지원하지 않아 매번 인라인 재구현되는 기존 관행을 그대로 따른 것이며, 이번 diff가 새로 만든 패턴은 아니다.
  - 제안(선택): `installFetchWithStatusSequence(responses: unknown[])` 류의 공유 헬퍼 도입 시 6개 안팎 테스트에 걸친 반복을 줄일 수 있음. 급하지 않음.

- **[INFO]** 이중 `await Promise.resolve()` (매직 넘버 "2") 가 무설명으로 반복됨(기존 관행, 새 테스트는 이를 답습)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1557-1558` (신규 테스트 마지막 `act` 블록).
  - 상세: `resolveStatus?.(...)` 후 정확히 두 번의 `await Promise.resolve()`로 microtask 를 흘려보낸 뒤 바로 `expect(...).toBe("ended")`를 단언한다. 왜 정확히 2회인지 주석이 없다. 파일 내 다른 2곳(옛 410 응답, in-flight 명령 dedup 테스트, 각각 라인 1714-1715·1797-1798)도 동일하게 무설명 "2회" 패턴을 쓰므로 새 테스트가 기존 관행을 일관되게 따른 것은 맞지만, 세 곳 모두 구현의 await 체인 깊이가 바뀌면(예: 파싱 단계 추가) 조용히 깨지거나 우연히 통과하는 상태에 머물 수 있어 파악하기 어렵다. 이 파일의 지배적 패턴은 `waitFor(...)`로 조건을 폴링하는 것이라, "아무 일도 안 일어남을 증명"하는 이 세 테스트만 실시간 대기(`NO_EXTRA_CALL_WAIT_MS`)도 아니고 명시적 waitFor 도 아닌 제3의 기법(고정 횟수 microtask flush)을 쓰는 셈이다.
  - 제안(선택): 최초 등장 지점에 왜 2틱이 필요한지 짧은 주석을 남기거나, 의도를 이름으로 드러내는 공용 `flushMicrotasks(n)` 헬퍼를 도입.

- **[INFO]** `useWidget()` 훅 자체의 길이/책임 범위는 여전히 큼(이번 diff 범위 밖, 팀이 후속 과제로 명시적으로 인지·기록)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003/codebase/channel-web-chat/src/widget/use-widget.ts` 전체(774줄, `useWidget()` 함수 본문 약 630줄, 내부 `useCallback` 20개 이상).
  - 상세: 체크리스트의 "함수 길이" 관점에서는 큰 편이지만, 이번 diff는 구조를 바꾸지 않고 3종의 staleness 가드를 1종(`worldGenRef`)으로 치환하는 국소 리팩터다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에 "지금 당장 `useEiaStream` 분리는 해법이 아니며, 가드가 하나로 정리된 지금 상태에서 후속(`useEiaSession`, ≈300/735줄)으로 진행하는 편이 안전하다"는 근거 있는 트레이드오프가 이미 기록돼 있어, 의도적 유예로 보인다.
  - 제안: 없음(추적 문서 존재) — 후속 분리 착수 시 재평가 권장.

## 요약

이번 변경은 `use-widget.ts`에서 서로 다른 무효화 트리거를 가진 3종의 staleness 가드(`startGenRef`·`sessionRef` 동일성·지역 `cancelled` 플래그)를 `worldGenRef` 하나로 통합한 실질적 개선이며, "왜 이렇게 바꿨는지"·"왜 겉보기엔 중복인 검사가 실제로는 아닌지"를 각 호출부에 정확하게 설명하는 JSDoc/인라인 주석과, 실측 재현된 회귀("유령 표면")를 정확히 잡아내는 새 테스트로 뒷받침되어 있어 전반적으로 신뢰도가 높다. 다만 리팩터의 핵심 주장("단일 진실, 두 곳뿐인 무효화 지점")을 문자 그대로 따져보면 두 종류의 잔여 간극이 있다: (1) `start()`와 `applyConfig()`가 "대칭"이라 서술되지만 실제로는 한쪽에만 있는 방어적 재검증 한 줄로 인해 구조가 다르고, (2) 이미 분리된 `useTokenRefresh` 훅이 통합 대상에 포함되지 않은 독립적인(그리고 더 약한) `cancelledRef` 가드를 여전히 쓰고 있어 토큰 갱신 경로에는 이번에 다른 세 경로에서 고친 것과 동형의 "종료 세션 storage 부활" 위험이 남아있을 가능성이 있다. 두 사안 모두 이번 diff가 직접 저지른 새로운 결함이라기보다는 "완전 통합"을 표방하는 문서/설계의 정확성 문제에 가까우며, 실제 런타임 위험 여부는 별도의 동시성 관점 검토로 재확인할 가치가 있다. 그 외 테스트 파일의 stale 용어 참조, 반복되는 fetchMock 보일러플레이트, 무설명 이중 microtask flush 는 경미하거나 기존 관행의 연장으로 시급하지 않다.

## 위험도

MEDIUM
