# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `triggers.service.ts` — `TRIGGER_RESPONSE_STRIP_COLUMNS`(엔티티 컬럼 스트립 목록)를 설명하는 JSDoc 블록이 그 대상 선언에서 다시 분리됐다. 이 PR 자신이 이미 4번 지적·수정한 것과 **동일한 패턴의 5번째 재발**이며, 이번 회차의 마지막 커밋에서 새로 만들어져 아직 미조치 상태다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:79-93`(`응답에서 제거할 **엔티티 컬럼**...` JSDoc 블록 전체), 그 직후 `:94-108`(`config.interaction` 에서 제거할 키... JSDoc 블록), `:109`(`const INTERACTION_RESPONSE_STRIP_KEYS = ...`), `:111-114`(`const TRIGGER_RESPONSE_STRIP_COLUMNS = [...]`, 사이에 JSDoc 없음).
  - 상세: `git blame` 으로 확인 — `:79-93` 블록(TRIGGER_RESPONSE_STRIP_COLUMNS 를 설명하는 내용: "왜 `select: false` 가 아닌가" 등)은 커밋 `dfb2664af9`(18:22:55)가 그 상수 바로 위에 썼다. 그런데 이번 리뷰 대상 diff 에 포함된 마지막 커밋 `66a2510fd9`(22:48:31, "§1.1 이 세 필드를 열거했는데 둘만 닫았다 — triggerToken 스트립")가 `INTERACTION_RESPONSE_STRIP_KEYS` 상수와 그 자신의 JSDoc(:94-108)을 **기존 JSDoc 블록과 그 대상 선언 사이**에 끼워 넣으면서, 기존 블록을 대상과 함께 옮기지 않았다. 결과: (1) `:79-93` 블록은 코드가 아니라 또 다른 JSDoc 블록(`:94-108`) 바로 위에 놓여 어떤 선언에도 귀속되지 않는 "떠 있는" 주석이 됐고 — TypeDoc 류 도구는 이를 인식하지 못한다. 사람이 읽어도 "엔티티 컬럼···세 곳에 산다" 설명 직후 뜬금없이 `config.interaction` 얘기가 나와 두 서사가 뒤섞인 것처럼 읽힌다. (2) 정작 `TRIGGER_RESPONSE_STRIP_COLUMNS`(:111-114)는 이제 **어떤 JSDoc 도 없이** 선언돼, "왜 `select: false` 가 아닌가"·"세 곳에 같은 등급 비밀이 산다" 같은 핵심 배경 설명을 그 상수를 직접 보는 사람이 잃는다. 이 PR 의 RESOLUTION 이력(`review/code/2026/09/05/22_24_58/RESOLUTION.md` "W3 — 같은 실수를 네 번 했다": "다음에 선언을 삽입할 때 위에 붙은 주석이 누구 것인지 먼저 보는 습관으로 옮긴다")이 이 정확한 실수를 4번 지적·시인·재발방지 다짐까지 한 뒤, 바로 다음 커밋에서 그 다짐이 지켜지지 않은 사례라 문서 위생의 구조적 재발 패턴으로 본다(기능 영향 없음).
  - 제안: `:79-93` JSDoc 블록을 `TRIGGER_RESPONSE_STRIP_COLUMNS` 선언(:111) 바로 위로 옮긴다. `INTERACTION_RESPONSE_STRIP_KEYS` 는 자신의 JSDoc(:94-108)만 바로 위에 남긴다.

