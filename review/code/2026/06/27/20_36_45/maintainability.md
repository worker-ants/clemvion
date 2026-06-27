# 유지보수성(Maintainability) 리뷰

## 발견사항

### 발견사항 1
- **[INFO]** `KNOWN_DOCS_ABSENT` 빈 Set + 크기 고정 테스트 조합의 가독성
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-docs-drift.spec.ts` L495, L581
  - 상세: `const KNOWN_DOCS_ABSENT = new Set<string>([])` 가 비어있는 상태에서 `expect(KNOWN_DOCS_ABSENT.size).toBe(0)` 를 별도 `it` 블록으로 고정하는 구조는, 히스토리를 모르는 신규 기여자에게 "왜 항상 비어있는 Set 을 테스트로 잠그는가?" 라는 혼란을 줄 수 있다. JSDoc 주석이 2026-06-27 사유를 충분히 담고 있어 완화되지만, 빈 Set 자체가 코드상 불필요한 것처럼 보일 수 있다.
  - 제안: 현 구조를 유지하되 JSDoc 에 "향후 docs 부재 op 가 다시 지원 대상에 포함될 경우를 위한 확장 지점(extension point)"임을 명시하는 한 줄을 추가하면 의도가 더 명확해진다. 현재 JSDoc 이 이미 그 역할을 하고 있어 실제 조치 우선순위는 낮다.

### 발견사항 2
- **[INFO]** op 카운트 주석 두 곳 중복 관리
  - 위치:
    - `codebase/frontend/src/app/(main)/integrations/[id]/activity-label.ts` L7 (`cafe24Catalog dict (485 op)`)
    - `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` L740 (`cafe24(485 op)·makeshop(161 op) dict`)
  - 상세: 숫자 `485` 가 두 파일의 문서 주석에 각각 존재한다. 테스트나 타입이 이 숫자를 강제하지 않으므로, 향후 op 를 추가하거나 제거할 때 두 곳 중 한 곳만 갱신하는 드리프트가 발생할 수 있다. 이번 PR 은 두 곳 모두 정확히 갱신했지만, 구조적으로 단일 진실(single source)이 아니라는 점이 남는다.
  - 제안: 두 파일 모두 같은 모듈(`cafe24-extras` 또는 `CAFE24_OPERATIONS_COUNT` 같은 export 상수)을 참조하도록 하고, 주석 대신 타입 시스템이나 테스트가 이 수치를 검증하게 하면 이상적이다. 다만, 이 주석은 어디까지나 가독성 보조용 메모이며 런타임에 영향이 없으므로 즉각 조치보다 백로그 트랙이 적합하다.

### 발견사항 3
- **[INFO]** 변경 범위의 일관성 — 긍정적 평가
  - 위치: 16개 파일 전반
  - 상세: 9개 ops 제거가 metadata `.ts`, catalog index `.md`, drift-guard allowlist, i18n dict ko/en, spec 예시 테이블, plan 체크박스, frontend 테스트 픽스처에 이르기까지 모든 레이어에서 누락 없이 동기화됐다. 특히 `KNOWN_DOCS_ABSENT` allowlist → size 테스트 → metadata.spec.ts must-exist → 카탈로그 coverage 카운트 → activity-label 테스트 픽스처 (`applications_list` → `scripttags_list` 교체)까지 일관성이 높다. 이런 수준의 cross-cutting 정합은 미래의 유사 삭제 작업에도 참조 패턴이 된다.

## 요약

이번 변경은 docs 부재가 최종 확정된 9개 seed operation 을 전 레이어에서 제거하는 깔끔한 정리 작업이다. 각 파일에서 삭제된 코드는 동일한 패턴(`⚠ JSDoc 주석 + operation 객체 + allowlist 항목 + i18n 라벨`)으로 일관되게 처리됐고, 테스트 기대값·카탈로그 카운트·spec 예시 테이블까지 동기화되어 코드베이스 전체의 일관성이 높다. 유일한 잠재적 유지보수 부담은 op 카운트(`485`)가 두 곳의 문서 주석에 중복 존재한다는 점인데, 이번 PR 은 두 곳 모두 정확히 갱신했고 런타임 영향이 없으므로 즉각 조치보다 백로그 수준으로 충분하다. 전반적으로 유지보수성 관점에서 개선적인 변경이다.

## 위험도

LOW
