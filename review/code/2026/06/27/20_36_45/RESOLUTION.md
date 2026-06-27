# Resolution — G-3l docs 부재 9 op 제거 (review 20_36_45)

**원 리뷰**: RISK=LOW, Critical=0, Warning=2. 아래대로 처리.

## WARNING

### W1 — DOCS_STALE: 유저 가이드 MDX 가 제거된 `customer_update` 예시 참조 → ✅ FIXED
- `codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.mdx:85`
- `codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.en.mdx:84`
- 조치: 예시 op id `customer_update` → `customer_delete` (현존 op) 로 교체. ko/en 동시 갱신(parity 유지).
- 원인: 최초 grep 이 `--include="*.md"` 라 `.mdx` 미포함 → 누락. 리뷰가 검출.

### W2 — SIDE_EFFECT: DB 퍼시스트 노드가 제거 op 참조 시 실패 모드 변경 → ⚠ ACCEPTED RISK (코드 변경 없음)
- 제거된 9 op 는 **이전부터 cafe24 wire 상 비동작(404)** 이었다 (docs 부재 seed). 따라서 해당 op 를
  참조하는 기존 워크플로/Integration 노드는 **이미 실패 상태**였고, 본 변경은 실패 메시지를
  "Cafe24 404" → "operation not found" 로 바꿀 뿐 **신규 기능 회귀가 아니다**.
- plan G-3l 및 커밋 메시지에 인지된 위험으로 기록됨 ("현재도 비동작 404 라 호환 영향 미미").
- 별도 DB 마이그레이션/참조-스캔은 본 PR 범위 밖 운영 작업 — 필요 시 배포 전 운영 트랙에서
  Integration 노드 설정의 op id 참조 조회를 수행한다(권장 조치로 SUMMARY 에 명시).

## INFO (선별 처리)

- **TESTING #2** (describe "CRUD coverage" 명칭 불일치) → ✅ FIXED: `metadata.spec.ts` describe 를
  "Core categories expose their minimum required operations" 로 변경 + G-3l 컨텍스트 주석 추가.
- 나머지 INFO(테스트 파일 console.warn 경로 / orphan 키 검출 / op 카운트 상수화 / 빈 Set JSDoc /
  fallback 경로 / activity-log 라벨 degradation)은 **백로그 수준**으로 본 PR 미적용 — 기능·정합성
  영향 없음. activity-log 라벨 degradation 은 제거 결정의 의도된 수용 결과.

## 검증 (fix 후)
- backend `metadata.spec.ts` 18 pass.
- fix 는 doc 예시 2곳 + test describe 명칭으로 런타임 로직 무변경 → 기존 7430 backend / 79+75 frontend green 유지.
- fix 커버 fresh `/ai-review` 1회 추가 수행(stale-review push BLOCK 회피).
