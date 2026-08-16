# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-prep)

## 방법론 노트 (판정에 영향)

조립된 `cross_spec.md` 프롬프트는 컨텍스트 예산 초과로 **target 영역(`spec/5-system/`) 자신의 파일
15개**(`14-external-interaction-api.md`·`6-websocket-protocol.md`·`1-auth.md`·`15-chat-channel.md`
등, 현재 진행 중인 작업(`plan/in-progress/eia-internal-rest-error-masking.md`)의 spec_impact 파일을
포함)와, target 밖 관련 영역 파일 대부분(`spec/0-overview.md`·`spec/2-navigation/4-integration.md`·
`spec/2-navigation/14-execution-history.md` 3개만 생존)이 본문 없이 절단됐다. "여기 없다 = 관련
없다" 로 오판하지 않기 위해 아래 항목들은 프롬프트 대신 저장소의 실제 파일을 `Read`/`grep` 로 직접
열어 검토했다: `spec/5-system/14-external-interaction-api.md`, `spec/conventions/secret-store.md`,
`spec/5-system/6-websocket-protocol.md`, `spec/5-system/3-error-handling.md`,
`spec/3-workflow-editor/3-execution.md`(§10.6.1), `spec/1-data-model.md`(`Execution.error` 필드).

## 발견사항

- **[WARNING]** `Execution.error` 노출 비대칭 — EIA egress 마스킹 vs 내부 REST/WS 원문
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 마지막 불릿
    ("`execution.failed` payload 의 `error.message`/`error.details`", 2026-08-16 신설, `:1462-1487`)
  - 충돌 대상: `spec/2-navigation/14-execution-history.md` R-5(`GET /api/executions/:id` 의 안전성 근거)
    + 실제 코드 표면(`executions.service.ts` `findById`/`toExecutionDto`/`getChain`/`stop`,
    `websocket.gateway.ts` 의 `execution.snapshot`)
  - 상세: EIA 종결 이벤트(`execution.failed`, WS·SSE·webhook·chat-channel)의 `Execution.error`
    는 `toTerminalErrorPayload`+`deepRedactSecrets` 로 마스킹되지만, 같은 DB 컬럼을 반환하는 내부
    `GET /api/executions/:id`(및 재사용 경로 `re-run`·`chain`·`stop`·WS `execution.snapshot`)는
    **원문**을 그대로 돌려주며 이 엔드포인트엔 `@Roles` 게이트가 없어 워크스페이스 viewer 롤까지
    포함한다. `14-execution-history.md` R-5 는 "안전성이 롤 게이팅이 아니라 서버 boundary masking
    parity 에 의존한다" 고 하지만 그 문장의 대상은 **노드 Config 탭 echo**(`handler-output.adapter.ts`
    의 `maskSensitiveFields`, write-time 마스킹)이지 `Execution.error` 가 아니다 — R-5 를 그대로
    이 필드에 적용하면 "이미 안전하다" 는 거짓 결론이 된다. EIA 문서 자신이 이 비대칭을 **"미결"**
    로 명시하고 있어(`§R17 :1484-1487` "내부 REST 와의 비대칭은 미결이다") 침묵 모순은 아니지만,
    등급 기준상 "명시적 우선순위 결정이 필요한 잠재 충돌"에 정확히 해당한다.
  - 제안: 이미 `plan/in-progress/eia-internal-rest-error-masking.md` 가 이 항목(I1)을 "내부 경로에도
    마스킹" 으로 택일해 집행 중이다(`redactExecutionErrorValue`, 표면 4곳). 구현과 함께 (a)
    `14-external-interaction-api.md` §R17 캐비엇을 "해결됨"으로 flip, (b)
    `2-navigation/14-execution-history.md` 에 `Execution.error` 마스킹 정책을 명시(R-5 의 대상이
    Config 탭 한정임을 오독하지 않도록 별도 항목으로), (c) 에디터 Run Results 드로어 SoT
    (`3-workflow-editor/3-execution.md` §10.6.1)도 동일 필드를 노출하면 함께 갱신 — 이 3곳 동시
    갱신이 plan 의 "planner 턴" 조치 항목에 이미 계획돼 있으므로 누락 없이 수행할 것.

