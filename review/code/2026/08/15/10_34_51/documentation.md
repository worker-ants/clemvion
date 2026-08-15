STATUS=success

===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (3차 라운드)

## 방법론 노트

이 세션은 이미 두 차례 ai-review(`09_58_24`, `10_18_38`)와 두 차례 consistency-check(`08_45_50`,
`09_00_27`, `09_58_31`)를 거쳤고, 각 라운드의 CRITICAL/WARNING 은 RESOLUTION.md 로 조치·정리돼
있다. 직전 문서화 라운드(`10_18_38`)가 지적한 두 건(옛 SQL 을 설명하는 stale 주석, plan 트래커
수치 불일치 4 vs 5)은 현재 소스에서 **모두 정정 확인**했다 — `grep -rn "GREATEST(0" codebase/`
결과 프로덕션 코드에는 남아 있지 않고(`terminal-duration.ts` 의 "종전엔" 과거 서술과 `.spec.ts`
의 부정 단언만 존재), `spec-draft-eia-notification-payload-contract.md:188` 도 "4곳"으로 정정됐다.

프롬프트 번들에서 diff 가 생략된 파일(`execution-engine.service.ts`, `execution-engine.service.spec.ts`,
`spec/5-system/14-external-interaction-api.md`)은 `git diff origin/main -- <path>` 로 직접
대조했고, `driveCallStackResume` 관련 W1(직전 라운드가 놓친 6번째~9번째 계산부)의 실제 정정
여부도 소스에서 확인했다(정정 완료 확인).

## 발견사항

- **[WARNING]** 이 PR 이 spec §6.5 에 새 blockquote 콜아웃을 끼워 넣으면서, **`durationMs` 와
  무관한 기존 문장**(`cancelledBy`/`error.code` 계약 위임 disclaimer)을 그 콜아웃 안으로
  말려들게 하고 blockquote 마커(`>`)도 마지막 두 줄에서 누락시켰다
  - 위치: `spec/5-system/14-external-interaction-api.md:806-814` (§6.5, `### 6.5 페이로드 —
    execution.cancelled / execution.ai_message` 직후). `Read` 로 직접 확인한 실제 파일
    줄 번호이며, 프롬프트 diff 는 이 파일에 대해 크기 제한으로 생략됨.
  - 상세: `git diff origin/main -- spec/5-system/14-external-interaction-api.md` 로 대조한 결과,
    origin/main 에서는 다음이 **독립된 일반 문단**이었다:
    ```
    `execution.cancelled` 는 §6.3 의 `payload` 자리에 `status` + `result.cancelledBy` 를 싣고,
    시스템 취소면 `error` 가 동행한다. **`cancelledBy` 의 닫힌 union·`error.code` 매핑·
    user cancel 의 `error` 부재는 [행동 계약](#executioncancelled-의-행동-계약-normative)이
    소유한다** — 여기 다시 적지 않는다.
    ```
    이번 PR 은 `durationMs` 설명을 위해 `>` blockquote 두 문단을 새로 끼워 넣었는데, **그
    두 번째 blockquote 문단의 마지막 줄에 위 기존 문장의 앞부분("`**cancelledBy` 의 닫힌
    union·`error.code` 매핑·")을 이어 붙였다.** 그런데 그 문장의 나머지 두 줄(813~814행,
    "user cancel 의 `error` 부재는 … 소유한다\*\* — 여기 다시 적지 않는다.")은 `>` 접두사 없이
    그대로 남아 있다. CommonMark 의 lazy-continuation 규칙상 이 두 줄은 (빈 줄로 끊기지
    않는 한) 여전히 앞 blockquote 문단에 흡수되어 렌더링되므로, 결과적으로 "`durationMs`
    (2026-08-15 구현)" 콜아웃 박스 안에 **durationMs 와 무관한 `cancelledBy`/`error.code`
    계약-소유 disclaimer 가 함께 들어가 버린다**. 이 disclaimer 는 원래 `execution.cancelled`
    섹션 전체에 적용되는 일반 진술이었는데, 지금은 "durationMs 콜아웃의 일부"처럼 읽혀
    범위가 좁아져 보인다. 이 파일 자신이 "normative"·"SoT" 경계를 엄격히 구분하는 스타일을
    표방하는 문서라(예: 같은 절 바로 아래 `[행동 계약](#...)` 링크로 소유권을 명시적으로
    위임) 이런 우발적 병합은 다음 편집자가 "이 disclaimer 는 durationMs 콜아웃 전용이니
    durationMs 관련 편집 시에만 손대면 된다"고 오판해, `cancelledBy`/`error.code` 계약이
    바뀔 때 이 disclaimer 를 놓칠 위험을 만든다.
  - 제안: `>` blockquote 를 `EXECUTION_QUEUE_WAIT_TIMEOUT` 설명에서 끝내고(812행을
    "…여기 명시한다."로 마무리), 빈 줄로 blockquote 를 닫은 뒤 `**cancelledBy` 의 닫힌
    union·… 소유한다\*\* — 여기 다시 적지 않는다."` 문장은 원래대로 **독립 문단**으로 복원한다.

