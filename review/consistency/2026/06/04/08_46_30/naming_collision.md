# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done`, scope=`spec/conventions/spec-impl-evidence.md`, diff-base=`origin/main`

검토 대상 신규 파일:
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`

---

## 발견사항

발견된 CRITICAL 또는 WARNING 수준 충돌 없음.

### [INFO] `spec-links.ts` 의 `extractLinks` 는 기존 `spec-area-index.test.ts` 와 `spec-link-integrity.test.ts` 만 소비
- target 신규 식별자: `extractLinks`, `collectSpecMarkdown`, `slugify`, `headingSlugs`, `findBrokenLinks`, `isExternal`, `MdLink`, `LinkViolation`, `LinkViolationKind`, `SpecMdFile`
- 기존 사용처: 신규 파일인 `spec-area-index.test.ts:5` 와 `spec-link-integrity.test.ts:6-9` 에서만 import. 프로덕션 코드(`codebase/frontend/src/**` — `__tests__/` 제외) 에서는 동명 심볼 없음.
- 상세: 충돌 없음. 단, `MdLink` 인터페이스는 본 모듈에서만 선언되고 프로젝트 전역에 동명 타입 없음. `SpecMdFile` 역시 마찬가지.
- 제안: 현재 상태 유지 가능. 필요 시 재사용 가능성을 고려해 별도 shared 라이브러리로 격상하는 리팩터를 향후 검토.

### [INFO] `impl-anchor-parse.ts` 의 `repoRoot` 와 `spec-frontmatter-parse.ts` 의 `repoRoot` 가 동명으로 두 파일에 존재
- target 신규 식별자: 신규 파일 4건이 모두 `import { repoRoot } from "./spec-frontmatter-parse"` 로 가져옴.
- 기존 사용처: `impl-anchor-parse.ts:128` 에도 `export function repoRoot()` 가 동일 시그니처로 선언되어 있음. 동일 폴더 내 두 helper 파일에 같은 이름의 함수가 별도 정의된 상태.
- 상세: 두 `repoRoot()` 구현은 모두 `path.resolve(__dirname, "../../../../../..")` 로 반환값이 동일하며 semantic 충돌 없음. 신규 파일들은 `spec-frontmatter-parse.ts` 에서만 가져오므로 런타임 혼동 없음. 향후 세 번째 helper 추가 시 어느 파일에서 import 해야 하는지 불명확해질 수 있음.
- 제안: `repoRoot` 를 단일 shared helper(`test-utils.ts` 등)로 통합 이전 검토. 단, 현 상태에서 충돌·오동작은 없음.

### [INFO] `Gate C` 라벨이 두 위치에서 언급되지만 의미 일관
- target 신규 식별자: `spec-plan-completion.test.ts` 에 `describe("Gate C — plan-completion spec-consistency", ...)` 와 `describe("Gate C enforcement logic", ...)` 블록명.
- 기존 사용처: `spec/conventions/spec-impl-evidence.md:128`, `plan/in-progress/spec-drift-gates.md:45`, `.claude/docs/plan-lifecycle.md` 에서 "Gate C" 라는 레이블 사용.
- 상세: 모두 동일한 plan-completion spec_impact gate 를 가리키며 의미 일관. 충돌 없음.
- 제안: 없음.

---

## 요약

신규 도입된 5개 파일(`plan-frontmatter.test.ts`, `spec-area-index.test.ts`, `spec-link-integrity.test.ts`, `spec-links.ts`, `spec-plan-completion.test.ts`)이 새로 정의하는 식별자(함수·인터페이스·상수·describe 블록명)는 기존 프로덕션 코드 및 spec 식별자와 의미상 충돌이 없다. `spec-links.ts`가 노출하는 `extractLinks`, `MdLink`, `SpecMdFile` 등 신규 공개 심볼은 동일 `__tests__/` 범위에서만 소비되며 전역 네임스페이스에 영향이 없다. 유일한 INFO 수준 주의 사항은 `repoRoot()` 함수가 `impl-anchor-parse.ts`와 `spec-frontmatter-parse.ts` 두 파일에 중복 선언된 기존 패턴이지만, 신규 파일들은 후자에서 일관되게 import 하므로 오동작 위험 없음.

---

## 위험도

NONE
