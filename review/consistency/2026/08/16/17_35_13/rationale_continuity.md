# Rationale 연속성 검토 — spec/5-system/ (--impl-done)

## 검토 방법

- 조립 프롬프트의 `<git diff origin/main...HEAD -- code_areas>` 블록이 컨텍스트 예산 초과로
  절단돼 있어, 저장소에서 직접 `git diff origin/main...HEAD -- spec/5-system/ codebase/` 를
  재현해 대조했다 (diff base 는 프롬프트가 명시한 `origin/main...HEAD`, CWD 는 대상
  워크트리 `eia-followups-1464c0` 자체라 별도 절대경로 지정 불요).
- 변경된 두 target spec(`spec/5-system/14-external-interaction-api.md` §R17,
  `spec/5-system/6-websocket-protocol.md` §6.2)과, 함께 바뀐 인접 spec
  (`spec/2-navigation/14-execution-history.md` R-5, `spec/4-nodes/1-logic/12-background.md`,
  `spec/conventions/secret-store.md`)의 diff를 실물로 확인.
- 코드 diff(`redact-stored-error.ts` 신설, `executions.service.ts`,
  `background-runs.service.ts`)를 spec 서술과 대조해 "spec 이 주장하는 마스킹 범위"가
  실제 코드 호출 그래프와 일치하는지 실측(`emitExecutionSnapshot` → `findById` 경유,
  `stop()` 반환값 미소비 등)으로 검증.
- 오늘 같은 날 앞선 3라운드(`16_03_57` impl-prep, `16_32_42`/`16_48_55` plan-target)의
  `rationale_continuity.md`·`cross_spec.md` 산출물을 원문 대조해, 그 라운드들이 낸
  WARNING/CRITICAL 이 이번 최종 diff에서 실제로 해소됐는지 확인.

## 발견사항

없음 — CRITICAL/WARNING 급 Rationale 연속성 위반은 발견되지 않았다.