- **[INFO]** `secret-store.md` "비대상" 목록과 EIA `interaction.triggerToken` 서술의 불일치 (planner 턴 예정)
  - target 위치: `spec/5-system/14-external-interaction-api.md:910`
    ("`config.interaction.triggerToken` 는 현재 JSONB 평문 (향후 secret store 통합 검토)")
  - 충돌 대상: `spec/conventions/secret-store.md §1` "비대상" 절 (`AuthConfig.config` 만 명시)
  - 상세: 같은 `Trigger.config` JSONB 안에서 `notification.signing.secretRef` 는 `SecretResolver` 를
    경유하는데 `interaction.triggerToken` 만 평문으로 남아 있고, secret-store.md 는 이 예외를 아직
    등재하지 않았다(“비대상”은 `AuthConfig.config` 하나뿐). EIA 문서의 "향후 통합 검토" 문구는 아직
    미결정인 것처럼 읽히지만, 사용자가 2026-08-16 에 이미 "명시 예외로 등재(이관 아님)" 로 결정했다
    (동일 plan 의 항목 D). 두 문서가 아직 서로를 반영하지 않은 과도기 상태다.
  - 제안: 위와 같은 planner 턴에서 (a) `secret-store.md §1` 비대상 목록에
    `Trigger.config.interaction.triggerToken` 추가 + 근거(같은 JSONB 안 비대칭이 의도적 예외임),
    (b) `14-external-interaction-api.md:910` 의 "향후 검토" 문구를 "의식적 예외로 결정됨" 으로 정정.

- **[INFO]** `6-websocket-protocol.md` 섹션 번호 중복/역순 (target 파일 자체의 장기 결함, 이번 draft 기인 아님)
  - target 위치: `spec/5-system/6-websocket-protocol.md:392`(`### 4.4 사용자 입력 대기 이벤트 상세`),
    `:738`(`### 4.3 KB 문서 이벤트`), `:761`(`### 4.4 알림 이벤트`)
  - 충돌 대상: 같은 문서 내부 (섹션 번호 체계 자체), 그리고 이 문서를 "§4.4" 로 인용하는 다른 spec
    (예: `14-external-interaction-api.md:1461` "[WS §4.4]")
  - 상세: `§4.3` 이 `§4.4` **뒤**에 나오고, `§4.4` 라는 번호가 **두 번**(`사용자 입력 대기 이벤트
    상세` 와 `알림 이벤트`) 쓰인다. `git log -S` 로 확인한 결과 두 섹션 모두 파일 최초 생성 커밋
    (`915607532`)부터 이 상태였고 최근 EIA/WS 후속 커밋(#1176 등)이 만든 회귀는 아니다. 다른 문서의
    전체 슬러그 앵커(`#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input`)는 프로그램적으로는
    모호하지 않지만, 본문 프로즈에서 "WS §4.4" 로만 지칭하는 인용은 사람이 읽을 때 어느 4.4 인지
    혼동될 수 있다.
  - 제안: 급하지 않음 — `6-websocket-protocol.md` 의 §4.3/§4.4 이하 번호를 순번대로 재정렬 (별도
    문서-위생 후속으로 처리 권장, 이번 EIA 마스킹 작업의 스코프는 아님).

- 그 외 대조 가능했던 범위(`spec/0-overview.md` 전문, `spec/2-navigation/4-integration.md` 전문,
  `spec/1-data-model.md` 의 `Execution`/`NodeExecution` 필드 정의, `spec/3-workflow-editor/3-execution.md`
  §10.6.1)에서는 target(`spec/5-system/`)과 직접 모순되는 데이터 모델·API 계약·상태 전이·RBAC 정의를
  찾지 못했다. `GET /api/executions/:id` 의 `@Roles` 부재는 `14-execution-history.md` R-5 가 의도적
  설계로 이미 문서화하고 있어 그 자체는 충돌이 아니다.

## 요약

target(`spec/5-system/`)의 현재 내용은 최근 EIA/WS 후속 커밋(#1170~#1178)이 남긴 캐비엇들과 크게
어긋나지 않으며, 발견된 CRITICAL 급 직접 모순은 없다. 유일하게 실질적인 항목(`Execution.error`
가 EIA 종결 이벤트에서는 마스킹되고 내부 REST/WS snapshot 에서는 원문으로 노출되는 비대칭)은 spec
자신이 이미 "미결" 로 정직하게 표시해 두었고, 지금 진행 중인 `eia-internal-rest-error-masking` plan
이 정확히 이 갭을 메우려는 작업이라 이번 --impl-prep 검토가 그 작업을 막을 이유는 없다. 다만 프롬프트
조립 예산이 target 자신의 핵심 파일(`14-external-interaction-api.md` 포함 15개)까지 절단한 점은
harness 차원의 반복 리스크이므로 별도로 기록해 둔다.

## 위험도

LOW — CRITICAL 없음. WARNING 1건은 이미 사용자 택일 완료 + 진행 중인 plan 이 해소 대상으로 잡고 있음.
나머지는 INFO(문서 동기화 권장) 수준.
