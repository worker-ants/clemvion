# 보안(Security) 코드 리뷰 — masking-residuals-0b195b (config echo 마스킹을 어댑터→egress 로 이동)

## 검토 범위

핵심 변경은 `handler-output.adapter.ts` 의 `adaptHandlerReturn` 에서 노드 `config` echo 에 걸던
`maskSensitiveFields` 키-이름 마스킹을 제거하고, 안전성을 REST(`redactStoredDataForResponse`)·
WS(`maskWireEnvelope`) 두 egress 지점의 `deepRedactSecrets*`(값-패턴 마스커, `CREDENTIAL_KEY_PATTERN`)
에 전적으로 위임한 것이다. `mask-sensitive-fields.util.spec.ts` 에 추가된 "포함관계 캐너리"가
`DEFAULT_SENSITIVE_KEYS` ⊆ `CREDENTIAL_KEY_PATTERN` 을 정본 구현 실행으로 단언한다.

이 변경은 이미 `/consistency-check --impl-prep` (`19_26_06`) 에서 CRITICAL 1건(spec Rationale
무효화)으로 지적되어 planner 턴으로 6개 spec 문서가 정정된 상태다(`RESOLUTION.md` 확인). 본
리뷰는 그 spec-drift 판정을 반복하지 않고, **코드 자체의 보안 안전성**을 직접 실행/추적으로
재검증하는 데 집중했다.

### 독립 검증 결과 (직접 코드 추적)

- REST: `executions.service.ts` (`findById`/list) · `background-runs.service.ts` 모두
  `redactStoredFieldsForResponse`/`redactNodeExecutionRow` → `deepRedactSecrets` 경유 확인.
- WS: `websocket.service.ts` 의 `emitExecutionEvent`/`emitNodeEvent` 모두 `maskWireEnvelope` →
  `deepRedactSecretsPreserving` 경유 확인 (노드 완료 이벤트의 `output: nodeExecution.outputData`
  포함, AI 프레젠테이션 `{config: adapted.config, ...}` 포함).
- 공개(비인증) EIA 표면: `external-interaction/interaction.service.ts` 의 `stripAndRedact` 도
  `deepRedactSecrets` 경유 확인 (`nodeExec.outputData`, `execution.outputData` 양쪽).
- DB 컬럼: `NodeExecution` 엔티티에 별도 `config` 컬럼이 없고, 핸들러 원본 반환값(`{config,
  output, ...}`)이 그대로 `nodeExecution.outputData` 에 저장됨(`execution-engine.service.ts:6103`
  등) → 위 REST/WS/공개 EIA 세 경로가 실제로 이 `config` 를 담는 컬럼을 마스킹 대상으로 삼는다.
  세 경로 모두 확인됨 → 이 PR 이 주장하는 "포함관계만 지키면 새로 뚫을 출구가 없다" 는 안전
  주장은 현재 알려진 소비처 기준으로 **성립**한다.

## 발견사항

