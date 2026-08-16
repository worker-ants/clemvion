# Rationale 연속성 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 검토 범위 요약

프롬프트 번들 내 실제 git diff 가 컨텍스트 예산 초과로 생략되어 있었으므로, 워크트리에서
`git diff origin/main...HEAD -- spec/` 를 직접 실행해 변경분을 확보했다. 변경된 spec 파일은
다음 5개뿐이다 (전부 동일 작업 — `plan/in-progress/eia-internal-rest-error-masking.md`,
트래커 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 I1·D 항목 집행):

- `spec/5-system/14-external-interaction-api.md` (§7.2, §R17)
- `spec/5-system/6-websocket-protocol.md` (`execution.snapshot` 행)
- `spec/conventions/secret-store.md` (§1 비대상 예외 + Overview 문구)
- `spec/4-nodes/1-logic/12-background.md` (§8.2 `nodeExecutions.data` 행)
- `spec/2-navigation/14-execution-history.md` (R-5 대상 범위 캐비엇)
- `spec/1-data-model.md` (§2.14 NodeExecution 표 "응답 마스킹" 행)

변경 내용: 종전 `## Rationale` §R17 이 "내부 REST 와의 비대칭은 **미결이다**" 로 명시적으로
열어 두었던 항목을, "내부 읽기 경로(`ExecutionsService` 4경로 + WS `execution.snapshot` +
`background-runs` body 노드)에도 종결 emit 과 동일한 egress 마스킹을 적용한다" 는 결정으로
닫았다. 함께 `Trigger.config.interaction.triggerToken` 을 `secret-store.md §1` 의 명시적
비대상 예외로 등재했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 미결(open) 항목의 결정 전환은 "기각된 대안 재도입"이 아니라 정상적인 완결
  — 근거 확인
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17, "내부 읽기 경로도
    같은 마스킹을 적용한다 (결정 2026-08-16)" 불릿
  - 과거 결정 출처: 같은 문서 §R17 (수정 전) "내부 REST 와의 비대칭은 **미결이다** … 어느
    쪽이 옳은지는 아직 정하지 않았다"
  - 상세: 이 문구는 확정된 결정이 아니라 명시적으로 열어 둔 미해결 항목(open question)이었다
    (`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 I1 로 트래킹). 따라서
    이번 target 변경은 "이미 기각된 대안의 재도입"도 "무근거 번복"도 아니라, 트래커에 등재된
    미결 항목을 사용자가 택일해 닫은 정상 케이스에 해당한다. target 은 (a) 결정 배경, (b) 적용
    범위(4경로 열거, 총칭 금지 명시), (c) 근거(EIA R17 `execution.ai_message` 선례 + 실행내역
    R-5 원칙의 **원용**이지 기존 판정 아님을 명시), (d) DB 원문 보존(egress-only 원칙 불변),
    (e) 잔여 범위 밖 항목(WS `execution.node.*` emit·`inputData`/`outputData`·workflow-assistant
    도구) 을 모두 새 Rationale 불릿에 함께 기록했다 — "결정의 무근거 번복" 회피 기준을 충족한다.
  - 제안: 없음 (현행 유지 권장). 참고로 이 항목은 트래커(`spec-sync-external-interaction-api-gaps.md`)
    에서 이미 `[x]` 로 닫히고 결정 근거 링크가 남아 있어 추적 가능하다.

- **[INFO]** 인접 Rationale 과의 과대인용(over-citation) 위험을 target 스스로 사전 차단
  - target 위치: `spec/2-navigation/14-execution-history.md` R-5 상단에 추가된
    "R-5 의 대상 범위 (2026-08-16 추가)" 캐비엇; `spec/5-system/14-external-interaction-api.md`
    §R17 신규 불릿의 "단 R-5 의 직접 대상은 Config 탭이라 `Execution.error` 를 이미 규정하고
    있지는 않다" 문장
  - 과거 결정 출처: `spec/2-navigation/14-execution-history.md` R-5 ("노드 상세 Config 탭이
    viewer 롤에도 노출되지만 안전한 이유" — "안전성은 롤 게이팅이 아니라 서버 boundary masking
    parity 에 의존")
  - 상세: R-5 는 원래 Config 탭(노드 handler config echo, write-시점 마스킹)에 한정된 결정이다.
    금번 변경은 이 원칙을 `Execution.error`(response-egress 마스킹, 다른 레이어)의 근거로
    **원용**하면서도, "R-5 가 이미 이 필드를 규정하고 있었다"는 잘못된 결론으로 읽히지 않도록
    R-5 문서 자체에 범위 캐비엇을 동반 추가했다. Rationale 인용이 대상 범위를 넘어 확장 해석될
    위험을 예방한 사례로, 별도 조치 불필요.
  - 제안: 없음.

- **[INFO]** 신규 예외(비대상) 등재 시 "선례로 확장 인용 금지" 를 명시 — 향후 유사 오용 예방
  - target 위치: `spec/conventions/secret-store.md` §1, `Trigger.config.interaction.triggerToken`
    비대상 블록의 "따라서 이 블록을 '평문 보관 일반의 선례'로 인용하면 안 된다" 문장
  - 과거 결정 출처: 같은 §1 의 기존 `AuthConfig.config` 비대상 예외
    ("다른 메커니즘으로 동등하게 암호화된다"가 근거)
  - 상세: target 은 신규 예외의 근거를 기존 `AuthConfig.config` 예외 문구 재사용이 아니라
    독립 근거(a·b·c)로 세우고, 두 예외가 "같은 종류가 아님"을 명시했다. 또한 근거 (a)(hot-path
    성능)가 해시+`timing-safe compare` 반례로 "평문이 불가피"가 아님을 스스로 인정하고 근거를
    (c)(위험 프로파일 차이)로 좁혔다 — `/ai-review` 4라운드에서 지적된 논리 결함을 target 자체가
    이미 반영한 상태다. Rationale 재사용을 통한 무근거 확장(세 번째 필드가 이 문단을 근거로
    평문 보관을 정당화하는 것)을 문서 차원에서 차단하고 있어 바람직한 패턴이다.
  - 제안: 없음.

## 교차 검증 메모

- `spec/1-data-model.md` §2.14 `NodeExecution` 표의 "복사" 행("최초 failed NodeExecution 의
  에러 정보를 복사")이 §R17 신규 불릿의 "같은 문자열이 같은 응답 안에 원문으로 병존" 주장의
  근거로 정확히 인용되고 있음을 확인했다 (`spec/1-data-model.md:561`). 이 인용은 실재하며
  왜곡 없음.
- `spec/4-nodes/1-logic/12-background.md` §8.2 `nodeExecutions.data` 행, `spec/5-system/
  6-websocket-protocol.md` 의 `execution.snapshot` 행 모두 §R17 의 신규 결정을 정확히 참조하며
  서로 모순되지 않는다.
- 신규 마스킹 함수(`redactStoredErrorForResponse`)가 기존 §R17 확립 원칙(`toTerminalErrorPayload`
  = 종결 emit 전용 wire-정규화 초크포인트, egress-only, DB 원문 보존)을 재사용하지 않고 별도
  함수로 분리한 이유("형태를 바꾸지 않는다 — 내부 응답 계약은 유지, 값만 마스킹")를 target 이
  명시적으로 적어 두어, "왜 기존 단일 초크포인트를 재사용하지 않았는가"에 대한 근거 공백이 없다.
- 과거 Rationale 이 이 항목을 `spec-sync-external-interaction-api-gaps.md` 트래커에서 "미결"로
  열어 두었을 뿐, 어떤 spec 문서에서도 "내부 REST 는 항상 원문이어야 한다"는 확정 원칙을 선언한
  바 없음을 grep 으로 확인했다 (`미결이다`/`아직 정하지 않았다` 패턴이 수정 전 §R17 한 곳에만
  존재). 따라서 이번 변경이 뒤집는 "합의된 원칙"은 존재하지 않는다.

## 요약

target 은 `spec/5-system/14-external-interaction-api.md` §R17 에서 과거 명시적으로 "미결"로
남겨 두었던 내부 읽기 경로 마스킹 여부를 결정하고 닫았을 뿐, 어떤 spec 의 `## Rationale` 에서
이미 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하지 않는다. 오히려 (1) 결정 배경·적용
범위·근거·잔여 범위를 모두 같은 불릿에 기록하고, (2) 원용한 타 문서 원칙(R-5)에 대해 과대인용을
막는 캐비엇을 그 문서 쪽에도 동반 추가하고, (3) 신규 비대상 예외가 향후 다른 필드의 선례로
오용되지 않도록 명시적으로 금지 문구를 남기는 등, Rationale 연속성 관점에서 모범적으로 처리된
변경이다. 관련 6개 spec 파일(1-data-model.md 포함) 간 상호 참조도 모두 정합적이다.

## 위험도

NONE
