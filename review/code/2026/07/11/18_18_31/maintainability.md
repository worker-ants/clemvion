# 유지보수성(Maintainability) 리뷰

대상: `codebase/channel-web-chat/src/lib/widget-state.ts`, `codebase/channel-web-chat/src/widget/use-widget.ts`,
`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (그 외 `plan/`·`review/`·`spec/` 문서는 코드가 아니므로
본 관점 리뷰 대상에서 제외)

## 발견사항

- **[INFO]** `use-widget-eager-start.test.ts` — inline `fetchMock` 구성 보일러플레이트가 계속 증식
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 신규 `it("R9-A: ...")`(약 L269-320), `it("R9-B-1: newChat cancel 명령 실패해도...")`(약 L349-382)
  - 상세: `vi.fn((url: unknown, init?: RequestInit) => { ... })` 형태의 fetch mock 리터럴이 파일 전체에서 이미 10회 반복되던 기존 패턴인데(`installFetch`/`installControllableSse` 두 공용 헬퍼가 있음에도 다수 테스트가 별도 인라인 정의를 계속 추가), 이번 diff 가 booting-in-flight(hook 응답을 수동 resolve) 케이스와 cancel-실패 케이스를 위해 유사한 인라인 정의를 2개 더 추가해 총 12회로 늘었다. `installFetch`/`installControllableSse` 는 옵션(`overrides`)으로 응답 지연·성공/실패 조합을 확장 가능한 구조이므로, 신규 시나리오도 옵션 파라미터(`{ webhookDeferred?: boolean, interactFails?: boolean }` 등)로 흡수했으면 중복을 늘리지 않을 수 있었다.
  - 제안: 당장 되돌릴 필요는 없으나(단발성 diff 이고 기존 패턴을 그대로 따른 것), 다음에 유사 fetch mock 조합이 필요할 때는 기존 헬퍼를 옵션화해 재사용하는 방향을 권장.

- **[INFO]** `use-widget.ts` — 동일한 "best-effort 명령 발사 + 실패 시 console.warn" 패턴이 서로 다른 async 스타일로 중복
  - 위치: `newChat`(신규, L1090-1109 부근 `.interact(...).catch(...)` fire-and-forget) vs 기존 `endConversation`(L1123-1151, `try { await client.interact(...) } catch (e) { console.warn(...) }`)
  - 상세: 두 함수 모두 "세션 정리 후 이전/현재 execution 에 best-effort 명령을 보내고 실패하면 콘솔에만 남긴다"는 동일한 의도를 갖지만, `newChat` 은 `void client.interact(...).catch(...)`(fire-and-forget), `endConversation` 은 `async`/`await`+`try/catch`(호출부가 완료를 기다림)로 스타일이 다르다. 결과적 동작은 유사(둘 다 실패를 삼키고 로컬 상태를 되돌리지 않음)하지만, 같은 파일 안에서 같은 목적의 코드가 두 관용구로 나뉘어 있으면 다음에 셋째 사례를 추가하는 사람이 어느 쪽을 따라야 할지 판단 비용이 생긴다.
  - 제안: 필수는 아니나, 향후 세 번째 유사 케이스가 생기면 공용 헬퍼(`fireAndForgetCommand(client, session, command, warnPrefix)`)로 통일을 고려.

- **[INFO]** `use-widget.ts` — `e instanceof Error ? e.message : String(e)` 에러 포맷 삼항식이 파일 내 4곳(기존 `seedWaitingFromStatus`·`endConversation`·`errMessage`, 신규 `newChat`)으로 늘었다
  - 위치: `newChat` 신규 catch 블록(`console.warn("[widget] newChat cancel 명령 실패(로컬 재시작 진행):", e instanceof Error ? e.message : String(e))`)
  - 상세: 사소한 1-liner 중복이라 심각하지 않으나, 이미 파일 최하단에 유사 목적의 `errMessage(e)` 헬퍼가 존재함에도 재사용하지 않고 인라인으로 반복했다(다만 `errMessage` 는 사용자 노출용 일반화 메시지를 반환하는 다른 책임이라 그대로 재사용은 부적합했을 수 있음).
  - 제안: `formatErr(e): string` 같은 순수 포맷터를 분리해 `errMessage`·각 `console.warn` 호출이 공유하면 향후 5번째 복제를 막을 수 있음. 즉시 조치 불필요.

- **[INFO]** `widget-state.ts` — `isActiveConversationPhase` JSDoc 확장은 함수 본문(3줄) 대비 주석이 매우 길다(약 11줄)
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` L84-97
  - 상세: 이번 diff 는 코드 로직 변경 없이 JSDoc 본문만 보강한 것으로, 새로 발견된 회귀 원인((b) 중복 webhook 문제가 이제 UI 게이팅이 아니라 `newChat` coalesce 로 해결됨)을 정확히 반영해 설명 정합성을 높였다. 함수 대비 주석 비율이 크지만 이는 이 파일 전체(`isTextInputSurface` 도 동일 패턴)의 기존 컨벤션과 일치하며, 상태기계의 미묘한 race 조건을 문서화하는 이 코드베이스의 의도적 스타일로 판단된다.
  - 제안: 조치 불필요(기존 컨벤션 일관성 유지).

## 요약

세 파일 모두 기존 코드베이스의 확립된 스타일(치밀한 근거 주석, ID 태그 테스트명 `R9-A`/`R9-B-1`, 상수 추출 재사용 `NINETY_MIN_MS`/`NO_EXTRA_CALL_WAIT_MS`)을 그대로 따른다. `widget-state.ts` 변경은 순수 문서 정합성 개선이라 리스크가 없고, `use-widget.ts` 의 `newChat` 확장은 3줄에서 12줄로 늘었지만 early-return 가드 + 캡처 + best-effort 발사라는 단일 흐름을 유지해 순환 복잡도가 낮으며 방대한 JSDoc 이 각 분기의 이유를 설명해 가독성을 해치지 않는다. 테스트 파일은 이번 diff 로 인라인 `fetchMock` 보일러플레이트 중복이 소폭 늘었고(기존 10→12), 동일 목적의 에러 처리 관용구가 파일 내에서 두 스타일(fire-and-forget vs async/await)로 공존하는 점이 눈에 띄지만, 둘 다 기존 패턴을 답습한 것이라 이번 diff 고유의 새로운 결함이 아니라 기존 기술부채의 완만한 누적이다. 즉시 차단할 사유는 없다.

## 위험도

LOW
