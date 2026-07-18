# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `eslint.config.mjs` 에 새 named export `LOWER_LAYERS` 도입 — config 모듈이 "설정값 제공자"에서 "테스트가 import 하는 SoT" 로 역할이 확장됨
  - 위치: `codebase/frontend/eslint.config.mjs:43` (`export const LOWER_LAYERS = ...`), 소비처 `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:255`
  - 상세: 기존에는 `eslint.config.mjs` 가 `export default eslintConfig` 하나만 노출했다. 이번 변경으로 `LOWER_LAYERS` 배열이 named export 로 추가되고, 테스트가 이를 import 해 "config 의 실제 계층 배열 == 규약이 기대하는 배열" 을 대조하는 역방향 결합이 생겼다. default export 사용처(ESLint 로더 자체)는 영향받지 않으므로 기존 호출자에는 breaking 하지 않지만, 앞으로 이 상수를 rename/삭제하면 테스트가 즉시 깨진다 — 이는 코드 내 주석(`회귀 테스트가 이 배열을 import 해...`)에 의도적으로 문서화돼 있어 "의도치 않은" 부작용은 아니다.
  - 제안: 없음(설계 의도로 확인됨). 향후 `LOWER_LAYERS` 이름을 바꿀 때 테스트 import 도 함께 갱신해야 함을 아는 사람만 작업하도록 파일 상단 주석 수준의 안내면 충분해 보임 — 이미 존재.

- **[INFO]** 신규 테스트 스위트가 실제 `ESLint` 인스턴스(`new ESLint({ cwd: FRONTEND_ROOT })`)를 생성해 `lintText` 를 다수 호출
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:539-581`
  - 상세: 기존 스위트는 합성 `Linter#verify` (순수 인메모리)만 썼으나, 신규 스위트는 `eslint.config.mjs` 를 실제로 resolve 하는 `ESLint` API 를 사용한다. 이는 디스크에서 config·plugin 모듈을 재로딩하므로 파일시스템 읽기(쓰기 아님)와 약간의 테스트 실행시간 증가를 유발한다. 캐시 옵션을 켜지 않았으므로 `.eslintcache` 등 파일 쓰기 부작용은 없다. 네트워크 호출도 없음(로컬 config/플러그인만 사용).
  - 제안: 없음(기능상 필요한 트레이드오프, 문서화됨).

- **[INFO]** ESLint 가드 스코프 확장(`files: ["src/lib/**"]` → `files: LOWER_LAYERS` = `["src/lib/**", "src/types/**"]`)은 향후 `src/types/**` 하위 파일의 `@/components/**` import 를 새로 차단하는 정책 변경(런타임 동작 변경 아님, lint-time 정책)
  - 위치: `codebase/frontend/eslint.config.mjs:146` (`files: LOWER_LAYERS`)
  - 상세: 실측(`npx eslint src/types --max-warnings=999`) 결과 현재 위반 0건이라 즉각적인 CI 회귀는 없음을 직접 확인했다. 다만 이는 "향후 기여자가 `src/types/**` 에서 `@/components` 를 import 하면 즉시 error" 라는 새 제약을 도입하는 것이므로 lint 정책의 실질적 인터페이스 변경이다. `spec/conventions/frontend-layering.md` §2·§4 와 plan 문서에 명시적으로 근거·의도가 기록돼 있어 의도치 않은 부작용은 아니다.
  - 제안: 없음.

- **[INFO]** `spec/conventions/frontend-layering.md` frontmatter 변경 (`status: partial → implemented`, `pending_plans` 필드 제거)이 `spec-pending-plan-existence.test.ts` 가드와 상호작용
  - 위치: `spec/conventions/frontend-layering.md:1-6`
  - 상세: `pending_plans` 를 참조하는 별도 가드(`codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts`)가 존재를 확인했다. 이번 변경은 `status` 를 `implemented` 로 승격하며 `pending_plans` 필드 자체를 제거하므로, 그 가드가 기대하는 "partial 이면 pending_plans 에 실재하는 plan 경로가 있어야 한다" 조건과 충돌하지 않는다(더 이상 partial 이 아니므로 검사 대상에서 벗어남). 의도치 않은 가드 트리거는 없음.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/spec-draft-frontend-layering.md` 삭제 + `plan/complete/spec-draft-frontend-layering.md` 신규 생성 (파일시스템 이동)
  - 위치: 파일 5·6
  - 상세: PLAN 라이프사이클 규약(`in-progress` → `complete`)에 따른 정상적인 파일 이동이며, 진행 중이던 작업이 완료됐음을 반영한다. 내용 변경(중복 작업 처분 기록 추가, Phase 2/3 체크리스트 완료 표시)도 이력 보존 목적으로 일관됨. 의도치 않은 삭제·덮어쓰기 아님.
  - 제안: 없음.

- **[INFO]** 메시지 문자열 상수(`DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG`/신규 `STATIC_IMPORT_MSG`) 리팩터 — 하드코딩 문자열 → `LOWER_LAYERS` 파생 템플릿 리터럴
  - 위치: `codebase/frontend/eslint.config.mjs:118-120`
  - 상세: `grep` 으로 확인한 결과 이 상수들을 소비하는 곳은 `eslint.config.mjs` 자기 자신뿐이며, 어떤 테스트도 메시지 텍스트를 정확히 문자열로 단언(assert)하지 않는다(길이·severity 만 검증). 따라서 메시지 문구가 `src/lib/**` 단독 언급에서 `src/lib/** · src/types/**` 병기로 바뀌어도 스냅샷/텍스트 매칭 회귀는 없다.
  - 제안: 없음.

발견된 **CRITICAL/WARNING 급 부작용은 없음**. 전역 변수 오염, 환경 변수 읽기/쓰기, 네트워크 호출, 예상치 못한 파일 삭제, 기존 함수 시그니처 파괴, 이벤트/콜백 변경은 확인되지 않았다.

## 요약

이번 변경은 ESLint 레이어 가드의 스코프를 `src/lib/**` 에서 `src/lib/**, src/types/**` 로 확장하고, 그 확장이 실제로 걸리는지 검증하는 신규 테스트 스위트(`ESLint` API 기반 실경로 매칭 테스트)를 추가하며, 관련 spec·주석·plan 문서를 동기화하는 작업이다. 새로 도입된 named export(`LOWER_LAYERS`)는 테스트와의 역방향 결합을 만들지만 의도적으로 문서화돼 있고, 스코프 확장은 실측(`npx eslint src/types` 0 errors)으로 즉각적 CI 회귀가 없음을 직접 확인했다. 파일 삭제/이동(plan 라이프사이클)과 spec frontmatter 변경도 관련 가드(`spec-pending-plan-existence.test.ts`)와 충돌하지 않는다. 전역 상태 오염, 환경변수, 네트워크 호출, 시그니처 파괴 등 고전적 의미의 의도치 않은 부작용은 발견되지 않았으며, 유일한 주목점은 lint 정책 자체의 실질적 확장(향후 `src/types/**` 기여자에게 새 제약 부과)인데 이는 이번 PR 의 목적 그 자체이므로 부작용이 아니라 의도된 인터페이스 변경이다.

## 위험도

LOW
