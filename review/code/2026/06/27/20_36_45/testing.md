# Testing Review — cafe24-g3l-remove-docsabsent

## 발견사항

### **[INFO]** metadata.spec.ts "CRUD coverage" 테스트 설명이 변경 후 의미 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-g3l-remove-docsabsent/codebase/backend/src/nodes/integration/cafe24/metadata/metadata.spec.ts` line 233, describe block "Core categories have CRUD coverage"
- 상세: `customer` 항목이 `['customer_list', 'customer_get', 'customer_update']` → `['customer_list']` 로 축소됨. describe 블록 이름이 "CRUD coverage"인데 customer 는 이제 R(list) 하나만 남아있어 CRUD를 대표하지 않는다. 테스트 로직 자체는 정확하고 "이 ops 가 존재해야 한다"는 의도는 유효하나, describe 이름이 독자를 오도할 수 있다.
- 제안: describe 이름을 "Core categories have minimum required operations" 등 제거 이후 실제 의도를 반영하는 이름으로 갱신하거나, 블록 내 주석으로 "customer 는 docs-absent op 제거 후 list 만 포함(G-3l)"을 명시한다.

---

### **[INFO]** cafe24-catalog-sync.spec.ts 가 dict → catalog 방향(orphan key)을 검증하지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-g3l-remove-docsabsent/codebase/frontend/src/lib/i18n/__tests__/cafe24-catalog-sync.spec.ts`
- 상세: 이 테스트는 "catalog에 있는 supported op 가 KO/EN dict에 존재하는지(missing 검출)"와 "KO↔EN parity"만 검증한다. dict에 있는 키가 catalog에 없는 경우(orphan / 잉여 키)는 별도 assertion이 없다. 이번 변경에서는 9개 op의 dict 키가 KO/EN 양쪽에서 동시에 제거됐기 때문에 KO↔EN parity 테스트가 orphan 불일치는 잡아준다. 그러나 미래에 KO/EN 양쪽에서 동시에 잉여 키를 남겨두면 이 테스트는 통과한다.
- 제안: 이번 변경의 직접적 문제는 아니나, 향후 `Object.keys(cafe24CatalogKo).filter(k => !expectedKeysSet.has(k))` 형태의 orphan 검출 assertion을 추가하면 dict 정합성 보호가 완전해진다.

---

### **[INFO]** frontend MDX 문서가 제거된 operation을 예시로 참조
- 위치:
  - `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-g3l-remove-docsabsent/codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.mdx` line 85
  - `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-g3l-remove-docsabsent/codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.en.mdx` line 84
- 상세: 두 MDX 파일의 Operation 컬럼 설명에 `customer_update`가 예시로 남아있다. 실제 기능 동작에는 영향 없지만, 더 이상 존재하지 않는 op를 예시로 노출한다. plan G-3l 변경 내역에도 "잔존 `customer_update` 예시 2곳(`4-cafe24.md §8.1`·`cafe24-api-metadata.md` i18n 키 예시 → `customer_delete`) + '494 op' 주석 2곳" 처리 항목이 있으나, MDX 문서 2곳은 목록에 포함되지 않은 것으로 보인다.
- 제안: `cafe24.mdx` line 85 및 `cafe24.en.mdx` line 84 의 `customer_update` 예시를 `customer_delete` 또는 `customer_list` 로 교체한다.

---

### **[INFO]** catalog-docs-drift.spec.ts fallback 경로가 테스트 없이 묵시적으로 의존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-g3l-remove-docsabsent/codebase/backend/src/nodes/integration/cafe24/metadata/catalog-docs-drift.spec.ts` lines 28-43 (`resolveRepoRoot`)
- 상세: git 부재 시 `join(__dirname, '..'.repeat(7))` fallback을 사용하는데, 이 경로 계산은 pre-existing issue이다. 이번 변경과 무관하나, CI 환경에서 git이 없고 디렉토리 구조가 다를 경우 `CATALOG_DIR`이 잘못 산출되어 `existsSync(dir)` 에서 모두 miss → 카탈로그 파싱 결과가 0이 되어 `expect(docsOps.size).toBeGreaterThan(450)` fail로 잡힌다. 즉 fail-loud 가드가 이미 존재한다. 현재 동작은 안전하다.
- 제안: 조치 불필요(기존 sanity floor test가 보호). 주석 수준의 메모.

---

## 요약

이 변경은 docs-absent로 확정된 9개 operation을 metadata, i18n dict(KO/EN), 드리프트 가드 allowlist, 테스트 픽스처에서 동시에 제거하는 잘 조율된 순수 삭제 작업이다. `catalog-docs-drift.spec.ts`의 `KNOWN_DOCS_ABSENT` 크기 assertion이 9→0으로 정확히 갱신됐고, `metadata.spec.ts`의 must-exist 기대값도 삭제된 op를 제거하여 일관성을 유지한다. `activity-label.test.ts`의 픽스처도 삭제된 `applications_list`에서 유효한 `scripttags_list`로 올바르게 교체됐다. `cafe24-catalog-sync.spec.ts`의 KO↔EN parity 테스트가 dict 불일치를 양방향으로 보호하므로 이번 dict 정리도 검증 범위 안에 있다. 핵심 드리프트 가드는 단방향(metadata→docs) 검증 구조를 유지하며, KNOWN_DOCS_ABSENT allowlist 크기를 테스트로 고정하는 설계는 미래 우회를 방지하는 좋은 패턴이다. 발견된 사항은 전부 INFO 수준이며 critical/warning은 없다.

## 위험도

LOW
