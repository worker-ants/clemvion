# Rationale 연속성 검토 결과

## 검토 대상

- 범위: `spec/5-system/` (impl-done, diff-base `origin/main`, merge-base `f5351e9c2`)
- prompt 첨부 번들이 커서 워크트리 절대경로에서 직접 `git diff origin/main...HEAD`
  (19 files, +1242/-96, spec 5파일: `3-error-handling.md` / `6-websocket-protocol.md` /
  `12-webhook.md` / `14-external-interaction-api.md` / `15-chat-channel.md`)와 `git log`를
  1차 근거로 삼았다. 대응 코드: `websocket.service.ts`(`maskWireEnvelope`/`toFanoutEnvelope`) ·
  `sanitize-error-message.ts`(`deepRedactSecretsPreserving`/마커 상수) ·
  `redact-stored-error.ts`(`redactStoredDataForResponse` 신설) · `executions.service.ts` ·
  `background-runs.service.ts`.
- **선행 리뷰 확인**: 같은 세션 계열 `review/consistency/2026/08/17/00_22_23/rationale_continuity.md`
  가 직전 diff 상태를 이미 검토해 INFO 2건을 냈고, 그 뒤 커밋 `81c9fcd60`("chat-channel verbatim
  계약과의 충돌 해소 + 게이트 3라운드 잔여 반영")이 그중 1건을 실제로 반영했다. 아래는 **현재
  최종 target 상태**(`81c9fcd60` 포함) 기준 재검토다 — 중복 보고를 피하기 위해 이미 해소된 항목은
  "해소 확인"으로만 표기한다.

## 발견사항

이번 diff 는 spec 5파일이며 대부분 기존 `## Rationale`/`§R17`/`§Rationale`(WS) 카탈로그를 직접
갱신·보강하는 형태다. "기각된 대안 재도입 / 원칙 위반 / 무근거 번복 / invariant 우회" 네 관점에서
대조한 결과, **CRITICAL/WARNING 급 위반은 발견되지 않았다.**

- **[해소 확인] §R17 "4곳" stale 서술의 자기모순 — 이미 정정됨**
  - target 위치: `spec/5-system/14-external-interaction-api.md` "내부 읽기 경로도 같은 마스킹을
    적용한다" 불릿
  - 과거 결정 출처: 같은 절의 "적용 범위는 총칭이 아니라 열거다" 갱신 블록
  - 상세: 선행 리뷰(`00_22_23`)가 지적한 "4곳"(구식 수치)이 같은 절의 "6곳·2컬럼" 정정과
    현재형으로 병존하던 자기모순은, `81c9fcd60`에서 "**적용 표면 목록은 아래 '적용 범위는 총칭이
    아니라 열거다' 항목이 정본**이다 — 여기에 개수를 다시 적지 않는다(초판은 *"4곳"* 이라
    적었는데 이후 여섯으로 늘며 낡았다)"로 교체되어 해소를 확인했다. 조치 불요.

- **[INFO] `nodeOutput` 일반 키 allowlist 잔여 노트가 신규 emit 값-마스킹 층을 여전히 반영 안 함**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 말미, "`nodeOutput` 일반 키
    allowlist (미구현·잔여)" 불릿 (diff 미변경 컨텍스트 라인 — 이번 PR 도 손대지 않음)
  - 과거 결정 출처: 같은 불릿 자신 — "SSE emit 은 `sanitizePayloadForWs` 의 credential-**키**
    마스킹으로 **부분 방어**; author config 의 **값-embedded secret 은 저위험 gap**"
  - 상세: 이번 PR 이 신설한 `execution.node.*`/비-종결 `execution.*` emit 값-패턴 마스킹
    (`WebsocketService.maskWireEnvelope`, WS §4.1 신규 캐비엇 — "대상은 특정 필드가 아니라
    **payload 전체**")은 `execution.waiting_for_input`도 `emitExecutionEvent` 경로를 타므로,
    fanout wire 에 실리는 `nodeOutput` 일반 키의 값도 이제 (SECRET_LEAK_PATTERNS 가 인식하는
    한도 내에서) 값-패턴 마스킹을 받는다 — 위 "잔여" 불릿이 미방어로 지목한 "author config
    값-embedded secret" 클래스를 최소 부분적으로 좁혔다. **위반은 아니다**(잔여 불릿이 논하는
    것은 값-마스킹과 별개인 키 allowlist/필드 축소 문제이고, 이번 PR 은 그걸 채택도 기각도
    하지 않았다) — 다만 선행 리뷰가 이미 낸 같은 지적이 이번 라운드에도 반영되지 않고 남아,
    "SSE emit 은 … 부분 방어"라는 방어-수단 서술이 같은 PR 로 추가된 두 번째 방어 층(값-패턴
    마스킹)을 언급하지 않아 최신 상태를 반영하지 못한다.
  - 제안: 해당 불릿에 "(2026-08-16 이후 값-패턴 마스킹 층이 추가돼 이 gap 이 부분적으로 축소됐다
    — §4.1 캐비엇 참조)" 1줄 교차 참조 추가. 강제 아님 — allowlist 자체의 미구현 상태·"저위험
    gap" 평가는 그대로 유효하다.

