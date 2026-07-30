# 문서화(Documentation) 리뷰 — retry_last_turn 2차 원자 claim (`RetryTurnService`)

대상 파일: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`,
`retry-turn.service.spec.ts`. 이 영역은 이미 6차(`review/code/2026/07/28/20_32_57`)·7차
(`review/code/2026/07/30/11_41_20`) 라운드에서 전담 documentation reviewer 가 검토했고,
그때 지적된 WARNING(①`claimSpawnedRetryRow` JSDoc 내부 자기모순, ②`runAiConversationLoop`
stale 참조 2곳, ③spec SoT 문구 stale)은 모두 코드/spec 대조 결과 **정확히 해소됨을 확인했다**
(commit `7a05c6ec8`, spec commit `025aedd0f`). 아래는 그 위에서 남아 있거나 이번에 새로 발견한
항목만 적는다.

## 발견사항

- **[WARNING]** claim 순서 불변식의 핵심 논거(~9줄)가 호출부 인라인 주석과
  `claimSpawnedRetryRow` JSDoc 두 곳에 거의 축약 없이 중복 서술돼 있어 drift 위험이 있음.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:322`-`330`
    (`applyRetryLastTurn` 내 호출 직전 인라인 주석) vs `:507`-`518`
    (`claimSpawnedRetryRow` JSDoc 본문)
  - 상세: 두 곳 모두 "claim 은 `_retryState` 부재→손상 판정보다 반드시 먼저 실행돼야 한다 —
    지우는 유일한 경로가 이 claim 자신이므로 값이 없다는 것은 100% 다른/이전 delivery 가
    이미 가져갔다는 뜻이지 손상이 아니다 — 예전엔 판정이 claim 뒤에 있어 살아있는 row 를
    오판했고, 진짜 동시성 없이도 BullMQ 기본 재시도(claim 성공 후 try 진입 전 구간의 일시
    예외 → 재배달 → fresh 조회가 이미 지워진 값을 관측)만으로 결정적으로 재현됐다"는
    동일 논증을 문장 단위로 거의 그대로 반복한다. 322행 주석은 "상세 근거·백스톱 갭은
    JSDoc 참조" 라며 세부는 위임하는 것처럼 적어 놓았지만, 정작 핵심 논거 자체는 이미
    전문을 복제해 놓아 그 위임이 실질적으로 무의미하다. 이 파일은 바로 이 클래스의 위험을
    이미 한 번 실증했다 — 7차 라운드가 고친 WARNING(“백스톱 커버리지” 문단이 `claimSpawnedRetryRow`
    JSDoc **안에서조차** 신·구 두 버전이 자기모순으로 공존)이 정확히 "같은 논거가 두 곳에
    나뉘어 있다가 한쪽만 갱신되며 어긋난" 사례였다. 현재는 두 사본이 일치하지만, 다음
    라운드가 이 불변식의 세부(예: 백스톱 갭 범위, ack-and-discard 조건)를 한쪽만 손보면
    같은 실패가 세 번째로 재발할 토대가 이미 마련돼 있다.
  - 제안: 호출부(322-330행) 주석을 "claim 은 반드시 이 손상 판정보다 먼저 실행돼야 한다 —
    상세 근거·조건·백스톱 갭은 `claimSpawnedRetryRow` JSDoc 참조" 수준의 1~2줄 pointer 로
    축약하고, 전체 논증은 `claimSpawnedRetryRow` JSDoc 한 곳(단일 진실 지점)에만 유지할 것.
    같은 파일 상단의 `RETRY_STATE_KEY` 상수가 정확히 이 논리("한쪽만 리네임되면 조용히
    drift 한다")로 도입됐으므로 그 원칙을 산문 설명에도 적용하는 편이 일관적이다.

- **[INFO]** 라운드별 축약 라벨(`W3`, `W6`)이 서로 다른 발견사항에 재사용돼 파일 내
  교차참조 시 혼동 소지가 있음.
  - 위치: `retry-turn.service.ts:371`(`INFO#4 / W3` — execution/node 조회 병렬화+zombie
    방지, 라운드 표시 없음) vs `:125`, `:279`(둘 다 `W3 정정(ai-review 7R)` —
    `runAiConversationLoop` stale 참조 정정, 서로 다른 내용); `:486`(`W6 — ai-review
    WARNING #6 helper 추출`, 라운드 표시 없음) vs `:364`, `:445`(둘 다 `W6(ai-review 7R)` —
    `NODE_STARTED` payload 비노출, 역시 다른 내용).
  - 상세: 같은 파일 안에서 `W3`/`W6` 라는 짧은 라벨이 서로 무관한 두 발견사항을 가리킨다.
    7R 이후에 추가된 인용(125/279/364/445행)은 `(ai-review 7R)` 라운드 표시를 일관되게
    붙였지만, 그보다 앞서 존재하던 인용(371/486행)은 라운드 표시가 없어 `grep -n "\bW3\b"`
    또는 `\bW6\b` 로 교차확인하면 두 세대의 라벨이 뒤섞여 나온다. 기능적 결함은 아니고
    현재는 주변 문맥으로 구분 가능하지만, 향후 "Wn" 참조를 근거로 plan/리뷰 이력을 추적할
    때 착오를 유발할 수 있다.
  - 제안: 필수는 아니나, 향후 라벨을 추가할 때 371/486행처럼 라운드 표시가 없는 기존 라벨도
    점진적으로 `(6R)`/`(7R)` 등으로 보강하면 grep 기반 교차추적이 안전해진다.

- **[INFO]** `claimSpawnedRetryRow` 에 자매 private 종결 헬퍼(`completeRetryExecution`,
  `failRetryExecution`)가 쓰는 `@internal` + "다른 경로에서 호출 금지" 태그가 없음 — 7R
  documentation 리뷰가 이미 "선택 사항"으로 제안했던 항목으로, 여전히 미반영 상태임을
  재확인.
  - 위치: `retry-turn.service.ts:485`-`537`(`claimSpawnedRetryRow` JSDoc 전체) vs
    `:698`(`completeRetryExecution` 의 `@internal`), `:911`(`failRetryExecution` 의 `@internal`)
  - 상세: `claimSpawnedRetryRow` 는 유일한 호출부(`applyRetryLastTurn`)를 가지며 그 자신의
    JSDoc 이 "반드시 손상 판정보다 먼저 호출돼야 한다"는 호출 순서 불변식을 명시할 만큼
    호출 문맥에 민감한 헬퍼인데도 `@internal` 태그가 없다. 기능적 영향은 없다.
  - 제안: 선택 사항. 태그를 추가하면 자매 헬퍼와의 문서 관례가 일관돼진다.

- **[INFO]** `CHANGELOG.md` 가 이번 원자 claim 연작(`b351731f0`/`414550a1d`/`7a05c6ec8`/
  `886ca9395`)을 반영하지 않음 — 6R·7R documentation 리뷰가 이미 지적했고 팀이 "다음
  문서-정리 턴" 으로 명시 이월한 항목(`plan/in-progress/retry-turn-terminal-guard.md:457`-`459`,
  W12)임을 재확인. 새 발견이 아니라 미해소 상태 확인.
  - 위치: `CHANGELOG.md`(루트) — "Unreleased — AI multi-turn resume turn 경계 cancel 가드 +
    park 짝 전이 lost-update 차단" 절 항목 7(`retry-turn` 종결 2경로 무가드 쓰기 차단)까지만
    반영, 이번 원자 claim 관련 커밋들은 언급 없음.
  - 상세: 이 섹션은 같은 파일(`retry-turn.service.ts`)의 이전 동시성 수정을 상세히 기록해 온
    전례가 있어 누락이 두드러진다. 다만 formal 한 CHANGELOG 갱신 강제 규약은
    `spec/conventions/` 에 없고, 팀 스스로 defer 를 명시했으므로 차단 사유는 아니다.
  - 제안: 지시대로 "문서-정리" 턴에서 일괄 반영. 우선순위 표(§코드 표)에 번호 항목으로
    승격하면(6R 당시 제안됐던 것처럼) 산문 이월 항목이 다시 유실되는 것을 막을 수 있다.

