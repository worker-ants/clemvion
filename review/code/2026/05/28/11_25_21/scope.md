# 변경 범위(Scope) 리뷰

**리뷰 대상**: Cafe24 operation 라벨 i18n 일원화 (cafe24-mcp-label-i18n)
**리뷰 일시**: 2026-05-28

---

## 발견사항

### [INFO] planned.ts — label 제거 방식이 타 파일과 다름 (주석 대체)
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/planned.ts`
- 상세: 다른 18개 metadata 파일은 `label: '...'` 라인을 단순 삭제했으나, `planned.ts` 의 `Cafe24PlannedOperationEntry` interface 에서는 삭제 대신 JSDoc 주석으로 대체했다 (`// \`label\` 필드는 frontend i18n dict 이주 (2026-05-28). // SoT: spec/...`). 주석 자체는 유용한 맥락이지만, 처리 방식이 types.ts 와는 동일하고 나머지 파일과는 이질적이다. 불일치 자체는 경미하며, 이주 히스토리를 남기려는 의도가 명확하므로 범위 위반이 아닌 스타일 차이다.
- 제안: 유지해도 무방. 장기적으로 히스토리가 충분히 쌓이면 주석을 제거하는 cleanup PR 분리 고려.

### [INFO] constraint-validator.spec.ts — 주석 문구 수정이 동반됨
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/constraint-validator.spec.ts` (라인 4–5)
- 상세: `label` 삭제 목적의 stub 함수 헬퍼 주석 문구가 함께 수정됐다. 기존: `id`/`label`/etc. are not consulted by the validator` → 변경: `Only \`fields\` (for key reference) and \`constraints\` matter to the validator; \`id\`/\`description\`/etc. are stubs.` label 이 존재 목록에서 사라진 것을 반영한 사실-보정 수정으로, label 제거 작업의 자연스러운 연동 변경이다. 범위 내.

### [INFO] public-meta.spec.ts — 테스트 설명 문구 동반 수정
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.spec.ts` (라인 692)
- 상세: `it('preserves id, label, scope, paginated, description', ...)` → `it('preserves id, scope, paginated, description, and emits labelKey', ...)` 테스트 목적을 정확히 기술하도록 설명 문구가 갱신됐다. `label` 삭제 / `labelKey` 도입을 반영한 것으로 범위 내.

### [INFO] review/ 및 plan/ 디렉터리 파일 포함
- 위치: `review/consistency/2026/05/28/11_04_48/` (SUMMARY.md, _retry_state.json, convention_compliance.md 등), `plan/in-progress/cafe24-mcp-label-i18n.md`
- 상세: consistency check 산출물 및 plan 파일이 PR에 포함됐다. 이는 프로젝트 규약(CLAUDE.md)에 정의된 정상 workflow 산출물이다. 범위 내.

---

## 요약

이번 변경의 핵심 의도는 backend `Cafe24OperationMetadata.label` 필드를 완전 제거하고, `/nodes/definitions` API 응답을 `label → labelKey` 로 교체하며, frontend 드롭다운을 `cafe24Catalog` dict lookup 으로 전환하는 것이다. 총 29개 파일의 변경 전반이 이 단일 목표 내에 일관되게 집중되어 있다. 18개 metadata 파일의 `label:` 라인 삭제, types/public-meta/planned.ts 의 인터페이스 갱신, frontend types.ts 및 integration-configs.tsx 의 소비처 전환, 관련 테스트 갱신까지 모두 이 범위 안에 있다. 의도와 무관한 리팩토링, 기능 확장, 포맷팅 변경, 불필요한 임포트 추가/정리, 설정 파일 수정은 발견되지 않았다. planned.ts 의 주석 방식 차이와 테스트 설명 문구 수정은 label 제거 작업의 자연스러운 연동이며 범위 이탈이 아니다.

### 위험도

NONE