- **검증됨 — `llmCalls` strip-only 결정 비-번복**: WS `## Rationale`의 *"기각된 대안: 값-레벨
  마스킹은 에디터 디버깅 가치를 훼손"* 판정에 대해, 신규 값-패턴 마스킹 캐비엇이 스스로
  "**이 결정은 유지된다**"·"대체가 아니라 병존"이라 명시하고, 코드(`WIRE_PRESERVED_FIELDS` =
  `EXTERNAL_STRIPPED_FIELDS` 재사용, `deepRedactSecretsPreserving`의 `preserveKeys`)가 이를
  뒷받침한다. 기각된 대안("llmCalls 를 값-마스킹으로 대체")과 채택된 것("llmCalls 는 여전히
  strip, 다른 자유 텍스트 필드에 값-마스킹 신설")이 다른 스코프임을 텍스트가 정확히 구분한다.
- **검증됨 — webhook ingestion-time 마스킹 결정 비-충돌**: `12-webhook.md` Rationale
  ("민감 헤더 마스킹 — ingestion(저장) 시점 채택", *"display(응답) 시점 마스킹"* 을 명시적으로
  기각)과 신규 §R17 "언제 가리는가 — ingestion-time 과 egress-time 이 공존한다" 불릿을 대조.
  신규 egress 마스킹은 §5.3 이 기각한 "**같은 대상**(알려진 헤더 key)의 display 시점 마스킹"을
  재도입하는 것이 아니라 **다른 대상**(자유 텍스트 값-패턴)에 적용되며, 텍스트 스스로 "모순이
  아니라 대상이 다르다"로 명시한다. 코드 쪽 `redact-stored-error.ts`의 `redactStoredDataForResponse`
  JSDoc도 동일 논리를 반복해 spec·코드가 일치한다. `inputData` 는 이 egress 층의 대상에서
  명시적으로 **제외**되어 있어(Re-run 프리필 재제출 오염 방지), 헤더 key 보호는 여전히 ingestion
  층 단독 책임 — §5.3 결정 범위가 축소되지도 우회되지도 않았다.
  - 참고: `12-webhook.md` §5.3에 새로 추가된 캐비엇("스코프는 '알려진 민감 헤더 key' 한정이다")도
    "inputData 는 이미 전부 안전하다로 읽으면 그 갭이 가려진다"고 스스로 경고해, 과신을 차단하는
    방향으로 서술돼 있다.
- **검증됨 — `inputData` 되돌림(`b05756d9e`)의 근거 갖춤 여부**: 직전 세션이 냈던 CRITICAL
  (Re-run/히스토리 로드 재제출 경로가 egress 마스킹과 충돌해 `***` 가 실제 입력값으로 흘러감)을
  되돌린 결정이 `MASKED_INPUT_DATA_REASON`(코드 JSDoc, `executions.service.ts`)과 §R17 "잔여
  ②"(spec) 양쪽에 **동일 근거**로 동시 기록되어 있다 — 무근거 번복이 아니다.
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에도 후속 가드(프런트 마스킹
  마커 감지) 트래커 항목이 신설돼 "닫는 조건"이 실제로 추적된다. `plan/complete/
  spec-draft-eia-fanout-masking.md` 서두에도 "`inputData` 마스킹은 철회됐다 … 이 결정을
  근거로 재집행하지 말 것"이 명문화돼 향후 세션이 해소된 CRITICAL 을 되살릴 위험을 차단한다.
- **검증됨 — R10 단일 sink 정책 무모순**: `14-external-interaction-api.md` §R10("`WebsocketService`
  단일 sink" — 엔진은 `emitExecutionEvent`/`emitNodeEvent` 만 호출, 세 listener 는
  `executionEvents$` 구독)이 신규 마스킹 초크포인트(`maskWireEnvelope`)를 언급하지 않지만, 코드
  확인 결과 이 초크포인트는 `emitExecutionEvent`/`emitNodeEvent` **내부**(단일 발행점 자신)에
  위치해 `executionEventSubject.next` 호출 이전에 적용된다 — 새 발행점을 만들지 않으므로 R10 이
  기술하는 아키텍처(단일 발행점 → 다중 listener)를 깨지 않는다.
- **검증됨 — `execution-history` R-5 boundary masking parity 원칙과의 정합**: WS
  `maskWireEnvelope`/EIA §R17 양쪽이 원용하는 "안전성은 롤 게이팅이 아니라 서버 boundary masking
  parity 에 의존" 문구가 `2-navigation/14-execution-history.md`의 R-5 원문과 정확히 일치하고,
  그 문서에 이미 "R-5 의 대상 범위는 Config 탭 하나이며 `Execution.error` 등은 별개 정책(원용일
  뿐 기존 판정 아님)"이라는 캐비엇이 선행 커밋에 박혀 있어 이번 PR 의 원용이 R-5 범위를 부풀려
  읽는 것도 아니다.