- **[INFO] 이전 라운드 CRITICAL(`16_32_42` cross_spec) — `nodeExecutions[].error` 형제 필드
  우회 — 이번 diff에서 실제로 닫힘 (확인)**
  - target 위치: `codebase/backend/src/modules/executions/executions.service.ts` `findById`
    (nodeExecutions map 블록), `spec/5-system/14-external-interaction-api.md` R17 "**`nodeExecutions[].error`
    도 함께 마스킹한다**" 불릿
  - 과거 결정 출처: `spec/1-data-model.md` §2.14 "Execution.error ↔ NodeExecution.error 관계"
    (`Execution.error` = 최초 failed `NodeExecution.error` 의 **복사**)
  - 상세: 앞선 라운드는 top-level `error` 만 마스킹하고 같은 응답의 `nodeExecutions[]` 배열은
    원문 그대로 반환하면 "같은 문자열이 같은 응답에 원문으로 병존"해 방어가 통째로 우회된다는
    CRITICAL 을 냈다. 이번 diff는 `reconcilePreParkWaitingStatus` 이후 `nodeExecutions` 를
    `error == null` 가드 + copy-on-change 로 `redactStoredErrorForResponse` 를 태우고, 자매 표면인
    `BackgroundRunsService` body 노드 응답에도 동일 함수를 적용했다. spec 텍스트(R17 "적용
    범위는 총칭이 아니라 열거다" 불릿)도 4경로 + BackgroundRunsService 로 범위를 정확히
    이름 붙여, "모든 내부 읽기 경로" 로 과잉 일반화하지 않도록 스스로 가드를 남겼다.
  - 제안: 없음 — 이미 반영·검증됨.

- **[INFO] R17 "내부 REST 와의 비대칭은 미결이다" → 결정 확정 — 번복이 아니라 미결 해소,
  새 Rationale 동봉 (재확인)**
  - target 위치: `spec/5-system/14-external-interaction-api.md` R17 마지막 불릿 교체분
  - 과거 결정 출처: 동일 불릿의 종전 문구("어느 쪽이 옳은지는 아직 정하지 않았다") — 명시적
    미결 상태이지 이미 내려진 결정이 아니었다.
  - 상세: 교체 문구는 근거(§R-5 원칙 원용 + "R-5 가 이미 규정한 것은 아니다" caveat,
    `execution.ai_message` 선례, `@Roles` 게이트 부재 실측, egress-only 불변 보존, 범위 밖
    항목 3가지 명시)를 온전히 새로 작성했다 — "결정의 무근거 번복" 기준(관점 3)을 충족하지
    않는다. `spec/2-navigation/14-execution-history.md` R-5 에도 "R-5 의 대상 범위는 Config
    탭 하나이고 `Execution.error` 를 이미 규정하고 있지는 않다"는 caveat 을 동일 커밋에서
    함께 추가해 과대인용을 스스로 차단했다.
  - 제안: 없음.

- **[INFO] `secret-store.md` "모든 도메인 모듈은 SecretResolver 경유" 원칙과 신규
  `triggerToken` 예외 — 독립 근거 + 서두 caveat 모두 반영 (재확인)**
  - target 위치: `spec/conventions/secret-store.md` 서두 문장 및 §1 신규
    "비대상 — `Trigger.config.interaction.triggerToken`" 블록
  - 과거 결정 출처: `secret-store.md` `## Rationale` R1(Application-side AES-256-GCM,
    "마스터키가 app↔DB 경계를 절대 넘지 않음") + 기존 유일 예외 `AuthConfig.config`
    ("다른 메커니즘으로 동등하게 암호화된다"가 근거)
  - 상세: 오늘 앞선 두 라운드가 각각 (a) `AuthConfig.config` 예외 문구를 그대로 재사용하지
    말고 독립 근거를 세울 것, (b) 서두의 "모든 도메인 모듈은 경유" 문장에 비대상 예외
    caveat 을 달 것을 제안했는데, 이번 diff는 두 제안을 모두 반영했다 — 서두에
    "[§1 하단의 필드 단위 명시적 비대상 예외]는 제외하며, 그 예외는 각각 자기 근거를 갖는다
    (다른 예외의 근거를 재사용하지 않는다)" 를 추가했고, §1 블록은 (a)~(c) 독립 근거 +
    "이 블록을 평문 보관 일반의 선례로 인용하면 안 된다" 가드 문구를 유지했다.
  - 제안: 없음.

- **[INFO] WS `execution.snapshot` 마스킹 상속 서술 — 실제 호출 그래프와 일치 (실측 확인)**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §6.2 `execution.snapshot` 행
    추가분 "nest 된 `execution.error` 와 `execution.nodeExecutions[].error` 는 `findById` 의
    마스킹 관문을 상속한다"
  - 과거 결정 출처: 없음(신규 서술이나, EIA §R17 "종결 emit ↔ 그 밖의 모든 읽기 경로" 축
    재정의와 짝을 이룸)
  - 상세: `websocket.gateway.ts` `emitExecutionSnapshot` 이 `this.executionsService.findById(...)`
    를 그대로 호출해 emit 하므로(코드 실측), spec 이 주장하는 "findById 관문 상속"은 실제
    호출 그래프와 정확히 일치한다. 같은 행이 "`execution.node.*` emit 은 이 관문을 지나지
    않아 아직 원문" 이라 명시한 것도 R17 "잔여(범위 밖) ①" 과 정합적이다.
  - 제안: 없음.

- **[INFO] `stop()` 반환 타입 축소(`Execution` → `ResponseExecution`) 코드 주석의
  "내부 소비자는 반환값을 버린다" 주장 — 실측 일치**
  - target 위치: `executions.service.ts` `stop`/`stopInternal` 문서화 주석
  - 상세: `interaction.service.ts`(2곳)·`hooks.service.ts`(1곳)는 `await
    this.executionsService.stop(...)` 를 반환값 할당 없이 호출하고, `executions.controller.ts`
    만 반환값을 그대로 HTTP 응답으로 돌려준다 — 주석의 "영향은 HTTP 응답 표면 하나뿐" 주장이
    실측과 일치해 spec/코드가 근거 없는 주장을 하고 있지 않다.
  - 제안: 없음.

## 요약

이번 diff는 EIA §R17 이 스스로 "미결"이라 적어 둔 내부 REST↔WS 읽기 경로의 `Execution.error`
마스킹 비대칭을, 근거를 온전히 새로 작성해 확정하는 결정이다. 오늘 앞서 진행된 3라운드
(`16_03_57` impl-prep, `16_32_42`/`16_48_55` plan-target)의 rationale_continuity·cross_spec
checker 가 낸 WARNING(“toTerminalErrorPayload 미재사용”·“AuthConfig.config 근거 재사용”·
“secret-store.md 서두 caveat 부재”)과 CRITICAL(“`nodeExecutions[].error` 형제 필드 우회”)을
이번 최종 diff에서 직접 코드/spec 대조로 재검증한 결과 전부 반영·해소돼 있었다 — 특히
CRITICAL 이었던 형제 필드 우회는 `nodeExecutions` map + `BackgroundRunsService` 양쪽에
동일 마스킹 함수가 적용돼 닫혔다. `1-data-model.md` §2.14 의 원본/복사 관계, `2-navigation/
14-execution-history.md` R-5 의 적용 범위(Config 탭 한정) caveat, `secret-store.md` R1(app-side
AES-256-GCM)·기존 `AuthConfig.config` 예외와의 관계, DB egress-only 불변식(내부 소비처는
faithful 유지) 모두 이번 diff가 정확히 지키며 새 Rationale 을 동봉했다. 기각된 대안의
무근거 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 중 어느 것도 발견되지 않았다.

## 위험도

NONE
