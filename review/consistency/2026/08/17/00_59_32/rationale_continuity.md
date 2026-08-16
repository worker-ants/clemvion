# Rationale 연속성 검토 결과

## 검토 대상

- 범위: `spec/5-system/` (impl-done, diff-base `origin/main`, HEAD `055ca996f`)
- prompt 번들이 예산 초과로 다수 파일이 절단되어, 워크트리 절대경로에서 직접
  `git diff origin/main...HEAD -- spec/5-system/ spec/1-data-model.md` 및 `git log`를
  1차 근거로 삼았다. 실제 변경 spec 은 7개: `1-data-model.md` · `5-system/3-error-handling.md` ·
  `5-system/6-websocket-protocol.md` · `5-system/12-webhook.md` · `5-system/13-replay-rerun.md` ·
  `5-system/14-external-interaction-api.md` · `5-system/15-chat-channel.md`.
- **선행 리뷰 확인**: 같은 세션 계열 `review/consistency/2026/08/17/00_47_04/rationale_continuity.md`
  가 직전 상태(커밋 `81c9fcd60`까지)를 이미 정밀 검토해 CRITICAL/WARNING 0, INFO 1건(+ 해소
  확인 1건)을 냈다. 그 뒤 최신 커밋 `055ca996f`("내 변경이 거짓으로 만든 `1-data-model` §2.13
  단언 정정 + Re-run 캐비엇")가 추가로 `spec/1-data-model.md`·`13-replay-rerun.md`를 갱신했다.
  아래는 **`055ca996f` 포함 최종 target 상태** 기준 재검토이며, 이미 검증된 항목은 중복 서술을
  피하고 "재확인"으로 축약한다.

## 발견사항

- **[해소 확인] `1-data-model.md` §2.13 "응답 마스킹" 행의 자기모순(개수·emit 포함 여부) — `055ca996f`가 정정**
  - target 위치: `spec/1-data-model.md` §2.13 "응답 마스킹" 행
  - 과거 결정 출처: 같은 문서 자신의 종전 서술 — "**열거된 읽기 경로에서만**… `ExecutionsService`
    4곳(...) + `BackgroundRunsService` body 노드" / "WS `execution.node.*` **emit** 등 별도 emit
    계약 경로는 **미포함**이다"
  - 상세: 이번 PR 이 §R17 표면을 4곳→6곳(2컬럼)으로 늘리고 WS `execution.node.*` emit 에도
    값-패턴 마스킹을 신설하면서, `spec/5-system/` 바깥에 있던 `1-data-model.md` §2.13 의 위 두
    단언이 **거짓**이 되었다(작성자 스스로 커밋 메시지에서 "내 변경이 만든 drift"로 인정).
    `055ca996f`는 개수 서술을 지우고 `[EIA §R17]`을 정본으로 가리키게 했으며, "emit 미포함"
    문장을 "2026-08-16 부터 WS emit 경로도 값-패턴 마스킹 대상"으로 정정했다. 결정 자체의
    번복이 아니라 원래 결정(§R17 확장)을 뒤늦게 놓친 파생 서술을 같은 턴에 바로잡은 것이라
    "무근거 번복"에 해당하지 않는다.
  - 조치: 불요 (이미 해소됨). 검증 방법: 위 diff(`git diff origin/main...HEAD -- spec/1-data-model.md`)
    확인 — 개수·"미포함" 두 단언 모두 삭제·정정됨.

- **[해소 확인] `13-replay-rerun.md` §10.2 — `inputData` 비-마스킹 캐비엇 신설로 "결정의 이유"가 그 결정이 적용되는 자리에도 기록됨**
  - target 위치: `spec/5-system/13-replay-rerun.md` §10.2 "재실행 모달" 직후 신규 인용 블록
  - 과거 결정 출처: `14-external-interaction-api.md` §R17 "잔여 ② — `inputData` 는 의도적
    비대상" (`b05756d9e`로 확정된 철회 결정)
  - 상세: 철회 결정 자체는 `b05756d9e`에서 `§R17`에 이미 근거와 함께 기록되어 있었으나, 그
    결정이 실제로 적용되는 자리(Re-run 모달의 프리필+제출 흐름을 서술하는 §10.2)에는 침묵이
    남아 있었다. `055ca996f`가 그 자리에 동일 근거(프리필+토글 기본값 OFF→재제출, 토글 ON 시
    무관)를 요약 인용하고 SoT 로 `EIA §R17`을 가리키는 캐비엇을 추가해, "결정은 한 곳에 있는데
    그 결정이 뒤집는 상황을 서술하는 다른 곳은 여전히 예전 가정처럼 읽히는" 정합성 갭을 닫았다.
    새 Rationale 을 별도로 창작한 것이 아니라 기존 SoT를 적용 지점에서 다시 가리키는 형태라
    이중 관리 위험도 없다.
  - 조치: 불요 (이미 해소됨).

- **[INFO] (선행 리뷰에서 이미 지적, 이번 라운드에도 미반영 — 재기재) `nodeOutput` 일반 키 allowlist 잔여 노트가 신규 emit 값-마스킹 층을 반영하지 않음**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 말미 "`nodeOutput` 일반 키
    allowlist (미구현·잔여)" 불릿 (diff 미변경 컨텍스트 — `055ca996f`도 이 불릿을 손대지 않음)
  - 과거 결정 출처: 같은 불릿 — "SSE emit 은 `sanitizePayloadForWs` 의 credential-**키** 마스킹으로
    **부분 방어**; author config 의 **값-embedded secret 은 저위험 gap**"
  - 상세: 이번 PR 계열이 신설한 `execution.node.*`/비-종결 `execution.*` emit 값-패턴 마스킹은
    `execution.waiting_for_input` 도 같은 `emitExecutionEvent` 경로를 타므로, 이 불릿이 "저위험
    gap"으로 지목한 "author config 값-embedded secret" 클래스가 최소 부분적으로는 이미 값-마스킹
    대상에 포함된다. 결정 위반은 아니다 — 이 불릿이 논하는 것은 값-마스킹과 별개인 키
    allowlist/필드 축소 미구현 상태이고, 이번 PR 이 그 미구현 상태를 채택도 기각도 하지 않았다.
    다만 방어-수단 서술이 같은 PR 로 추가된 두 번째 방어층(값-패턴 마스킹)을 언급하지 않아
    최신 상태를 온전히 반영하지 못한다.
  - 제안: 해당 불릿에 "(2026-08-16 이후 값-패턴 마스킹 층이 추가돼 이 gap 이 부분적으로 축소됐다
    — §4.1 캐비엇 참조)" 1줄 교차 참조 추가. 강제 아님 — allowlist 자체의 미구현 상태·"저위험 gap"
    평가는 그대로 유효하다.

