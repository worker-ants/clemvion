### 발견사항

- **[WARNING]** `config` 가 이제 DB 에 원문(자격증명 포함)으로 저장된다 — 노출 표면이 REST/WS egress 두 경로 밖으로 넓어진다
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:53` (`config: r.config ?? {}`), 관련 결정 서술 `spec/2-navigation/14-execution-history.md`(R-5 정정 블록, `> **지금의 정확한 서술**: \`config\` 는 **DB 에 원문으로 저장**되고...` 문단)
  - 상세: 이번 변경으로 `maskSensitiveFields` boundary 가 제거되어 `NodeExecution.outputData.config`(그리고 waiting 상태의 `toEngineFlatShape` 스프레드를 거치는 여러 파생 위치)가 **DB at-rest 에 자격증명 원문**으로 남는다. 안전성 증명은 "REST(`redactStoredDataForResponse`) 와 WS(`maskWireEnvelope`)가 각각 `deepRedactSecrets*` 를 걸어 나간다"는 **두 egress 경로에 한정**돼 있고, 그 포함관계(`DEFAULT_SENSITIVE_KEYS` ⊆ `CREDENTIAL_KEY_PATTERN`)는 직접 순회 캐너리로 확인했다(정확 — 22개 키 전수 대조 결과 `CREDENTIAL_KEY_PATTERN`(`/^(password|passwd|pwd|api[_-]?key|secret|[a-z0-9_-]*token|private[_-]?key|client[_-]?secret|authorization|cookie|x[_-]api[_-]?key)$/i`)이 전부 포괄함을 확인). 다만 이 보증은 **그 두 egress 경로에만** 유효하다 — DB 백업·복제본·읽기 전용 리포트/ETL·운영자의 직접 `psql` 조회·감사 로그 export 등 **제3의 데이터 접근 경로**는 egress 마스킹을 거치지 않으므로 원문을 그대로 본다. 종전엔(storage-time 마스킹) 이 제3경로도 마스킹된 값만 봤는데, 이번 변경으로 그 방어가 사라졌다. R-5 정정 블록이 이 trade-off 를 "DB 를 직접 읽는 사람은 이제 원문을 본다(§R17 이 수용한 trade-off)"로 이미 인지·문서화했고 코드 리뷰 이력(`10_53_52`/`12_00_05`/`12_52_43` 라운드)에서 반복 검토·수용된 기지 사안이라 이 PR 을 새로 막을 사유는 아니지만, 보안 리뷰 관점에서 "노출 표면이 REST/WS 두 곳에서 DB 접근 전반으로 넓어졌다"는 사실 자체는 재확인해 둘 가치가 있다.
  - 제안: 이미 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에 등재된 "자격증명 참조 간접화"(예: HTTP Request `authentication=custom` 자유 입력 헤더/바디) 근본 처방을 우선순위 유지. 추가로 DB 백업·리포팅/ETL 파이프라인이 이 컬럼을 원문으로 유출하지 않는지(예: 백업 암호화, 감사 export 시 재-마스킹) 별도로 점검할 가치가 있음을 명시적으로 등재 권장.

- **[WARNING]** safe-by-construction → safe-by-convention 전환 — 컴파일러가 신규 egress 의 마스킹 누락을 못 잡는다
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:26-63` (`adaptHandlerReturn`, `NodeHandlerOutput.config` 반환 타입에 raw/masked 구분 브랜딩 없음)
  - 상세: 마스킹이 생성 시점 한 곳(어댑터 boundary)에서 각 egress 구현체의 규율로 옮겨졌다. `NodeHandlerOutput.config` 타입에 raw 여부를 구분하는 브랜드가 없어, 향후 새 egress(신규 API 엔드포인트·신규 export 기능·신규 관리자 조회 화면 등)가 추가될 때 `deepRedactSecrets`/`maskWireEnvelope` 를 빠뜨려도 타입체커가 잡지 못한다 — 이는 팀 스스로 R-5 정정 블록에 "**새 출구를 여는 사람이 이 문단을 읽어야 한다**"고 명시한 바로 그 리스크다. 현재 확인된 두 출구(REST/WS)는 정확하지만, 이 안전장치는 "코드 리뷰 + 문서" 라는 사람 프로세스에 의존한다.
  - 제안: 이미 인지·수용된 trade-off(코드 리뷰 `10_53_52` W2·W3, `12_28_26`/`12_52_43` 라운드에서 비차단으로 재확인)이므로 이번 PR 자체를 막을 사유는 아니다. 다만 후속으로 `NodeHandlerOutput.config` 를 `Raw<T>` 류의 브랜디드 타입으로 감싸거나, lint 규칙으로 "config 를 읽어 응답/로그로 내보내는 새 코드는 반드시 `deepRedactSecrets` 를 거친다"를 강제하는 근본 처방을 트래커에서 계속 추적할 것.

- **[INFO]** 크로스-노드 자격증명 릴레이 — 이미 문서화·수용된 trade-off, 워크스페이스 경계 내로 한정
  - 위치: `spec/2-navigation/14-execution-history.md` R-5 정정 블록 1번 항목, 관련 코드: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:53`
  - 상세: 표현식이 이제 `config` 를 원문으로 읽으므로, 워크플로 작성 권한자가 한 노드의 `config.apiKey` 를 다른 노드의 body 로 실어 제3자 엔드포인트로 전송할 수 있다. 다만 그 권한자는 애초에 노드 설정 화면에서 그 자격증명을 볼 수 있으므로 **권한 상승은 아니고**, 워크스페이스 경계를 넘지 않는다(팀 분석과 일치). 새로운 취약점이 아니라 이미 R-5 정정 블록·트래커에 정확히 등재된 기지 사안.
  - 제안: 조치 불요(별건 트래커에서 근본 처방을 계속 추적).

