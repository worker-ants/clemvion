# Rationale 연속성 검토 결과

## 검토 대상

- 범위: `spec/5-system/` (impl-done, diff-base `origin/main`)
- prompt 첨부 diff 블록은 컨텍스트 예산 초과로 절단되어 있어, 워크트리 절대경로에서 직접
  `git diff origin/main...HEAD`(70 files, +4862/-110) 및 `git log`를 1차 근거로 삼았다.
- spec 변경은 3파일: `spec/5-system/12-webhook.md` / `spec/5-system/14-external-interaction-api.md`
  (§R17 확장) / `spec/5-system/6-websocket-protocol.md` (§4.1 값-패턴 마스킹 캐비엇). 대응 코드:
  `websocket.service.ts`(`maskWireEnvelope`/`toFanoutEnvelope`) · `sanitize-error-message.ts`
  (`deepRedactSecretsPreserving`/마커 상수) · `redact-stored-error.ts`(`redactStoredDataForResponse`)
  · `executions.service.ts` · `background-runs.service.ts`.
- 최근 커밋 `b05756d9e`("`inputData` 마스킹 철회")가 직전 세션(`23_49_05`)에서 이 checker 계열이
  BLOCK 근거로 낸 CRITICAL(Re-run/Mock-Input 재제출 경로가 egress 마스킹과 충돌해 `***`가 실제
  입력값으로 흘러감)을 되돌려 해소한 상태다 — 이 되돌림이 현재 target 의 최종 상태다.

## 발견사항

이번 diff 는 spec-only 3파일이며 모두 기존 `## Rationale`/`§R17` 카탈로그를 직접 갱신하는 형태다.
"기각된 대안 재도입 / 원칙 위반 / 무근거 번복 / invariant 우회" 네 관점에서 대조한 결과,
**CRITICAL/WARNING 급 위반은 발견되지 않았다.** 직전 세션이 낸 CRITICAL(Re-run 재제출 오염)은
`b05756d9e`로 이미 되돌려졌고, 그 되돌림 자체도 `inputData`/`14-external-interaction-api.md` §R17
"잔여 ②"·`executions.service.ts`의 `MASKED_INPUT_DATA_REASON` 두 곳에 새 Rationale 을 갖춰 기록됐다
(무근거 번복이 아니다). 아래는 확인 과정에서 특정한, 조치 불요 수준의 잠재 지점이다.

