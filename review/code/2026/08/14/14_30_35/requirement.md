# 요구사항(Requirement) 리뷰 — `14_30_35`

리뷰 대상 중 실질 코드 변경은 `interaction.service.ts`/`.spec.ts`(신규: REST 스냅샷에도 fanout 과
같은 수준의 `llmCalls` strip 적용) + 신규 공유 유틸 `shared/utils/strip-external-only-fields.ts`
(`websocket.service.ts` 에서 추출) 뿐이다. `CHANGELOG.md`/`plan/**`/`review/**` 는 계획·리뷰
산출물이라 "기능 충족" 관점 자체의 적용 대상이 아니되, 문서-코드 정합성(spec fidelity, CHANGELOG
정확성)은 아래에서 함께 점검했다.

## 발견사항

- **[WARNING]** `getStatus()` 의 terminal `result`(COMPLETED)/`error`(FAILED) 경로는 이번 diff 가
  `context.nodeOutput`(waiting) 경로에 적용한 `stripExternalOnlyFields` 방어를 받지 않는다 —
  같은 함수 안에서 "출구 하나만 막고 나머지는 세지 않는" 이 PR 자신이 경고하는 바로 그 패턴이
  다시 나타난다. **단, 직접 추적한 결과 오늘 시점엔 실제 누출은 아니다** — 아래 상세 참조.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:406-421`
    (`result`/`error` 필드, `deepRedactSecrets` 만 적용) — 대조: 같은 파일 `:342-355`
    (`context.nodeOutput` 경로, 이번 diff 가 `stripExternalOnlyFields` 를 추가한 지점)
  - 상세: `result`/`error` 는 `execution.outputData`(Execution 엔티티, DB 컬럼)를
    `deepRedactSecrets` 만으로 마스킹해 반환한다 — 정확히 이 PR 의 CHANGELOG/JSDoc 이
    "값 마스킹이지 필드 제거가 아니다" 라고 지적한 그 함수 단독 사용이다. 소스를 끝까지
    추적했다: `Execution.outputData` 는 `execution-engine.service.ts:2359`
    (`savedExecution.outputData = context.nodeOutputCache[lastNodeId] ?? {}`) 에서
    채워지고, `context.nodeOutputCache` 는 `setNodeOutput(..., toEngineFlatShape(adapted))`
    (`execution-engine.service.ts:5899-5901`)로 채워진다. `toEngineFlatShape`
    (`handler-output.adapter.ts:109-190`)는 `adapted.output` 의 키만 펼치고
    `adapted.meta` 는 **어느 분기에서도 결과에 포함시키지 않는다**(조건 판별에만
    쓰이고 값은 버려짐) — 즉 `Execution.outputData` 는 구조적으로 `meta.turnDebug[].llmCalls[]`
    를 담을 수 없다(반면 `NodeExecution.outputData`, 즉 waiting 경로가 읽는
    `nodeExec.outputData` 는 raw handler return 전체를 그대로 저장해 `meta` 를 보존한다 —
    `execution-engine.service.ts:5936` `nodeExecution.outputData = (output as ...) ?? {}`).
    그래서 **오늘은 안전**하지만, 그 안전은 `stripExternalOnlyFields` 자신의 방어가 아니라
    "엔진의 flat-shape 변환이 우연히 `meta` 를 버린다" 는, 이 함수와 무관한 별도 코드
    경로의 부수 효과에 전적으로 기댄다. `eia-terminal-payload.md`(같은 브랜치의 자매 plan)
    가 정확히 `Execution.output_data`/`result.outputs` 표면을 확장하려는 작업이라
    (`git grep -n "result.outputs"`), 그 작업이 `Execution.outputData` 조립 방식을
    바꾸면(예: `meta` 를 함께 실어야 하는 요구가 생기면) 이 자리가 조용히 다시 열린다.
    이 비대칭을 고정하는 테스트도 없다 — `interaction.service.spec.ts:830`
    ("COMPLETED result / FAILED error 의 outputData secret 도 마스킹")는 credential
    패턴 마스킹만 검증하고 `llmCalls`/`meta` 케이스는 없다.
  - 제안: 최소한 (a) `result`/`error` 조립에도 `stripExternalOnlyFields` 를 대칭적으로
    적용해 "모든 외부 출구가 같은 것을 부른다" 는 이 PR 자신의 설계 원칙을 문자 그대로
    지키거나, (b) `Execution.outputData` 가 `meta` 를 구조적으로 담을 수 없다는 불변식을
    타입/주석/테스트로 명시적으로 고정(예: `meta.turnDebug` 를 포함한 fixture 로
    `getStatus` COMPLETED 응답에 `llmCalls`/`requestPayload` 가 없음을 회귀 테스트).
    (a) 가 더 견고하다 — `eia-terminal-payload.md` 가 이 표면을 확장할 예정이므로.

- **[WARNING]** `stripExternalOnlyFields(deepRedactSecrets(...), MAX_REDACT_DEPTH)` 조합이
  자기 자신의 문서화된 계약("같은 값·같은 경계 연산자")을 어긴다 — 오늘은 실제 누출로
  이어지지 않지만 근거가 실행 순서에 암묵 의존한다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:349-355`
    (`stripExternalOnlyFields(deepRedactSecrets(...), MAX_REDACT_DEPTH)`) — 계약 서술:
    `codebase/backend/src/shared/utils/strip-external-only-fields.ts:36-39`
    ("호출부의 자매 sanitizer... 와 같은 값·같은 경계 연산자를 쓴다")
  - 상세: `deepRedactSecrets` 의 경계는 `depth >= MAX_REDACT_DEPTH`
    (`shared/utils/sanitize-error-message.ts:134`, depth 10 전체를 `'***'` 로 치환)이고,
    `stripDeep` 의 경계는 `depth > maxDepth`(`strip-external-only-fields.ts:46`, depth 10 까지
    처리하고 depth 11 부터 건너뜀) — **같은 상수(10)를 쓰지만 연산자가 다르다.** 자매 관계인
    `websocket.service.ts` 의 `sanitizePayloadForWs`(`depth > MAX_SANITIZE_DEPTH`)는 `stripDeep`
    과 연산자까지 일치해(리뷰 라운드 `11_02_16`/`12_06_20` 가 실행으로 검증·통일한 바로 그
    지점) 계약이 문자 그대로 참이지만, 이번 새 호출부(`MAX_REDACT_DEPTH` 페어링)는 검증되지
    않은 채 다른 연산자를 쓴다. 직접 추적한 결과 — `deepRedactSecrets` 가 depth 10 에서
    서브트리 전체를 문자열로 치환하므로, 그 뒤에 도는 `stripDeep` 은 depth 10 이후에 실제
    object 를 만날 일이 없어(이미 문자열이 됨) 오늘은 안전하다. 그러나 이 안전은 (1)
    `deepRedactSecrets` 가 **반드시 먼저** 실행된다는 호출 순서, (2) 두 함수가 **같은 상수값**
    을 쓴다는 우연에 의존하며, 둘 다 `stripDeep` 자신의 방어가 아니다 — 이 프로젝트가 자매
    호출부에서 이미 세 라운드에 걸쳐 지적하고 고친 것과 동일 클래스("호출 순서에 의존하는
    불변식은 함수 자신의 방어가 아니다", `12_06_20` RESOLUTION INFO 1)가 이번 새 호출부에는
    아직 미검증 상태로 재현됐다. 경계 depth sweep 테스트(`websocket.service.spec.ts` 의
    `it.each([0,5,8,9,10,11,12])`)에 대응하는 것이 `interaction.service.spec.ts` 에는 없다.
  - 제안: 우선순위는 낮다(오늘 안전함을 확인함) — 다음에 이 조합을 건드릴 때 (a) JSDoc 에
    "redact 가 strip 보다 먼저 실행돼야 한다" 는 순서 의존성을 명시하거나, (b) 자매
    호출부처럼 depth 경계 테스트를 하나 추가해 이 페어링의 판별력을 실측으로 고정한다.

- **[SPEC-DRIFT][WARNING]** `spec/5-system/14-external-interaction-api.md` §R17 "표면
  제약(보안)" 의 `getStatus` 관련 서술이 이번 코드 변경을 반영하지 못해 이제 불완전하다
  - target 위치: `spec/5-system/14-external-interaction-api.md:1346-1352`
    ("`nodeOutput.conversationConfig` + terminal `result`/`error` (강제됨 — bypass 차단)"
    항목, 특히 1350행 "`getStatus` 는 `nodeOutput` 전체 + terminal `result`(COMPLETED)/
    `error`(FAILED)의 `outputData` 를 `deepRedactSecrets` 로 마스킹한다")
  - 상세: 이 spec 문장은 `getStatus` 의 `nodeOutput` 보호 수단을 **`deepRedactSecrets`
    하나**로만 서술한다 — 이 diff 이전의 실제 동작(그리고 이 diff 가 고친 CRITICAL 그 자체)과
    정확히 일치했던, 이제는 낡은 서술이다. 코드는 이제 `nodeOutput`(waiting 경로)에
    `stripExternalOnlyFields` 를 추가로 적용한다(`interaction.service.ts:349-355`,
    이 diff 의 핵심 변경) — 이는 정당하고 필요한 보안 수정(같은 diff 의 회귀 테스트 +
    `12_06_21` cross_spec CRITICAL 1 이 실증)이라 코드가 옳다. spec 본문만 그 방어
    계층 추가를 반영하지 못했다.
  - 제안: 코드는 유지. `spec/5-system/14-external-interaction-api.md:1350` 문장을
    "`getStatus` 는 `nodeOutput`(waiting 경로) 에 `deepRedactSecrets` 마스킹 +
    `stripExternalOnlyFields`(`llmCalls` 깊이 무관 제거, WS §4.4 strip-only 결정과 동일)를
    적용하고, terminal `result`/`error` 의 `outputData` 는 `deepRedactSecrets` 만 적용한다"
    처럼 구분해 갱신할 것 — planner 위임 대상(`developer` 는 `spec/` 쓰기 권한 없음). 위 첫
    WARNING(terminal 경로 비대칭)이 (a) 안으로 해소되면 이 spec 문장도 "양쪽 모두
    `stripExternalOnlyFields` 적용" 으로 한 번에 갱신하는 편이 낫다 — 지금 반영하면 다음
    라운드에 또 갱신해야 한다.

- **[WARNING]** CHANGELOG 에 이번 REST 스냅샷 수정(커밋 `34e32e62f`, "fanout 만 막았다 — REST
  스냅샷으로 같은 프롬프트가 나가고 있었다")에 대한 항목이 없다 — 같은 PR 이 앞선 fanout 수정에는
  항목을 달았던 것과 비대칭이다
  - 위치: `CHANGELOG.md:1-24`(현재 최상단 "Unreleased — (보안) 외부 fanout 의 `llmCalls`
    strip 이 depth-1 이라..." 항목)
  - 상세: 이 항목의 제목·본문은 "**외부 fanout**"(SSE·webhook·chat-channel)만 명시하고,
    영향받는 수신자 목록도 "external-interaction SSE · notification webhook · chat-channel
    아웃바운드" 로 한정한다 — `GET /api/external/executions/:id`(REST 스냅샷, `iext_*`/`itk_*`
    토큰 인증)는 언급되지 않는다. 그런데 이번 diff 가 고친 것은 정확히 그 REST 엔드포인트가
    `deepRedactSecrets` 만 거쳐 같은 raw `llmCalls` 를 그대로 돌려주던 **별개의 두 번째 유출
    경로**다(`interaction.service.ts` 주석·`strip-external-only-fields.ts` JSDoc 이 스스로
    "REST 스냅샷도 같은 데이터의 다른 출구" 라고 명시). 같은 PR 의 앞선 라운드(`10_32_27`
    RESOLUTION W9)는 정확히 이 클래스의 결함("정보 노출 수정에 CHANGELOG 항목이 없었다")을
    조치한 전례가 있는데, 이번 REST 수정에는 같은 처리가 빠졌다. 사용자가 현재 CHANGELOG
    만 읽으면 REST 스냅샷 경로로도 같은 데이터가 새고 있었다는 사실(및 "이미 전송된 데이터"
    운영 판단 필요성)을 알 수 없다.
  - 제안: 기존 항목에 "REST 스냅샷(`GET /api/external/executions/:id` → `getStatus`)도 같은
    `nodeOutput.meta.turnDebug[].llmCalls[]` 를 `deepRedactSecrets` 만으로 마스킹해 동일하게
    새고 있었다 — `stripExternalOnlyFields` 를 공유 유틸로 추출해 두 표면 모두 적용" 문단을
    추가하거나 별도 Unreleased 항목을 신설한다. `plan/in-progress/spec-draft-eia-62-waiting-payload.md`
    에도 이 REST 경로 발견·조치 이력이 전혀 등재돼 있지 않다(fanout 쪽은 "🔴 조사 중 발견"
    절 전체가 있음) — 같은 절 아래 REST 스냅샷 추가 발견을 기록하는 편이 이 PR 의 조사 이력
    추적 관례와 일관된다.

## 확인했으나 문제 없음 (positive findings)

- 신규 공유 유틸 `shared/utils/strip-external-only-fields.ts` 는 `websocket.service.ts` 의
  검증된 구현(`__proto__` 오염 방지 스프레드-우선 패턴, 지연 할당, `depth > maxDepth` 통일
  연산자)을 그대로 이식했다 — 이미 3라운드 리뷰·뮤테이션 테스트를 거친 로직이라 재검증
  리스크가 낮다.
- `interaction.service.spec.ts` 신규 테스트(`waiting_for_input — nodeOutput 의 raw llmCalls 가
  REST 응답에 실리지 않는다`)는 정확히 실제 프로덕션 shape(`meta.turnDebug[].llmCalls[].requestPayload`)
  을 재현하고, 대조군(정상 필드 `conversationConfig.greeting` 보존)도 함께 검증해 "통째로
  날려서 통과" 하는 거짓 양성을 배제한다.
- `websocket.service.ts` 는 로컬 `stripExternalOnlyFields`/`EXTERNAL_STRIPPED_FIELDS` 정의를
  제거하고 공유 유틸을 그대로 재사용하도록 정리됐다 — 시그니처(`maxDepth` 명시 인자화)·
  호출부(`MAX_SANITIZE_DEPTH` 전달) 모두 일관되게 갱신됐다.
- `EXTERNAL_STRIPPED_FIELDS` 는 이름 기반 삭제라 새 외부 표면이 추가돼도 자동 보호된다는
  설계 의도가 이번 확장(REST 스냅샷도 같은 유틸을 부름)으로 실제로 검증됐다 — "새 위치가
  생겨도 자동 보호된다" 는 JSDoc 주장이 이번 diff 로 처음 실전에서 참임이 증명된 셈이다.

## 요약

핵심 변경(REST 스냅샷 `getStatus` 의 `context.nodeOutput` 에도 fanout 과 동일한 깊이-무관
`stripExternalOnlyFields` 를 적용, 로직을 공유 유틸로 추출)은 실제로 존재했던 CRITICAL 급
정보 노출(같은 `iext_*`/`itk_*` 토큰으로 REST 스냅샷이 raw LLM 프롬프트를 돌려주던 문제)을
정확히 겨냥해 닫는다. 다만 같은 함수 `getStatus()` 안에서 이 방어가 `context.nodeOutput`(대기)
경로에만 적용되고 `result`/`error`(종결) 경로엔 여전히 `deepRedactSecrets` 단독인 비대칭이
남아 있다 — 직접 엔진 소스를 끝까지 추적한 결과 오늘은 `Execution.outputData` 가 구조적으로
`meta` 를 담지 않아 실제 누출은 아니지만, 그 안전이 이 함수 자신의 방어가 아니라 별개 엔진
경로의 부수 효과에 의존한다는 점에서 이 PR 이 스스로 경고하는 "한 출구만 막는" 패턴이 형태를
바꿔 재현된 것이다. 또한 `MAX_REDACT_DEPTH` 페어링은 자매 `MAX_SANITIZE_DEPTH` 페어링과 달리
경계 연산자가 달라(`>=` vs `>`) 공유 유틸 자신의 문서 계약을 어기며, 이는 호출 순서 의존
안전성이라 근거가 약하다. spec 쪽은 `spec/5-system/14-external-interaction-api.md` §R17 의
`getStatus` 보호 서술이 이번 코드 강화를 반영하지 못해 SPEC-DRIFT 상태이고, CHANGELOG 에도
이번 REST 스냅샷 수정 자체의 항목이 없어 이 PR 이 이미 정착시킨 "정보 노출 수정은 CHANGELOG
항목화" 관례와 어긋난다. 모두 WARNING 급이며 CRITICAL 로 격상할 만한 활성 취약점은 확인되지
않았다(핵심 수정 자체는 유효하고 테스트로 뒷받침됨).

## 위험도

MEDIUM
