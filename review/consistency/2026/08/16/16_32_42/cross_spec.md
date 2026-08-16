# Cross-Spec 일관성 검토 — `plan/in-progress/eia-internal-rest-error-masking.md` (`--spec`)

## 방법론 노트

번들 프롬프트(`_prompts/cross_spec.md`, 3,608줄)는 컨텍스트 예산 초과로 target 의 spec_impact
파일 자체(`spec/5-system/14-external-interaction-api.md`)를 포함해 대부분의 영역이 "본문
생략됨" 으로 절단됐고, `spec_impact` 에 명시된 `spec/conventions/secret-store.md` 는 번들에
아예 등장하지 않았다(placeholder 조차 없음 — 프롬프트 조립기가 `conventions/` 를 통째로
떨구는 기존 결함, MEMORY 기록과 일치). 이 결함을 우회해 실제 저장소 파일을 직접 `Read`/`grep`
했다: `spec/5-system/14-external-interaction-api.md`, `spec/conventions/secret-store.md`,
`spec/1-data-model.md`, `spec/2-navigation/14-execution-history.md`,
`spec/3-workflow-editor/3-execution.md`(§10.6.1), `spec/5-system/6-websocket-protocol.md`,
그리고 이미 구현이 끝난 코드(`executions.service.ts`, `page.tsx`, `redact-stored-error.ts`)를
대조해 target 의 실측 주장 자체를 검증했다.

## 발견사항