- **[INFO] §R17 "4곳" 서술이 같은 절 아래 "6곳(2컬럼)" 정정에도 원문 그대로 남아 있다**
  - target 위치: `spec/5-system/14-external-interaction-api.md:1486-1490`
    ("내부 읽기 경로도 같은 마스킹을 적용한다 (결정 2026-08-16)" 불릿, "`ExecutionsService` 의
    독립 반환 경로 **4곳**(`findById` · `toExecutionDto` · `getChain` · `stop`)에 적용한다")
  - 과거 결정 출처: 같은 절 바로 아래 `:1512-1525` ("적용 범위는 총칭이 아니라 열거다
    (2026-08-16 갱신 — 표면 **여섯**, 컬럼 **둘**)") — 이 갱신 블록 자체가 "종전 이 자리는
    `ExecutionsService` 4경로였는데 … **'넷'이라는 수치가 이미 낡아 있었다**"라고 명시적으로
    `:1489`의 "4곳"을 지목해 구식임을 선언한다.
  - 상세: `:1489`의 "4곳" 서술은 현재형("… 4곳에 적용한다")으로 남아 있어, 그 문단만 읽고
    멈춘 독자는 `error` 마스킹이 4개 표면에 한정된다고 오인할 수 있다. 위험 방향은 "미보호 표면
    누락"이 아니라 "이미 보호된 표면(`nodeExecutions[]`·`BackgroundRunsService`)의 존재를
    과소평가"하는 쪽이라 보안 회귀는 아니지만, 이 문서 자신이 반복 실패로 지목해 온 바로 그
    "총칭·부정확한 개수" 패턴이 같은 절 안에서 재현된 사례다.
  - 제안: `:1489`의 "4곳" 앞에 "(2026-08-16 최초 결정 시점 서술 — 이후 §1512 에서 총 6표면·2컬럼으로
    확장)" 류의 상태 표시를 붙이거나, 숫자를 아예 지우고 "`:1512` 표 참조"로 대체해 단일 정본을
    강제한다(이 문서가 이미 `:1518` "소스 정본은 `ExecutionsService.toResponseExecution` 의 표"로
    정본을 못박은 것과 같은 조치를 `:1489`에도 적용).

- **[INFO] `nodeOutput` 일반 키 allowlist 잔여 노트가 신규 emit 값-마스킹 층을 반영하지 않음**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 말미
    ("`nodeOutput` 일반 키 allowlist (미구현·잔여)" 불릿, diff 미변경 컨텍스트 라인)
  - 과거 결정 출처: 같은 불릿 — "SSE emit 은 `sanitizePayloadForWs` 의 credential-**키** 마스킹으로
    **부분 방어**; author config 의 **값-embedded secret 은 저위험 gap**"
  - 상세: 이번 PR 이 신설한 `execution.node.*`/비-종결 `execution.*` emit 값-패턴 마스킹
    (`WebsocketService.maskWireEnvelope`, `6-websocket-protocol.md` §4.1 신규 캐비엇 — "대상은
    특정 필드가 아니라 **payload 전체**")은 `execution.waiting_for_input`도 `emitExecutionEvent`
    경로를 타므로(`form-interaction.service.ts`/`ai-turn-orchestrator.service.ts` →
    `eventEmitter.emitExecution` → `websocketService.emitExecutionEvent`), fanout wire 에 실리는
    `nodeOutput`(§4.4 wire 캐비엇이 명시하는 실제 nest 필드)의 일반 키들도 이제 값-패턴 마스킹을
    받는다 — 위 "잔여" 불릿이 미방어로 지목한 "author config 값-embedded secret" 클래스를 최소
    부분적으로 덮는 셈이다. 위반은 아니다(잔여 불릿이 논하는 것은 값-마스킹과 **별개인 키
    allowlist/필드 축소** 문제이고 이번 PR 은 그걸 채택도 기각도 하지 않았다) — 다만 그 불릿의
    "SSE emit 은 … 부분 방어"라는 방어 수단 서술이, 같은 PR 로 추가된 두 번째 방어 층(값-패턴
    마스킹)을 언급하지 않아 최신 상태를 반영하지 못한다.
  - 제안: 해당 불릿에 "(2026-08-16 이후 값-패턴 마스킹 층이 추가돼 이 gap 이 부분적으로 축소됐다 —
    §4.1 캐비엇 참조)" 1줄 교차 참조 추가. 강제 아님 — allowlist 자체의 미구현 상태는 그대로다.

- **검증됨 — 조작·과장 없음**: `llmCalls` strip-only 결정("이 결정은 유지된다", `6-websocket-protocol.md`
  §Rationale)이 신규 값-패턴 마스킹과 실제로 병존(대체 아님)함을 코드(`WIRE_PRESERVED_FIELDS` =
  `EXTERNAL_STRIPPED_FIELDS` 재사용, `deepRedactSecretsPreserving`의 `preserveKeys`)로 대조 확인.
- **검증됨 — 마커 멱등성 주장**: "값-마스커가 마커(`[REDACTED]`/`***`/`[REDACTED_DEPTH]`)를 재마스킹하지
  않는다"는 신규 서술을 `sanitize-error-message.ts`의 `MASKED_MARKERS`/`isMaskedMarker` 및
  `SECRET_LEAK_PATTERNS`(Bearer/JWT/secret 키워드/URI userinfo 패턴)와 대조 — `[REDACTED]` 자체는
  어떤 패턴과도 매치되지 않아 재마스킹 위험이 없다는 주장이 코드와 일치한다.
- **검증됨 — ingestion-time vs egress-time 공존 서술**: `12-webhook.md` §5.3 Rationale("민감 헤더
  마스킹 — ingestion(저장) 시점 채택", display 시점 마스킹을 명시적으로 **기각**)과 신규 §R17
  "언제 가리는가" 불릿을 대조 — 신규 egress 마스킹은 §5.3 이 기각한 "동일 대상(헤더)의 display 시점
  마스킹"을 재도입하는 것이 **아니라** 다른 대상(자유 텍스트 값-패턴)에 적용되며, 텍스트도 스스로
  "모순이 아니라 대상이 다르다"로 이를 명시해 §5.3 의 기각 판정과 충돌하지 않는다.
- **검증됨 — `inputData` 되돌림의 근거 갖춤 여부**: `b05756d9e`가 `outputData`는 유지하고 `inputData`만
  되돌린 비대칭 결정이 `MASKED_INPUT_DATA_REASON`(코드 JSDoc, `executions.service.ts`)과
  §R17 "잔여 ②"(spec) 양쪽에 **같은 근거**(Re-run/히스토리 로드 재제출 경로, `useOriginalInput`
  기본값 `false`)로 동시에 기록돼 있어 "무근거 번복"이 아니다. `plan/in-progress/
  spec-sync-external-interaction-api-gaps.md`에도 후속 가드(프런트 마스킹 마커 감지) 트래커
  항목이 신설돼 있어 "닫는 조건"이 실제로 추적됨을 확인했다.
- **검증됨 — R10 단일 sink 정책 무모순**: `14-external-interaction-api.md` §R10 ("`WebsocketService`
  단일 sink" — 엔진은 `emitToExecution`만 호출, 세 listener 는 `executionEvents$` 구독)가 신규
  마스킹 초크포인트(`maskWireEnvelope`)를 언급하지 않지만, 이 초크포인트는 정확히 그 단일 sink
  직전에 위치해 R10 이 기술하는 아키텍처(단일 발행점 → 다중 listener)를 깨지 않는다(모순 아님).

## 요약

target 변경(`spec/5-system/12-webhook.md`·`14-external-interaction-api.md`·`6-websocket-protocol.md`)은
기존 `§R17`/WS `## Rationale` 카탈로그를 확장하는 문서 커밋이며, 과거 명시적으로 기각된 대안
(`llmCalls` 값-마스킹 대체, webhook display-시점 마스킹, raw-WS/REST 대체 등)을 이유 없이 재도입한
사례는 없다. 직전 세션이 낸 유일한 CRITICAL(Re-run 재제출 경로 오염)은 이번 diff 의 최신 커밋에서
이미 되돌려졌고, 그 번복 자체가 spec·코드 양쪽에 명시적 새 Rationale 을 갖췄다. 발견된 두 건은 모두
INFO 수준의 "정합 보완" 제안이다 — (1) §R17 안에서 "4곳"이라는 구식 수치가 같은 절의 정정 문단
바로 위에 현재형으로 남아 있는 자기-불일치, (2) `nodeOutput` allowlist 잔여 노트가 같은 PR 이 추가한
값-패턴 마스킹 층의 존재를 언급하지 않아 최신화가 필요한 정도다. 둘 다 결정 자체의 번복·원칙 위반이
아니라 서술 최신화 누락이다.

## 위험도

LOW