- **[INFO]** `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스 앞에 동일한
  5줄 주석("producer 는 항상 이 키를 싣고 …" / "그런데 `?` 는 유지한다 …")이 글자 그대로
  3중 복제돼 있다
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:392-396`, `:415-419`, `:433-437`
    (프롬프트 diff 게이트 기준)
  - 상세: 세 곳의 근거·문구가 완전히 동일해 지금 당장 drift 는 없지만, 다음에 이 계약이
    바뀌는 편집(예: 필수화 재검토, 부재 표현 변경)이 있을 때 세 곳 중 한두 곳만 고치고
    나머지를 놓치는 형태는 이 PR 자신이 코드 레벨에서 이미 두 차례 겪은 패턴이다
    (`driveCallStackResume` 누락, dispatcher 캐스트 3곳 중 일부 누락). maintainability 리뷰가
    이미 같은 지점을 DRY 관점에서 지적했다(`review/code/2026/08/15/10_18_38/maintainability.md`)
    — 여기서는 "주석 정확성 유지 비용"이라는 별도 각도로 같은 지점을 재확인한다.
  - 제안: 강제 조치 아님(3라운드 리뷰를 거친 안정적 상태). 한 곳(예: `EiaCompletedEvent`)에
    canonical 설명을 두고 나머지 둘은 `retry-turn.service.ts:893` 이 이미 쓴 "짧은 문장 + 정본
    참조" 패턴으로 축약하면 drift 표면이 1곳으로 준다.

- **[INFO]** REST `GET /api/external/executions/:executionId` 응답 스키마(§5.3)에 `durationMs`
  부재가 그 자리에서 자체 문서화돼 있지 않다 — CHANGELOG·plan 트래커에만 있다
  - 위치: `spec/5-system/14-external-interaction-api.md:454-473` (§5.3 JSON 예제 블록,
    `result`/`error` 필드 직후)
  - 상세: 이 문서는 다른 gap 을 항상 **그 자리에서** 인라인 주석으로 표기하는 컨벤션을 쓴다
    (예: §6.3 JSON 예제의 `// result.outputs — Planned`). 반면 `durationMs` 가 REST 단발
    조회에는 아직 없다는 사실은 CHANGELOG(`- **REST GET /api/external/executions/:id 에는
    아직 없다**…`)와 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(W4 항목)
    에만 등재돼 있고, §5.3 JSON 예제 자체에는 그 비대칭을 알리는 주석이 없다. 이미 RESOLUTION
    (`review/code/2026/08/15/09_58_24/RESOLUTION.md`)이 "CHANGELOG 에 고지하고 트래커 등재"로
    의도적으로 처리 범위를 좁힌 결정이라 재차단 사유는 아니다.
  - 제안: §5.3 JSON 예제의 `"result": { ... } | null,` 줄 근처에 `// durationMs 는 아직 없음 —
    §6 필드 집합 표 참조` 한 줄을 추가하면, 이 문서의 기존 self-documenting 관례와 일관되고
    다음 사람이 REST 응답을 보다가 "durationMs 가 왜 없지?" 라고 놀랄 확률을 줄인다.

## 그 외 확인 결과 (문제 없음)

- **CHANGELOG**: 새 항목이 직전 항목의 예고를 정확히 이어받고, breaking 성격이 아님(필드
  추가만)을 명시하며 `null` 방어 필요성과 REST 비대칭을 함께 고지한다.
