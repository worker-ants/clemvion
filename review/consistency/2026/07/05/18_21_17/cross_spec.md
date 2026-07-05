# Cross-Spec 일관성 검토 — V-14 rerun-modal.tsx (typed form + new-tab link)

대상: `codebase/frontend/src/components/executions/rerun-modal.tsx` 구현 예정 변경
- (a) 원본 실행 ID → 새 탭 링크 (`/workflows/:workflowId/executions/:id`)
- (b) 입력 폼을 manual_trigger `config.parameters` 스키마 기반 TYPED dynamic form 으로 전환
- (c) 필드 기본값 = `inputData.parameters[name] ?? schema.defaultValue`

검토 대상 spec: `spec/5-system/13-replay-rerun.md` (§10.2, §8.1, §9), `spec/4-nodes/7-trigger/1-manual-trigger.md` (§1, §4~5), `spec/4-nodes/7-trigger/0-common.md` (§1 `TriggerParameterDefinition`), `spec/5-system/4-execution-engine.md` (§6.1.1), `spec/2-navigation/14-execution-history.md` (§3.7).

---

## 발견사항

### [WARNING] 원본 실행 ID 링크의 새-탭 동작이 자매 문서(chain badge)와 정면 반대

- **target 위치**: `spec/5-system/13-replay-rerun.md` §10.2 필드 동작 표, "원본 실행 헤더" 행 — "ID 클릭 시 **새 탭**으로 원본 상세 페이지" (line 338)
- **충돌 대상**: `spec/2-navigation/14-execution-history.md` §3.7, Chain badge 행 — "원본 ID 클릭 시 **같은 탭**에서 원본 상세로 이동 (`<Link href>`, `target=_blank` **없음**)" (line 361)
- **상세**: 두 문서 모두 "원본 실행(original execution)" 으로의 ID 링크를 기술하지만 대상 UI 요소가 다르다 — (1) Re-run **모달 헤더**의 원본 ID (13-replay-rerun §10.2, 지금 구현 대상), (2) 실행 상세 페이지의 **chain badge** 원본 링크 (14-execution-history §3.7, 이미 구현·코드 존재: `app/(main)/workflows/[id]/executions/[executionId]/page.tsx:407-412` 의 평범한 `<Link>` — 새 탭 아님). 두 요소가 별개이므로 기술적으로는 "동일 요소의 모순 정의"는 아니지만, 같은 개념("원본 실행으로의 딥링크")에 대해 한쪽은 새 탭, 다른 쪽은 명시적으로 "새 탭 아님"이라고 반대로 정의한 것은 spec 저자 의도가 실제로 갈렸는지, 아니면 한쪽이 다른 쪽을 갱신할 때 놓친 것인지 확인이 어렵다. git blame 상 13-replay-rerun §10.2 문구는 2026-05-13, 14-execution-history §3.7 문구는 2026-06-03 — 후자가 더 최근이며 "명시적으로 target=_blank 없음" 이라고 **강조**해서 적어놓은 점이 이례적이다(마치 앞선 결정을 뒤집거나 대비시키려는 의도처럼 보임). 이 강조가 §10.2 의 새 탭 결정을 인지한 채 "이 요소는 다르게 간다"고 의도적으로 갈린 것인지, 우연히 일관성 누락된 것인지 spec 텍스트만으로는 판별 불가.
- **영향**: target 구현이 §10.2 문구 그대로 새 탭(`target="_blank"`)을 채택하면 spec 표기상 모순은 없으나(요소가 다르므로), 사용자 경험상 "같은 개념의 두 진입점이 다른 탭 동작"이 실제 의도인지 재확인 없이 진행하면 후속 리뷰에서 "왜 하나는 새 탭이고 하나는 같은 탭이냐"는 질문이 재발할 수 있다.
- **제안**: (1) 이번 구현은 §10.2 문구(새 탭)를 그대로 따르되, 구현 완료 후 PR 설명 또는 spec 어딘가에 "모달 헤더의 원본 링크(새 탭, 모달을 유지한 채 비교 가능하도록)와 chain badge 의 원본 링크(같은 탭, 페이지 이동)는 UX 목적이 달라 의도적으로 다르다"는 한 줄 근거를 남기는 것을 권장(선택). (2) 또는 project-planner 재량으로 두 링크의 탭 동작을 통일하는 것도 고려 가능하나 본 target 범위 밖 — 이번 V-14 는 §10.2 그대로 구현하고, 통일 여부는 별도 follow-up 으로 분리 권장.
- 이 항목은 target 문서 자체의 신규 결함이 아니라 **기존에 이미 존재하던 두 spec 간 불일치**이며, 이번 구현이 그 불일치를 코드로 고착시키는 시점이라 WARNING 으로 표기한다.