- **검증됨 — `nodeName`→`nodeLabel` 정정은 재도입이 아니라 기존 drift 노트의 해소**:
  `origin/main` 판 WS 스펙에 이미 *"Note (spec drift): … nodeName 으로 표기되어 있으나 엔진 및
  프론트엔드는 모두 nodeLabel 을 사용 … 본 PR scope 밖"* 이라는 caveat 이 있었다. 이번 PR 은 그
  caveat 이 지목한 갭을 실측(엔진 emit 전수 `nodeLabel`, `nodeName` emit 0건)으로 닫은 것으로,
  기각된 대안의 재도입이 아니라 예정된 정정이다. `3-error-handling.md` §2.2 예시도 동일 근거로
  함께 정정됐다.
- **검증됨 — chat-channel CCH-MP-06 "그대로" 문구와 신규 값-마스킹의 충돌은 caveat 으로 해소**:
  `81c9fcd60` 자체가 impl-done 리뷰에서 나온 CRITICAL(CCH-MP-06 verbatim 계약과 신규 emit
  값-마스킹의 충돌)을 캐비엇 추가로 해소한 이력이다. 채택한 안(캐비엇 추가)이 "그대로" 의 의미
  범위를 "emit 계층 마스킹 이후 값"으로 명확히 하고, 리뷰어가 제안한 대안(presentation 필드
  carve-out — 이 PR 이 닫은 외부 누출을 다시 여는 조치)은 §R17 `ai_message` 불릿의 선례("내부
  WS·Chat Channel 도 마스킹됨 — 수용된 trade-off")와 같은 방향으로 명시적으로 기각했다. 결정
  기록이 충분하다.

## 요약

target 변경(`3-error-handling.md`·`6-websocket-protocol.md`·`12-webhook.md`·
`14-external-interaction-api.md`·`15-chat-channel.md`)은 기존 `## Rationale`/`§R17`/WS
`## Rationale` 카탈로그를 확장·정정하는 문서 커밋이며, 과거 명시적으로 기각된 대안(`llmCalls`
값-마스킹 대체, webhook display-시점 마스킹, raw-WS/REST 대체 등)을 이유 없이 재도입한 사례는
없다. 오히려 이 PR 은 "결정을 뒤집을 때는 같은 자리에 새 근거를 남긴다"는 이 저장소의 관행을
spec·코드 양쪽에서 일관되게 지킨 사례(`inputData` 되돌림, `llmCalls` 비-번복 명시, ingestion vs
egress 공존 설명, CCH-MP-06 caveat)로 평가된다. 선행 리뷰(`00_22_23`)가 낸 INFO 2건 중 1건("4곳"
stale 수치)은 후속 커밋에서 실제로 정정을 확인했고, 나머지 1건(`nodeOutput` allowlist 잔여 노트
미갱신)은 이번 라운드에도 미반영 상태로 남아 재기재했다 — 다만 결정 자체의 번복·원칙 위반이
아니라 서술 최신화 누락이므로 INFO 수준을 유지한다.

## 위험도

LOW