- **[CRITICAL]** R17 draft 가 주장하는 "내부 읽기 경로도 같은 마스킹을 적용한다"가 같은
  엔드포인트 응답 안에서 형제 필드로 우회된다 — `nodeExecutions[].error`
  - target 위치: `plan/in-progress/eia-internal-rest-error-masking.md` §"범위 밖" 의
    `NodeExecution.error` 불릿 및 "spec 초안 ①" (`14-external-interaction-api.md` §R17 교체안,
    `:1484` 불릿 대체 텍스트)
  - 충돌 대상: `spec/1-data-model.md` §2.14 "**Execution.error ↔ NodeExecution.error 관계**"
    (`:556-563`, 원본/복사 표) · `spec/2-navigation/14-execution-history.md` R-5 (`:464-466`,
    "안전성은 롤 게이팅이 아니라 서버 boundary masking parity 에 의존") ·
    `spec/5-system/6-websocket-protocol.md` `execution.node.failed` 정의(`:186`, 마스킹 언급 없음)
  - 상세: `spec/1-data-model.md` 는 `Execution.error` 가 "워크플로우 실행이 `failed` 상태로
    전이될 때 **최초 failed `NodeExecution`의 에러 정보를 복사**"한 값이라고 명시한다 — 즉 실패
    시점에 두 필드는 **동일한 내용**을 담는다. 그런데 실측하면 `GET /api/executions/:id`
    (`findById`, `executions.service.ts:540-618`)는 이번 결정으로 top-level `error`
    (`toResponseExecution` 경유 → `redactStoredErrorForResponse`)는 마스킹하지만, **같은 응답의
    `nodeExecutions` 배열은 `manager.find(NodeExecution, …)` 로 가져온 원시 엔티티를 그대로
    반환**하며 어떤 마스킹도 거치지 않는다(`:566-618`). 프런트엔드도 같은 페이지에서 두 값을
    나란히 렌더한다 — 실패 배너는 마스킹된 `execution.error?.message`
    (`executions/[executionId]/page.tsx:393-395`)를 쓰지만, 노드 상세 Error 탭은 **미마스킹**
    `ne.error?.message`(같은 파일 `:493`)를 그대로 보여준다. `execution.node.failed` WS 이벤트도
    스펙상 마스킹 언급이 없다(`6-websocket-protocol.md:186`).
    target 의 R17 §근거는 이 엔드포인트의 위협 모델을 "`@Roles` 게이트가 없어 viewer 포함 전원이
    조회 + 프런트가 원문 렌더"로 명시적으로 세우고, 그래서 마스킹을 정당화한다. 그러나 그 동일한
    위협 모델이 `nodeExecutions[].error` 로 **그대로 살아 있다** — viewer 는 실패 배너 대신 실패
    노드를 클릭하기만 하면 (데이터 모델상 그 배너와 동일한 원문 값을) 그대로 본다. target 은 이를
    "**같은 클래스**의 유출 가능성이 있다"(범위 밖 절)고 일반적으로만 적는데, 실제로는 "같은
    클래스"가 아니라 spec 이 명시한 **동일 값의 형제 필드**이고, **같은 HTTP 응답 바디** 안에
    나란히 존재한다 — 정본 트래커(`spec-sync-external-interaction-api-gaps.md:205-210`)에 이미
    "같은 클래스의 유출 가능성이 있다"로 등재돼 있는 문구도 같은 과소평가를 반복한다.
    이 상태에서 "spec 초안 ①"을 그대로 `14-external-interaction-api.md` §R17 에 적용하면, R17 은
    "내부 읽기 경로도 같은 마스킹을 적용한다(결정 2026-08-16)"고 **일반화된 보장**을 선언하지만,
    같은 엔드포인트의 실제 동작은 그 보장을 충족하지 않는다 — spec 자신의 §근거(위협 모델)와
    spec 자신의 데이터 모델 정의가 서로를 반증하는 상태로 발행된다.
  - 제안: (a) 이번 PR 의 마스킹 범위를 `findById` 가 반환하는 `nodeExecutions[].error` 까지
    확장하거나, (b) 확장하지 않기로 한다면 "spec 초안 ①"에 "`GET /api/executions/:id` 는 최상위
    `error` 만 마스킹하며, 같은 응답의 `nodeExecutions[].error`는 (데이터 모델상 원본과 동일
    내용을) 여전히 원문으로 노출한다"는 캐비엇을 **필수**로 추가한다. 그리고 정본 트래커의
    `NodeExecution.error` 항목(`spec-sync-external-interaction-api-gaps.md:205-210`) 문구를
    "같은 클래스의 유출 가능성" 대신 "`Execution.error` 와 **동일 값의 복사 원본**이 같은
    엔드포인트 응답에서 미마스킹 상태로 병존"으로 정정해 우선순위를 격상한다. (b)를 택하는 경우
    `spec/2-navigation/14-execution-history.md` R-5 옆에도 "이 불변식은 현재 `Execution.error`
    한 필드에만 적용되고 `NodeExecution.error`는 잔여 갭"이라는 캐비엇을 남겨야 R-5 를 원용하는
    미래 독자가 오독하지 않는다.

- **[WARNING]** "spec 초안 ①" 텍스트가 target 자신이 이미 폐기한 함수명을 그대로 spec 에 심는다
  - target 위치: `plan/in-progress/eia-internal-rest-error-masking.md:163`
    ("spec 초안 ①" `14-external-interaction-api.md` §R17 교체 텍스트 안의
    `` `redactExecutionErrorValue`(`deepRedactSecrets` 위임, **형태 보존**)를 … `` 문구)
  - 충돌 대상: 같은 target 문서의 §설계 섹션(`:83-90`, "**이름을 바꿨다**" — `ExecutionError`
    예외 클래스명을 부분 문자열로 포함해 리네이밍했다는 설명) 및 실제 구현 코드
    (`codebase/backend/src/shared/utils/redact-stored-error.ts:57`
    `export function redactStoredErrorForResponse(...)`, `executions.service.ts:40,875,913`)
  - 상세: target 문서 §설계는 초안의 `redactExecutionErrorValue` 가 기존 예외 클래스
    `ExecutionError`(`workflow-errors.ts:33`)를 온전한 부분 문자열로 포함해 이름을
    `redactStoredErrorForResponse` 로 바꿨다고 명시하고, "조치" 체크리스트(`:210`)와 실제 코드
    모두 `redactStoredErrorForResponse` 를 쓴다(`spec/` 전체에는 아직 두 이름 다 등장하지
    않음 — 확인함). 그런데 "spec 초안 ①"(§R17 에 실제로 삽입될 텍스트)만 옛 이름
    `redactExecutionErrorValue` 를 그대로 쓴다. planner 가 이 텍스트를 그대로
    `spec/5-system/14-external-interaction-api.md` 에 적용하면, spec 이 코드베이스에 **존재하지
    않는** 식별자를 R17 카탈로그(다른 불릿들이 `toTerminalErrorPayload` 처럼 실제 함수명을
    audit trail 로 정확히 인용하는 관행과 동형)에 남기게 된다.
  - 제안: "spec 초안 ①"의 `redactExecutionErrorValue` → `redactStoredErrorForResponse` 로
    치환 후 적용한다(단순 find-replace, 결정 자체는 이미 내려져 있음).

