# API 계약(API Contract) 리뷰 결과

리뷰 대상: cafe24-mcp-label-i18n 변경셋
리뷰 일시: 2026-05-28

---

## 발견사항

### [WARNING] `/nodes/definitions` 응답 shape 의 breaking change — `label` → `labelKey`

- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.ts` (파일 17), `codebase/frontend/src/lib/node-definitions/types.ts` (파일 26)
- 상세: `PublicCafe24OperationSupported` 및 `PublicCafe24OperationPlanned` 의 `label: string` 필드가 `labelKey: string` 으로 교체된다. 이는 `GET /nodes/definitions` 응답의 `extras.operationsByResource[*][]` 와 `extras.plannedByResource[*][]` 배열 내 모든 오퍼레이션 객체의 스키마 변경을 의미한다. 기존 `label` 필드를 직접 소비하는 모든 클라이언트(브라우저 캐시, 기타 통합 소비자)가 즉시 깨진다.
- plan 문서(파일 27)가 이를 명시적으로 인지하고 "frontend ↔ backend 동시 머지 의무" 라고 명기하고 있어 의도된 breaking change 임은 확인된다.
- 제안: 배포 안전성을 위해 다음 중 하나를 권장한다. (a) 단기간 `label` 필드를 deprecated 로 유지하면서 `labelKey` 를 추가하는 dual-field 전환 후 후속 PR 에서 `label` 제거. (b) 현재 계획대로 atomic deploy 를 강제하되, staging 에서 e2e 회귀를 머지 직후 필수 통과로 CI 게이팅 추가. plan 에 dual-field 방안을 채택하지 않은 이유가 명기되어 있지 않으므로 결정 근거를 spec `§7.5 Rationale` 에 추가하는 것이 바람직하다.

### [INFO] `labelKey` 의 형식(format) 스키마가 API 응답에 암묵적으로 의존됨

- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.ts` line 110 (파일 17)
- 상세: `labelKey` 값은 `cafe24.${resource}.${op.id}` 템플릿으로 생성된다. 이 형식 자체가 API 응답의 일부이자 frontend 의 dict lookup 키가 된다. `resource` 또는 `op.id` 값에 특수문자나 `.` 이 포함될 경우 lookup 충돌이 발생할 수 있다. 현재 `Cafe24Resource` 타입과 `op.id` 는 영문 소문자·언더스코어만 사용하므로 실질적 위험은 낮으나, 형식 규칙이 스키마 수준에서 문서화되어 있지 않다.
- 제안: `spec/conventions/cafe24-api-metadata.md §7.5` 에 `labelKey` 값의 허용 문자 집합과 형식 BNF 를 명기한다.

### [INFO] 응답 형식의 `toPublicSupportedOperation` 시그니처 변경 — 호출자 누락 위험

- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.ts` (파일 17)
- 상세: `toPublicSupportedOperation(op)` 에서 `toPublicSupportedOperation(op, resource)` 로 시그니처가 변경되었다. `buildCafe24Extras()` 내부의 map 콜백은 이미 올바르게 갱신되어 있고, 테스트(`public-meta.spec.ts`, 파일 16)도 갱신되어 있다. 그러나 이 함수가 외부 모듈에서 직접 호출되는 경우 TypeScript 컴파일 에러로 잡히므로 런타임 위험은 없다.
- 제안: 별도 조치 불필요. TypeScript 타입 시스템이 보호한다.

### [INFO] dict lookup miss fallback 이 사용자에게 노출되는 key 형식

- 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` (파일 25), `resolveCafe24OperationLabel` 함수
- 상세: dict 에 `labelKey` 가 등록되지 않은 경우 `cafe24.product.product_list` 형태의 점(`.`) 구분 기술 키가 UI 에 그대로 노출된다. 이는 의도된 fallback(drift 즉시 감지)이라고 plan/spec 에 명기되어 있어 설계 의도는 명확하다. 그러나 production 환경에서 번역 누락이 발생하면 사용자가 이해할 수 없는 문자열을 보게 된다.
- 제안: 모니터링/알림 수단이 없다면 fallback 발생 시 `console.warn` 또는 에러 트래커 전송을 고려한다.

---

## 요약

이번 변경은 Cafe24 오퍼레이션 메타데이터의 한국어 하드코딩 `label` 필드를 backend에서 제거하고, `/nodes/definitions` API 응답의 해당 필드를 `label: string` → `labelKey: string` 으로 대체하는 작업이다. 순수한 i18n 아키텍처 개선이며, Cafe24 외부 API(Cafe24 플랫폼 API)의 URL·경로·인증·페이지네이션·요청 검증 등 계약 사항은 전혀 변경되지 않는다. API 계약 관점에서 유일한 실질적 영향은 내부 `GET /nodes/definitions` 응답의 오퍼레이션 스키마 필드명 변경이며, 이는 의도된 breaking change 로 plan 문서에 명시되어 있다. frontend ↔ backend 동시 머지 의무와 staging e2e 회귀 확인 요건이 plan 에 기재되어 있으므로 절차적으로는 적절히 관리되고 있다. 단, 단기 dual-field 전환 없이 atomic deploy 에 의존하는 방식의 위험 근거가 spec 에 명기되어 있지 않다는 점이 개선 여지로 남는다.

---

## 위험도

LOW
