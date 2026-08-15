STATUS=success

===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (4차 라운드, `10_52_08`)

## 방법론 노트

이 PR 은 이미 3회의 ai-review 라운드(`09_58_24`→`10_18_38`→`10_34_51`, 각각 CRITICAL/WARNING
다수를 조치)와 3회의 consistency-check 라운드(`08_45_50`→`09_00_27`→`09_58_31`, `--impl-done`
BLOCK: NO 확보)를 거쳤고, 그 산출물 전체가 이번 diff 에 함께 포함돼 있다. 프롬프트 번들이 크기
제한으로 생략한 파일(특히 `execution-engine.service.ts`/`.spec.ts` 전체, `spec/5-system/
14-external-interaction-api.md` 전체)은 `Read`/`Bash`(`grep`)로 저장소를 직접 열어 아래 사실
주장들을 실측 대조했다:

- `terminal-duration.ts` JSDoc 의 "`emitCancellationEvent` 호출부 4곳은 계산·영속을 안 한다" →
  실제 호출부 5곳(`execution-engine.service.ts:1077,1208,2858,2907,4884`) 중 raw UPDATE 기반
  4곳(`cancelParkedExecution`·`markWebChatIdleTimeout`·`markExecutionCancelled`·
  `markQueueWaitTimeout`)만 해당하고 `finalizeCancelledExecution`(:4884)은 엔티티 기로드라
  제외됨을 확인 — **정확**.
- `TERMINAL_DURATION_MS_SQL` 사용처 5곳(1036/1171/2828/2899/3352행) — CHANGELOG·spec §6.5 가
  말하는 "5경로" 와 **정확히 일치**.
- `spec/5-system/14-external-interaction-api.md` §6.3/§6.4 JSON 예시(`durationMs` 뒤 콤마 오류,
  9_58_31 라운드가 지적) — 직전 10_18_38 라운드가 실제 파싱으로 재확인한 수정이 현재도 유지됨
  (:758, :779, 마지막 프로퍼티라 트레일링 콤마 불필요·이전 프로퍼티는 콤마 보유 — 구문 정상).
- CHANGELOG 의 "REST `GET /api/external/executions/:id` 에는 아직 없다" — 해당 컨트롤러/DTO
  전수 grep 결과 `durationMs` 미등장, 주장과 실제 코드 일치.

위 항목들은 이미 여러 라운드에 걸쳐 검증·수정된 상태라 재차단 사유가 아니다. 아래는 이번
라운드에서 **아직 미해결**로 확인된 순수 신규 발견(INFO 3건)이다 — CRITICAL/WARNING 은 없다.

## 발견사항

- **[INFO]** `plan/in-progress/eia-terminal-payload.md` §"차단 해제 조건" 이 이미 해소된 BLOCK
  상태를 여전히 현재형으로 서술 — 위→아래로 읽으면 오독 위험
  - 위치: `plan/in-progress/eia-terminal-payload.md:275-281` (실제 파일 줄 번호, `Read` 로 직접
    확인 — 이 파일은 diff 가 프롬프트 번들에 실리지 않았다)
  - 상세: "이 plan 의 `--impl-prep` BLOCK: YES 를 실제로 푸는 것은
    [`spec-draft-eia-62-waiting-payload.md`]... 그쪽이 spec 에 반영돼야 여기가 진행된다" 라고
    현재형으로 적혀 있는데, 바로 아래 `## 체크리스트`(:296 이하)는 "**planner 턴 완료**
    (`4b13ca5ae`) ... **이 plan 의 차단이 풀렸다**" 라고 이미 명시한다. 같은 이슈를 직전
    consistency 라운드(`review/consistency/2026/08/15/09_00_27/plan_coherence.md` INFO 2번)가
    이미 지적하며 "다음 편집 때 '차단 해제 조건' 절 머리에 '(해소됨 — 아래 체크리스트 참조)'
    한 줄만 추가해도 충분하다. 급하지 않음" 이라 처분했으나, 이번 diff 시점까지도 그 한 줄이
    아직 반영되지 않았다.
  - 제안: 이미 나와 있는 제안(한 줄 캐비엇 추가)을 이번 라운드에 반영. 급하지 않음(비차단).

- **[INFO]** `types.ts` 의 `durationMs` 설명 주석이 3개 인터페이스에 글자 그대로 3중 복제 —
  drift 위험
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:392-396`(`EiaCompletedEvent`),
    `:415-419`(`EiaFailedEvent`), `:433-437`(`EiaCancelledEvent`)
  - 상세: "EIA §6 — producer 는 **항상** 이 키를 싣고, 값을 모르면 `null` 이다. **그런데 `?` 는
    유지한다**... (`09_58_31` cross_spec W1 — 미채택)." 5줄 블록이 세 필드 선언 앞에 문자
    그대로 반복된다. `maintainability.md`(`10_18_38` 라운드) 가 이미 코드-중복 관점에서 같은
    지점을 INFO 로 지적했는데, 문서화 관점에서 보면 리스크가 조금 다르다 — 이 주석은 미래
    편집자가 세 곳 중 한 곳만 갱신하고 나머지 둘을 stale 로 남길 drift 표면이다. 같은 diff 안의
    `retry-turn.service.ts:893`(`// 조건 밖 — ... (engine 과 동일 처방)`)이 이미 "짧은 문장 +
    정본 포인터" 패턴을 쓰고 있어 사내 선례가 있다.
  - 제안: 세 곳 중 한 곳(예: `EiaCompletedEvent`)에 canonical 설명을 두고 나머지 둘은
    `// EIA §6 — durationMs 계약: <canonical 위치> 참조` 형태의 짧은 포인터로 축약. 강제
    아님(이미 유사 권고가 유지보수성 리뷰에 있음 — 재차단 사유 아님).

