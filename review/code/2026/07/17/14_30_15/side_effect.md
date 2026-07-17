# 부작용(Side Effect) 리뷰 — `use-widget.ts` 리셋 폐기 로직 제거 (`d9388d36e`)

대상: `codebase/channel-web-chat/src/widget/use-widget.ts`, `use-widget-eager-start.test.ts` (-52/+30, 순삭제).

## 검증 방법론 (재현/근거 없는 주장 배제)

- `git show d9388d36e` 로 실제 커밋 diff 를 prompt 의 truncated 버전 대신 원문 대조.
- `use-widget.ts` 전체를 정독하고 `pendingResetRef`/`bootGenRef`/`applyConfig` grep 으로 전 참조 지점을 열거(set 1곳·consume 1곳 뿐임을 직접 확인).
- `review/code/2026/07/17/13_03_59/RESOLUTION.md`, `11_38_14/RESOLUTION.md` 원문 대조.
- **독립 mutation 검증** — `git worktree add --detach <scratchpad>/mutation-worktree HEAD` 로 격리(공유 워크트리 무변경, 종료 후 `git worktree remove`로 제거 완료):
  - BLOCKED 분기에 `pendingResetRef.current = false` 무조건 재도입 → **2건 실패**(RESOLUTION 표 "BLOCKED 폐기 재도입 → 2건"과 정확히 일치, 직접 재현).
  - `applyConfig` 소비 블록(`if (pendingResetRef.current) {...}`) 자체 삭제 → **4건 실패**(RESOLUTION 표 "소비 제거 → 4건"과 정확히 일치, 직접 재현).
- 공유 워크트리에서 read-only로 `vitest run`(channel-web-chat 전체) 재실행 → **22 files / 375 tests passed** 독립 확인(RESOLUTION 자기보고 수치와 일치, 공유 워크트리는 무변경 — `git status` 로 확인).
- `packages/web-chat-sdk/src/{index,loader}.ts` 를 읽어 "host 가 iframe 재생성 없이 `wc:boot` 를 재전송"하는 경로가 **오늘 코드베이스에서 `frontend/src/components/web-chat/live-preview.tsx` 단 하나**임을 확인 — 공개 npm `ClemvionChat.boot()` 및 스니펫 로더의 `boot` 재호출은 전부 기존 인스턴스를 `shutdown()` 한 뒤 **새 iframe** 을 만든다(`loader.ts:28-32`, `index.ts:81-110`) — 기존 iframe 을 재사용해 재전송하는 경로가 없다.

## 발견사항

### [INFO] Q1 — "유령 리셋" 재프레이밍은 사실관계상 타당. 다만 소비 시점의 UX 는 여전히 불투명

- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:162-184`(`pendingResetRef` JSDoc §계약), `:741-744`(BLOCKED 분기)
- 상세: "같은 host·같은 위젯 인스턴스" 주장은 코드로 뒷받침된다 — ① origin 은 첫 `wc:boot` 에서 핀되고 이후 재전송도 동일 origin 만 허용(`spec/7-channel-web-chat/2-sdk.md:111`), ② `pendingResetRef` 는 `useRef` 로 **해당 마운트(=해당 iframe 인스턴스)에 스코프**되어 리마운트 시 소멸한다. 즉 이 리셋이 "다른 host·다른 인스턴스"로 새는 경로는 없다 — `11_38_14` 라운드의 "2차 boot 의 host 는 요청한 적 없다" 프레이밍이 과했다는 이번 재평가는 타당하다.
  다만 실사용 UX 관점의 잔여 불투명성은 있다. `state.phase === "blocked"` 는 `widget-app.tsx:49` 에서 **완전히 `null` 렌더**(런처조차 없음)다 — host(관리자)가 리셋 버튼을 눌렀는데 그 부팅이 BLOCKED 라면 그 클릭이 "실패했다"는 어떤 신호도 없이 화면이 비고, 이후 **무관해 보이는 조작**(외형 폼 필드 수정 등 — `live-preview.tsx:116-119` 가 필드 변경마다 `wc:boot` 재전송)으로 부팅이 성공하는 순간, 이미 잊었을 과거 클릭이 뒤늦게 이행되어 진행 중이던(전혀 다른) 세션이 사라진다. "결과적으로 정답이지만 타이밍이 놀라운" 케이스다.
  실제 도달 가능 경로는 오늘 기준 **`live-preview.tsx` 단 하나**로 확인했다(위 검증 방법론). 따라서 영향 반경은 **운영 콘솔 관리자 1인의 테스트용 미리보기 세션**으로 국한되며, 실 고객 세션에는 닿지 않는다.
- 제안: 코드 조치 불요(설계 결정으로 수용 가능). 선택 사항으로 `live-preview.tsx` 의 BLOCKED 상태에 안내 문구를 노출하면(현재는 `unavailable`(8초 타임아웃) 상태와도 시각적으로 구분되지 않음) 위 UX 불투명성이 줄어들 수 있으나 이번 diff 범위 밖의 별개 개선이다.

### [WARNING] Q2 — `pendingResetRef` 는 `triggerEndpointPath` 를 구분하지 않음 — 폐기 제거로 노출 시간이 사실상 무기한

- 위치: `use-widget.ts:162-184`(정의), `:245-248`(set, `teardownSession`), `:755-759`(consume, `applyConfig`)
- 상세: 플래그는 "이 마운트에서 **처음 성공하는** 부팅"만을 소비 조건으로 삼고, 그 부팅의 `cfg.triggerEndpointPath` 가 리셋이 접수됐던 시점의 endpoint 와 같은지는 전혀 검사하지 않는다. 이론적 시나리오: (1) `triggerEndpointPath=X` 로 부팅 중 resetSession 접수 → BLOCKED. (2) 같은 마운트에서 이후 host 가 (트리거 전환 등으로) `triggerEndpointPath=Y` 로 `wc:boot` 를 재전송해 성공 → **Y 의 세션이 X 시절 요청으로 강제 초기화**된다. 이는 "그 시점에 저장 세션을 지울 권한이 없는" 소비 — Q2 가 묻는 정확한 해악에 해당한다.
  구 설계(`bootGenRef` 소유권)에서도 이 endpoint 무관성 자체는 동일했지만(세대는 "누가 최신 시도인가"만 다뤘지 endpoint 는 다루지 않았다), **겹치지 않는(sequential) 시도**의 경우 앞선 시도가 BLOCKED 로 끝나며 자기 소유의 플래그를 지웠으므로 노출 창이 "겹친 시도들 사이"로 좁았다. 폐기가 전면 제거된 지금은 이 창이 **마운트 생존 기간 전체**로 넓어졌다 — 이번 diff 가 "만든" 갭은 아니지만(09_36_01 도입 시점부터 있던 설계 공백), **노출 시간을 실질적으로 확장**한 것은 사실이다.
  회귀 테스트 커버리지 공백도 확인했다: 공용 헬퍼 `boot()`(`use-widget-eager-start.test.ts:129-142`)는 `triggerEndpointPath: "t1"` 이 하드코딩돼 있어, 파일 내 모든 겹친/혼합 부팅 테스트가 **동일 endpoint** 로만 겹친다 — 이 시나리오는 기존 테스트 어느 것으로도 커버되지 않는다.
  **오늘 기준 도달 가능성은 0으로 확인했다**: 유일한 실사용 재전송 호출부인 `live-preview.tsx` 는 `endpointPath` 가 바뀌면 `iframeSrc` 의 `useMemo` 의존성이 바뀌어 `<iframe key={iframeSrc}>` 가 **리마운트**된다(`live-preview.tsx:54-58,143`). 리마운트는 `pendingResetRef` 를 포함한 훅 전체 상태를 초기화하므로, 한 마운트 안에서 서로 다른 `triggerEndpointPath` 로 `applyConfig` 가 두 번 불리는 경로 자체가 오늘의 유일한 호출부엔 없다.
- 제안: 즉시 코드 수정은 불필요(도달 불가 경로)하나, `pendingResetRef` JSDoc(§계약)에 "이 플래그는 `triggerEndpointPath` 를 구분하지 않는다 — 재전송 호출부가 마운트를 유지한 채 endpoint 를 바꾸지 않는다는 전제에 의존한다"는 불변식을 `teardownSession` 의 기존 "**불변식 의존 주의**" 주석(`configRef.current` null 불변식, L241-244)과 같은 형태로 남겨 두면, 향후 이 전제가 깨질 때(예: 프리뷰가 리마운트 없이 endpoint 전환을 지원하도록 바뀌는 경우) 재발견이 쉬워진다.

### [WARNING] Q3 — 죽은 참조: 테스트 주석이 제거된 `bootGenRef` 소유권 메커니즘을 현재형으로 서술

- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:2266-2269`
- 상세: "겹친 부팅의 결과가 갈릴 때, 차단된 쪽이 살아있는 쪽의 리셋을 지우지 않는다" 테스트(2271행) 바로 위 설명 주석이 다음과 같이 **현재형으로** 서술한다(2269행):

  > `` `bootGenRef` 소유권 조건이 그걸 막는다 — 이 테스트가 그 조건 하나만 정확히 고정한다. ``

  그러나 이번 diff 로 `bootGenRef` 와 모든 "소유권 조건"(폐기 로직 자체)이 완전히 삭제됐다(`grep -rn bootGenRef codebase/` 결과 이 한 줄이 전체 코드베이스 중 유일한 잔존 참조). 지금 이 테스트가 통과하는 이유는 "소유권 조건이 막아서"가 아니라 **정반대로 "아무도 지우지 않기 때문"** 이다 — 위 Q2 검증에서 재현한 대로, BLOCKED 분기에 무조건 폐기를 재도입하면 이 테스트를 포함해 정확히 2건이 깨진다. 즉 테스트의 회귀 방지력 자체는 멀쩡하지만, **주석의 인과 설명이 현재 코드와 어긋난다**.
  같은 파일에서 두 test 앞(2091-2099행)은 이번 diff 로 정확히 이런 취지의 갱신을 거쳤는데(폐기 로직 자체가 없다는 새 계약 언어로 교체), 2266-2269 는 그 갱신에서 누락됐다. 이 파일은 정확히 이 메커니즘에서 **4라운드 연속 회귀**가 난 hotspot 이므로(11_38_14·12_04_49·12_34_03·13_03_59), 향후 유지보수자가 이 주석만 보고 "세대 소유권 메커니즘이 아직 존재한다"고 오인해 유사한 재도입을 시도할 위험이 다른 파일의 일반적인 stale comment 보다 실질적으로 크다.
