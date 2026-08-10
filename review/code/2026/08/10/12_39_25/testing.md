# 테스트(Testing) 리뷰

## 검증 방법
diff 자체는 테스트 파일을 건드리지 않는 순수 리팩터(스트림 게이트를 호출부 2곳의 복제 코드에서
`openStream()` 내부로 이전)이므로, 기존 회귀 테스트가 새 구현에서도 여전히 유효한지가 핵심 질문이다.
아래를 직접 실행해 확인했다.

- `npx vitest run src/widget/use-widget-eager-start.test.ts src/widget/use-widget.test.ts src/widget/use-widget-commands.test.ts` → 74/74 PASS
- `npx vitest run` (channel-web-chat 전체) → 23 files / **409 tests** 전부 PASS — plan 문서(`plan/in-progress/webchat-usewidget-extraction.md:79`)의 "위젯 23파일 409건 통과" 서술과 실측이 일치.
- `npx tsc --noEmit -p .` (channel-web-chat) → 0 errors — 같은 문서의 "`tsc --noEmit` 0 errors" 서술과 일치.

## 발견사항

- **[INFO]** 이중 스트림 방지 회귀 테스트는 이미 존재하며(선행 커밋에서 도입, 이번 diff는 테스트 파일 미변경) 리팩터에도 여전히 통과한다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:601`(`start()` 호출부), `codebase/channel-web-chat/src/widget/use-widget.ts:950`(`applyConfig` 복원 호출부) / 대응 테스트 `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3482`·`:3488`
  - 상세: `raceStartVsResendSingleStream(resendResolvesFirst)` 헬퍼가 두 `getStatus` seed 를 같은 flush 에서 resolve 시키고 `esCount`(EventSource 생성 횟수)를 단언한다. 이 단언은 "누가 게이트를 걸었는지"가 아니라 관측 가능한 최종 상태(스트림 1개)만 보므로, 게이트가 호출부에 있던 구버전과 `openStream` 내부로 옮긴 신버전 양쪽에서 동일하게 유효하다 — 구현이 바뀌어도 테스트를 고칠 필요가 없는 좋은 설계다. 실제로 74/169/409 테스트 전부 GREEN 으로 재확인했다.
  - 제안: 없음(긍정적 관찰).

- **[WARNING]** 회귀 테스트 파일의 주석이 리팩터 이전 아키텍처를 서술한 채로 남아 있어, 구현(소스 JSDoc)과 테스트 주석이 서로 다른 이야기를 한다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3401-3403` (`raceStartVsResendSingleStream` 바로 위 설명 주석)
  - 상세: 테스트 주석은 "`openStream` **직전**에도 `sessionEstablished()` 재확인 — ... 스트림 게이트가 `start()`(`use-widget.ts` openStream 직전)와 `applyConfig`(복원 분기 openStream 직전) **양쪽**에 있다"고 적혀 있다. 이는 이번 diff 이전의 구조(호출부 2곳에 손으로 복제된 `if (sessionEstablished()) return;`)를 정확히 설명하지만, 이번 diff 이후에는 그 재확인이 `openStream()` **내부**의 단일 게이트(`use-widget.ts:373`)로 이동했다(소스 JSDoc `use-widget.ts:448-450` "종전에는 그 재확인이 두 호출부에 손으로 복제된 3줄이었다 ... 게이트를 `openStream` 안으로 옮겨 구조적으로 강제한다" 참조). 즉 테스트 주석이 지금은 사실이 아닌 예전 구현 세부를 계속 설명한다.
  - Assertion 자체(esCount)는 구현 불변이라 테스트 유효성에는 문제가 없지만, 이 파일이 스스로 밝히듯("JSDoc 인접성 취약성 ... 2회 재발") 이 코드베이스는 정확히 이런 종류의 주석 drift 로 반복 결함을 냈던 이력이 있다. 다음에 이 테스트가 실패했을 때 조사자가 주석만 보고 "호출부 게이트"를 찾다가 시간을 허비할 수 있다.
  - 제안: 테스트 주석의 "openStream 직전에도 sessionEstablished() 재확인... 양쪽에 있다" 문장을 "게이트는 이제 `openStream()` 내부 단일 지점"으로 갱신. 급한 사안은 아니므로 다음 이 영역을 건드리는 커밋에서 함께 정리해도 무방.

