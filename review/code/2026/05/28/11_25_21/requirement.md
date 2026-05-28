# 요구사항(Requirement) 리뷰 — cafe24-mcp-label-i18n

**리뷰 일시**: 2026-05-28
**관련 spec**: `spec/conventions/cafe24-api-metadata.md §2, §7.5`
**plan**: `plan/in-progress/cafe24-mcp-label-i18n.md`

---

## 발견사항

### [INFO] dict-metadata 간 커버리지 자동 검증 테스트 없음 (drift 무감지 위험)

- **위치**: `catalog-sync.spec.ts`, 프론트엔드 테스트 전반
- **상세**: `catalog-sync.spec.ts` 는 catalog markdown ↔ backend metadata 간 양방향 동기는 검증하지만, **backend metadata 의 operation id 집합과 frontend `cafe24Catalog` KO/EN dict 의 key 집합 간 커버리지를 자동으로 검증하는 테스트가 없다**. 현재 KO dict 501 건, EN dict 500 건으로 1건 차이가 있으나, 더 중요한 것은 새 operation 이 backend 에 추가될 때 dict 갱신을 강제하는 보호막이 없다는 점이다. `resolveCafe24OperationLabel` 의 fallback(`labelKey` 자체 노출)은 운영에서 사용자가 어색한 키 문자열을 보게 되는 시점에야 감지된다.
- **spec 근거**: `spec/conventions/cafe24-api-metadata.md §7.5` 는 "dict lookup miss fallback: labelKey 자체 노출 — drift 즉시 감지 가능"이라고 명시하나, "즉시"가 CI 자동 감지가 아닌 운영 배포 후 사용자 노출 시점이다. spec 이 CI 레벨 보호를 명시적으로 요구하진 않으므로 CRITICAL이 아닌 INFO로 분류한다.
- **제안**: `catalog-sync.spec.ts` 또는 별도 frontend 테스트에서 `CAFE24_OPERATIONS_BY_RESOURCE` 의 모든 operation id 에 대응하는 `cafe24.<resource>.<id>` 키가 KO/EN dict 모두에 존재하는지 검증하는 테스트 추가를 권장. EN/KO dict 건수 불일치(501 vs 500)도 이 테스트로 즉시 포착 가능해진다.

---

### [INFO] EN/KO dict 건수 불일치 (501 vs 500)

- **위치**: `codebase/frontend/src/lib/i18n/dict/ko/cafe24Catalog.ts` (501건), `codebase/frontend/src/lib/i18n/dict/en/cafe24Catalog.ts` (500건)
- **상세**: KO dict 와 EN dict 의 key 수가 1건 다르다. 위의 dict-metadata 커버리지 테스트가 없어 어느 key 가 빠졌는지 자동으로 감지되지 않는다. EN dict 에 key 가 누락된 경우 영문 UI 사용자에게 fallback(`cafe24.<resource>.<operation>`) 이 노출된다.
- **제안**: EN dict 에 누락된 key를 확인해 보완할 것. `diff /tmp/ko_keys.txt /tmp/en_keys.txt` 로 확인 가능.

---

### [INFO] `resolveCafe24OperationLabel` 의 locale 파라미터 타입이 `Locale` 대신 `"ko" | "en"` 리터럴

- **위치**: `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` L394
- **상세**: 함수 시그니처가 `locale: "ko" | "en"` 으로 선언되어 있고, 호출부는 `useLocaleStore` 가 반환하는 `Locale` 타입(`"ko" | "en"`)을 넘긴다. 현재 `Locale = "ko" | "en"` 이라 타입은 일치하지만, `Locale` 이 장래에 `"ja"` 같은 값으로 확장되면 `resolveCafe24OperationLabel` 은 묵시적으로 KO dict 로 fallback 한다 (`locale === "en"` 이 아닌 모든 locale → KO dict). `Locale` 타입을 직접 임포트해 사용하면 이 잠재적 버그를 컴파일 시점에 차단할 수 있다.
- **spec 근거**: spec §7.5 는 함수 시그니처 타입을 명시하지 않으므로 spec fidelity 위반이 아닌 INFO.
- **제안**: 함수 파라미터를 `locale: Locale` 로 변경하고 `@/lib/i18n/types` 에서 임포트.

---

### [INFO] `planned.ts` interface 에 `label` 제거 코멘트는 남아 있으나 SoT 참조가 완전하지 않음

