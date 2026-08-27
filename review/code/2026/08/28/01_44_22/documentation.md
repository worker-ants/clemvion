# 문서화(Documentation) 리뷰

## 컨텍스트

이 diff 는 이전 리뷰 라운드(`01_26_11`, forced 7/7 · RISK=LOW)에서 나온 문서화 관련 WARNING
4건(JSDoc 낙후·자매 주석 낙후·fixture 복제·`direct` 분기 커버리지 0)이 전부
`review/code/2026/08/28/01_26_11/RESOLUTION.md` 에 따라 이미 반영된 **이후 상태**다.
`codebase/frontend/src/lib/websocket/use-execution-events.ts` 의 JSDoc·인접 주석을 직접
`Read` 로 재확인한 결과, 이전 WARNING #1(JSDoc 낙후)·#2(자매 주석 낙후)는 해소돼 있고
(`§4.1-a` 정확히 인용, `output.output.error` 정확히 서술), 테스트 파일도 `wrapNodeHandlerOutput`
빌더로 통합·제목 정정이 반영돼 있다. 아래는 그 위에서 **새로** 확인한 항목이다.

## 발견사항

- **[WARNING]** 이번과 같은 클래스의 과거 수정은 전부 `CHANGELOG.md` 에 기록해 온 저장소
  관례인데, 이번 diff 에는 CHANGELOG 항목이 없다
  - 위치: `CHANGELOG.md` (diff 에 신규 항목 없음 — 비교 대상 기존 항목: `CHANGELOG.md:485`
    "종결 `error` 를 문자열로 보내던 4곳 (EIA §6.4 object 로 일원화)")
  - 상세: `CHANGELOG.md` 는 "Unreleased" 섹션에 40건이 넘는 항목을 갖고 있고, 그중 다수가
    이번 것과 정확히 같은 형태 — *"필드 shape 을 잘못 읽고/보내고 있었고, 그 결과 어떤 경로가
    조용히 죽어 있었다. 이제 고쳐서 사용자가 보는 동작이 바뀐다"* — 를 "운영 영향" 문단과
    함께 기록한다(예: `CHANGELOG.md:485` 는 같은 `error` 필드의 shape 정정을 `execution.failed`
    이벤트에 대해 다루며 "수신자 영향 (breaking)" 을 명시한다). 이번 PR 은 `execution.node.failed`
    / `execution.node.completed` 의 `error` 파싱 결함을 고쳐 **한 번도 뜨지 않던
    `system_error` 재시도 배너가 처음으로 뜨기 시작**하는, 사용자가 직접 관측 가능한 동작
    변화다 — `review/code/2026/08/28/01_26_11/RESOLUTION.md` INFO 1 도 "관측 시 회귀로
    오인되지 않도록" 이 점을 어딘가에 명시해야 한다고 이미 지적했다. plan 문서
    (`plan/in-progress/system-error-banner-live-ws.md`)가 "왜" 를 잘 기록하고 있지만, 그
    문서는 `plan/in-progress/` → `plan/complete/` 로 이동하며 커밋 히스토리에 묻히고,
    `CHANGELOG.md` 는 릴리스/운영 담당자가 훑는 별도 표면이라 **대체가 아니라 별도로 필요한
    표면**이다. (참고: 이전 라운드 documentation 리뷰는 "새 환경변수·설정·공개 API 없음" 을
    근거로 "해당 없음" 판정했으나, `CHANGELOG.md` 의 기존 항목 다수는 신규 API/설정이 아닌
    **내부 버그 수정**이며 그 판정 기준과 배치된다 — line 485 항목이 정확한 반례.)
  - 제안: `CHANGELOG.md` 최상단에 짧은 "Unreleased" 항목을 추가해 (a) 결함 요지
    (`execution.node.failed`/`completed` 의 구조화 에러가 항상 `null` 로 파싱돼
    `system_error` 배너가 라이브 WS 에서 한 번도 안 떴다) (b) 운영 영향("이 배포 이후
    사용자가 처음으로 배너를 보게 된다 — 회귀 아님")을 명시한다.

- **[INFO]** 도메인-레벨 `output.error` 표현이, 이번 PR 이 명시적으로 없애려 한 바로 그
  래퍼/도메인 혼동 용어를 diff 바로 옆 comment 에 그대로 남기고 있다 (diff 범위 밖, 미수정)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:865-868`
    (`handleNodeFailed` 의 `payload` 타입 선언 중 `output?: unknown` 필드 위 주석)
  - 상세: 같은 함수(`handleNodeFailed`) 바로 위, 이번 diff 로 새로 고쳐진 주석
    (`:843-850`)은 "top-level `error` 는 **문자열**이고 구조화 객체는
    **`output.output.error`**" 라고 wire-layer 관점에서 명확히 못박는다. 그런데 불과
    15줄 아래, 같은 `payload` 타입 선언의 `output` 필드 위 주석은 *"엔진은 실패 시에도
    `nodeExec.outputData` 를 영속하고 본 payload 에 동봉한다 (spec/4-nodes/3-ai/1-ai-agent.md
    §7.9 — error 종결은 `output.error` + 부분 `output.result.*` 병존)"* 라고 적혀 있다.
    이 문장의 "output.error" 는 사실 AI Agent 핸들러 자신의 `NodeHandlerOutput.output`
    (도메인 주 데이터) 안의 `error` 필드를 가리키는 **도메인-레벨** 서술(§7.9 자신의
    용어법으로는 맞다)이라, wire-레벨로 보면 `payload.output.output.error` 와 같은 자리다 —
    기술적으로는 틀리지 않았다. 하지만 `node-output.md` Principle 0 자신이 *"이 구분이
    산문으로 5개 문서에 흩어져 있던 탓에 2026-08-24 한 작업에서 네 라운드에 걸쳐 같은 결함이
    하나씩 튀어나왔다"* 고 적고 있는 바로 그 혼동 패턴과 표면적으로 동일한 문구
    (`output.error`, "래퍼" 표기 없음)가 이번 PR 이 그 혼동을 정확히 disambiguate 한 주석의
    직하에 남아 있다. 이번 diff 대상은 아니라(pre-existing) CRITICAL 로 볼 이유는 없지만,
    다음 사람이 두 주석을 나란히 읽고 "output.error 와 output.output.error 중 뭐가 맞지"
    하고 다시 헤맬 실질적 위험이 있다.
  - 제안: 여유가 있으면 이 주석에 "(AI Agent 자신의 domain output 필드 이름 — wire 관점의
    `output.output.error` 와 같은 자리)" 같은 한 구절만 덧붙여 두 서술이 같은 것을 가리킴을
    명시한다. 이번 PR 범위 밖이라 즉시 조치는 불요.

- **[INFO]** `RESOLUTION.md` INFO 1 이 요구한 "PR 설명에 배너 최초 노출 명시" 가 아직
  미완료 상태다 — plan 체크리스트상 PR 이 아직 열리지 않았다
  - 위치: `plan/in-progress/system-error-banner-live-ws.md` 체크리스트 마지막 항목
    (`- [ ] \`/ai-review\` · push · PR`) / `review/code/2026/08/28/01_26_11/RESOLUTION.md`
    "INFO 1 — PR 설명에 반영"
  - 상세: 이전 라운드 SUMMARY 의 INFO #1 이 "배포 노트/PR 설명에 명시" 를 권고했고
    RESOLUTION.md 가 이를 수용했다고 적었지만, 실제 PR 은 아직 생성 전(체크리스트 미체크)
    이므로 이 항목의 이행은 여전히 열려 있다.
  - 제안: PR 생성 시 본문에 "이 변경으로 `system_error` 배너가 라이브 WS 경로에서 처음
    노출된다(회귀 아님)" 문구를 반드시 포함한다.

## 요약

핵심 코드(`use-execution-events.ts`/`.test.ts`)의 JSDoc·인라인 주석·테스트 제목은 이전
라운드에서 지적된 4건의 문서 낙후 문제(JSDoc-함수 분리, `handleNodeCompleted` 자매 주석,
fixture 손복제, 커버리지 0 분기)를 `RESOLUTION.md` 대로 성실히 반영했고, 재확인 결과
`§4.1-a`·`node-output.md` Principle 0 인용도 spec 원문과 정확히 일치한다. 남은 발견은
(1) 이번과 동일 계급의 과거 수정들이 전부 받아 온 `CHANGELOG.md` 항목이 이번엔 빠져 있다는
점(WARNING), (2) diff 범위 밖 인접 주석 한 곳이 이 PR 이 없애려던 래퍼/도메인 용어 혼동을
표면적으로 재현한다는 점(INFO), (3) PR 설명에 "배너 최초 노출" 을 명시하라는 이전 권고가
아직 미이행 상태라는 점(INFO)이다. 코드 정확성·spec 정합에는 영향 없다.

## 위험도

LOW
