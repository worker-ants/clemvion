# 정식 규약 준수 검토 — convention_compliance

## 대상
- 문서: `spec/conventions/spec-impl-evidence.md` (변경 없음 — frontmatter `code:` 에 이미 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 등재됨)
- 실제 diff: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (순수 내부 리팩터 — `findBrokenLinks`/`findBrokenSpecLinksInSources` 의 DEAD/ANCHOR 스캔 골격을 공유 코어 `findBrokenLinksInFiles(files, options)` 로 추출. public 함수 2개의 시그니처·동작은 무변경)
- 모드: `--impl-done`, diff-base `origin/main`

## 점검 결과

### 1. 명명 규약
신규 식별자(`findBrokenLinksInFiles`, `LinkScanOptions`, `checkSelfAnchors`, `targetFilter`, `slugsFor`)는 모두 파일 내부(비-export) 또는 이미 존재하던 두 public 함수의 내부 헬퍼다. API endpoint·DTO·spec 파일명이 아니라 test-helper 모듈의 사적 구현 디테일이므로 `spec/conventions/**` 의 명명 규약(감사 액션 `<resource>.<verb>`, cafe24 `id` snake_case, DTO 명명 등)이 적용되는 영역이 아니다. 기존 코드베이스 스타일(camelCase 함수·PascalCase 인터페이스)과도 일치. 위반 없음.

### 2. 출력 포맷 규약
`LinkViolation`/`LinkViolationKind` 타입은 diff 이전부터 존재했고 이번 변경에서 그대로 유지된다(`kind`/`source`/`line`/`target` 필드 무변경). API 응답·이벤트 페이로드·에러 코드가 아니라 내부 빌드 가드의 리턴 타입이라 `error-codes.md`/`swagger.md` 등 출력 포맷 규약의 적용 대상이 아니다. 위반 없음.

### 3. 문서 구조 규약
target 인 `spec-impl-evidence.md` 자체는 이번 diff 로 수정되지 않았다 (frontmatter `code:` 목록에 `spec-links.ts` 가 이미 등재돼 있어 갱신 불요 — 새 파일 생성·이름 변경 없음, export 되는 두 public 함수 `findBrokenLinks`/`findBrokenSpecLinksInSources` 는 시그니처 그대로). 문서는 여전히 Overview → 본문(§1~§6) → Rationale 3섹션 구조를 유지하고 있어 CLAUDE.md 의 문서 구조 컨벤션과 일치한다. 해당 없음(N/A) — 위반 아님.

### 4. API 문서 규약
diff 는 OpenAPI/Swagger DTO·데코레이터와 무관한 프런트엔드 test-helper 코드다. `swagger.md` 규약의 적용 대상이 아니다. 위반 없음.

### 5. 금지 항목
`spec/conventions/**` 전체를 확인한 결과 이번과 같은 내부 코드 중복 제거(DRY 리팩터)를 금지하는 항목은 없다. (참고: 과거 cafe24/makeshop 미러 중복은 spec 본문 수준의 *의도된* 미러였고 그 중복 제거가 금지된 사례였으나, 이번 건은 spec 미러가 아니라 한 테스트 헬퍼 파일 내부의 실행 로직 중복을 함수 추출로 제거한 것이라 성격이 다르다.) 커밋 메시지도 "동작 무변경 — spec-link-integrity 가드 13 tests 동일 green" 이라 명시하며, `spec-link-integrity.test.ts`/`spec-area-index.test.ts` 의 import(`findBrokenLinks`, `findBrokenSpecLinksInSources`, `collectSpecMarkdown`, `extractLinks`)도 diff 후 시그니처 그대로 소비되는 것을 확인했다. 위반 없음.

## 발견사항
없음.

## 요약
이번 diff 는 `spec/conventions/spec-impl-evidence.md` §4.2 가드(`spec-link-integrity.test.ts`)가 의존하는 `spec-links.ts` 내부 스캔 로직을 옵션 파라미터화한 순수 리팩터로, public 함수 시그니처·동작·소비자 계약이 전부 무변경이다. API 응답 포맷·명명 규약·문서 구조·Swagger 데코레이터 등 `spec/conventions/**` 가 규율하는 어떤 표면도 건드리지 않으며, 명시적으로 금지된 패턴(예: 의도된 spec 미러 중복 제거)에도 해당하지 않는다. target 문서(`spec-impl-evidence.md`)의 frontmatter `code:` 목록도 파일 경로 변경이 없어 그대로 유효하다.

## 위험도
NONE