- **위치**: `codebase/backend/src/nodes/integration/cafe24/metadata/planned.ts` L17
- **상세**: 변경된 코드에 `// SoT: spec/conventions/cafe24-api-metadata.md §7.5.` 참조가 있으나, §7.5 는 "활동 로그 `api_label`" 섹션 제목이고 "노드 에디터 드롭다운" 관련 내용은 같은 절 하위에 있다. 의도는 명확하지만 코드의 주석이 독자를 정확히 안내한다고 보기에는 다소 모호하다. 기능 결함은 아닌 INFO.

---

### [INFO] plan Phase 체크박스가 모두 미완료 상태

- **위치**: `plan/in-progress/cafe24-mcp-label-i18n.md`
- **상세**: plan 의 Phase 0~7 모두 `[ ]` (미완료) 상태이다. 코드 변경은 Phase 3~4 에 해당하는 내용을 구현했음에도 plan 이 갱신되지 않았다. plan lifecycle 규약(`plan-lifecycle.md`)상 구현 완료된 phase 를 `[x]` 로 체크해야 한다.
- **제안**: 구현 완료된 Phase 0(plan 작성), Phase 3(backend), Phase 4(frontend) 를 `[x]` 로 갱신.

---

## 기능 완전성 평가

변경 범위 전체를 점검한 결과 **핵심 기능 요구사항은 완전히 충족**되었다:

1. **backend `Cafe24OperationMetadata.label` 필드 제거** — `types.ts` 에서 필드 제거, 18개 metadata 파일에서 `label:` 프로퍼티 일괄 제거 완료. 잔여 `label` 참조는 주석이거나 다른 의미의 `label` 변수로 확인됨.

2. **`/nodes/definitions` 응답 `label` → `labelKey`** — `public-meta.ts` 의 `toPublicSupportedOperation` 과 `toPublicPlannedOperation` 모두 `resource` 파라미터를 받아 `` `cafe24.${resource}.${op.id}` `` 형식의 `labelKey` 생성. `buildCafe24Extras` 에서 lambda 로 `resource` 전달 정확.

3. **frontend dict lookup 일원화** — `integration-configs.tsx` 에 `resolveCafe24OperationLabel(locale, op.labelKey)` 도입. supported/planned 드롭다운 모두 적용. fallback 정책(key 자체 노출) spec §7.5 와 일치.

4. **타입 정의 동기** — backend `PublicCafe24OperationSupported`/`PublicCafe24OperationPlanned`, frontend `Cafe24SupportedOperation`/`Cafe24PlannedOperation` 모두 `label` → `labelKey: string` 로 갱신됨.

5. **테스트 갱신** — `public-meta.spec.ts` 는 `label` 미존재 및 `labelKey` 형식 검증. `cafe24-config.test.tsx` 는 `labelKey` fixture + KO dict 실제 lookup 으로 "상품 목록 조회" 등 사람 친화 라벨 렌더 검증.

6. **spec fidelity** — 구현이 `spec/conventions/cafe24-api-metadata.md §7.5` 의 책임 분리 표(labelKey 형식 `cafe24.<resource>.<operation>`, frontend i18n dict lookup, fallback 정책)와 line-level 로 일치한다.

---

## 요약

본 변경은 backend Cafe24 operation metadata 에 hardcoded 된 한국어 `label` 필드를 완전 제거하고, `/nodes/definitions` 응답과 frontend 드롭다운 모두를 `cafe24Catalog` i18n dict lookup 으로 일원화하는 작업이다. 구현은 `spec/conventions/cafe24-api-metadata.md §7.5` 의 책임 분리 설계를 충실히 따르고 있으며, backend/frontend 양측 타입 정의·테스트·메타데이터 파일이 일관되게 갱신되었다. 주요 발견사항은 운영 후 drift 를 즉시 감지하기 위한 CI 레벨 dict-metadata 커버리지 테스트 부재(INFO), EN/KO dict 건수 1건 불일치(INFO)이며, 기능 완전성 관점의 CRITICAL·WARNING 위배는 없다.

---

## 위험도

**LOW**

dict-metadata 커버리지 자동 검증 부재로 장래 operation 추가 시 dict 누락이 CI 에서 차단되지 않는 위험이 있으나, fallback 정책(key 자체 노출)으로 운영에서 즉시 가시화되고 기능 중단은 없다. EN/KO dict 1건 불일치는 사소한 영향이다. 현재 구현된 기능 자체는 요구사항을 완전히 충족한다.