- 그 외 대조: `secret-store.md §1` "비대상" 절(현재 `AuthConfig.config` 만 등재, `:40`)에 target
  이 신설하려는 `interaction.triggerToken` 블록은 (a) 근거를 재사용하지 않고 독립적으로 세웠고
  ((c) 값 공간이 서버 발급 랜덤 hex 라는 근거는 `AuthConfig.config`의 "동등 암호화" 근거와
  실제로 다른 종류다), (b) `spec/1-data-model.md:638`(`itk_` prefix SoT = EIA §인증)·
  `spec/5-system/14-external-interaction-api.md:94,910,920`(EIA-AU-02, `:910` 원문)과 충돌하지
  않는다 — `:910` 문구 정정 제안도 실제 원문("현재 JSONB 평문 (향후 secret store 통합 검토)")과
  정확히 일치해 직접 모순은 찾지 못했다. `3-workflow-editor/3-execution.md` §10.6.1 의 Error 탭이
  `NodeExecution.error`(다른 컬럼)를 노출한다는 target 의 "동반 갱신 불요" 판단도 실측(`:478-524`)
  과 일치한다 — 다만 위 CRITICAL 항목이 지적하듯 "다른 컬럼"이라는 사실 자체가 이번 결정의
  보안 목적을 무효화하지는 않는다는 점이 그 판단에서 빠졌다.

## 요약

target 은 표면 전수·캐시 상호작용·판별력 있는 뮤테이션 테스트 등 이 저장소의 반복 실패 패턴을
의식적으로 피하며 꼼꼼히 설계됐고, `secret-store.md`/EIA `:910` 관련 spec 초안은 실측과
일치해 충돌이 없다. 그러나 핵심 CRITICAL 은 target 이 스스로도 인지하고 "범위 밖"으로 이름
붙인 `NodeExecution.error` 잔여 갭의 **성격을 과소평가**한 데서 온다 — `spec/1-data-model.md`
가 이미 `Execution.error` 를 `NodeExecution.error` 의 "복사"로 정의하고 있어, 이번 마스킹은
같은 `GET /api/executions/:id` 응답의 형제 필드로 그대로 우회된다(실측 확인). "spec 초안 ①"을
그대로 적용하면 R17 이 실제로 성립하지 않는 보장("내부 읽기 경로도 같은 마스킹을 적용한다")을
선언하게 되므로, 이 캐비엇을 명시하거나 범위를 넓히지 않고는 `--spec` 적용을 진행하면 안 된다.
추가로 "spec 초안 ①"의 함수명이 target 자신의 리네이밍 결정과 어긋나(옛 이름 잔존), 그대로
적용하면 spec 이 존재하지 않는 식별자를 인용하게 된다 — 적용 전 치환이 필요하다.

## 위험도

CRITICAL — spec 초안을 무수정 적용하면 신설되는 R17 캐비엇이 자신의 §근거(위협 모델)·
`spec/1-data-model.md` 의 필드 관계 정의와 직접 모순되는 보장을 선언하게 된다.
