# 문서화(Documentation) 리뷰 — `system_error` 배너 라이브 WS 복구 (4라운드 누적 diff, `02_21_19`)

## 배경

이 diff 는 이미 3 라운드의 `/ai-review` (`01_26_11`, `01_44_22`, `02_02_18`)를 거쳤고, 세 라운드
모두 documentation 관점 발견사항(JSDoc-함수 분리·낡은 서술, 자매 호출부(`handleNodeCompleted`)
주석 잔존, 테스트 제목·describe 주석 shape 불일치, CHANGELOG 누락, `.bak` 잔여 파일)을 지적했고
각 RESOLUTION.md 가 반영을 기록했다. 이번 라운드는 그 반영이 **실제 소스에 그대로 있는지**를
`Read`/`grep`으로 직접 재확인하고, 실행 가능한 주장(테스트 통과 수·spec 인용)은 직접 실행/대조로
검증했다. 새로 찾은 문제만 아래 "발견사항"에 싣는다.

## 재확인 결과 (직접 소스 대조 + 실행)

- `extractNodeErrorPayload` JSDoc(`use-execution-events.ts:58-83`) — `§4.1-a` 인용, `output.output.error`
  shape 서술 정확. `asRecord`(51-56행)가 JSDoc **위**로 옮겨져 JSDoc-함수 인접성 복원됨. 3라운드
  전부가 지적했던 "정정 전 §4.1 서술을 남긴 JSDoc" 문제는 더 이상 없음.
- `handleNodeCompleted` 위 주석(807-812행)·`handleNodeFailed` 위 주석(843-850행) 모두
  `output.output.error` + `§4.1-a` 로 일치. 더 이상 어긋나지 않음.
- 테스트 제목(`use-execution-events.test.ts:2155` `"node.completed with output.output.error APPENDs..."`)과
  describe 헤더 주석(`:1965`)이 모두 `output.output.error` 로 정정돼 있음.
- `CHANGELOG.md:3-20` 에 이번 결함 전용 `## Unreleased` 항목이 있고, 원인·운영 영향("회귀 아님")·
  백엔드 계약 불변까지 명시. `spec/5-system/6-websocket-protocol.md:189,239` 에 `§4.1-a` 섹션이
  실재함을 직접 확인해 인용이 정확함을 검증했다.
- `codebase/frontend/src/lib/websocket/use-execution-events.ts.bak` — `find` 로 재확인한 결과
  **존재하지 않음**(3라운드 documentation 리뷰가 지적한 잔여물은 이미 제거됨).
- 3라운드(`02_02_18`) testing WARNING(`isMultiTurnAiContext` "이전 대화 없음" 분기 커버리지 0)의
  수정이 실제로 반영됨을 확인 — `use-execution-events.test.ts:2349` 의
  `"AI node failure without prior conversation context does NOT APPEND"` 테스트가 이제
  `output: wrapNodeHandlerOutput({...})` 를 실어 `errorPayload` 를 non-null 로 만든 뒤
  `isMultiTurnAiContext` 분기를 실제로 태운다.
- 3라운드 requirement INFO(`"node.failed on a NON-AI node also carries output into outputData"` 테스트가
  옛 object-shape `error` 를 씀, `:2136`)도 이번 라운드에서 문자열로 정정됨을 확인 —
  `error: "Internal Server Error"`(`:2138`) + 정정 근거를 자기 참조하는 주석
  ("production shape — 자매 non-AI 테스트는 직전 라운드에 고쳤는데 이쪽을 갈랐다 (`02_02_18` INFO 1)",
  `:2136-2137`)까지 남겨 이력 추적이 가능하다.
- `pnpm exec vitest run src/lib/websocket/__tests__/use-execution-events.test.ts` 직접 실행 —
  **89/89 GREEN**. 이전 라운드 RESOLUTION/SUMMARY 가 주장한 수치(89/89)와 일치 확인.

## 발견사항

