# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] 퍼시스트된 워크플로 노드의 실패 모드 변경
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/application.ts`, `category.ts`, `customer.ts`, `promotion.ts`, `store.ts`
- 상세: 9개 operation(`applications_list`, `webhooks_list`, `customer_get`, `customer_update`, `coupon_get`, `coupon_delete`, `mains_update`, `mains_delete`, `socials_apple_settings_get`)이 `CAFE24_OPERATIONS_BY_RESOURCE` 에서 제거된다. 기존에 이 operation ID를 참조하는 사용자 워크플로/Integration 설정이 DB에 저장돼 있다면, 이전에는 Cafe24 API에서 404를 반환하는 방식으로 실패했지만 이후에는 `findCafe24Operation` 이 `undefined`를 반환하는 방식으로 실패 모드가 바뀐다. plan 노트("현재도 비동작 404 라 호환 영향 미미")에서 인지한 위험이며, 실제 호환 영향은 낮다. 다만 런타임 에러 메시지 및 오류 처리 분기가 달라질 수 있다.
- 제안: 배포 전 DB에 저장된 Integration 노드 설정에서 9개 operation ID 참조 여부를 조회하는 마이그레이션 체크를 실행하고, 참조가 존재하면 삭제 또는 사용자 경고 처리 로직을 확인할 것.

### [INFO] 과거 Activity 로그 UI 라벨 degradation
- 위치: `codebase/frontend/src/lib/i18n/dict/ko/cafe24Catalog.ts`, `codebase/frontend/src/lib/i18n/dict/en/cafe24Catalog.ts`
- 상세: 9개 operation의 i18n 라벨 항목이 제거된다. 이미 기록된 활동 로그(activity logs)가 DB에 있어 이 operation ID를 참조하는 경우, 사람 친화 라벨 대신 endpoint fallback 렌더링으로 표시된다. 기능 회귀는 아니지만 과거 데이터의 UI 표시가 달라진다.
- 제안: 허용 가능하면 현 상태로 유지. 과거 데이터 라벨 보존이 필요하다면 i18n dict에 레거시 항목만 주석 처리 없이 별도 `LEGACY_cafe24Catalog` 등으로 유지하는 방안을 고려할 수 있으나, 9개 모두 비동작 ops라 실용적 필요는 낮다.

### [INFO] 테스트 픽스처 교체 — `applications_list` → `scripttags_list`
- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/__tests__/activity-label.test.ts`, 라인 18~20
- 상세: 삭제된 operation ID를 테스트 픽스처로 쓰던 부분을 현존하는 `scripttags_list`로 교체했다. `scripttags_list`는 metadata 및 ko/en dict 모두에 존재하므로 테스트 의도("cafe24 prefix + dict hit → 사람 친화 라벨")를 올바르게 검증한다.
- 제안: 이상 없음.

### [INFO] `KNOWN_DOCS_ABSENT` allowlist 비움 → size === 0 고정
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-docs-drift.spec.ts`
- 상세: Set을 비워 allowlist 크기 테스트를 9에서 0으로 갱신했다. `opsForDriftCheck()` 제너레이터가 allowlist 기반으로 필터링하므로, 앞으로 docs 부재 op를 다시 `supported`로 두려면 반드시 allowlist에 추가해야 한다. 가드 우회 방지 메커니즘은 그대로 작동하며 더 엄격해졌다.
- 제안: 이상 없음. 의도된 강화.

### [INFO] 카운트 주석 일관성 갱신 (494 → 485)
- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/activity-label.ts`, `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx`
- 상세: JSDoc 주석의 op 카운트만 갱신된 순수 문서 변경. 런타임 로직 영향 없음.
- 제안: 이상 없음.

## 요약

이번 변경은 Cafe24 공식 docs에 실제 존재하지 않는 것으로 확정된 9개의 seed operation을 backend metadata 배열, spec 카탈로그 MD, frontend i18n 딕셔너리, drift-guard allowlist, 테스트 픽스처까지 연동 일괄 제거한 것이다. 모듈 수준의 const 배열·딕셔너리만 변경되며 전역 변수 도입, 파일시스템 부작용, 환경 변수 조작, 네트워크 호출, 이벤트/콜백 변경은 없다. 유일한 실질적 부작용은 DB에 퍼시스트된 워크플로 노드가 이 9개 operation ID를 참조할 경우 실패 모드가 "Cafe24 404" 에서 "operation not found"로 바뀌는 것인데, plan 노트에서 이미 인식한 위험이며 해당 ops가 이미 비동작 상태였으므로 사용자 영향은 미미하다.

## 위험도

LOW
