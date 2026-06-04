# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done` (scope: `spec/conventions/spec-impl-evidence.md`)
대상 diff: `codebase/frontend/src/lib/docs/__tests__/` 내 5개 신규 파일

---

## 발견사항

충돌 또는 주의가 필요한 항목이 없습니다.

### [INFO] `repoRoot()` 함수명 — 두 헬퍼 파일에서 동일 이름으로 독립 정의

- target 신규 식별자: `repoRoot()` — `spec-frontmatter-parse.ts` 에서 export, 4개 신규 test 파일이 이 출처로부터 import
- 기존 사용처: `impl-anchor-parse.ts` 의 128번째 줄에도 동일 이름 `export function repoRoot()` 가 정의됨. `no-internal-refs.test.ts` · `integrations-coverage.test.ts` 등이 이 출처로부터 import
- 상세: 두 파일이 각각 같은 이름의 `repoRoot` 를 export 하지만, 신규 test 파일들은 모두 `spec-frontmatter-parse` 로부터 명시 import 하고 있어 런타임 충돌은 없다. 두 구현이 동일 repo 루트를 반환하므로 의미도 일치한다. 다만 같은 디렉토리 내 두 헬퍼에 동일 이름 함수가 중복 정의됨으로써 유지보수 시 혼란 여지가 있다.
- 제안: 충돌이 아니므로 즉시 수정 불필요. 향후 `spec-frontmatter-parse.ts` 의 `repoRoot` 를 공유 유틸로 단일화하거나, `impl-anchor-parse.ts` 가 동일 출처를 re-export 하도록 리팩토링 가능. 현 상태는 기능·타입 충돌 없음.

### [INFO] `Area` 인터페이스명 — `spec-area-index.test.ts` 내 파일-로컬 정의

- target 신규 식별자: `interface Area` — `spec-area-index.test.ts` 파일 내부 비-export 타입
- 기존 사용처: `codebase/frontend/src/lib/i18n/dict/en/nodeConfigs.ts:364` 에서 `"Area"` 문자열 값(차트 레이블)으로 사용
- 상세: nodeConfigs.ts 의 `"Area"` 는 TypeScript 타입이 아닌 i18n 문자열 값이다. `Area` 인터페이스는 test 파일 내 export 없이 사용되므로 모듈 경계 밖으로 노출되지 않는다. 의미 충돌 없음.
- 제안: 조치 불필요.

---

## 충돌 검토 전체 결과

| 점검 관점 | 결과 |
|---|---|
| 요구사항 ID 충돌 | 없음. `spec-impl-evidence.md` frontmatter `id: spec-impl-evidence` 는 이미 origin/main 에서 사용 중이던 값이고, 신규 도입 ID 아님. |
| 엔티티/타입명 충돌 | `MdLink`, `SpecMdFile`, `LinkViolation`, `LinkViolationKind`, `Area` 모두 `__tests__/` 스코프 내 신규 정의이며 프로덕션 코드나 다른 테스트 유틸과 동명 충돌 없음. |
| API endpoint 충돌 | 해당 없음 (신규 endpoint 없음). |
| 이벤트/메시지명 충돌 | 해당 없음 (신규 이벤트 없음). |
| 환경변수·설정키 충돌 | 해당 없음 (신규 ENV var 없음). |
| 파일 경로 충돌 | 신규 5개 파일(`plan-frontmatter.test.ts`, `spec-area-index.test.ts`, `spec-link-integrity.test.ts`, `spec-links.ts`, `spec-plan-completion.test.ts`) 은 기존 파일과 중복 없음. 기존 명명 컨벤션(`spec-*.test.ts` / `plan-*.test.ts` / 헬퍼는 `spec-*.ts`) 을 준수. |

---

## 요약

target (`spec/conventions/spec-impl-evidence.md`) 가 도입한 5개 신규 파일이 가져오는 식별자들(`slugify`, `headingSlugs`, `extractLinks`, `collectSpecMarkdown`, `findBrokenLinks`, `MdLink`, `SpecMdFile`, `LinkViolation`, `LinkViolationKind`, `isGateCEnforced`, `hasValidSpecImpact`, `GATE_C_CUTOFF`, `WORKTREE_SENTINEL`, `WORKTREE_PLACEHOLDER`, `ISO_DATE`, `collectTopLevelPlans`, `collectAreas`, `inGeneratedCatalog`, `Area`) 은 모두 `__tests__/` 디렉토리 내 신규 스코프로, 프로덕션 코드 및 기존 테스트 헬퍼와 실질적인 명명 충돌이 없다. `repoRoot` 가 두 헬퍼 파일에 독립 정의된 중복이 INFO 수준으로 존재하나 runtime 충돌 없이 각자 명시 import 로 분리 사용 중이다. 파일 경로, 요구사항 ID, Gate 레이블(`Gate C`, `Gate D`) 은 기존 문서와 정합하게 사용되며 신규 충돌이 없다.

---

## 위험도

NONE
