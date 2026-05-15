### 발견사항

---

**[CRITICAL]** Presentation 노드 출력 구조 Breaking Change — 판별자(discriminator) 제거
- 위치: `spec/4-nodes/6-presentation-nodes.md` — Carousel §1.3, Table §2.3, Chart §3.3, Template §5.3 출력 형식
- 상세: 기존 `output.type === 'carousel'|'table'|'chart'|'template'` 판별자가 제거되었으며, `output.layout`, `output.columns`, `output.chartType` 등 리터럴 config 필드가 `config.*` 로 이동했다. 기존에 `$node["X"].output.layout`, `$node["X"].output.type` 등으로 접근하는 모든 다운스트림 표현식이 런타임에 `undefined` 를 반환하게 된다. Migration script 가 존재하지만 **DB apply 미실행** 상태이며(진행 로그: "후속 3 ⏸"), 현재 브랜치의 핸들러 구현은 이미 신규 shape 으로 출력하고 있어 script apply 전까지 기존 저장된 워크플로우 표현식이 모두 깨진 상태다.
- 제안: Migration script `--apply` 를 핸들러 배포와 동시 또는 사전에 실행하거나, 핸들러가 `output` 에 구 필드를 `previousOutput` shim 으로 함께 포함하도록 이중 출력 전환기 단계를 명시적으로 구현해야 한다. `previousOutput` 필드는 Carousel spec 에 언급되어 있으나 Table/Chart/Template 에는 누락되어 있다.

---

**[CRITICAL]** Form 노드 출력 계약 — 클라이언트 소비 필드 제거
- 위치: `spec/4-nodes/6-presentation-nodes.md` — Form §4.3 출력 형식
- 상세: 기존 `output.submittedData`, `output.submittedAt`, `output.submittedBy` 가 폐기되고 `output.interaction.data`, `output.interaction.receivedAt` 으로 대체되었다. `submittedBy` (제출자 UUID) 는 신규 spec 에 대응 필드가 없어 완전히 소실된다. 감사(audit) 또는 권한 검증에 해당 필드를 사용하는 다운스트림 노드는 기능이 중단된다.
- 제안: `interaction.data` 에 `submittedBy` 필드를 포함하거나, `meta.submittedBy` 로 이관하는 규격을 명시해야 한다.

---

**[WARNING]** Error Port 응답 구조 변경 — `nodeId`, `timestamp`, `originalInput` 제거
- 위치: `spec/5-system/3-error-handling.md` — §3.2 Route to Error Port
- 상세: 기존 에러 포트 출력에는 `error.nodeId`, `error.nodeType`, `error.timestamp`, `error.originalInput` 이 포함되었다. 신규 구조에서는 `output.error` 에 `code`, `message`, `details?` 만 남고 나머지는 제거되었다. 에러 포트의 다운스트림에서 실패 노드를 식별하거나 원본 입력을 복구하는 워크플로우가 깨질 수 있다. `details` 에 포함 가능하다고 명시되어 있으나 핸들러별 선택적이라 보장되지 않는다.
- 제안: `meta` 에 `nodeId`, `nodeType` 을 포함하도록 공통 엔진 계층에서 주입하거나, `output.error.details` 에 `originalInput` 포함을 필수로 규정해야 한다.

---

**[WARNING]** Chart 출력 형식 — `rendered` (SVG) 필드 누락
- 위치: `spec/4-nodes/6-presentation-nodes.md` — Chart §3.3 출력 형식 예시
- 상세: 기존 출력에는 `rendered: "<svg>...</svg>"` 가 포함되었으나, 신규 spec 예시의 `output` 에는 `data: [{x, y}]` 만 있고 `rendered` 가 누락되어 있다. 실행 결과 뷰어나 다운스트림이 SVG를 직접 소비하는 경우 렌더링이 불가능해진다. Carousel/Table 은 `output.rendered` 를 유지하는 것과 불일치한다.
- 제안: Chart 출력 형식 예시에 `rendered: "<svg>…</svg>"` 필드를 명시적으로 포함해야 한다.

---

**[WARNING]** `status` 값 통합 — 클라이언트가 interaction type 을 구분 불가
- 위치: `spec/5-system/4-execution-engine.md` — §1.2.x 블로킹/재개 컨트랙트
- 상세: `status: 'submitted'`, `'button_click'`, `'button_continue'` 가 모두 `'resumed'` 로 통합되었다. `$node["X"].status === 'button_click'` 으로 분기하는 기존 표현식이 Migration script Pass 5 로 `'resumed'` 로 치환되지만, interaction type 의 구분 책임이 `output.interaction.type` 으로 이동한다. 기존 `status` 기반 분기 로직은 치환 후 조건이 항상 참이 되어 버그를 유발할 수 있다.
- 제안: Migration script 의 단순 치환(`status === 'button_click'` → `status === 'resumed'`) 이 올바르지 않은 케이스임을 audit 로그에 명시하고, `&& output.interaction.type === 'button_click'` 를 함께 추가하도록 안내해야 한다.

---

**[INFO]** `error-codes.ts` — 신규 enum 이 기존 §1.4 에러 코드와 중복/불일치
- 위치: `backend/src/nodes/core/error-codes.ts`
- 상세: 기존 `spec/5-system/3-error-handling.md §1.4` 에 정의된 `NODE_EXECUTION_FAILED`, `INTEGRATION_ERROR`, `LLM_ERROR` 등이 신규 `ErrorCode` enum 에 포함되지 않았다. 엔진 레벨의 에러 코드와 핸들러 레벨의 에러 코드가 두 곳에서 별도로 관리되며 일관성이 없다.
- 제안: §1.4 의 코드 중 핸들러가 직접 방출하는 것은 `error-codes.ts` 로 통합하거나, 두 계층의 코드 범위를 명확히 분리하여 문서화해야 한다.

---

**[INFO]** `migration-script` 테스트 — `output.config.systemPrompt` 패스 3 동작이 spec 에 없음
- 위치: `backend/src/scripts/migrate-node-output-refs.spec.ts` — `structural path preservation` 케이스
- 상세: `$node["AI"].output.config.systemPrompt` → `$node["AI"].config.systemPrompt` 로 재작성하는 Pass 3 동작이 테스트에 정의되어 있으나, 이 패턴이 실제 필드 접근으로 사용된 경우 `config` echo 필드 중 무엇이 여기 해당하는지 spec 에 명시적으로 정의되어 있지 않다.
- 제안: `$node["X"].output.config.*` → `$node["X"].config.*` 압축 규칙을 spec 에 명문화해야 한다.

---

### 요약

이번 변경은 Presentation 노드(Carousel, Table, Chart, Form, Template) 출력 구조를 `output.{type, layout, columns, ...}` 플랫 형식에서 `config`/`output`/`meta` 분리 구조로 전환하고, 에러 포트 응답 구조와 interaction status 값을 통합하는 광범위한 API 계약 개편이다. 핵심 위험은 **Migration script 가 DB에 아직 apply 되지 않은 상태에서 핸들러가 이미 신규 shape 을 출력**하고 있다는 것으로, 기존 저장된 워크플로우 표현식이 현재 런타임에서 깨진 상태일 가능성이 높다. Form 의 `submittedBy` 소실, Chart 의 `rendered` 누락, status 통합으로 인한 분기 로직 오작동도 즉시 조치가 필요한 계약 위반이다. Migration script 의 `--apply` 실행이 배포와 동시에 이루어지지 않으면 프로덕션 워크플로우가 중단될 위험이 있다.

### 위험도

**HIGH**