- **[INFO]** `durationMs` 변경을 "breaking" 으로 부르는 코드 주석이, CHANGELOG 본문이 스스로
  선언한 성격("제거·변경 아님")과 어긋난다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:372-373`
    (`// durationMs wire 변환 (2026-08-15). CHANGELOG 가 breaking 으로 고지한 계약인데...`)
    vs `CHANGELOG.md:17`(`**수신자 영향**: 종결 3종 payload 에 필드가 하나 늘었다(**제거·변경
    아님**). 기존 파서는 무시하면 되고, 값을 읽을 때 `null` 을 방어해야 한다.`)
  - 상세: 테스트 주석과 `review/code/2026/08/15/10_34_51/RESOLUTION.md` W4 는 이 변경을
    "CHANGELOG 가 breaking 으로 고지한 계약"이라고 서술하는데, 정작 CHANGELOG 자신은 이
    필드 추가를 명시적으로 **비파괴적**(필드 추가일 뿐 제거·변경 아님, 파서는 무시하면 됨)이라고
    적는다. 실무 영향은 낮지만("null 방어 필요"라는 실질 요구사항 자체는 두 서술 모두 동일),
    "breaking" 이라는 단어를 나중에 grep 해서 호환성 영향을 조사하는 사람에게는 CHANGELOG 의
    실제 문구와 코드 주석의 성격 규정이 서로 다른 신호를 준다. (바로 아래 있는 별개의 CHANGELOG
    항목 — `error` 를 string→object 로 일원화한 변경 — 이 오히려 "breaking" 성격에 더 가깝다.)
  - 제안: 테스트 주석/RESOLUTION 표현을 "CHANGELOG 가 **null 방어가 필요한 계약**으로 고지"
    정도로 CHANGELOG 본문 문구와 맞추거나, 반대로 CHANGELOG 쪽에 "narrow" 하게라도
    "consumer 는 `durationMs` 를 다룰 때 `null` 을 항상 가정해야 한다" 는 요구사항이 사실상
    호환성 계약 강화(=넓은 의미의 breaking)임을 한 문구로 인정하는 절충도 가능. 강제 아님.

## 그 외 확인 결과 (문제 없음으로 판정, 기록 목적)

- `spec/conventions/chat-channel-adapter.md`(:149-151, :159-161), `spec/3-workflow-editor/
  3-execution.md`(:308-309) — consistency SUMMARY(`09_58_31`) WARNING #1·#2 가 요구한
  nullable 타입 정정·자매 트래커 동기화가 이번 diff 안에 이미 반영돼 있음을 확인.
- `plan/in-progress/spec-draft-eia-notification-payload-contract.md` — 표 행(`durationMs` →
  구현됨)과 체크리스트가 `result.outputs` 와 분리되어 정확히 갱신됨. `spec_impact`
  frontmatter 도 `spec/data-flow/3-execution.md` 를 포함하도록 이미 확장돼 있음(직전
  plan_coherence 라운드 WARNING 해소 확인).
- `terminal-duration.ts`/`terminal-duration.spec.ts` — JSDoc 이 (a) 헬퍼 존재 이유
  (16 emit 경로, 계산 출처가 갈림), (b) `startedAt` 미신뢰 이유(실제 겪은 회귀), (c) `null`
  vs `undefined` 선택 근거, (d) SQL 클램프·sentinel 근거를 모두 코드 옆에 직접 남기고 있어
  독스트링 품질이 이 저장소 평균 대비 높음. 인용된 수치(4곳/5경로)는 위 방법론 노트에서
  실측 검증됨.
- CHANGELOG 항목 자체 — 왜 필요했는지(직전 항목의 예고), 무엇이 바뀌는지(3종 전부),
  수신자가 뭘 해야 하는지(null 방어), 알려진 잔여 갭(REST 비대칭)까지 갖춘 좋은 형태.

## 요약

이 PR 은 이미 여러 라운드의 리뷰·consistency-check 를 거치며 문서화 결함 대부분(§6.3/§6.4 JSON
콤마 오류, nullable 타입 spec-코드 drift, 자매 트래커 미동기화, spec Planned→구현됨 전환 시
"해소" 형태 보존 등)을 스스로 잡아 고쳤고, 이번 라운드에서 실측 검증한 JSDoc·CHANGELOG 의 구체적
수치 주장들(경로 개수, REST 비대칭)도 실제 코드와 정확히 일치했다. 남은 것은 순수 INFO 3건 —
(1) plan 문서의 "차단 해제 조건" 절이 아래 체크리스트와 모순되는 현재형 서술로 아직 남아 있고
(이미 이전 라운드가 지적·비차단 처분), (2) `types.ts` 의 동일 설명 주석이 3개 인터페이스에
글자 그대로 복제돼 향후 drift 위험이 있으며, (3) `durationMs` 변경의 "breaking" 성격 규정이
테스트 주석/RESOLUTION 과 CHANGELOG 본문 사이에서 미묘하게 어긋난다. 셋 다 기능에 영향이
없고 이미 알려진(또는 사소한) 사안이라 머지를 막을 사유는 아니다.

## 위험도

LOW
