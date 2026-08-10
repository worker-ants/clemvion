# 요구사항(Requirement) Review

## 대상
- `codebase/channel-web-chat/src/widget/use-widget.ts` — SSE 스트림 소유권 게이트를 `openStream` 내부로 이동(손 복제된 `if (sessionEstablished()) return;` 3줄 제거, `openStream` 반환값 `void → boolean`)
- `plan/in-progress/webchat-usewidget-extraction.md` — 해당 리팩터를 완료 항목으로 체크

## 검증 절차
- `pnpm vitest run src/widget/use-widget-eager-start.test.ts` → 62 passed
- `pnpm vitest run`(channel-web-chat 전체) → **23 files / 409 tests passed** — plan 이 명시한 "23파일 409건" 수치와 **정확히 일치**함을 실측 확인
- `pnpm tsc --noEmit` → 0 errors
- `git show 8f6d783f1 -- .../use-widget.ts` 로 리뷰 대상 커밋의 diff 를 직접 열어 대조
- 이중 EventSource 방지 회귀 테스트(`raceStartVsResendSingleStream`, 양방향 2건, `use-widget-eager-start.test.ts:3482-3491`) 확인 — start-먼저/재전송-먼저 두 순서 모두 `esCount===1` 단언

## 발견사항

- **[WARNING]** `start()`의 `useCallback` 의존성 배열에 더 이상 직접 참조되지 않는 `sessionEstablished` 가 남아 ESLint `react-hooks/exhaustive-deps` "unnecessary dependency" 경고를 유발한다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:612` (프롬프트 게이트 기준) — `}, [openStream, persist, seedWaitingFromStatus, scheduleRefresh, isStale, sessionEstablished, worldGenRef]);`
  - 상세: 이 커밋(`8f6d783f1`) 이전엔 `start()` 본문이 `if (sessionEstablished()) return;` 를 직접 호출했으므로 의존성이 정당했다. 이번 diff 가 그 직접 호출을 제거하고 `if (!openStream(session, "0")) return;` 로 대체했지만(§598-601), 해당 `useCallback` 의 의존성 배열은 손대지 않아 `sessionEstablished` 가 이제 본문 어디에서도 쓰이지 않는데도 남아 있다(주석에서만 언급). `git show 8f6d783f1 -- use-widget.ts` 로 확인한 결과 이 diff 는 의존성 배열 줄 자체를 건드리지 않았다. `pnpm eslint src/widget/use-widget.ts` 로 재현: `warning React Hook useCallback has an unnecessary dependency: 'sessionEstablished'`. `sessionEstablished` 자신이 `useCallback(() => streamRef.current !== null, [])` 로 참조 안정이라 런타임 동작에는 영향이 없어(memoization 오염 없음) 기능 결함은 아니지만, "가드를 openStream 안으로 옮겨 손 복제를 제거했다"는 이번 diff 의 취지가 의존성 목록 정리까지는 완전히 관철되지 않은 흔적이다(관점 4, 의도와 구현 간 괴리).
  - 제안: `sessionEstablished` 를 해당 의존성 배열에서 제거.
  - 참고: 이 리뷰 도중 워크트리를 재확인한 결과 **동일 파일에 이미 커밋 이후 미커밋 변경이 진행 중**이며(다른 세션·같은 shared worktree), 그 변경에서 이 의존성이 실제로 제거된 상태를 관측했다. 즉 이 항목은 이미 해소되고 있을 가능성이 높다 — 별도 조치가 중복일 수 있으니 최신 상태를 재확인 후 처리할 것.

- **[INFO]** `openStream` 의 반환값 의미가 "열었나" 가 아니라 "다른 시도가 넘겨받았는가(아니오)" 로 재정의됐고, `client` 미확립 경로도 `true`(계속 진행)를 반환한다 — `boolean` 하나로 "실제로 열었다" 와 "열 게 없어 통과시켰다" 두 의미가 뭉개진다는 점에서 오독 여지가 있다. JSDoc(§357-365, 452-456)이 이 의미를 명시적으로 문서화하고 있고, 회귀 테스트(§3482-3491)가 두 실패 방향(게이트 제거·게이트 반전) 모두 잡는 것을 확인해 기능적으로는 문제가 없다. 다만 이 리뷰 도중 관측한 동일 워크트리의 진행 중 변경에서 `boolean` 이 `StreamClaim`(`"opened" | "already_owned" | "no_client"`) union 으로 이미 정교화되고 있어, 사실상 이 우려가 별도 조치로 해소되는 중이다. 요구사항 관점에서는 추가 조치 불필요(회색지대, maintainability reviewer 소관에 더 가까움).
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:367-393` (함수 정의), 호출부 `:601`, `:950`