- 제안: 해당 주석을 `use-widget.ts:176-182`(폐기 로직을 다시 넣지 말 것 — 원리적 불가능) 또는 2091-2099 갱신본과 동일한 어투로 교체. 예: "이 테스트가 지키는 것은 소유권 조건이 아니라 **폐기 로직의 완전한 부재**다 — 폐기가 없으므로 이 실패 유형이 존재할 수 없다."

### [INFO] Q4 — 그 외 부작용: 추가로 확인된 것 없음 (점검 항목 요약)

- **시그니처/인터페이스**: `useWidget()` 반환 shape(`{ state, config, actions }`, `use-widget.ts:849-854`)는 diff 전후 동일. `bootGenRef`/`pendingResetRef` 는 애초에 비공개 `useRef` 로 export 되거나 `useTokenRefresh` 등 다른 훅에 주입된 적이 없다 — 제거로 인한 호출자 영향 없음.
- **전역 변수/전역 상태**: 신규 전역 없음. 제거된 두 `useRef` 는 컴포넌트 인스턴스 스코프였다(위젯이 페이지당 통상 단일 인스턴스라 사실상 전역처럼 동작하는 것은 diff 이전부터의 기존 설계이며 이번 변경의 산물이 아니다).
- **파일시스템/환경 변수/네트워크 호출**: 해당 없음 — 이 diff 는 순수 인메모리 ref 상태 관리 로직만 다룬다.
- **이벤트/콜백**: 소비 시 `apiRef.current.newChat()` → `start()` 경로로 host 에 `conversationStarted` 이벤트가 발사되는 흐름 자체는 diff 이전(11_38_14 버그 재현 시점)에도 동일하게 발사됐던 코드 경로로, 이번 diff 가 새로 만든 발사 지점이 아니다 — 다만 그 발사가 "막아야 할 결함"에서 "허용된 정상 경로"로 재분류됐다는 점이 이번 결정의 핵심이며 Q1 항목에서 다뤘다.
- 겹친(concurrent) 두 부팅이 동시에 플래그를 소비해 `newChat()`이 이중 발사될 가능성도 별도로 추적했다 — `applyConfig`의 `configRef.current = cfg` 대입부터 `pendingResetRef` 소비·`worldGenRef` 증가까지는 그 사이 `await` 가 없는 **동기 구간**이라 JS 런투컴플리션 특성상 다른 겹친 시도가 그 사이에 끼어들 수 없다(자기치유 메커니즘, diff 이전부터 존재·불변). 새로운 이중 발사 경로는 없다.
- 위에서 다루지 않은 추가 부작용은 발견하지 못했다.

## 요약

이번 diff 는 4라운드에 걸쳐 반대편 결함을 계속 재생산해 온 "부팅 시도 소유권 기반 폐기" 로직을 전면 삭제하고 "접수된 리셋은 다음 성공하는 부팅이 이행하며, 소비 외에는 아무도 지우지 않는다"는 단순 계약으로 대체했다. 독립적으로 재현한 mutation 검증(BLOCKED 폐기 재도입 2건 실패·소비 로직 제거 4건 실패)과 전체 스위트 재실행(375/375 통과)은 RESOLUTION.md 의 주장과 정확히 일치했고, 시그니처·공개 인터페이스·전역 상태·파일시스템·네트워크·환경 변수 어느 축에서도 새로운 부작용은 발견되지 않았다. `11_38_14` 의 "유령 리셋" 프레이밍을 뒤집은 이번 판단("같은 host·같은 인스턴스이므로 결함이 아니다")은 origin 핀·ref 마운트 스코프라는 사실관계로 뒷받침되고, 실사용 재전송 경로가 오늘 기준 운영 콘솔 라이브 미리보기 하나로 한정됨을 코드로 확인해 실질적 위험은 낮다고 판단한다. 다만 (1) 플래그가 `triggerEndpointPath` 를 구분하지 않아 폐기 제거로 노출 시간이 사실상 무기한이 된 점(오늘은 도달 불가하나 불변식이 문서화돼 있지 않음)과, (2) 정확히 이 hotspot 에서 4라운드 회귀 이력을 감안하면 방치하기 부담스러운 죽은 주석(`bootGenRef` 소유권을 현재형으로 서술) 두 가지는 문서화·정정 형태의 후속 조치를 권한다. 둘 다 즉시 차단 사유는 아니다.

## 위험도

LOW
