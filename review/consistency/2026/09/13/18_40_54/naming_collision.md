# 신규 식별자 충돌 검토 — `error-code-emission-axis` (--impl-prep, scope=spec/conventions/)

## 조사 방법

target(`plan/in-progress/error-code-emission-axis.md`)이 실제로 새로 도입하겠다고 명시한
식별자는 하나뿐이다 — `GUIDE_NON_EMITTED_VOCABULARY` (신규 방출-축 예외 목록). 그 외
체크리스트 항목("방출 축 구현", "가이드 문장 3종 정정")은 기존 토큰(`MAKESHOP_UNRESOLVED_PATH_PARAM`·
`CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT`)의 **서술을 정정**하는 것이지 새 식별자를
발행하는 것이 아니다. `spec_impact: none` 이라 이번 target 은 `spec/` 파일을 만들지도 고치지도
않는다. 이에 맞춰 검토 범위를 "target 이 실제로 새로 붙이는 이름"으로 좁히고, 번들에 포함된
`spec/conventions/**` 전체(특히 `error-codes.md`)와 저장소 전수를 grep 대조군으로 썼다.

```
grep -rn "GUIDE_NON_EMITTED_VOCABULARY\|NON_EMITTED\|EMITTED_VOCABULARY\|EMISSION" codebase/ spec/ plan/
→ 0건 (target 문서 자기 자신 제외)
```

## 발견사항

- **[INFO]** `GUIDE_NON_EMITTED_VOCABULARY` 는 기존 사용처와 충돌하지 않는다 — 단 자매 목록과
  이름이 한 토큰만 다르다
  - target 신규 식별자: `GUIDE_NON_EMITTED_VOCABULARY` (방출 축 예외 목록, plan §C)
  - 기존 사용처: 없음. `GUIDE_EXTERNAL_VOCABULARY` (`codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:245`, 존재 축 예외 목록)만 존재하며 서로 다른 상수다.
  - 상세: 저장소 전수 grep 으로 `GUIDE_NON_EMITTED_VOCABULARY`·`NON_EMITTED`·`EMITTED_VOCABULARY`·`EMISSION` 어느 것도 target 문서 밖에서 0건이라 실존 충돌은 없다. 다만 두 상수는 이름이 `EXTERNAL`↔`NON_EMITTED` 한 토큰만 다르고 나란히 존재하게 되며, plan §C 스스로 "두 목록을 합치면 예외 하나가 두 축의 결함을 동시에 덮는다"고 정확히 그 위험을 지적하고 제약이 정반대(기준집합에 **없을 것** vs **있을 것**)임을 표로 못박아 뒀다. 즉 이 checker 가 잡아야 할 유형의 위험을 target 이 이미 자기진단했다 — 남은 것은 실제 코드 구현 시 그 대조표가 소실되지 않게 하는 절차적 문제다.
  - 제안: `guide-identifier-scan.ts` 에 `GUIDE_NON_EMITTED_VOCABULARY` 를 추가할 때, `GUIDE_EXTERNAL_VOCABULARY` JSDoc 바로 옆(또는 그 JSDoc 안)에 plan §C 의 대조표("존재 축 vs 방출 축, 제약이 정반대")를 그대로 이식할 것 — 지금은 그 대조가 plan 문서에만 있고 코드 주석에는 아직 없어, plan 이 `complete/` 로 이동하면 근거가 사라진다(이 저장소 기록: "정의를 한 칸 좁게 잡는다" 계열 교훈과 동일하게, 근거가 코드 곁에 없으면 다음 사람이 두 목록을 합치는 시도를 막을 수 없다).

