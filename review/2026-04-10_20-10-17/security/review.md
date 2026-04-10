## 보안 코드 리뷰 결과

### 발견사항

---

**[WARNING] `useMemo` 내에서 Hook 규칙 위반 — 잠재적 런타임 오류**
- 위치: `frontend/src/components/editor/settings-panel/node-settings-panel.tsx:138`
- 상세: `useMemo` 콜백 내부에서 `useEditorStore.getState()`를 직접 호출하고 있음. 이는 React Hook 규칙 위반이며, 렌더링 외부에서 스토어에 접근하는 방식이 일관되지 않음. 보안 측면에서는, `isDuplicateLabel` 검증이 렌더 시점 스냅샷에 기반하므로 저장 버튼 클릭 직전 다른 세션/탭에서 상태가 변경된 경우 TOCTOU(Time-of-Check-Time-of-Use) 불일치가 발생할 수 있음.
- 제안: `useEditorStore.getState()` 대신 `useEditorStore((s) => s.nodes)`를 사용하여 반응형으로 노드 목록을 구독. 서버 측 중복 검증은 이미 존재하므로 프론트엔드 단의 TOCTOU는 허용 가능하나, Hook 규칙 준수는 필수.

---

**[WARNING] `label`이 에러 메시지에 직접 노출 (정보 노출)**
- 위치: `backend/src/modules/nodes/nodes.service.ts:62, 72, 87` / `backend/src/modules/workflows/workflows.service.ts:309`
- 상세: 사용자 입력값(`label`)이 예외 메시지에 그대로 포함되어 API 응답으로 반환됨. 일반적으로는 낮은 위험이지만, 레이블에 특수문자나 민감한 내용이 포함된 경우 로그 인젝션(Log Injection)으로 이어질 수 있음.

```ts
message: `A node with label "${label}" already exists in this workflow`
```

- 제안: 에러 메시지에 사용자 입력을 직접 삽입하는 경우 길이 제한과 새니타이징을 적용하거나, 범용 메시지로 대체하고 상세 정보는 `code` 필드만 클라이언트에 전달.

---

**[WARNING] `bulkCreate`의 중복 검사 — TOCTOU 레이스 컨디션**
- 위치: `backend/src/modules/nodes/nodes.service.ts:56-74`
- 상세: 기존 노드를 조회한 후(`findByWorkflow`) 배치를 저장하는 사이에 다른 요청이 동일 레이블의 노드를 생성할 수 있음. 트랜잭션 없이 Check-Then-Act 패턴을 사용하고 있어 동시 요청 시 레이블 중복이 DB에 삽입될 수 있음.
- 제안: `bulkCreate`도 트랜잭션 내부에서 실행하거나, DB 레벨에서 `(workflowId, label)` 유니크 제약조건을 추가하여 최종 방어선 확보.

---

**[WARNING] UUID를 `$node` 키로 노출 (정보 노출)**
- 위치: `backend/src/modules/execution-engine/expression/expression-resolver.service.ts:44`
- 상세: `$node[nodeId] = { output }` 형태로 내부 DB UUID를 표현식 컨텍스트에 직접 노출. 워크플로우 표현식을 작성하는 사용자가 내부 노드 UUID를 알게 됨. 이 자체가 직접적 취약점은 아니나, UUID 추측 공격의 기반 정보가 될 수 있고, 레이블을 변경하지 않고 UUID로 영구 참조를 만드는 것은 의도된 설계지만 보안 감사 로그에서 추적이 어려워짐.
- 제안: UUID 폴백 기능이 필요하다면 사용 목적과 접근 권한을 스펙 문서에 명시하고, 실행 로그에 UUID 기반 접근을 기록하는 것을 권장.

---

**[INFO] `$node` 키에 사용자 제어 문자열 사용 — 키 충돌 가능성**
- 위치: `packages/expression-engine/src/disambiguate-labels.ts`
- 상세: 노드 레이블이 UUID 형식(예: `550e8400-e29b-41d4-a716-446655440000`)일 경우, UUID 폴백 키와 충돌 가능. 또한 레이블에 `#` 문자가 포함된 경우(예: `HTTP#2`), `buildDisambiguatedKeys`가 생성하는 키(`HTTP#2`, `HTTP#2#2`)와 의미적 혼동이 발생할 수 있음.
- 제안: 레이블 입력에서 `#` 문자를 허용하지 않거나 이스케이프 처리. UUID 형식 레이블을 금지하는 검증 추가 (`/^[0-9a-f]{8}-...$/` 패턴 거부).

---

**[INFO] XSS 위험 없음 — 에러 메시지 렌더링 안전**
- 위치: `frontend/src/components/editor/settings-panel/node-settings-panel.tsx:178-180`
- 상세: `isDuplicateLabel` 조건으로 보여주는 오류 문구는 하드코딩된 한국어 문자열(`"동일한 이름의 노드가 이미 존재합니다"`)이며, 사용자 입력값을 직접 DOM에 렌더링하지 않음. React의 JSX 기본 이스케이프로 XSS 위험 없음.

---

**[INFO] 표현식 평가기 샌드박싱 확인 필요**
- 위치: `backend/src/modules/execution-engine/expression/expression-resolver.service.ts`
- 상세: 이번 변경에 직접 포함되지 않았으나, `evaluate()` 함수에 사용자 정의 표현식이 전달됨. 표현식 엔진(`@workflow/expression-engine`)이 `eval()`이나 `Function()` 생성자를 사용하는 경우 코드 인젝션 위험이 있음. 이번 변경의 범위는 아니나 전체 보안 위협 모델에서 가장 중요한 지점.
- 제안: 표현식 엔진이 자체 파서/평가기를 사용하며 네이티브 JS 실행이 없음을 확인. (현재 코드 구조상 tokenizer→parser→evaluator 파이프라인 사용으로 안전해 보임)

---

### 요약

이번 변경사항은 노드 레이블 중복 방지 및 표현식 컨텍스트 키 안전성 강화를 목적으로 하며, 전반적으로 보안 설계 방향은 올바름. 가장 주목할 취약점은 `bulkCreate`에서의 TOCTOU 레이스 컨디션으로, DB 레벨 유니크 제약이 없으면 동시 요청 시 중복 레이블이 삽입될 수 있음. `useMemo` 내 `getState()` 호출은 React Hook 규칙 위반으로 런타임 불안정성을 유발할 수 있으며, 에러 메시지에 사용자 입력이 포함되는 패턴은 로그 인젝션 가능성을 내포함. 하드코딩된 시크릿, SQL 인젝션, XSS 등의 직접적 취약점은 없으며, TypeORM의 파라미터 바인딩이 적절히 사용되고 있음.

### 위험도

**MEDIUM** — TOCTOU 레이스 컨디션과 Hook 규칙 위반이 실제 환경에서 데이터 무결성 문제를 일으킬 수 있음.