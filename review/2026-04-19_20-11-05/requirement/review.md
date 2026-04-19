## 발견사항

### [WARNING] Chart 노드 출력에 `rendered` 필드 누락
- **위치**: `spec/4-nodes/6-presentation-nodes.md` — Chart §3.3 출력 형식
- **상세**: Carousel(`rendered`), Table(`rendered`), Template(`rendered`)는 `output`에 렌더링 결과를 포함하지만, Chart의 출력 예시에는 `rendered` SVG 문자열이 없음. §3.3 실행 로직 5번엔 "SVG 차트 렌더링"이 명시되어 있으나 출력 shape에 반영되지 않음.
- **제안**: `output: { data: [...], rendered: "<svg>…</svg>" }` 형태로 명시.

---

### [WARNING] `previousOutput` 호환 필드 정의 미완성
- **위치**: `spec/4-nodes/6-presentation-nodes.md` — Carousel Resumed 출력 예시
- **상세**: `"previousOutput": { /* Stage 3 전환기 호환 필드 — Phase 3 에서 제거 예정 */ }` 주석만 있고 실제 shape이 정의되지 않음. 다운스트림 노드나 프론트엔드가 이 필드를 참조해야 한다면 구조 명시가 필요하고, 불필요하다면 제거해야 함.
- **제안**: Phase 3 전까지만 유지한다면 `previousOutput: NodeHandlerOutput['output']` 타입으로 명확히 정의하거나, 스펙에서 아예 제외하고 코드 레벨 주석으로만 관리.

---

### [WARNING] Form 노드 `waiting` 상태에서 `port` 필드 부재
- **위치**: `spec/4-nodes/6-presentation-nodes.md` — Form §4.3 Waiting 출력 예시
- **상세**: Waiting 상태 JSON에는 `"port"` 필드가 없지만, Resumed 상태에는 `"port": "out"`이 있음. 실행 엔진이 재개 시 포트를 어떻게 결정하는지 spec에서 명시적으로 다루지 않음. §4.2에 Form은 `out` 단일 포트만 있으므로 항상 `"out"`이 고정이지만, Carousel처럼 다중 포트를 가진 노드와 대칭적이지 않아 엔진 구현시 혼선 가능.
- **제안**: Waiting → Resumed 시 포트 결정 규칙을 §4.3 또는 실행 엔진 spec §1.2.x에 명시.

---

### [WARNING] `migrate-node-output-refs.spec.ts`의 `form.submittedData` 리네임 케이스 불완전
- **위치**: `backend/src/scripts/migrate-node-output-refs.spec.ts` — `intra-output renames` describe
- **상세**: `form.output.submittedData.email` → `output.interaction.data.email` 케이스는 테스트하지만, `submittedData` 바로 아래(서브 필드 없이) `submittedData` 자체를 참조하는 경우(`$node["F"].output.submittedData`)는 커버하지 않음. 실제 워크플로우에서 전체 객체 참조가 빈번하게 사용될 수 있음.
- **제안**: `submittedData` 루트 참조 케이스 테스트 추가: `$node["F"].output.submittedData` → `$node["F"].output.interaction.data`.

---

### [WARNING] `error-codes.ts`에 Presentation 노드 에러 코드 부재
- **위치**: `backend/src/nodes/core/error-codes.ts`
- **상세**: `error-handling.md` §3.2는 에러 포트 보유 노드로 `http_request`, `database_query`, `send_email`, `code`, `ai_agent`, `text_classifier`, `information_extractor`, `workflow`를 열거하는데, 버튼이 있는 Presentation 노드(Carousel/Chart/Table/Template)가 타임아웃/취소 시 에러를 어떻게 반환하는지 코드 정의 없음. Spec §1.3.6에서 "외부 cancel/종료" 시나리오가 언급되지만 에러 코드가 없음.
- **제안**: `USER_CANCELLED`, `INTERACTION_TIMEOUT` 같은 interaction 에러 코드 추가 또는 spec에서 Presentation 노드의 취소 처리 정책 명시.

---

### [INFO] `error-handling.md`의 `NodeHandlerOutput` 타입 레퍼런스
- **위치**: `spec/5-system/3-error-handling.md` — §3.2 envelope 필드 정의
- **상세**: `config: { /* 해석된 노드 config echo (credentials 제외) */ }` 가 에러 포트 envelope에 포함되어 있는데, `execution-engine.md §5.1`의 `NodeHandlerOutput` 계약과 일치하나 `status: "ended"` 값이 `execution-engine.md §1.2.x`의 상태표에서 "multi-turn 종료"로만 정의되어 있음. 에러 포트 라우팅 시에도 `ended`를 사용하는 것이 혼란스러울 수 있음.
- **제안**: 에러 포트 라우팅 시의 `status`를 `ended` 대신 undefined(일반 완료)로 사용하거나, 에러 경로에서의 `status` 값을 실행 엔진 spec에 명시.

---

### [INFO] `walkAndRewrite` 테스트에서 배열 내 비문자열 혼합 케이스 미커버
- **위치**: `backend/src/scripts/migrate-node-output-refs.spec.ts` — `walkAndRewrite` describe
- **상세**: 현재 테스트는 문자열 배열과 숫자 상수만 검증. `[{ key: "{{ expr }}" }, "literal"]` 형태의 혼합 배열이나 중첩 객체 배열은 테스트되지 않음. 실제 워크플로우 config는 이런 복합 구조가 일반적.
- **제안**: 객체를 포함하는 배열에 대한 테스트 케이스 추가.

---

### [INFO] `execution-engine.md §1.2.x`의 `requires_playwright` 상태 구현 여부 불명확
- **위치**: `spec/5-system/4-execution-engine.md` — §1.2.x status enum 표
- **상세**: `requires_playwright` 상태가 "PDF 노드"에 적용된다고 명시되어 있으나 progress checklist에 PDF 노드 구현 계획이 없음. 이 상태값을 엔진이 실제로 처리하는지, 혹은 미래 spec인지 불명확.
- **제안**: "(Stage N에서 구현 예정)" 또는 "🚧 미구현" 주석 추가.

---

## 요약

전반적으로 요구사항 문서화 수준이 높고 config/output/meta 분리 원칙이 일관되게 적용되어 있음. 주요 리스크는 세 가지: (1) Chart 노드의 `output.rendered` 누락으로 구현 시 일관성 깨짐 가능성, (2) `previousOutput` 호환 필드가 shape 정의 없이 "Phase 3 제거 예정"으로만 남아 있어 임시 구현이 필요한 팀이 참조할 기준이 없음, (3) migration 테스트가 `submittedData` 루트 참조 케이스를 누락해 실제 DB 마이그레이션 시 일부 표현식이 미변환될 수 있음. 에러 코드 파일(`error-codes.ts`)은 spec과 잘 일치하나 Presentation 노드의 취소/타임아웃 에러 코드가 없어 해당 노드의 에러 포트 라우팅이 필요할 경우 코드 체계 확장이 필요함.

## 위험도

**MEDIUM**