## 검토했으나 문제 없음 (재확인)

- `claimSpawnedRetryRow` JSDoc 의 "대가(트레이드오프)" 문단과 "알려진 백스톱 갭" 문단이
  이제 같은 결론("이 2차 claim 경로는 recoverStuckExecutions 백스톱이 닿지 않는다")을
  가리키도록 정정돼 있다(`:499`-`518`) — 7R WARNING #1(자기모순) 해소 확인.
- `retryLastTurn`/`applyRetryLastTurn` docstring 의 `runAiConversationLoop` 인용이 모두
  `processAiResumeTurn`/`PARK_RELEASED` re-park 서술로 정정돼 있다(`:120`-`128`,
  `:264`-`287`) — 7R WARNING #3(=6R W10) 해소 확인.
- SoT spec(`spec/5-system/4-execution-engine.md:1387`-`1393`)도 코드 JSDoc 과 동일하게
  "복구는 recoverStuckExecutions 가 담당한다"는 무조건 서술을 "이 2차 claim 경로는 그
  백스톱이 닿지 않는다"로 정정 완료(커밋 `025aedd0f`) — 7R WARNING #1(spec-drift) 해소 확인.
- `claimSpawnedRetryRow` 의 `@returns` 문서와 실제 caller(`applyRetryLastTurn`)의 소비 방식
  (claim 성공 시 `spawnedRow.inputData` 동기 delete, 실패 시 무조건 discard)이 정확히 일치.
  claim 성공+in-memory `retryState` 부재의 "이론상 도달 불가능" 방어 분기 서술(`:344`-`354`)도
  claim 의 원자성 논리와 모순 없이 정확함.
  - `retryLastTurn`(검증 순서 1-6)·`applyRetryLastTurn`(재진입 절차 1-8) JSDoc 의 번호
  목록이 실제 코드의 순서·단계와 일치.
