# 부작용(Side Effect) 리뷰 결과

검토 대상: Cafe24 planned operation 전수 구현 (Phase 1~4)
검토 일시: 2026-05-21
검토 파일 수: 18

---

## 발견사항

### [INFO] `planned.ts` 배열 비움 — 소비자 코드 영향 없음
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/planned.ts`
- 상세: `store`, `product`, `order` 배열이 각각 대규모 제거(~300 행)를 거쳐 빈 배열 `[]` 또는 privacy_* 6건만 잔존하는 형태로 변경되었다. 이 배열을 소비하는 쪽(프론트엔드 UI 드롭다운 "지원 예정" 배지 렌더링)은 배열을 enumerate 해 disabled 항목을 표시하는 구조이며, 빈 배열이 되면 disabled 배지가 자동으로 사라진다. 이는 의도된 동작이므로 별도 UI 변경 작업이 없어도 부작용이 없다. 단, `community`, `customer`, `design`, `application` 등 나머지 resource 배열은 이전에도 `[]` 였고 이번 변경에서 건드리지 않았으므로 기존 동작 보존.
- 제안: 특이사항 없음.

---

### [INFO] `orderOperations`, `productOperations`, `storeOperations` 배열 확장 — 런타임 enumerate 영향
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/order.ts`, `product.ts`, `store.ts`
- 상세: 세 배열에 대규모 정적(static) 객체 리터럴 추가(order ~1016줄, product ~670줄, store 유사 규모). 이 배열은 모듈 로드 시 메모리에 한 번 올라가는 상수 배열이다. 함수 시그니처 변경 없음, 전역 변수 변경 없음, 기존 행 수정 없음(append-only). `findCafe24Operation(resource, id)` 같은 lookup 함수가 선형 탐색을 하는 경우 배열 크기 증가(약 5~7배)로 lookup 지연이 미세하게 증가할 수 있으나, operation metadata lookup 이 hot-path 가 아닌 설정 조회 경로임을 고려하면 실질적 성능 부작용은 없다.
- 제안: 추후 operation 수가 더 증가할 경우 ID → 객체 Map 인덱스 도입을 검토할 수 있으나, 현재 규모에서는 불필요.

---

### [INFO] `spec/conventions/cafe24-restricted-scopes.md` 단일 토큰 변경 (`op` → `operation`)
- 위치: `spec/conventions/cafe24-restricted-scopes.md` 32행
- 상세: spec 문서 서술 수정(설명 텍스트의 `restricted: op` → `restricted: operation`). 실제 catalog MD 파일의 `restricted` 컬럼 값이나 backend 메타데이터 코드를 변경하는 것이 아니라 규약 문서의 예시 표기를 통일한 것이다. `catalog-sync.spec.ts` 는 catalog MD 파일의 실제 `restricted` 컬럼 값을 파싱하지 규약 문서 본문을 파싱하지 않으므로, 이 변경이 테스트 결과에 영향을 주지 않는다. 부작용 없음.
- 제안: 특이사항 없음.

---

### [INFO] `spec/conventions/cafe24-api-catalog/_overview.md` Coverage Matrix 수치 갱신 및 §4 검증 규칙 8 문장 추가
- 위치: `spec/conventions/cafe24-api-catalog/_overview.md`
- 상세: Coverage Matrix 수치가 실제 배포 상태와 일치하도록 수동 갱신됨(264→494 supported, ~109→6 planned). §4 규칙 8 말미에 `status: planned` 행 제외 명시 문장이 추가되었다. 이 변경은 spec 문서만 수정하며 런타임 코드·테스트 동작에 직접 영향을 주지 않는다. `catalog-sync.spec.ts` 가 이 문서의 §4 규칙 설명 텍스트를 파싱하여 동작하지 않는다면(테스트는 코드로 구현된 검증 로직을 실행함) 부작용 없음.
- 제안: 특이사항 없음.

---

