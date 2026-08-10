# 테스트(Testing) Review

## 검증 방법

이번 diff는 `12_39_25` 라운드에서 나온 maintainability WARNING("`openStream` 의 `boolean` 반환이 서로
다른 두 상황을 같은 `true` 로 뭉갠다")과 testing WARNING("회귀 테스트 주석이 옛 아키텍처를 서술")에
대한 `RESOLUTION.md` 조치분이다. 두 조치가 실제로 반영됐는지, 그리고 새로 도입된 `StreamClaim`
명명 union 이 테스트 관점에서 갭을 남기지 않는지를 직접 실행/코드 대조로 확인했다.

- `npx vitest run src/widget/use-widget-eager-start.test.ts src/widget/use-widget.test.ts src/widget/use-widget-commands.test.ts` → 74/74 PASS
- `npx vitest run`(channel-web-chat 전체) → 23 files / **409 passed** — RESOLUTION.md·SUMMARY.md·plan 문서의 서술과 실측 일치
- `npx tsc --noEmit -p .`(channel-web-chat) → 0 errors — 서술과 일치
- `grep -n "clientRef.current\s*="` → 대입 1곳(`establishConfig`)뿐, 해제 없음 → `"no_client"` 분기가 현재 불변식 하에서 도달 불가하다는 RESOLUTION.md 의 "동등 뮤턴트" 근거를 독립적으로 재확인
- `use-token-refresh.ts` 확인 → `scheduleRefresh` 는 `clearRefreshTimer()` 로 시작하는 멱등 함수 → "호출부가 결과 무시" 뮤턴트가 관측 불가하다는 근거도 독립적으로 재확인
- `openStream(` 호출부 grep → 정확히 2곳(`start()` gate 619, `applyConfig` gate 968) 모두 `=== "already_owned"` 로 게이팅됨. 3번째 호출부는 없음
- 다른 테스트 파일(`use-widget.test.ts`, `use-widget-commands.test.ts`)에 `sessionEstablished`/`openStream`/`StreamClaim` 참조 없음 — 이번 변경으로 인한 stale 주석 파급 없음

## 발견사항

- **[INFO]** (긍정 관찰) 이전 라운드(`12_39_25`)의 testing WARNING — 회귀 테스트 주석이 "호출부 양쪽 게이트" 라는 옛 구조를 서술하던 문제 — 가 정확히 조치됨
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3401`-`3408` (`raceStartVsResendSingleStream` 상단 주석)
  - 상세: 새 주석은 "스트림 게이트가 `openStream()` 안에 있다"·"소유권을 재확인하고 이미 열려 있으면 `"already_owned"` 를 돌려준다"로 현행 구조와 정확히 일치하고, 옛 구조는 "종전엔 ~였다"로 이력만 남겨(gate 3405-3408) drift 재발을 스스로 경계하는 문구까지 포함한다. `esCount` 단언(gate 3489, 3495) 자체는 변경 없이 그대로이며 두 방향(start 먼저 / 재전송 먼저) 모두 GREEN 으로 재확인했다.
  - 제안: 없음(양호).

- **[INFO]** `StreamClaim` 의 `"no_client"` 분기는 여전히 직접 실행되는 테스트가 없다 — 다만 새 결함이 아니라 이전 라운드부터 알려진 구조적 제약이 boolean → union 전환 후에도 동일 형태로 이월됨
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:389` (`if (!client) return "no_client";`)
  - 상세: `openStream` 이 훅 내부 클로저라(`useWidget()` 이 `state`/`config`/`actions` 만 export, gate 1036-1041) 단위 테스트로 직접 호출해 이 분기만 격리 검증할 수 없다. `clientRef.current` 는 코드베이스 전체에서 `establishConfig` 한 곳에서만 대입되고 이후 null 로 되돌리는 지점이 없어(직접 grep 재확인), 실행 시점에 `openStream` 이 `client === null` 로 불릴 경로가 현재는 없다. RESOLUTION.md/SUMMARY.md 가 이를 "관측 불가 → 뮤턴트 동등" 으로 명시하고 실측(멱등성·불변식) 근거를 남긴 점은 vacuous 테스트를 만들지 않겠다는 이 프로젝트 컨벤션에 부합한다. 이전 라운드(`12_39_25` testing INFO)에서도 동일 결론이었으므로 새로 발생한 갭이 아니라 boolean 시절부터 이월된 것이다.
  - 제안: 당장 조치 불필요. `pendingResetRef`/`sessionEstablished` JSDoc 의 "불변식 의존 주의" 패턴을 따라, 향후 `clientRef.current` 가 재설정 가능해지는 기능(예: config 재설정)이 들어오는 시점에는 `"no_client"` 반환 계약을 검증하는 테스트를 함께 추가할 필요가 있다는 점만 인지해 둘 것.

- **[INFO]** `"opened"` 분기도 이름으로 직접 assert 되지 않고 `esCount` 증가라는 간접 신호로만 검증됨
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:408` (`return "opened";`) / 대응 테스트 `use-widget-eager-start.test.ts:3487`-`3497`
  - 상세: `openStream` 이 실제로 열렸는지는 `client.openStream` 호출로 인한 `EventSource` 생성 카운트(`esCount`)로만 관측된다. 세 값(`"opened"`/`"already_owned"`/`"no_client"`) 중 타입 리터럴 자체를 assert 하는 테스트는 없다 — 이는 `openStream` 이 비공개 콜백인 구조적 한계이며(위 항목과 동일 원인), `boolean` 이었던 이전 판에서도 동일했다. union 전환은 오독 방지·컴파일 타임 강제(미처리 케이스 컴파일 에러)라는 이익을 주지만, 런타임 테스트 커버리지 자체를 넓히지는 않는다 — 그 갭은 이번 diff 의 범위가 아니라 `plan/in-progress/webchat-usewidget-extraction.md` 의 미착수 슬라이스(`useEiaSession` 추출)가 닫을 항목으로 이미 추적 중이다.
  - 제안: 조치 불요(기록 목적). `useEiaSession` 추출 시 `openStream` 을 훅 공개 계약으로 노출하거나 별도 파일로 분리해 세 분기를 좁은 단위 테스트로 직접 커버하는 것을 그 작업의 완료 기준에 포함시킬 것을 권고(plan 문서가 이미 유사 방향을 계획 중).

## 요약

이번 diff 는 `12_39_25` 라운드에서 나온 testing WARNING(회귀 테스트 주석의 구조 drift) 과 maintainability
WARNING(boolean 반환의 의미 뭉개짐)을 동시에 해소하는 조치분이다. 테스트 관점에서 직접 검증한 결과 두
WARNING 모두 정확히 반영됐음을 확인했다 — 테스트 주석은 현행 `openStream` 내부 단일 게이트 구조를
정확히 서술하고, `esCount` 기반 두 방향(회귀) 테스트는 구현 세부(boolean→union)가 바뀌어도 관측
가능한 최종 상태만 보므로 수정 없이 그대로 GREEN 이다(74/409 실측 일치, `tsc --noEmit` 0 errors 일치).
남은 갭은 새로 생긴 것이 아니라 `openStream` 이 훅 비공개 클로저라는 구조적 제약에서 이월된 두 건
(`"no_client"` 미실행 분기, `"opened"` 미직접-assert)뿐이며, 둘 다 RESOLUTION.md 가 실측(불변식 grep·
멱등성 확인)으로 "동등 뮤턴트/관측 불가"임을 근거를 남기며 정당화했고 이번 리뷰에서 그 근거(clientRef
단일 대입, scheduleRefresh 멱등성)를 독립적으로 재확인했다. 차단 사유 없음.

## 위험도

LOW
