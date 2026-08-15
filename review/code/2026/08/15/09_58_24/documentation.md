# 문서화(Documentation) 코드 리뷰 — EIA 종결 이벤트 `durationMs` 구현

## 조사 방법 메모

프롬프트 번들이 대부분의 대상 파일에서 "전체 파일 컨텍스트" 를 예산 초과로 생략했으므로
(`execution-engine.service.ts`/`.spec.ts`, `retry-turn.service.ts`/`.spec.ts`,
`spec/5-system/14-external-interaction-api.md`, `spec/conventions/chat-channel-adapter.md` 등),
diff 만으로 판단하지 않고 `Read`/`Grep` 으로 해당 파일 및 이 diff 가 **건드리지 않은 인접
소비처**(`codebase/backend/src/modules/chat-channel/types.ts`,
`chat-channel.dispatcher.ts`)까지 직접 열어 대조했다.

---

## 발견사항

- **[WARNING] `durationMs` 의 "항상 존재 + nullable" 계약이 chat-channel 소비 측 TS 타입에는 반영되지 않았다 — 같은 파일의 `error.code` 패턴과도 모순**
  - 위치: `spec/conventions/chat-channel-adapter.md:161`(이번 diff 로 새로 추가된 설명 —
    "durationMs 는 2026-08-15 에 종결 3종 전부 구현됐다 — 알 수 없으면 `null` 이라
    **optional 표기는 유지한다**"). 실제 타입 선언은 같은 파일 149–151행(이번 diff 밖,
    무변경) 및 `codebase/backend/src/modules/chat-channel/types.ts:392,410,423`(이번 diff
    가 전혀 건드리지 않은 파일)의 `durationMs?: number;` 세 곳.
  - 상세: 이번 PR 의 핵심 설계 불변식은 `terminal-duration.ts` 의 `resolveTerminalDurationMs`
    JSDoc 이 명시한다 — "`@returns` 밀리초. 알 수 없으면 **`null`** — `undefined` 를
    돌려주면 JSON 직렬화에서 키가 사라져 '필드가 없는 것' 과 '값을 모르는 것' 이 구분되지
    않는다." 그리고 이 diff 의 모든 emit 호출부(`execution-engine.service.ts`,
    `retry-turn.service.ts`)는 실제로 `durationMs: resolveTerminalDurationMs(...)` 또는
    `durationMs: opts.durationMs ?? null` 형태로 **조건 없이 키를 싣는다** — 즉 필드는
    이제 3종 종결 이벤트 전부에서 **항상 존재**하고 값은 `number | null` 이다(다시는
    `undefined` 가 되지 않는다).

    그런데 이 계약을 소비하는 `EiaEvent` 타입(스펙 문서의 인라인 스니펫과 실제 백엔드
    `types.ts` 양쪽)은 여전히 `durationMs?: number;` — **optional(키가 없을 수도 있음)이면서
    `null` 은 허용하지 않는** 선언이다. "optional 표기를 nullable 의 대용으로 유지한다"
    는 이번 diff 의 설명 자체가 TS 관용과 어긋난다 — **바로 옆 `error` 필드가 정확한
    반례를 제공한다**: `types.ts:400` 의 `error.code: string | null` (optional 마커 없이
    `| null` 로 "항상 존재하되 null 일 수 있다" 를 표현)가, 이번 PR 이 `durationMs` 에
    적용하려는 것과 **동일한 의미**를 이미 올바른 문법으로 인코딩하고 있다. `types.ts:397`
    의 주석("EIA §6.4 — `code`·`nodeId` 는 **명시적 `null`** 이 올 수 있다(키 생략이
    아니다)")은 이번 diff 가 `durationMs` 에 대해 반복해서 강조하는 바로 그 원칙과 글자
    그대로 같다.

    실무 영향은 제한적이다 — `chat-channel.dispatcher.ts:534,571,587` 는
    `(event.payload as { durationMs?: number }).durationMs` 로 값을 그대로 통과시키므로
    런타임에서 `null` 이 깨지지는 않는다(단, `as` 캐스팅이 타입 체크를 우회해 컴파일러가
    이 불일치를 잡아내지 못한다). 다만 `chat-channel-adapter.md` 자신이 "위 3 variant 는
    [EIA §6.5 행동 계약] 를 TypeScript 로 옮긴 것" 이라고 R3 에서 명시하는데, EIA §6 필드
    표 자체가 `durationMs` 를 "밀리초. 알 수 없으면 `null`" 로 정의한 이번 diff 이후
    상태(`spec/5-system/14-external-interaction-api.md:575`)와 그 "옮긴 것" 이 타입
    수준에서 어긋난다 — 문서가 스스로 세운 충실도 기준을 이번 편집이 어긴다.
  - 제안: `spec/conventions/chat-channel-adapter.md` 의 `EiaCompletedEvent`/`EiaFailedEvent`/
    `EiaCancelledEvent` 인라인 타입과 `codebase/backend/src/modules/chat-channel/types.ts`
    의 `durationMs?: number;` 세 곳을 `durationMs: number | null;`(옵셔널 마커 제거 +
    `| null` 추가)로 정정하고, "optional 표기를 유지한다" 는 새 설명 문구를 `error.code`
    와 동일한 패턴 설명으로 교체할 것. 최소한 스펙 prose 만이라도 "이 필드는 이제 항상
    존재하며 값이 `number | null` 이다" 로 정정해야 실제 계약과 문서가 일치한다.

