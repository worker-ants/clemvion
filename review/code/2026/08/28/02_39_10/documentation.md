# 문서화(Documentation) 리뷰 — `system_error` 배너 라이브 WS 복구 (5라운드 누적 diff, `02_39_10`)

## 배경

이 diff 는 이미 4 라운드의 `/ai-review`(`01_26_11`, `01_44_22`, `02_02_18`, `02_21_19`)를
거쳤고, 매 라운드 documentation 관점 발견사항(JSDoc-함수 분리·낡은 §4.1 인용, 자매 호출부
주석 잔존, 테스트 제목·describe 주석 shape 불일치, CHANGELOG 누락, `.bak` 잔여 파일)이
전부 해당 RESOLUTION.md 대로 반영됐음을 이전 라운드가 직접 재확인했다. 이번 라운드의
실질 델타(커밋 `7ea6f5618`, `02_21_19` W1 fix)는 **테스트 파일 + plan 체크리스트만** 건드리는
순수 테스트 추가다(`extractNodeErrorPayload`/핸들러 소스는 무변경). 아래는 소스를 직접
`Read`로 재확인하고 새로 추가된 테스트 주석의 정확성을 검증한 결과다.

## 재확인 결과 (직접 소스 대조)

- `codebase/frontend/src/lib/websocket/use-execution-events.ts` — `extractNodeErrorPayload`
  JSDoc(58-83행경), `handleNodeCompleted`(807-812행)·`handleNodeFailed`(843-850행) 주석 모두
  이전 라운드가 확인한 `§4.1-a` / `output.output.error` 서술을 그대로 유지. 이번 커밋이
  소스를 건드리지 않았으므로 drift 없음.
- 신규 테스트 4건(`use-execution-events.test.ts:2241,2260,2293,2315`)의 docstring/인라인
  주석을 코드와 대조:
  - `:2241` "`message` 만 없어도" — fixture `error: { code: "LLM_CALL_FAILED", details: {...} }`
    (message 없음) — 주석·제목·fixture 일치.
  - `:2260` "`code` 만 없어도" — fixture `error: { message: "Upstream refused", details: {...} }`
    (code 없음) — 일치.
  - `:2293` 배열 테스트 — 주석이 스스로 "이 테스트는 `!Array.isArray(v)` 항을 못 가른다"고
    명시하고 그 근거(`[].output` → `undefined` → 등가 뮤턴트)까지 서술한다. `asRecord`
    정의(`:51-55`, `!Array.isArray(v)` 포함)와 대조해 그 근거가 실제 구현과 일치함을
    확인했다 — **검증 범위를 실제 검증 능력에 맞춘, 스스로 정직한 주석**이다.
  - `:2315` completed 대칭 케이스 — `no seedConversation()`(single-turn)로 시작해
    `conversationMessages` 길이 0 을 단언, `isMultiTurnAiContext`(`:150-153`, `nodeType
    !== "ai_agent"` 또는 `conversationMessages.length === 0` 이면 `false`)와 정합.
- `plan/in-progress/system-error-banner-live-ws.md` 체크리스트 마지막 줄이 "86→92 · e2e 285
  (`02_21_19` INFO 2 — 87 로 적어 둔 사이 라운드가 더 늘렸다)"로 자기 정정돼 있다. 저장소
  전체(`grep -rn "87"` — plan/CHANGELOG/소스/테스트)에 낙후된 `87` 잔존 없음을 확인.
- `CHANGELOG.md:3-20` 항목은 이전 라운드와 동일하게 유지, 이번 커밋이 건드리지 않음 —
  이번 커밋은 사용자 관측 동작을 바꾸지 않는 테스트 전용 변경이라 추가 항목 불요.

## 발견사항