- `retry-turn.service.spec.ts` 의 각 신규/기존 테스트 설명 주석(`(b2)`/`(b3)`/`(c)`/`(f)`/
  재배달 안전성 테스트, `W-5`~`W-7`, "종결 경로의 terminal 가드" 블록)이 실제 assertion 과
  정확히 대응하며 과장이나 누락이 없다.
- `NODE_STARTED` emit payload 에서 `_retryState` 가 빠지는 변경은 `spec/5-system/
  6-websocket-protocol.md` 의 `execution.node.started` 문서화 표 자체에 `input` 필드가
  없어(내부 필드이므로 애초에 공개 계약 대상이 아님) 별도 spec 갱신 불필요 — 기존 판정
  재확인.
- 이 모듈에는 README 관례가 없다(spec/ 가 SoT) — README 미갱신은 정상. 신규 환경변수/설정
  옵션 없음 — 설정 문서화 해당 없음. REST/WS 공개 계약(에러 코드 4종, 반환 타입) 불변 —
  API 문서 갱신 불요.

## 요약

이 영역은 이미 2회의 전담 documentation 라운드를 거쳤고, 그때 지적된 자기모순 JSDoc·
stale `runAiConversationLoop` 참조·spec SoT drift 는 모두 코드/spec 대조로 해소를 확인했다.
남은 발견은 전부 비차단 성격이다 — 가장 눈에 띄는 것은 claim 순서 불변식의 핵심 논거가
호출부 인라인 주석과 `claimSpawnedRetryRow` JSDoc 두 곳에 거의 그대로 중복돼 있는 점으로,
이 파일이 이미 한 번(자기모순 WARNING) 겪은 "분산된 동일 논거가 한쪽만 갱신되며 어긋나는"
실패 유형이 재발할 토대가 된다 — 지금은 두 사본이 일치하므로 차단 사유는 아니나 정리를
권한다. 그 외 라벨 재사용(`W3`/`W6`)·`@internal` 태그 누락·CHANGELOG 미갱신은 모두 이미
팀이 인지했거나 영향이 미미한 저비용 항목이다.

## 위험도

LOW