- **[INFO]** `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 "코드가 아니라 메시지 접두"로 정정하는 것은 target 범위 밖의 다수 spec 문서와 서술이 어긋난다 (참고용 — 이번 target 의 결함 아님)
  - target 신규 식별자: 없음 (target 은 이 두 토큰을 새로 발행하지 않고, guide mdx 의 서술 문장만 고친다)
  - 기존 사용처: `spec/4-nodes/1-logic/0-common.md:83`, `spec/4-nodes/1-logic/7-map.md:179-180`, `spec/4-nodes/1-logic/9-foreach.md:209-210`, `spec/4-nodes/1-logic/3-loop.md:56,189-191`, `spec/3-workflow-editor/2-edge.md:202`, `spec/3-workflow-editor/0-canvas.md:636`, `spec/5-system/4-execution-engine.md:332-333` — 전부 이 두 토큰을 다른 정식 에러 코드(예: `EXECUTION_TIME_LIMIT_EXCEEDED`)와 같은 방식으로 backtick 인용한다.
  - 상세: target(plan §D)의 실측은 정확하다 — `execution-engine.service.ts:7121-7130` 확인 결과 두 토큰은 `ErrorCode`/`EngineErrorCode` enum 멤버가 아니라 일반 `Error(...)` 메시지의 **접두 문자열**이다. 그런데 위 7개 spec 파일은 이 사실을 반영하지 않고 정식 에러 코드와 동일한 표기(단독 backtick, "에러 코드"·"검증" 컬럼)로 문서화해 왔다 — target 이전부터 있던 기존 drift 다. target 은 guide(`integrations{,.en}.mdx`, `logic{,.en}.mdx`) 문장만 고치기로 명시적으로 스코프를 좁혔고(§D "(A) 문장을 고친다... (B)는 별 배치"), 이 spec 문서군은 손대지 않는다.
  - 제안: 새 식별자 충돌은 아니므로 이번 target 을 막을 사유는 아니다. 다만 §D 가 예고한 (B) "엔진이 전용 코드를 방출하게 한다" 작업을 착수하는 사람은, 그 신규 코드에 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 이름을 그대로 재사용할지(이미 7개 spec 파일과 사용자에게 그 이름으로 노출돼 있음) 아니면 새 이름을 신설할지를 `error-codes.md` §2(rename=breaking) 정책에 비추어 먼저 판단해야 한다 — 지금 이름을 그대로 승격하면 §1 "의미 기반 명명" 검토 없이 예외 레지스트리(§3) 후보가 될 수 있다는 점을 후속 plan 에 남겨 둘 가치가 있다.

- **[INFO]** `ACTION_ROW` 신규 등재는 기존 `GUIDE_EXTERNAL_VOCABULARY` 항목과 충돌하지 않는다
  - target 신규 식별자: `ACTION_ROW` 를 `GUIDE_EXTERNAL_VOCABULARY` 에 추가 (plan §C, 존재 축 규약대로)
  - 기존 사용처: `codebase/backend/src/modules/chat-channel/providers/discord/*`(주석·테스트명), `spec/4-nodes/7-trigger/providers/discord.md`, `codebase/frontend/src/content/docs/06-integrations-and-config/discord{,.en}.mdx` — 전부 Discord Message Components 타입 이름으로 동일 의미로만 쓰인다.
  - 상세: grep 결과 `ACTION_ROW` 는 저장소 전역에서 항상 Discord 어휘로만 쓰이고(주석·테스트 설명·spec 서술), 우리 쪽 `ErrorCode`/`EngineErrorCode`/`AUDIT_ACTIONS` 등 어떤 내부 카탈로그에도 없다. `GUIDE_EXTERNAL_VOCABULARY` 4강제("기준집합에 없을 것") 를 만족한다. 현재 배열 길이 1 + `ACTION_ROW` 추가 시 2 로, `EXTERNAL_VOCABULARY_CAP = 5`(`guide-identifier-existence.test.ts:15`) 이내다.
  - 제안: 없음 — 등재해도 무방.

## 요약

target 이 실제로 새로 붙이는 이름은 `GUIDE_NON_EMITTED_VOCABULARY` 하나이며, 저장소 전수 grep 상 기존 사용처와 실질 충돌은 없다(0건). `ACTION_ROW` 를 `GUIDE_EXTERNAL_VOCABULARY` 에 추가하는 것도 기존 어휘와 의미가 일관돼 안전하다. 유일한 주의점은 새 목록이 기존 `GUIDE_EXTERNAL_VOCABULARY` 와 이름이 한 토큰 차이인데 제약이 정반대라는 점 — 이는 target 문서가 스스로 정확히 진단하고 대조표까지 만들어 뒀으므로, 실제 구현 시 그 근거를 코드 JSDoc 으로 이식하기만 하면 된다. `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 둘러싼 spec-vs-실체 drift 는 실재하지만 이번 target 이 만든 것도, 이번 target 이 건드리는 범위도 아니다(guide 문장만 정정, 코드/spec 은 불변). 종합하면 이번 target 이 도입하는 신규 식별자 표면은 매우 좁고, CRITICAL/WARNING 급 충돌은 발견되지 않았다.

## 위험도

LOW