- **JSDoc 품질**: `terminal-duration.ts` 의 `resolveTerminalDurationMs`/`toFiniteNumber`/
  `TERMINAL_DURATION_MS_SQL` 모두 "왜"를 근거(실측 회귀, int4 상한, 음수 sentinel 통일)와
  함께 설명하는 상세 JSDoc 을 갖췄고 `@returns`/`{@link}` 상호 참조도 정확하다.
  `TERMINAL_DURATION_MS_SQL` 의 클램프 값 `2147483647` 은 SQL 문자열 리터럴 안에 있어 이름이
  바로 안 보이지만, 바로 위 JSDoc 이 근거(`V001__initial_schema.sql:223`)를 링크하고 있어
  실질 위험은 낮다(이미 maintainability 리뷰가 INFO 로 확인).
  `finalizeStalledExhausted` 호출부(`execution-engine.service.ts:3352` 부근)의 인라인 주석은
  이제 "int4 상한은 saturate — 근거는 헬퍼 JSDoc 참조"로 현재 SQL 동작과 일치한다(직전
  라운드 WARNING 정정 확인).
- **인라인 주석**: `if (lastNodeId)` 블록 밖으로 옮긴 `finishedAt`/`durationMs` 계산부 전체
  (completed 6곳 모두 확인)에 "왜 조건 밖인가"(이 PR 이 실제로 겪은 회귀) 설명이 붙어 있다.
  `markQueueWaitTimeout` 의 "이 경로의 durationMs 는 큐 대기 시간" 주석도 §6.5 spec 설명과
  정확히 일치한다.
  `retry-turn.service.ts:893` 의 "조건 밖 — outputData 만 마지막 노드에 의존한다 (engine 과
  동일 처방)" 짧은 주석은 engine 쪽 반복 설명을 정본 참조로 축약한 좋은 예다.
  `chat-channel/chat-channel.dispatcher.ts` 의 세 캐스트(534/572/589)는 `types.ts` 가 넓힌
  `number | null` 계약과 이제 일치한다(직전 라운드 W8 정정 확인).
- **CHANGELOG/spec/plan 3중 동기화**: `CHANGELOG.md`, `spec/5-system/14-external-interaction-api.md`
  §6 표·§6.3/§6.4/§6.5, `spec/conventions/chat-channel-adapter.md`, `plan/in-progress/
  eia-terminal-payload.md`(재판정 ④), `plan/in-progress/spec-draft-eia-notification-payload-contract.md`,
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 가 모두 같은 숫자("취소 경로
  4곳", "종결 16 경로")로 일관된다. "Planned" 캐비엇도 삭제 대신 취소선+"(해소)"로 보존해
  이 저장소 컨벤션(왜 한동안 비어 있었는지 이력 보존)을 따랐다.
- **예제 코드**: §6.3/§6.4 JSON 예제에 `"durationMs": 4242` 가 정확히 반영됐고 실제로
  `json.loads` 로 파싱 가능함을 직전 라운드가 검증했다(trailing comma 재발 없음, 현재
  소스 재확인).
- **README/설정 문서**: 이번 diff 는 신규 환경변수·설정 옵션·CLI 플래그를 추가하지 않는다
  (신규 함수는 순수 계산 헬퍼, 신규 상수는 SQL 문자열/파라미터명뿐). README 갱신 불필요 —
  다른 8명의 이 세션 리뷰어(`user_guide_sync` 포함)도 동일 결론.

## 요약

이 PR 은 세 차례 리뷰·조치 라운드를 거치며 문서화 수준이 이미 이 저장소 기준 상당히
높아진 상태다 — CHANGELOG·spec 3개 파일·convention 문서·plan 트래커 3개가 숫자까지
일관되게 동기화됐고, 직전 라운드가 지적한 stale 주석·수치 불일치도 모두 정정 확인했다.
이번 라운드에서 새로 발견한 것은 spec §6.5 에 `durationMs` 콜아웃을 끼워 넣는 과정에서
**`durationMs` 와 무관한 기존 disclaimer 문장이 그 콜아웃 blockquote 안으로 우발적으로
흡수**된 markdown 병합 결함(WARNING) 하나다 — origin/main 대조로 이 PR 이 만든 것임을
확인했다. 그 외에는 타입 주석 3중 복제(INFO, 이미 maintainability 가 확인한 지점의
문서 각도 재확인)와 REST 비대칭을 §5.3 JSON 예제 자리에서도 self-documenting 하면
더 좋겠다는 제안(INFO) 뿐이다.

## 위험도

LOW