- **[INFO]** spec fidelity — `spec/7-channel-web-chat/2-sdk.md` §3(재전송)이 "동일 `triggerEndpointPath` 로의 재부팅은 진행 중 execution 을 중복 시작하지 않는다"(SSE 재오픈 금지 포함) 는 사용자-가시적 계약을 정의하지만, `openStream` 내부 반환값·게이트 위치 같은 구현 세부는 spec 서술 범위 밖이다. 이번 diff 는 이 계약을 어기지 않고 오히려 더 견고하게 구현하는 내부 리팩터이며(동작 무변경, "기능 무변경" 이 diff 의 명시 목표), 관련 spec 문서 갱신은 불필요 — SPEC-DRIFT 아님.
  - 위치: `spec/7-channel-web-chat/2-sdk.md:110-116`

## 기능 완전성 / 엣지 케이스 / 에러 시나리오 / 반환값 검토 결과

- **동작 보존 검증**: 새 게이트는 종전 `if (sessionEstablished()) return;` 호출부-선-검사와 논리적으로 동치임을 확인 — `client` 확립 불변식(`clientRef.current` 는 한번 세팅되면 null 로 되돌아가지 않고, `streamRef.current` 는 `client` 가 truthy 일 때만 non-null 이 될 수 있음)상 "`client` null 이면서 `streamRef.current !== null`" 조합은 도달 불가하므로 새 코드의 검사 순서(`!client` 먼저, `streamRef.current !== null` 다음)가 종전 순서(`sessionEstablished()` 먼저)와 관측 가능한 차이를 만들지 않는다.
- **이중 스트림 race**: `start()`·`applyConfig` 복원 두 호출부 모두 `openStream` 반환값으로 게이팅하도록 정확히 치환됐고(§601, §950), 양방향 race 회귀 테스트가 존재·통과한다.
- **멱등성 근거 실측**: plan 이 주장하는 "호출부가 반환값을 무시하는 뮤턴트는 동등 뮤턴트(`scheduleRefresh` 가 `clearRefreshTimer()` 로 시작하는 멱등 함수)" 를 `use-token-refresh.ts:73-74` 에서 직접 확인 — 정확한 주장.
- **plan 체크리스트**: `[x]` 로 승격된 항목의 서술(파일 수·테스트 건수·`tsc` 결과)이 모두 실측과 일치 — memory 의 "실측했다 주장이 세 번 틀렸다" 패턴 재발 없음.
- TODO/FIXME/HACK/XXX 주석: diff 내 없음.
- 반환값 누락 경로: `openStream` 의 세 분기(`!client`/`streamRef.current !== null`/정상 open) 모두 명시적 반환 — 누락 없음.

## 요약

`openStream` 안으로 SSE 소유권 게이트를 이동한 이번 diff는 종전 두 호출부(`start()`, `applyConfig` 복원)의 손-복제 가드를 구조적으로 대체하며, 동작 보존(특히 `client` 미확립 시 `scheduleRefresh()` 그대로 진행)과 이중 EventSource 방지 모두 논리적·테스트로 검증됐다(23파일/409건 전체 통과, `tsc` 0 errors, 관련 spec 과 충돌 없음). 유일한 흠은 `start()` 의 `useCallback` 의존성 배열에 남은 미사용 `sessionEstablished` 참조(ESLint 경고, 기능 영향 없음)이며, 리뷰 중 관측한 바로는 동일 shared worktree 에서 진행 중인 후속 변경이 이를 포함해 반환 타입을 더 명시적인 union 으로 정교화하는 중으로 보인다. 기능 결함이나 spec 불일치는 발견되지 않았다.

## 위험도

LOW
