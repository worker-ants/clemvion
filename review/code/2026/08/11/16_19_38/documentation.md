# 문서화(Documentation) Review — 커밋 `df1375208` (주석 2줄 교체, 실행 코드 0줄)

## 점검 배경

이 라운드의 델타는 `codebase/channel-web-chat/src/widget/use-widget.ts` 의 주석 2곳뿐이다:

1. `configFromQuery` 함수 JSDoc — "host 없이 직접 로드/샘플 대비" → "**샘플/개발 전용이 아니다** … 모든 임베드에서 발동한다"
2. 직접 로드 폴백 호출부 인라인 주석 — "host 없이 직접 로드(샘플/개발)" → "query param 만으로 부팅 시도 — host 유무를 검사하지 않는다 … 모든 임베드에서 발동한다"

직전 라운드에서 `spec/7-channel-web-chat/4-security.md §1` 이 "쿼리 경로를 host 없는 직접 로드/샘플 전용으로 읽으면 안 된다"고 정정됐는데, 이번 커밋 전까지 코드 주석 2곳이 정확히 그 오독을 유도하는 문구를 그대로 갖고 있었다는 지적(security INFO, 라운드 4)을 처분한 것이다.

## 확인 절차 (직접 소스 판독)

**1. 새 주석 서술이 코드와 맞는가.**

- `codebase/packages/web-chat-sdk/src/bridge.ts:192-204` `resolveIframeTarget()` — `widgetBase` 기준으로 iframe src 를 만들고, `apiBase`·`trigger` 를 **무조건** `URLSearchParams` 에 실어 쿼리로 붙인다(둘 다 필수 필드, 조건부 아님).
- `codebase/packages/web-chat-sdk/src/index.ts:81-94` `boot()` — 모든 `boot()` 호출에서 `resolveIframeTarget(config, base)` 로 iframe src 를 만든 **뒤** `bridge.post("wc:boot", config)` 로 같은 config 를 postMessage 로도 보낸다. 조건 분기 없음 — "샘플/개발"이라는 특수 모드가 SDK 쪽에 아예 존재하지 않는다.
- `codebase/channel-web-chat/src/widget/use-widget.ts:1385-1388` — `configFromQuery()` 로 읽은 `fallback.apiBase && fallback.triggerEndpointPath` 를 조건으로 `runApplyConfig` 를 호출한다. host 유무를 검사하는 코드가 없다(주석이 말하는 그대로). SDK 가 항상 두 값을 iframe src 쿼리에 싣으므로 이 조건은 정상 임베드에서도 항상 참이 되어 폴백이 먼저 발동한다.
- `codebase/channel-web-chat/src/widget/use-widget.ts:1233-1291` `applyConfig`/`beginBootAttempt`/`isAttemptStale` — 뒤이어 도착하는 `wc:boot` 이 `applyConfig` 를 다시 호출하면 새 attempt 가 이전 attempt 를 대체한다(`applyConfig` 내부 주석 `:1235` "이 호출이 앞선 시도를 대체한다"). "뒤이어 도착하는 `wc:boot` 이 세대 판정으로 대체한다"는 새 주석의 서술과 일치한다.

→ 두 새 주석 모두 **코드와 정확히 맞는다**. 과장·축소 없음.

**2. "샘플"/"dev-only" 로 이 경로를 부르는 다른 복제본이 남아 있는가.**

```
grep -rn "샘플\|dev-only\|dev only\|개발 전용\|개발전용" \
  codebase/channel-web-chat/src codebase/packages/web-chat-sdk/src \
  spec/7-channel-web-chat
```

결과: 이번에 고친 두 줄(`use-widget.ts:222`, `:1384` — 둘 다 "**아니다**"로 부정하는 문장) 외에는:

- `presentation.test.ts` 의 `"샘플상품 …"` — 상품명 테스트 fixture. 이 폴백 경로와 무관.
- `spec/7-channel-web-chat/_product-overview.md`, `0-architecture.md`, `web-chat-sdk/examples/README.md` — "샘플 프로젝트"/"샘플 항목"은 SDK 사용 예제 디렉터리·`.env.example` 을 가리키는 별개 의미(제품 정의상의 "샘플"=demo app). 이 쿼리 폴백 메커니즘을 가리키지 않는다.
- `spec/7-channel-web-chat/4-security.md:39` — 이미 정정된 §1 문장 자체("…샘플 전용으로 읽으면 안 된다…").

→ 커밋 메시지가 주장한 "복제본 정확히 2곳"이 실측과 일치한다. 세 번째 복제본은 없다.

**3. 새 주석과 spec §1 이 서로 모순되는가.**

`4-security.md:39`: "경로는 둘이고 **정상 임베드에서 둘 다 순차로 발동한다** — SDK 의 `resolveIframeTarget` 이 같은 `apiBase` 를 iframe src 쿼리에 싣고(위젯 마운트 시 그 값으로 먼저 부팅 시도), 이어서 `wc:boot` postMessage 가 도착해 세대 판정으로 대체한다."

새 코드 주석(`use-widget.ts:222-224`, `:1382-1384`)은 동일한 인과관계("iframe src 쿼리에 같은 값 → 이 경로가 먼저 뜸 → 뒤이은 `wc:boot` 이 세대 판정으로 대체")를 같은 표현으로 서술하고, JSDoc 은 명시적으로 `SoT: 4-security.md §1` 을 인용해 단일 진실 소스를 코드에서 가리킨다. 모순 없음 — 오히려 두 서술이 문장 단위로 정합한다.

## 발견사항

없음. 억지로 만들 항목이 없다 — 위 세 가지 확인 축(코드 일치·복제본 잔존·spec 정합) 전부 통과했고, 이 delta 는 실행 코드 0줄의 순수 주석 정정이라 JSDoc/README/API문서/CHANGELOG/설정문서/예제코드 항목도 해당 없음(변경 범위 밖). `configFromQuery` JSDoc 이 새로 SoT 링크(`4-security.md §1`)를 명시한 것은 오히려 이 저장소가 반복 겪은 "spec 만 고치고 코드 주석은 그대로" 재발을 막는 좋은 관행이다.

## 요약

`df1375208` 은 `use-widget.ts` 의 두 주석(함수 JSDoc + 인라인)만 바꾼 순수 문서 정정 커밋이다. `resolveIframeTarget`/`boot()`(web-chat-sdk)과 `use-widget.ts` 의 폴백 조건·`applyConfig`/`beginBootAttempt` 대체 로직을 직접 읽어 새 주석의 "모든 임베드에서 발동한다 + 세대 판정으로 대체된다" 서술이 코드와 정확히 일치함을 확인했다. `codebase/`·`spec/` 전수 grep 으로 "샘플"/"dev-only" 로 이 경로를 잘못 부르는 세 번째 복제본이 없음을 확인했고, 새 주석과 `4-security.md §1` 사이에도 모순이 없다(오히려 JSDoc 이 그 절을 SoT 로 명시 인용). 이 PR 이 이전 라운드들에서 반복했던 "spec 만 고치고 코드는 그대로" 패턴이 이번엔 재발하지 않았다.

## 위험도

NONE

STATUS: OK