- **[WARNING]** `plan/in-progress/spec-draft-nullable-notation-followups.md` — "23필드 선언이 §5.4 금지 조합이었다"는 서술이 같은 세션 자신의 consistency 리뷰 산출물과 불일치한다. 실제로 금지 조합(`@ApiPropertyOptional({nullable:true})` + `field?: T|null`)이었던 것은 23개 중 **17개**뿐이다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:420`("위 배선과 함께 넣은 **23필드 선언이 §5.4 금지 조합**(`@ApiPropertyOptional` + `nullable: true`)이었다.")
  - 상세: 같은 스윕에서 새로 선언된 23필드(`TriggerDto` 7 · `IntegrationDto` 6 · `KnowledgeBaseDto` 7 · `AlertRuleDto` 2 · `ScheduleDto` 1)는 두 갈래로 나뉜다 — (a) `review/consistency/2026/09/05/18_23_03/rationale_continuity.md` Critical 1 이 지목한 **17개**(5+5+4+2+1)는 문자 그대로 §5.4 가 응답 바디에서 금지하는 `Optional+nullable` 조합이었고, (b) 같은 라운드 WARNING 1(`review/code/2026/09/05/18_23_02/RESOLUTION.md` "6필드가 '항상 존재 + non-null' 인데 `@ApiPropertyOptional()` — 제3의 과소선언")이 지목한 **6개**(`chatChannelHealth`·`notificationHealth`·`documentCount`·`rerankMode`·`rerankCandidateK` 등)는 `nullable:true` 가 아예 없는 별개의 "과소 선언" 문제였다. `rationale_continuity.md:52-55` 는 이 6개를 "이쪽은 §5.4 의 '금지 조합'은 아니지만 항상 존재하는 필드를 선택적으로 과소 선언한 것" 이라고 **명시적으로 구별**한다. 즉 `17+6=23` 이지 "23필드 전부가 금지 조합"이 아니다. 이 plan 문서 자체가 인접 단락에서 이 사건을 "스윕 1차의 자기 반박" 이라는 제목으로 상세히 정리하며 향후 유사 재발을 막으려는 취지로 적은 자리라, 그 취지에 비춰 숫자의 정확성이 특히 중요한데 정작 그 숫자가 부정확하다.
  - 제안: "23필드 선언이 §5.4 금지 조합이었다" → "23필드 중 17개가 §5.4 금지 조합이었고(나머지 6개는 별도의 과소 선언 위반), 둘 다 같은 배치에서 정정했다" 식으로 두 갈래를 구별해 정정한다.

- **[INFO]** `triggers.service.spec.ts` — 새로 추가된 두 개의 JSDoc 블록이 연달아 붙어 있고, 첫 블록("응답 정화 회귀 — e2e 만이 이 결함을 물던 상태였다")이 서술하는 내용은 사실 바로 다음 세 개의 `it()`(생략 필드 유지 / secret 스트립 / 조기 return 회귀) 전체에 대한 도입부인데, 정작 그 사이에 끼어든 두 번째 JSDoc("생략된 필드가 지워지지 않는다")이 그중 첫 번째 `it()` 만의 설명이라 두 블록의 소속 범위가 헷갈린다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:191-197`(첫 블록, "응답 정화 회귀…") 바로 뒤 `:198-206`(둘째 블록, "생략된 필드가 지워지지 않는다…") 그리고 `it('PATCH 에서 생략된 필드는 로드된 값을 유지한다', ...)`.
  - 상세: 첫 블록의 내용(비밀 필드가 fixture 에 없어 스트립을 되돌려도 그린이었다)은 아래 세 테스트 중 두 번째·세 번째("응답에서 회전 secret 컬럼과…", "chat-channel 이 아닌 트리거도…")의 배경이지, 바로 다음에 오는 "PATCH 에서 생략된 필드는…" 테스트(별개 결함 — `Object.assign` undefined 덮어쓰기)의 배경이 아니다. 두 서사가 코드상 인접해 있어 사람이 위에서 아래로 읽을 때 첫 블록이 마치 바로 다음 테스트의 배경인 것처럼 오독될 수 있다. 테스트 전용 파일이라 TypeDoc 등 문서 생성 도구의 영향은 없고 기능에도 영향이 없어, 위 프로덕션 코드 사례보다 심각도는 낮다.
  - 제안: 첫 블록을 세 `it()` 전체를 묶는 `describe()` 를 신설해 그 안에 옮기거나, 최소한 첫 블록과 둘째 블록 사이에 어느 테스트들이 첫 블록의 배경인지 한 줄을 보태 범위를 명시한다.

## 요약

이번 diff 는 §5.4 응답-계약 검증자 배선 확대(4→18 DTO), 트리거 회전 secret 유출 수정(2경로), 5개 DTO 23필드 선언 보정, `allowMissing`/`contractForDto` 메모이제이션 신설로 구성된 대규모 교정 PR 이며, 이미 4라운드의 code/consistency 리뷰를 거치며 다수의 문서화 결함(오래된 함수명 인용, JSDoc-선언 분리, CHANGELOG 수치 오차, enum 미선언 등)이 실제로 정정된 이력이 `git blame`·이전 RESOLUTION 파일 대조로 확인된다. CHANGELOG 의 "78건"(`EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열 길이 실측 일치)·"23필드"(DTO별 필드 표 합계 일치) 등 정량 서술도 코드와 대조해 정확함을 확인했다. 다만 이번 마지막 커밋(`66a2510fd9`, 22:48:31)이 `triggers.service.ts` 에 이 PR 이 이미 4번 지적하고 재발 방지를 다짐한 것과 정확히 같은 종류의 JSDoc-선언 분리 결함을 5번째로 다시 만들었고, `plan/` 트래커의 "23필드 전부가 금지 조합" 서술이 같은 세션 자신의 consistency 리뷰가 명시적으로 갈라놓은 17 vs 6 구분을 뭉갠 채 남아 있다. 둘 다 기능 영향은 없는 순수 문서 정합성 문제이며 병합을 막을 사안은 아니나, 전자는 반복 패턴이 다섯 번째로 재현된 것이라 리뷰-fix 루프의 구조적 맹점으로 특히 주목할 가치가 있다.

## 위험도

LOW