- **재확인 — `llmCalls` strip-only 결정 비-번복**: WS `## Rationale` 의 "기각된 대안: 값-레벨
  마스킹은 에디터 디버깅 가치를 훼손" 판정에 대해, 신규 값-패턴 마스킹 캐비엇이 스스로 "이
  결정은 유지된다"·"대체가 아니라 병존"이라 명시한다. 기각된 대안("llmCalls 를 값-마스킹으로
  대체")과 채택된 것("llmCalls 는 여전히 strip, 다른 자유 텍스트 필드에 값-마스킹 신설")이 다른
  스코프임을 텍스트가 정확히 구분한다.
- **재확인 — webhook ingestion-time 마스킹 결정과 신규 egress 마스킹 비-충돌**: `12-webhook.md`
  Rationale "민감 헤더 마스킹 — ingestion(저장) 시점 채택(2026-07-07)"이 명시적으로 기각한 것은
  "**같은 대상**(알려진 헤더 key → `inputData`)의 display(응답) 시점 마스킹"이다. 신규 §R17
  egress 마스킹은 **다른 대상**(자유 텍스트 값-패턴, `error`/`outputData`/emit payload)에
  적용되고 `inputData` 는 명시적으로 제외되어 있어, 기각된 대안의 재도입이 아니다. §R17 자체가
  "언제 가리는가 — ingestion-time 과 egress-time 이 공존한다" 불릿으로 이 구분을 스스로 서술한다.
- **재확인 — `nodeName`→`nodeLabel` 정정은 재도입이 아니라 기존 drift 노트의 예정된 해소**:
  `origin/main` 판 WS 스펙에 이미 "Note (spec drift): … nodeName 으로 표기되어 있으나 엔진 및
  프론트엔드는 모두 nodeLabel 을 사용 … 본 PR scope 밖"이라는 caveat 이 있었다. 이번 PR 은 그
  caveat 이 지목한 갭을 실측(엔진 emit 전수 `nodeLabel`, `nodeName` emit 0건)으로 닫았다.
  `3-error-handling.md` §2.2 예시도 같은 근거로 동시 정정됐다. 원칙 위반이 아니다.
- **재확인 — R10 단일 sink 정책·R-5 boundary masking parity 원용 무모순**: 신규 마스킹
  초크포인트(`WebsocketService` 내부)는 `executionEventSubject.next` 호출 이전에 위치해 새
  발행점을 만들지 않으므로 §R10(단일 sink)을 깨지 않는다. `2-navigation/14-execution-history.md`
  R-5 에는 이미 "R-5 의 대상 범위는 Config 탭 하나이며 `Execution.error` 등은 별개 정책(원용일
  뿐 기존 판정 아님)" caveat 이 선행 커밋에 박혀 있어, 이번 PR 의 원용이 R-5 범위를 부풀려 읽는
  것도 아니다.
- **재확인 — CCH-MP-06 "그대로" 문구와 신규 값-마스킹의 충돌은 caveat 으로 해소**: `81c9fcd60`가
  "emit 계층 마스킹 이후 값"으로 문구 범위를 명확히 했고, 대안(presentation 필드 carve-out —
  이 PR 이 닫은 외부 누출을 다시 여는 안)은 §R17 `ai_message` 불릿의 선례와 같은 방향으로
  명시적으로 기각했다.

## 요약

이번 라운드의 유일한 실질 변화는 최신 커밋 `055ca996f`이며, 이는 새로운 결정을 도입한 것이
아니라 **직전 커밋들이 `spec/5-system/` 안에서 §R17 을 확장하며 `spec/5-system/` 밖의
`1-data-model.md` §2.13 을 갱신하지 못해 생긴 spec-spec 자기모순(개수·emit 포함 여부)을 같은
턴에 스스로 잡아 정정**한 것이고, `13-replay-rerun.md` 에는 이미 확정된 `inputData` 철회 결정의
근거를 그 결정이 실제로 작동하는 화면 서술 자리에도 캐비엇으로 옮겨 적었다. 두 변경 모두 새
Rationale 항목을 창작하지 않고 기존 SoT(§R17)를 가리키는 형태를 유지해 이중 관리·drift 재발
위험을 만들지 않는다. 과거 `## Rationale`에서 명시적으로 기각된 대안(`llmCalls` 값-마스킹 대체,
webhook display-시점 마스킹, raw-WS/REST 대체 등)을 이유 없이 재도입한 사례는 이번에도 발견되지
않았다. 유일한 잔여는 두 라운드 연속 미반영 상태인 INFO 1건(nodeOutput allowlist 잔여 노트의
교차 참조 누락)으로, 서술 최신화 누락일 뿐 결정 위반이 아니다.

## 위험도

LOW
