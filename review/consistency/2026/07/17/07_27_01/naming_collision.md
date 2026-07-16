# 신규 식별자 충돌 검토 — scope=spec/conventions/ (impl-done, diff-base=origin/main)

### 확인 절차

- `git diff origin/main...HEAD --stat -- spec/conventions/` 로 target 영역의 실제 변경분을 1차 확인: 수정 4파일(`cross-node-warning-rules.md`, `execution-context.md`, `node-cancellation.md`, `spec-impl-evidence.md`), 각 1라인, 총 4 insertion / 4 deletion. `--diff-filter=A/R/D` 로 재확인한 결과 이번 diff 에서 **신규 생성·rename·삭제된 conventions 파일은 0건**.
- 4건의 실제 변경 내용은 전부 `plan/in-progress/parallel-p2-followups.md` → `plan/complete/parallel-p2-followups.md` 로의 **기존 링크 경로 정정**(plan 완료 이동 반영)이며, 신규 식별자(요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV var·파일 경로)를 전혀 도입하지 않는다. `spec-impl-evidence.md` 1건은 `spec-link-integrity.test.ts` 가드 범위를 명확히 하는 서술 정정으로, 마찬가지로 새 식별자 신설이 아니다.
- target_path 가 `spec/conventions/` 디렉토리 전체로 지정돼 있어(prompt 가 전체 내용을 덤프), diff 로는 안 잡히는 **디렉토리 전반의 잠재 충돌**도 표본 점검했다:
  - `audit-actions.md` §3 레지스트리(예: `workspace.created`, `workspace.transfer_ownership`, `execution.re_run` 등) vs 실제 코드 `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 의 `AUDIT_ACTIONS` 상수 — 항목·상태(구현/미구현) 1:1 일치, drift 없음.
  - `cafe24-api-catalog/_overview.md` 가 명시한 "operation `id` 는 resource 내 unique" 제약은 `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` + `catalog-docs-drift.spec.ts` 가 자동 강제 중 — 222개 field-level 문서를 수작업 전수 대조하는 대신 이 기존 가드에 위임해도 안전.
  - `secret-store.md:151` 이 언급하는 환경변수 `ENCRYPTION_KEY` 는 "재사용" 이라고 스스로 명시하며 `crypto.util.ts` 의 기존 키를 가리킨다 — 새 ENV var 신설이 아니라 의도된 재사용이므로 충돌 아님.
  - `cafe24-api-catalog/` 와 `makeshop-api-catalog/` 는 provider 별 별도 디렉토리 네임스페이스라 `product.md`/`order.md` 등 동명 리소스 파일이 양쪽에 있어도 경로가 분리(`.../cafe24-api-catalog/product.md` vs `.../makeshop-api-catalog/product.md`)돼 실제 파일 경로 충돌 없음.

### 발견사항

없음.

### 요약

이번 검토 대상 diff(`origin/main` → HEAD, `spec/conventions/` 범위)는 4개 파일의 1라인씩 링크 경로 정정(`plan/in-progress/...` → `plan/complete/...`)뿐이며 신규 파일·신규 식별자를 전혀 도입하지 않아 신규 식별자 충돌의 여지가 없다. scope 가 디렉토리 전체로 지정된 점을 고려해 diff 밖의 기존 정의들(감사 액션 레지스트리, Cafe24/MakeShop API 카탈로그 operation id, ENV var 재사용 표기, provider 별 카탈로그 디렉토리 네임스페이스)도 표본 점검했으나 코드·기존 문서와의 drift 나 다른 의미로의 재사용은 발견되지 않았고, 카탈로그 id 유일성은 이미 자동화 가드(`catalog-sync.spec.ts`, `catalog-docs-drift.spec.ts`)로 상시 강제되고 있다.

### 위험도
NONE