- **[INFO]** diff 범위 밖 인접 주석이 wire/domain 용어 혼동을 여전히 표면적으로 재현한다
  (4라운드 연속 확인된 pre-existing 항목, 신규 아님 — 재차 carry-over)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` (`handleNodeFailed`
    의 `payload` 타입 선언 중 `output?: unknown` 필드 위 주석, `§4.1-a` 핵심 정정 주석
    바로 15줄 아래)
  - 상세: 이번 커밋은 이 파일의 소스를 전혀 건드리지 않아 이전 라운드가 지적한 상태
    그대로다. `output` 필드 위 주석("엔진은 실패 시에도 `nodeExec.outputData` 를 영속하고
    본 payload 에 동봉한다... §7.9 — error 종결은 `output.error` + 부분 `output.result.*`
    병존")은 AI Agent 핸들러 자신의 도메인 필드 이름을 가리키는 것이라 §7.9 용어법으로는
    틀리지 않지만, 바로 위 `§4.1-a` wire-레벨 주석과 표면적으로 다른 자리(`output.error`
    vs `output.output.error`)를 가리키는 것처럼 읽힐 여지가 3~4라운드째 남아 있다.
  - 제안: 3~4라운드 연속 "조치 불요(유예 유지)"로 판정된 항목 — 이번 라운드도 같은
    판정을 유지한다. 여유가 있으면 "(AI Agent 자신의 domain output 필드 이름 — wire 관점의
    `output.output.error` 와 같은 자리)" 한 구절만 덧붙이는 것을 고려.

- **[INFO]** "PR 설명에 배너 최초 노출 명시" 이행이 여전히 대기 중 — PR 미생성
  - 위치: `plan/in-progress/system-error-banner-live-ws.md` 체크리스트 마지막 항목
    (`- [ ] \`/ai-review\` · push · PR`)
  - 상세: `01_26_11`·`01_44_22` RESOLUTION 이 약속하고 `02_21_19` documentation 리뷰가
    "PR 이 아직 생성되지 않아 검증 불가"로 기록한 것과 동일 상태 — 이번 라운드도 push/PR
    이전이라 이행 시점에 도달하지 않았다.
  - 제안: PR 생성 시 본문에 "이 변경으로 `system_error` 배너가 라이브 WS 경로에서 처음
    노출된다(회귀 아님)" 문구를 반드시 포함할 것.

- **[INFO]** 신규 테스트 4건의 주석 품질은 우수하며 새로운 문서화 결함 없음
  - 상세: 이번 커밋이 추가한 테스트들은 (a) 어느 라운드/WARNING 을 겨냥한 것인지
    (`02_21_19` W1/INFO 7/INFO 8), (b) 뮤테이션 예측/실측을 인라인 docstring 에 직접
    남기고, (c) 배열 테스트는 스스로 "이 테스트가 못 가르는 것"까지 명시해 향후
    유지보수자가 커버리지를 과대평가할 위험을 줄인다. README·API 문서·설정 문서·
    CHANGELOG 관점에서 이번 커밋에 요구되는 추가 조치는 없다(테스트 전용, 사용자
    관측 동작 불변).

## 요약

이 diff 는 이미 4 라운드의 `/ai-review` 를 거쳐 documentation 관점 발견사항이 소진된
상태이며, 이번 라운드의 실질 변경(`02_21_19` W1 fix)은 소스 코드를 건드리지 않는 순수
테스트 추가다. 신규 테스트 4건의 인라인 주석을 실제 구현(`asRecord`, `isMultiTurnAiContext`,
`extractNodeErrorPayload`)과 직접 대조한 결과 모두 정확하며, 특히 검증 범위를 정직하게
좁혀 서술한 배열 테스트의 주석은 이 세션이 반복해 겪은 "이름/주석이 실제 검증 범위를
과장한다"는 결함 클래스를 스스로 예방한 사례다. 남은 두 항목은 3~4라운드 연속 이미
식별·유예된 carry-over(스코프 밖 인접 주석 1건, PR 미생성으로 인한 이행 대기 1건)이며
새로운 CRITICAL/WARNING 은 없다.

## 위험도

NONE
