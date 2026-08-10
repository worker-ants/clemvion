# 부작용(Side Effect) Review

## 발견사항

없음(CRITICAL/WARNING 없음). 아래는 INFO 관찰 사항이다.

- **[INFO]** `openStream` 시그니처 변경(`void` → `StreamClaim`)의 영향 범위는 파일 내부로 완전히 국한됨을 실코드로 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — 타입 정의는 `type StreamClaim` 선언부(게이트 104-110), 함수 정의는 `openStream` (게이트 386-409), 호출부는 `start()` 내부(게이트 622-623)와 `applyConfig` 내부(게이트 972-974).
  - 상세: `StreamClaim` 은 `export` 되지 않았고(`grep -n "^export"` 결과에 없음), `openStream` 자체도 `useWidget()` 이 반환하는 공개 `actions` 객체(게이트 1046 `{ open, close, start, submitMessage, clickButton, submitForm, newChat, endConversation, show, hide, updateProfile, sendResize }`)에 포함되지 않는 훅-내부 전용 콜백이다. `grep -rn "StreamClaim" codebase/channel-web-chat/src/` 로 파일 밖 참조가 없음을 확인했다. 호출부는 `start()`(게이트 622-623)와 `applyConfig`(게이트 972-974) 두 곳뿐이며 둘 다 이번 diff 에서 새 반환 계약(`if (claim !== "opened" && claim !== "no_client") return;`)에 맞춰 함께 갱신되어 있다. 외부 모듈·다른 훅·테스트가 `openStream`/`StreamClaim` 을 직접 참조하는 곳은 없으므로 공개 인터페이스·호출자에 영향 없음.
  - 제안: 조치 불필요. 확인 목적의 기록.

- **[INFO]** 게이트 이동 전후 동작 등가성을 실코드로 재검증 — 두 호출부 모두 `client` 미확립 시에도 `scheduleRefresh()` 를 그대로 실행하는 종전 동작이 보존됨
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:622-623`(`start()`), `:972-974`(`applyConfig`), `openStream` 정의 게이트 388-389 (`if (!client) return "no_client";`)
  - 상세: `claim !== "opened" && claim !== "no_client"` 부정 비교이므로 `"no_client"` 는 진행(스킵 아님)이다. 종전(게이트 이동 전) 호출부가 `openStream(...)`(client 없으면 내부 no-op) 뒤 무조건 `scheduleRefresh()` 를 실행하던 것과 관측적으로 동일 — 직접 로직을 대입해 대조한 결과 일치했다. RESOLUTION.md/SUMMARY.md 가 주장하는 "기능 무변경" 이 이 지점에서 실코드와 부합한다.
  - 제안: 조치 불필요.

- **[INFO]** `start()` `useCallback` 의존성 배열의 `sessionEstablished` 잔재는 이번 diff 로 이미 제거되어 있음(이전 12_39_25 라운드 WARNING 의 fix 반영분)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:634` — `}, [openStream, persist, seedWaitingFromStatus, scheduleRefresh, isStale, worldGenRef]);`
  - 상세: `start()` 본문(게이트 577-634)을 전수 확인한 결과 `sessionEstablished()` 직접 호출이 없다(주석 언급만 게이트 609). 반면 `applyConfig`(게이트 913 이하)는 여전히 `sessionEstablished()` 를 직접 호출하지만(게이트 942), 이 함수는 `useCallback` 이 아니라 `useEffect` 내부의 평범한 `async` 함수라 별도 의존성 배열이 없다 — 두 호출부 간 "한쪽만 정리, 반대쪽은 stale" 형태의 비대칭이 재발하지 않았음을 확인.
  - 제안: 조치 불필요. 확인 목적의 기록.