- **[INFO]** diff 범위 밖 인접 주석이 이 PR 이 disambiguate 한 wire/domain 용어 혼동을 여전히
  표면적으로 재현한다 (3라운드 연속 확인된 pre-existing 항목, 신규 아님)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:865-868`
    (`handleNodeFailed` 의 `payload` 타입 선언 중 `output?: unknown` 필드 위 주석)
  - 상세: 바로 위 15줄, 같은 `handleNodeFailed` 의 핵심 정정 주석(`:843-850`)은 "top-level `error`
    는 문자열, 구조화 객체는 `output.output.error`" 로 wire-layer 관점을 명확히 못박는다. 그런데
    `output` 필드 위 주석은 *"엔진은 실패 시에도 `nodeExec.outputData` 를 영속하고 본 payload 에
    동봉한다 (spec/4-nodes/3-ai/1-ai-agent.md §7.9 — error 종결은 `output.error` + 부분
    `output.result.*` 병존)"* 라고 적혀 있다. 이 "output.error" 는 AI Agent 핸들러 자신의
    `NodeHandlerOutput.output`(도메인 값) 안의 `error` 필드를 가리키는 도메인-레벨 서술이라
    §7.9 자신의 용어법으로는 틀리지 않지만, wire-레벨로 보면 `payload.output.output.error` 와
    같은 자리다. `node-output.md` Principle 0 이 자신도 "이 구분이 산문으로 여러 문서에 흩어져
    있던 탓에 같은 결함이 반복 튀어나왔다"고 적는 바로 그 혼동 패턴(`output.error`, 래퍼 표기
    없음)과 표면적으로 동일한 문구가, 이 PR 이 그 혼동을 정확히 정리한 주석 바로 15줄 아래
    남아 있다. `01_44_22`·`02_02_18` 두 라운드 모두 "diff 범위 밖·기술적으로는 틀리지 않음"으로
    유예했고, 이번 재확인에서도 실질적 오류는 아니다.
  - 제안: 조치 불요(2회 유예 판정 유지). 여유가 있으면 "(AI Agent 자신의 domain output 필드 이름
    — wire 관점의 `output.output.error` 와 같은 자리)" 한 구절만 덧붙이는 것을 고려.

- **[INFO]** RESOLUTION 이 2라운드 연속 수용한 "PR 설명에 배너 최초 노출 명시" 가 아직 미이행 —
  PR 이 아직 생성되지 않음
  - 위치: `plan/in-progress/system-error-banner-live-ws.md` 체크리스트 마지막 항목
    (`- [ ] \`/ai-review\` · push · PR`, 미체크 상태와 실제 상태 일치 확인)
  - 상세: `git status`/`gh pr list` 로 확인한 결과 이 브랜치는 아직 push 되지 않았고 PR 도 없다.
    `01_26_11/RESOLUTION.md` INFO 1, `01_44_22/RESOLUTION.md` #11 이 모두 "PR 생성 시 본문에
    명시"를 약속했는데 그 트리거(PR 생성) 자체가 아직 발생하지 않아 검증 불가 — 결함이 아니라
    아직 도달하지 않은 이행 시점.
  - 제안: PR 생성 시 본문에 "이 변경으로 `system_error` 배너가 라이브 WS 경로에서 처음
    노출된다(회귀 아님)" 문구를 반드시 포함할 것 (CHANGELOG 항목과 동일 취지, 별도 표면).

- **[INFO]** README·API 문서·설정 문서 — 해당 없음 (변경 불요, 3라운드 연속 확인)
  - 상세: 이번 누적 diff 는 프런트 WS 이벤트 핸들러 내부 파싱 버그 수정이며 새 환경변수·설정·
    공개 API·엔드포인트 추가가 없다. `spec/5-system/6-websocket-protocol.md §4.1-a` 는 이미
    2026-08-24 정정되어 있고 코드가 그 spec 을 뒤늦게 따라잡는 구도 — `plan/in-progress/
    system-error-banner-live-ws.md` 의 `spec_impact: none` 과 일치.

## 요약

이 diff 는 이미 3 라운드의 `/ai-review` 를 거쳤고, 세 라운드가 각각 새로 지적한 documentation
관련 발견사항(JSDoc-함수 분리·낡은 §4.1 인용, 자매 주석 잔존, 테스트 제목·describe 주석 불일치,
CHANGELOG 누락, `.bak` 잔여 파일, 인접 fixture 의 production-shape 불일치)이 전부 실제 소스에
반영돼 있음을 이번 라운드에서 `Read`/`grep`/테스트 실행으로 직접 재확인했다 — 새로 발견된
CRITICAL/WARNING 은 없다. 남은 항목은 전부 INFO 이고 그중 둘은 2~3라운드에 걸쳐 이미 식별·유예된
carry-over(스코프 밖 인접 주석 1건, PR 미생성으로 인한 이행 대기 1건)이며 코드 정확성에는 영향이
없다. JSDoc·인라인 주석·테스트 제목·CHANGELOG·plan 문서가 모두 `§4.1-a` / `output.output.error`
서술로 서로 모순 없이 수렴해 있고, "종전 서술이 이 결함을 낳았다"는 이력을 취소선으로 남기는
이 저장소의 관례도 일관되게 지켜졌다.

## 위험도

LOW
