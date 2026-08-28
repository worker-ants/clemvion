# RESOLUTION — `02_02_18` (3라운드, forced 7/7)

RISK=LOW · **CRITICAL 0** · WARNING 1 → 반영. INFO 1 도 반영.
7명 중 6명이 NONE, testing 만 LOW.

## W1 — **단락 평가가 분기를 가리고 있었고, 직전 라운드는 그걸 놓쳤다**

`"AI node failure without prior conversation context does NOT APPEND"` 테스트가 `output` 을
안 실어 `errorPayload` 가 `null` 이었다. 그러면

```ts
if (errorPayload && isMultiTurnAiContext(payload.nodeType)) { … }
```

의 `&&` 가 **`isMultiTurnAiContext` 를 호출하기도 전에** 끊는다. 즉 그 테스트가 검증한다고
믿은 *"이전 대화 없음 → 배너 억제"* 분기는 **한 번도 안 돌았다**. 리뷰어가
`return true` 뮤테이션으로 **89/89 GREEN** 을 실증했다.

**직전 라운드(`01_44_22`)는 이 케이스를 *"게이트에서 조기 차단되어 공허 테스트는 아니다"*
로 판정했는데 오판이었다** — 조기 차단된다는 것이 바로 그 분기가 무검증이라는 뜻인데,
반대로 읽었다. 이번 라운드가 뮤테이션으로 반증했다.

`output` 을 실어 `errorPayload` 를 non-null 로 만들고 `seedConversation()` 은 **일부러
호출하지 않았다** — 배너를 막는 것이 `errorPayload` 부재가 아니라 **대화 이력 부재**임을
그 자리에서 가른다.

| | 예측 | 실측 |
| --- | --- | --- |
| M5 `isMultiTurnAiContext` → `return true` | 2 failed | **3 failed** |

추가 1건은 직전 라운드 INFO 8 에서 고친 `non-AI does NOT APPEND` 다 — 그때 `output` 을
실으면서 이미 살아났다. 리뷰어가 89/89 GREEN 을 본 뮤턴트를 이제 **셋이** 문다.

## INFO 1 — 자매를 또 갈랐다

비-AI 테스트가 **둘**인데 직전 라운드에 `does NOT APPEND` 만 production shape 으로 고치고
`also carries output into outputData` 는 두고 왔다. 이 PR 에서만 *"형제 중 하나만 고친다"*
가 세 번째다. 문자열 `error` 로 통일.

## INFO 7 — `.bak` 잔여물은 리뷰어가 만든 것이다

documentation 리뷰어가 워크트리에서 `use-execution-events.ts.bak`(52KB)을 관측했다.
**지금은 없다**(`find` 0건, `git status` 는 신규 review 디렉토리만).

내 백업은 전부 세션 scratch(`/private/tmp/.../scratchpad`)로 갔다. 이 라운드에서 testing
리뷰어가 *"뮤테이션 후 즉시 원복"* 했다고 보고했으므로, 그 과정에서 `cp file file.bak` 로
저장소 안에 만들었다가 지운 것으로 보인다.

**이것이 정본 트래커/하네스 트래커가 추적 중인 "형제 리뷰어가 저장소를 뮤테이션한다"
클래스의 세 번째 사례**다(2026-08-11 `13_04_55` · 2026-08-27 `14_10_42` · 오늘). 이번에도
무해했지만 **무해했던 이유가 설계가 아니라 우연**이라는 점이 같다. 다음 PR(트래커 중복
정리)에서 이 사례를 그 항목에 함께 싣는다.

## 나머지 INFO — 조치 불요

- **#2** `handleNodeCompleted` 도달 가능성 미확증 — 이전 라운드 판정 승계, 백엔드 조사는 별건.
- **#3** 배너가 프로덕션에서 처음 발동 — CHANGELOG·plan 에 이미 명시.
- **#4** 시그니처 축소로 계약이 좁아졌다 — 혼재 배포 시 유의점은 맞고, 현재 도달 불가는
  emit 4곳 전수 실측으로 근거가 있다.
- **#6** 세 유예 항목 재확인 — 신규 아님, 판정 유지.
- **#9·#10·#11** 신규 캐너리가 뮤테이션에 반응함 · 스코프 이탈 없음 · 이전 두 라운드
  WARNING 전건 반영을 5명이 각자 확인 — 확인 기록.

TEST WORKFLOW 4단계 PASS — frontend 89/89(이 스위트) · e2e 285.