- **[INFO]** 리뷰 대상 diff 에 `spec/7-channel-web-chat/3-auth-session.md` frontmatter 변경(`status: implemented` → `partial`, `pending_plans:` 신규 추가)이 포함되어 있으나 런타임 부작용은 없음
  - 위치: `spec/7-channel-web-chat/3-auth-session.md` (frontmatter, 게이트 1-15 영역)
  - 상세: 이 파일은 문서(spec)이며 코드 실행 경로에 포함되지 않는다. `pending_plans:` 필드는 이 프로젝트의 `spec-impl-evidence.md` 컨벤션이 요구하는 정본 표기이고, 이후 자동 가드(consistency-checker 등)가 이 필드를 읽어 판정에 사용하지만 이는 문서화된 인터페이스이지 의도치 않은 부작용이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 이번 diff 에 이전 코드 리뷰/일관성 검토 라운드(`12_39_25`, `12_56_30`, `13_12_16`)의 산출물(SUMMARY/RESOLUTION/각 reviewer .md·meta.json·_retry_state.json)이 신규 파일로 대량 포함됨
  - 위치: `review/code/2026/08/10/12_39_25/**`, `review/consistency/2026/08/10/12_56_30/**`, `review/consistency/2026/08/10/13_12_16/**`
  - 상세: 이들은 코드가 실행 중에 생성하는 파일이 아니라, 앞선 리뷰/일관성-검토 세션이 별도로 만든 산출물을 이번 커밋에 함께 반영한 것이다(CLAUDE.md 의 `review/code/**`·`review/consistency/**` 저장 위치 규약과 일치). 런타임 파일시스템 부작용이 아니라 저장소에 커밋되는 정적 문서이므로 이 관점(파일시스템 부작용)의 우려 대상이 아니다.
  - 제안: 조치 불필요. scope reviewer 소관(리뷰 대상 diff 범위 판단)에 더 가까움 — side_effect 관점에서는 문제 없음.

## 요약

리뷰 대상 diff 의 핵심 부작용 표면은 `openStream` (`useWidget()` 훅 내부 전용 콜백)의 반환 타입을 `void` 에서 명명 union `StreamClaim`(`"opened"`/`"already_owned"`/`"no_client"`)으로 바꾼 것과, 스트림 소유권 재확인 가드를 두 호출부(`start()`, `applyConfig` 복원 경로)의 손-복제 코드에서 `openStream` 함수 진입부로 옮긴 것이다. `openStream`·`StreamClaim` 모두 export 되지 않고 `useWidget()` 의 공개 `actions` 계약에도 포함되지 않아 시그니처 변경의 영향 범위는 이 파일의 두 호출부로 완전히 국한되며, 두 곳 모두 새 반환 계약에 맞춰 diff 안에서 함께 갱신돼 있다. 두 검사 시점(`!client`/`streamRef.current !== null`)과 그 뒤 부수효과(`closeStream()`/`streamRef.current` 대입) 사이에 비동기 경계가 없어 새로운 race window 도 만들지 않는다. `client` 미확립 시에도 `scheduleRefresh()` 로 계속 진행하던 종전 동작이 부정 비교(`!== "opened" && !== "no_client"`)로 보존되고, 이전 라운드에서 지적된 `start()` useCallback 의존성 배열의 `sessionEstablished` 잔재는 이미 정리돼 있음을 실코드로 확인했다. 전역 변수·환경 변수·네트워크 호출 트리거 조건·이벤트/콜백 배선(`onEvent`/`onError`/`dispatch`/`bridgeRef.current?.sendEvent`)은 이번 diff 로 달라지지 않았고, 오히려 게이트를 구조적으로 강제해 "이중 EventSource 생성" 이라는 잠재적 네트워크 부작용을 두 호출부 모두에서 일관되게 차단하는 방향이다. 나머지 변경(테스트 주석 갱신, plan 문서 갱신, spec frontmatter 상태 정정, 이전 리뷰 라운드 산출물 커밋)은 모두 비-런타임 문서 변경으로 side effect 관점의 우려 대상이 아니다.

## 위험도

NONE