- **[WARNING]** `config` echo 의 raw 노출 범위가 "저장·응답" 을 넘어 "표현식 평가(워크플로우
  데이터 흐름)" 로 확장됨 — egress 마스킹이 닿지 않는 새 유출 경로
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:49`
    (`config: r.config ?? {},`) — 주석은 `:30`~`:48`
  - 상세: 종전엔 `maskSensitiveFields` 가 (의도치 않게) `config` 의 모든 소비처에 마스킹된
    값만 노출했다 — REST/WS 응답뿐 아니라 **표현식 평가**(`$node["X"].config.<field>`,
    `expression-resolver.service.ts`)도 마스킹값만 봤다(이게 이 PR 이 고치는 버그다). 이번
    변경 이후 표현식은 **원문 자격증명**을 그대로 읽는다. `redactStoredDataForResponse`·
    `maskWireEnvelope` 는 "실행 기록을 **읽는(REST/WS)**" 경로만 가리는 초크포인트이고,
    워크플로우 자신의 **데이터 흐름**(예: 한 노드의 `config.apiKey` 를 표현식으로 다른 HTTP
    Request/Send Email 노드의 body 에 끼워 넣어 제3자 엔드포인트로 전송)은 그 초크포인트를
    아예 지나지 않는다 — egress 마스킹으로 원리적으로 막을 수 없는 클래스다. 즉 이 PR 은
    "워크스페이스 멤버가 실행 이력을 읽어 자격증명을 얻는" 경로는 확실히 막지만, "워크플로우
    편집 권한자가 자기 워크플로우 로직으로 다른 노드의 자격증명을 외부로 릴레이하는" 경로는
    새로 열어 준다(종전엔 마스킹 버그가 부작용으로 이 경로도 막고 있었다).
  - plan/spec 문서(`spec/5-system/4-execution-engine.md` "Engine Raw Config Exposure",
    `spec/conventions/node-output.md`)가 "핸들러가 config 에 시크릿 평문을 싣지 않는 것이
    상시 불변식" 이라 명시하고 있고, AI Agent 노드는 이미 `llmConfigId` 간접 참조 패턴으로
    이 클래스를 피하고 있다(스펙 `1-ai-agent.md:480` 참조). 그러나 HTTP Request·Send Email
    등 **사용자가 헤더/바디에 직접 문자열 자격증명을 입력하는 노드**는 그 불변식에 기술적으로
    구속되지 않는다 — 정적 grep 으로 못 닫는다는 점은 `mask-sensitive-fields.util.ts` 자체
    주석(`:33-`)도 이미 인정한 한계다.
  - 제안: 이 트레이드오프가 **의도된 것**이라면(설계 문서상 그렇게 보인다) 문제 없음 —
    다만 "표현식이 config 를 원문으로 읽을 수 있게 됨" 이 곧 "동일 워크스페이스 내 다른
    노드의 자격증명을 자신의 워크플로우 로직으로 외부에 릴레이할 수 있게 됨" 을 의미한다는
    점을 보안 관점 Rationale 에 **명시적으로** 한 줄 추가할 것을 권한다(현재 문서는
    "DB 직접 열람자는 원문을 본다" 는 trade-off 만 명시하고 "워크플로우 자신의 데이터 흐름을
    통한 크로스-노드 릴레이" 라는 별개 벡터는 명시하지 않았다). 자격증명이 실제로 문자열
    그대로 config 에 들어가는 노드 타입(HTTP Request/Send Email 등)에 한해 향후 "credential
    참조 간접화"(AI Agent 의 `llmConfigId` 패턴) 적용을 검토 항목으로 등재하는 것을 권장.

- **[INFO]** 포함관계 캐너리(`KEYS` fixture)가 `DEFAULT_SENSITIVE_KEYS` 실제 상수가 아니라
  손으로 병행 작성한 객체 리터럴에서 파생 — 목록 확장 시 캐너리가 조용히 뒤처질 수 있음
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:129`~`156`
    (`describe('DEFAULT_SENSITIVE_KEYS ⊆ deepRedactSecrets 의 키 축', ...)`, `const KEYS = ...`)
  - 상세: `DEFAULT_SENSITIVE_KEYS` 는 export 되지 않으므로 이 테스트는 그 상수를 직접 import 할
    수 없고, 손으로 같은 키 목록을 다시 나열한 객체를 `maskSensitiveFields` 에 통과시켜
    `Object.keys()` 로 파생한다. `mask-sensitive-fields.util.ts` 에 새 민감 키가 추가되는데
    이 파일의 리터럴 갱신을 잊으면, 새 키에 대한 포함관계 검증은 **조용히 스킵**된다(plan
    문서의 뮤테이션 M2 가 정확히 이 성질을 실측·문서화함 — "이번엔 결함이 아니다" 로 수용됐지만,
    안전 주장의 유일한 자동 가드가 이 캐너리인 점을 고려하면 반복 리스크다).
  - 제안: `mask-sensitive-fields.util.ts` 에서 `DEFAULT_SENSITIVE_KEYS`(또는 테스트 전용 접근자)를
    export 해 캐너리가 실제 SoT 에서 직접 파생하도록 바꾸면, "목록 확장 시 이 파일도 함께
    고쳐야 한다" 는 사람 규율에 대한 의존을 구조적으로 없앨 수 있다. 필수는 아니나(현재는
    `DEFAULT_SENSITIVE_KEYS` 변경 시 함께 갱신하는 절차가 커밋 관례로 지켜지고 있음), 안전
    불변식의 유일한 자동 가드라는 점에서 우선순위가 낮지 않다.