---

### 검증됨 — 충돌 없음 (참고용, 발견사항 아님)

다음은 검토 관점에서 명시적으로 확인했으며 **충돌이 없다**:

1. **`config.parameters` 스키마 계약 일치**: `manual-trigger.md §1` 과 `0-common.md` 의 `TriggerParameterDefinition { name, type: string|number|boolean|object|array, required?, defaultValue?, description? }` 정의가 target 이 언급한 스키마와 정확히 일치. `execution-engine.md §6.1.1` 의 `resolveTriggerParameters` 도 동일 인터페이스 사용.
2. **타입 coercion 호환성**: 백엔드 `coerceToType` (`codebase/backend/.../coerce-type.ts`) 는 이미 네이티브 JS 타입(number/boolean/object/array)을 그대로 통과시키는 분기를 갖고 있어, 프론트가 문자열이 아닌 네이티브 타입 값을 `inputOverride` 로 보내도 `resolveTriggerParameters` → `coerceToType` 경로에서 문제 없이 처리된다. 기존 all-text-input 구현(문자열만 전송)에서 typed form(네이티브 타입 전송)으로 바뀌어도 §8.1 의 "`resolveTriggerParameters` 와 동일한 검증을 거침" 계약과 충돌하지 않는다.
3. **필드 기본값 우선순위**: target 이 명시한 `inputData.parameters[name] ?? schema.defaultValue` 순서는 `13-replay-rerun.md §10.2` "입력 데이터 폼 | 원본의 `inputData.parameters`" 항목 및 §RR-PL-02 "원본 실행의 입력 데이터를 폼으로 미리 채워 표시" 와 일치. `resolveTriggerParameters` 자체의 값 없을 때 `defaultValue` 적용 순서(§6.1.1)와도 계층이 다르므로(모달 프리필 vs 서버 실행-시 재보정) 모순 없음.
4. **API 계약**: `POST /api/executions/:executionId/re-run` 의 `inputOverride?: Record<string, unknown>` (§8.1) 은 이미 임의 타입 값을 허용하는 shape 이라 typed form 이 number/boolean/object/array 값을 채워 보내도 request shape 변경이 필요 없다.
5. **manual_trigger 노드 조회 경로**: target 이 "워크플로의 manual_trigger 노드"에서 스키마를 끌어오는 방식은 이미 `rerun-modal.tsx` 가 `workflowsApi.getNodes` 로 로드하는 `NodeData[]` (`type`, `config: Record<string,unknown>`) 를 통해 가능 — 별도 API 신설 불요. `NodeData.type === 'manual_trigger'` 로 필터링하면 `config.parameters` 를 얻을 수 있어 기존 데이터 모델과 충돌 없음.
6. **요구사항 ID**: 새로 부여되는 요구사항 ID 없음(V-14 는 plan 라벨). 기존 `RR-PL-01~07` 네임스페이스와 충돌 없음.

---

## 요약

target 이 구현하려는 typed dynamic form 은 `manual-trigger.md`/`0-common.md` 의 `TriggerParameterDefinition` 계약, `execution-engine.md §6.1.1` 의 seeding 패턴, `replay-rerun.md §8.1` 의 API 계약과 데이터 모델 수준에서 완전히 정합적이며, 백엔드 타입 강제(coerceToType) 도 네이티브 타입 전송을 이미 지원해 별도 backend 변경 없이 안전하다. 유일한 소음은 "새 탭 링크" 요구사항이 인접 문서(`14-execution-history.md §3.7` chain badge)의 "명시적으로 새 탭 아님" 표기와 반대 방향이라는 점인데, 이는 서로 다른 UI 요소를 가리키는 기존(사전 존재) 불일치이지 target 이 새로 만드는 모순이 아니다. 구현을 막을 이유는 없으며 CRITICAL 요소는 없다.

## 위험도

LOW