- **[INFO]** REST/WS 두 layer 의 `CREDENTIAL_KEY_PATTERN` 이 독립 선언·비대칭(`x-api-key` 는 REST 전용) — 이미 별건 등재된 기지 사안
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:112-113`, `codebase/backend/src/modules/websocket/websocket.service.ts` 의 로컬 sanitizer(`sanitizePayloadForWs` 계열)
  - 상세: 이번 PR 의 config-echo 안전성은 이 두 정규식 중 어느 쪽을 타든 `DEFAULT_SENSITIVE_KEYS` 를 포함하므로 영향받지 않는다(직접 검증). 다만 두 선언이 계속 독립적으로 유지·수정되는 구조 자체는 향후 한쪽만 갱신되는 drift 위험을 안고 있고, 이는 이미 별도 트래커 항목(WS 가 REST 보다 좁아 라우팅 컨텍스트에서만 `x-api-key` 를 못 가림)으로 등재돼 있다.
  - 제안: 조치 불요(이 PR 범위 밖, 기존 트래커에서 추적 — 합칠 때는 넓은 쪽 기준으로).

- **[INFO]** `ExecutionContextService.setStructuredOutput` 이 핸들러의 `config` 객체를 참조로 그대로 캐시에 보관 — 마스킹 결함은 아니나 aliasing 계약이 새로 생겼다
  - 위치: `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:137-157`
  - 상세: 종전엔 `maskSensitiveFields` 가 항상 새 객체를 만들어 냈으므로 이 참조 공유가 우연히 가려져 있었다. 이제 핸들러가 반환한 객체 자체가 장기 캐시에 눕는다 — 핸들러가 반환 후 자기 `config` 를 변형하면 캐시도 함께 바뀐다. 이는 시크릿 유출 벡터는 아니지만(민감도 자체는 안 바뀜) 데이터 무결성 계약이 새로 생긴 것이고, 신규 캐너리 2건(`execution-context.service.spec.ts`)과 JSDoc 2-hop 분리로 이미 정확히 고정·문서화됐다(직접 소스 대조로 확인).
  - 제안: 조치 불요 — 이미 캐너리로 고정됨.

### 요약

이번 diff 의 핵심은 노드 `config` echo 마스킹을 엔진 boundary(`handler-output.adapter.ts`)에서 REST/WS egress 전용으로 옮기는 것이다. 이 변경은 이미 6차례(코드 리뷰 5라운드 + consistency-check 다수 라운드) 독립 검토를 거쳐 CRITICAL 1건(포함관계 캐너리가 파생 없이 손으로 나열돼 아무것도 검사하지 않던 결함)과 다수 WARNING(미러 스윕 누락 등)이 이미 발견·수정·수렴됐다. 이번 라운드에서 핵심 코드(`handler-output.adapter.ts`, `mask-sensitive-fields.util.ts`, `execution-context.service.ts`)를 직접 열어 재검증한 결과: (1) `DEFAULT_SENSITIVE_KEYS` 의 22개 키 전수가 REST/WS 공유 `CREDENTIAL_KEY_PATTERN` 정규식에 실제로 포함됨을 독립적으로 재확인했고, (2) REST(`redactStoredDataForResponse`)·WS(`maskWireEnvelope`)·LLM 컨텍스트(`explore-tools.service.ts`, 이중 마스킹 유지) 세 소비처 모두 정상적으로 마스킹을 걸고 있으며, (3) `websocket.service.ts:448` 의 JSDoc 용어("boundary masking parity"→"egress masking parity")도 이전 라운드 지적대로 정정 반영돼 있음을 확인했다. 새로운 인젝션·인증 우회·하드코딩 시크릿·안전하지 않은 암호화는 발견되지 않았다. 남은 항목은 팀 스스로 문서화·수용한 두 가지 구조적 trade-off(DB at-rest 평문화로 인한 제3경로 노출 확대, safe-by-convention 전환으로 인한 컴파일 타임 보증 상실)이며 둘 다 근본 처방이 별도 트래커에 재개 조건과 함께 등재돼 있어 이번 PR 을 막을 사유는 아니다.

### 위험도
LOW