### [INFO] `spec/conventions/cafe24-api-catalog/product.md` 및 관련 catalog MD — status 컬럼 `planned` → `supported` 일괄 변경
- 위치: `spec/conventions/cafe24-api-catalog/product.md` (49행), `order.md` (89행, diff 생략), `store.md` (92행, diff 생략)
- 상세: catalog MD 파일의 row status 변경은 `catalog-sync.spec.ts` 의 동기 검증 대상이다. 동기 검증이 통과하려면 catalog MD의 `supported` 행에 대응하는 backend 메타데이터 row 가 존재해야 하고, 실제 `order.ts`/`product.ts`/`store.ts` 에 row 가 추가되었으므로 정합이 유지된다. `?` 값이 실제 값으로 채워졌고, 추가된 메타데이터의 `method`/`path`/`scopeType` 이 catalog MD와 일치하는지는 `catalog-sync.spec.ts` 가 CI에서 검증한다. 부작용 없음.
- 제안: 특이사항 없음.

---

### [INFO] `plan/in-progress/cafe24-planned-implementation.md` 신규 생성 — 파일시스템 부작용
- 위치: `plan/in-progress/cafe24-planned-implementation.md`
- 상세: plan 파일 신규 생성은 `plan/` 디렉토리에만 영향을 미치며, 코드 동작·테스트·빌드에 영향이 없다. frontmatter 에 `worktree: cafe24-planned-impl-060c7f` 가 명시되어 있어 CLAUDE.md 규약(진행 중 작업 = `plan/in-progress/`, worktree 명시)을 준수한다. Phase 4 체크박스에 `git mv plan/in-progress/... plan/complete/` 가 미완 항목으로 남아있으므로 PR 종료 전 이동이 필요하다(이 자체는 부작용이 아니라 계획된 절차).
- 제안: 특이사항 없음.

---

### [INFO] `review/consistency/` 하위 신규 파일들 — 리뷰 산출물 생성
- 위치: `review/consistency/2026/05/21/07_31_53/` 하위 7개 파일 (SUMMARY.md, convention_compliance.md, cross_spec.md, naming_collision.md, plan_coherence.md, rationale_continuity.md, _retry_state.json, meta.json)
- 상세: 코드 리뷰·일관성 검토 산출물 파일 생성은 `review/` 디렉토리로 격리되며 런타임 코드 동작에 영향이 없다. `_retry_state.json` 은 오케스트레이터의 재시도 상태 추적용 내부 파일로 이후 재실행에 영향을 미칠 수 있으나, `agents_pending: []` 로 완료 상태이므로 다음 호출이 이 파일을 읽어 불필요한 재실행을 하지 않는다.
- 제안: 특이사항 없음.

---

## 부작용 관점별 점검 결과 요약

| 관점 | 결과 |
|---|---|
| 의도치 않은 상태 변경 | 없음. 모든 변경은 상수 배열 확장 또는 spec/plan 파일 갱신이다. |
| 전역 변수 | 새 전역 변수 도입 없음. `orderOperations`, `productOperations` 등은 기존 export 상수이며 append-only 확장이다. |
| 파일시스템 부작용 | `plan/in-progress/` 신규 파일 생성, `review/consistency/` 산출물 생성 — 모두 의도된 위치에 격리되어 있음. |
| 시그니처 변경 | 함수/메서드 시그니처 변경 없음. |
| 인터페이스 변경 | 공개 API (외부로 export 되는 배열 및 타입)는 기존과 동일 타입을 유지한 채 확장만 이루어짐. |
| 환경 변수 | 환경 변수 읽기/쓰기 없음. |
| 네트워크 호출 | 의도하지 않은 외부 서비스 호출 없음. metadata 파일은 정적 데이터 선언만 포함한다. |
| 이벤트/콜백 | 이벤트 발생 또는 콜백 호출 변경 없음. |

---

## 요약

이번 변경 전체는 Cafe24 operation metadata 정적 배열에 새 row 를 append 하고, 대응하는 catalog MD 파일의 `planned` 행을 `supported` 로 승격하며, spec 문서 2건(restricted-scopes.md 토큰 통일, store.md Rationale 섹션 이동)을 정정한 것이다. 어떤 함수 시그니처도 변경되지 않았고, 전역 변수 도입도 없으며, 외부 서비스 호출도 없다. `planned.ts` 에서 대규모 행이 제거되어 빈 배열이 되었으나 이는 UI의 "지원 예정" 배지가 자동으로 사라지는 의도된 결과다. 신규 추가된 모든 메타데이터 row는 기존 `Cafe24OperationMetadata` 타입을 준수하며 catalog-sync 테스트가 양방향 동기를 검증한다. 부작용 관점에서 식별된 위험 항목이 없다.

---

## 위험도

NONE