- **[WARNING] EIA 종결 3종 페이로드에 신규 필드(`durationMs`)를 추가하는 외부 계약 변경인데 `CHANGELOG.md` 항목이 없다**
  - 위치: 저장소 루트 `CHANGELOG.md`(이번 diff 에 포함되지 않음 — `git diff --stat
    origin/main` 로 확인, 26개 변경 파일 중 CHANGELOG.md 없음).
  - 상세: 이 저장소는 외부 노출 API/이벤트 계약이 바뀔 때마다 세밀한 단위로
    `CHANGELOG.md` "Unreleased" 항목을 남기는 확립된 관행이 있다 — 바로 **이 작업의
    직전 커밋**(`e3825cc2c`, `error` 를 문자열→객체로 통일한 PR #1170)이 이미 그 관행을
    따라 `CHANGELOG.md:3-20` 에 항목을 남겼고, **그 항목의 마지막 줄이 정확히 이번 작업을
    예고한다**: *"`durationMs`·`result.outputs` 는 취소 경로 배관 비용이 달라 후속으로
    분리했다."* `plan/in-progress/eia-terminal-payload.md:255` 도 "이 저장소는 URL 버전
    세그먼트를 쓰지 않으므로 버전 협상 수단이 없고 **CHANGELOG 가 유일한 통지 경로**다"
    라고 스스로 못박아 둔 원칙이다. 이번 diff 는 `execution.completed`/`failed`/
    `cancelled` 3종 모두에 새 필드를 채워 webhook·SSE·chat-channel 외부 구독자에게 도달하는
    wire 계약을 바꾸는데(추가적이라 엄밀히는 breaking 은 아니지만, 직전 항목이 이 작업을
    이미 CHANGELOG 에서 "후속" 으로 지목해 뒀다는 점에서 이번 완료를 알리는 항목이
    빠졌다), 그 통지 경로에 아무 항목도 남기지 않았다.
  - 제안: `CHANGELOG.md` 에 "EIA 종결 3종(`completed`/`failed`/`cancelled`) 에
    `durationMs` 필드 추가 — 알 수 없으면 `null`, 취소 경로 4곳은 raw UPDATE 에서 SQL 로
    계산 후 `RETURNING` 으로 확보" 요지의 Unreleased 항목을 추가할 것. 직전 `error` 항목의
    마지막 줄("후속으로 분리했다")을 이번 항목에서 되짚어 두면 두 항목이 하나의 완결된
    이야기로 연결된다.

- **[INFO] `spec_impact` frontmatter 누락(직전 라운드가 지적한 W3)은 이번 diff 로 이미 해소됨 — 확인만**
  - 위치: `plan/in-progress/eia-terminal-payload.md` frontmatter (게이트 라인 7-16).
  - 상세: `08_45_50`/`09_00_27` consistency 라운드가 지적한 `spec_impact` 누락
    (`spec/conventions/chat-channel-adapter.md`, `spec/3-workflow-editor/3-execution.md`,
    `spec/data-flow/3-execution.md`)이 이번 diff 에서 실제로 4번째 파일까지 포함해
    추가돼 있다. 다만 `spec/data-flow/3-execution.md` 자체는 이번 diff 의 실제 spec 변경
    3파일(`spec/3-workflow-editor/3-execution.md`, `spec/5-system/14-external-interaction-api.md`,
    `spec/conventions/chat-channel-adapter.md`) 목록에 없다 — plan 본문이 이미 "이 PR 이
    (그 다이어그램의 뭉뚱그림을) 참으로 만든다" 고 설명해 두었으므로 텍스트 편집이 필요
    없다는 결론은 타당해 보이나, `spec_impact` 에 등재된 파일에 대응하는 실제 diff 가
    0줄이라는 비대칭은 이후 Gate C(`spec-plan-completion.test.ts`) 감사 시 재확인이 필요할
    수 있다. 조치는 불요, 참고 기록.

- **[INFO] `chat-channel-adapter.md` 의 `result` optional 표기가 실제 `types.ts` 의 `result:`(필수) 선언과 이미 어긋나 있음 — 이번 PR 범위 밖의 기존 drift**
  - 위치: `spec/conventions/chat-channel-adapter.md:149`(diff 밖, `result?: { outputs?:
    unknown }`) vs `codebase/backend/src/modules/chat-channel/types.ts:391`(diff 밖,
    `result: { outputs?: unknown }` — optional 마커 없음). `chat-channel.dispatcher.ts:533`
    도 `result: ... ?? {}` 로 항상 채워 보낸다.
  - 상세: 이번 diff 가 바로 그 줄(게이트 라인 159-161, "`result` 가 optional 인 이유:
    …")을 손보면서도 이 기존 불일치는 건드리지 않았다. `durationMs` 건과 같은 성격(옵셔널
    vs nullable 혼동)이라 같은 편집 세션에서 함께 정정하면 재작업 비용이 줄어든다.
  - 제안: 급하지 않음 — 이번 PR 의 durationMs 타입 정정과 묶어 처리하거나 별도 후속으로
    남길 것.

---

## 긍정적으로 확인한 점

- `codebase/backend/src/shared/utils/terminal-duration.ts` 의 모듈/함수 JSDoc 은 이 리뷰가
  본 세션에서 읽은 문서 중 가장 완성도가 높다 — "왜 헬퍼인가"(16개 emit 경로 중 값의 출처가
  갈리는 이유), "`startedAt` 을 낙관하지 않는다"(이 브랜치가 실제로 겪은 회귀의 재현 경로),
  `@returns` 의 `null` vs `undefined` 구분 근거까지 전부 문서화돼 있다.
- `execution-engine.service.ts`/`retry-turn.service.ts` 의 인라인 주석은 "무엇을" 뿐 아니라
  "왜 조건문 밖으로 옮겼는지"(과거엔 `if (lastNodeId)` 블록 안에 있어 노드 0개 그래프에서
  `undefined` 가 wire 로 나갈 뻔했던 회귀)까지 명시해 다음 편집자가 실수를 반복하지 않게 한다.
- `terminal-duration.spec.ts` 의 각 테스트 설명은 "무엇을 검증하는가" 를 넘어 "왜 이 케이스가
  중요한가"(`0` 은 falsy 로 버리면 안 됨, pg 드라이버가 bigint 를 문자열로 준다 등)를 담아
  회귀 방지 문서 역할을 겸한다.
- `spec/5-system/14-external-interaction-api.md` 의 §6 필드 표·§6.3·§6.4·§6.5 전환은 "Planned"
  캐비엇을 삭제 대신 `~~취소선~~` + "(2026-08-15 해소)" 로 남기는 이 저장소의 확립된 관행을
  그대로 지켰다(직전 `error` 전환 때와 동일 패턴) — rationale 연속성이 잘 보존됐다.

---

## 요약

핵심 신규 유틸리티(`terminal-duration.ts`)와 그 소비 지점(`execution-engine.service.ts`,
`retry-turn.service.ts`)의 문서화 수준은 이 저장소 평균을 웃돈다 — 왜(rationale)·과거
회귀·설계 불변식이 촘촘히 기록돼 있다. `spec/5-system/14-external-interaction-api.md` 의
필드 표 전환도 기존 관행(삭제 대신 해소 표기)을 잘 따랐다. 다만 이번 PR 이 세운 핵심 설계
원칙("`durationMs` 는 이제 항상 존재하고 값은 `number | null`")이 그 원칙을 소비해야 하는
`chat-channel-adapter.md` 의 인라인 타입 스니펫과 실제 `codebase/.../chat-channel/types.ts`
양쪽 모두에는 반영되지 않았다 — 두 곳 다 `durationMs?: number` 라는 이전 문법(옵셔널·
non-nullable)을 유지했고, 새로 추가된 설명 문구는 이 불일치를 "의도적으로 optional 표기를
유지한다" 고 정당화하지만 그 정당화 자체가 같은 파일의 `error.code: string | null` 패턴과
모순된다. 외부 계약 변경에 대한 `CHANGELOG.md` 항목 누락도 발견했다 — 이 저장소의 확립된
통지 관행(URL 버전 세그먼트 미사용 → CHANGELOG 가 유일한 통지 경로)과 직전 커밋이 이 작업을
직접 예고해 둔 사실에 비추면 이번 커밋에서 함께 처리됐어야 한다. 두 건 모두 런타임 크래시로
이어지지는 않지만, 문서/타입이 실제 계약보다 좁게 남아 다음 편집자를 오도할 수 있어
WARNING 으로 분류했다.

## 위험도

MEDIUM