- **[INFO]** `openStream`의 `!client → return true` 분기가 현재 코드베이스 불변식 하에서는 실질적으로 도달 불가능한(dead) 방어 분기이고, 어떤 테스트도 이 분기를 실행하지 않는다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:371` (`if (!client) return true;`)
  - 상세: `clientRef.current`는 코드베이스 전체에서 오직 `establishConfig`(`use-widget.ts:867`) 한 곳에서만 대입되고 이후 `null`로 되돌려지는 곳이 없다(`grep -n "clientRef.current\s*="` 결과 1곳). `start()`는 진입에서 `if (!cfg || !client) return;`로 이미 조기 반환하고, `applyConfig`는 `establishConfig(cfg)`가 `openStream` 호출보다 먼저 동기적으로 `clientRef.current`를 세팅하므로, 실행 시점에 `openStream`이 `client === null` 상태로 불릴 경로가 현재는 없다. `openStream` 자체가 훅 클로저 내부에 있어(export 되지 않음) 단위 테스트로 직접 호출해 이 분기만 격리 검증할 수도 없다.
  - JSDoc(`use-widget.ts:362-365`)이 "**`client` 미확립(부팅 전)은 `true`** ... 어색해 보이지만 의도적"이라고 근거를 명시하고 있어 당장 결함은 아니다. 다만 이 불변식("clientRef는 한 번 세팅되면 null로 되돌아가지 않는다")이 향후 깨지면 — 예: config 재설정 기능 도입 — 이 분기가 무검증 상태로 처음 활성화된다.
  - 제안: 당장 조치 불필요. 다만 `pendingResetRef`/`sessionEstablished` JSDoc에 이미 있는 "불변식 의존 주의" 패턴을 따라, `clientRef.current`가 재설정될 수 있게 되는 시점에는 이 분기의 반환값 계약(`true`)을 검증하는 테스트를 함께 추가할 필요가 있다는 점을 인지해 둘 것.

- **[INFO]** `openStream`의 3가지 반환 분기(client 미확립→true, 이미 열림→false, 성공적으로 엶→true) 중 회귀 테스트로 명시적으로 방어되는 것은 사실상 "이미 열림→false"(이중 오픈 방지) 뿐이며, 검증은 전부 `renderHook(() => useWidget())` 전체 마운트를 통한 간접(통합) 경로로만 이뤄진다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:367-393` (`openStream` 정의 전체)
  - 상세: `openStream`이 훅 밖으로 노출되지 않는 내부 콜백이라 독립 단위 테스트가 원천적으로 불가능한 구조다. `plan/in-progress/webchat-usewidget-extraction.md`가 스스로 명시하듯 `useEiaSession`으로의 완전 추출은 아직 미착수 상태(§체크리스트 첫 항목 `[~]`)이므로, 이는 새로 생긴 문제라기보다 알려진/이월된 구조적 제약이다.
  - 제안: 향후 `useEiaSession` 추출 시 `openStream`을 훅의 공개 계약으로 노출하거나 별도 파일로 분리해, 반환값 3분기를 좁은 단위 테스트로 직접 커버할 수 있게 하는 것을 그 작업의 완료 기준에 포함시키는 것을 권고(이미 plan 문서가 이 방향을 계획 중이므로 별도 액션 불필요, 기록 목적).

## 요약
이번 diff는 순수 리팩터(스트림 게이트를 호출부 2곳의 손복제 코드에서 `openStream()` 내부 단일 지점으로 이동)이고 테스트 파일 자체는 건드리지 않는다. 검증해 보니 관련 회귀 테스트(이중 EventSource 방지, 양방향 race)가 구현이 아니라 관측 가능한 결과(`esCount`)만 단언하도록 이미 잘 설계돼 있어 리팩터 전후 모두에서 유효하며, 실측으로 74/169/409 테스트 전부 GREEN·`tsc --noEmit` 0 errors를 확인해 plan 문서의 서술과 완전히 일치했다. 남은 이슈는 기능 결함이 아니라 (1) 이 파일이 반복적으로 겪어온 "주석 drift" 패턴이 회귀 테스트 파일에도 나타난 점(구조 변경 후 오래된 설명 문장이 남음)과 (2) `openStream`이 훅 내부 클로저라 3가지 반환 분기 중 실질 도달 불가능한 방어 분기(`!client→true`)와 단위 수준 격리 테스트 불가라는 구조적 한계다. 둘 다 즉시 차단 사유는 아니며 plan 문서 자체가 후자를 이미 알려진 이월 항목으로 추적하고 있다.

## 위험도
LOW