- **[INFO]** WS 로컬 `CREDENTIAL_KEY_PATTERN`(`websocket.service.ts` 의
  `sanitizePayloadForWs(ctx.chatChannel)` 라우팅 컨텍스트 전용 사본)이 공유본(`sanitize-error-message.ts`)
  보다 좁다(`x-api-key` 미포함) — 이미 별도 트래커에 등재된 기지 이슈이나, 이번 PR 이후 config
  echo 가 "egress 마스킹 하나" 에 안전성을 전적으로 의존하게 되어 그 하나의 키-축 정합성이
  이전보다 더 중요해졌다.
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` W6 항목(이번 diff에
    신규 등재, "미판정" 상태) — 코드 위치는 `codebase/backend/src/modules/websocket/websocket.service.ts`
    의 로컬 `CREDENTIAL_KEY_PATTERN` 선언부
  - 상세: 다만 실측 근거(문서상)에 따르면 이 좁은 사본은 `chatChannel` 라우팅 컨텍스트에만
    적용되고 config echo 경로는 공유본(`maskWireEnvelope`)을 지나 영향받지 않는다 — 이번 PR
    코드 경로 자체의 결함은 아니다.
  - 제안: 별건으로 이미 등재되어 있으므로 추가 조치 불요. 다만 이 PR 로 config echo 의 안전성이
    "egress 마스킹 하나에만" 의존하게 된 점을 고려해, 해당 트래커 항목의 우선순위를 재검토할
    가치가 있다.

- **[INFO]** 테스트 픽스처의 시크릿류 문자열(`'sk-secret-1234567890'`, `'AAAABBBB4321'`,
  `'p@ssw0rd'`, `'xyz-token-abcdef'`, `'Bearer xyz-token-abcdef'` 등)은 전부 합성 placeholder 로
  실제 자격증명이 아님 — 하드코딩된 시크릿 문제 아님.

## 점검 관점별 요약

1. 인젝션(SQL/XSS/커맨드/경로탐색): 해당 diff 범위 내 신규 인젝션 벡터 없음.
2. 하드코딩된 시크릿: 없음(테스트 픽스처는 합성값).
3. 인증/인가: 변경 없음 — REST/WS/공개 EIA 인가 경로(viewer 포함 워크스페이스 멤버, 공개
   인터랙션 토큰)는 그대로이고, 이 PR 은 그 위에 실리는 **데이터의 마스킹 시점**만 바꾼다.
4. 입력 검증: 해당 없음(구조적 변경, 신규 사용자 입력 경로 없음).
5. OWASP Top 10 (A02 암호화 실패/민감정보 노출 관련): 위 WARNING 이 이 범주 — config 의 raw
   저장·표현식 노출 확대가 핵심 트레이드오프.
6. 암호화: 해당 없음(마스킹 알고리즘 자체는 변경되지 않음, 위치만 이동).
7. 에러 처리: 해당 없음(`error` 컬럼 마스킹 경로는 이 PR 의 대상이 아니고 기존 그대로).
8. 의존성 보안: 신규 의존성 없음.

## 요약

이 PR 은 노드 `config` echo 마스킹을 어댑터 경계에서 REST/WS egress 경계로 옮기는 의도된 설계
변경으로, 표현식이 마스킹된 값을 읽던 기능 버그를 고친다. 안전 주장("두 egress 마스커의 키
축이 `DEFAULT_SENSITIVE_KEYS` 를 포함한다")은 정본 구현을 실행하는 포함관계 테스트로 못박혀
있고, 필자가 REST·WS·공개 EIA 세 소비처 모두를 코드로 직접 추적해 실제로 `deepRedactSecrets`
계열을 지난다는 것을 확인했다 — 알려진 소비처 기준으로 회귀는 없다. 다만 이 변경은 "config 를
읽는(REST/WS)" 경로의 안전성과 "config 를 워크플로우 자신의 로직으로 다른 목적지에 릴레이하는"
경로의 안전성을 구분하지 않은 채 후자를 새로 열어 준다는 점에서 순수한 무해 리팩터는 아니다 —
문서화된 trade-off(DB 직접 열람자는 원문을 본다)에 "동일 워크스페이스 내 크로스-노드 자격증명
릴레이" 벡터를 명시적으로 추가할 것을 권한다. 그 외에는 테스트 캐너리의 파생 방식(수동 동기화)
과 WS 로컬 패턴 비대칭이 낮은 우선순위의 개선 여지로 남아 있다. CRITICAL 급 결함은 발견되지
않았다.

## 위험도

MEDIUM
