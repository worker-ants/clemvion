# 정식 규약 준수 검토 — `e2e-race-helper-8d1b6e`

## 검토 범위 확인

- 이 브랜치의 `spec/5-system` 델타는 0개 파일이다 (프롬프트 명시). 실제 변경은 `codebase/backend/test/**` 의 e2e 헬퍼 추출(`raceUnderHeldLock()`) + `PROJECT.md` 갱신 + `plan/in-progress/e2e-race-helper.md` 신설로, **테스트 전용 리팩터**다.
- `## 구현 변경 사항` 섹션이 예산 절단으로 프롬프트에 실리지 않아, `git -C <워킹트리> diff origin/main...HEAD` 로 직접 확인했다 (10개 code_areas 파일: `PROJECT.md`, `codebase/backend/test/helpers/concurrency.ts` 신설, e2e-spec 8개 수정).
- `spec/conventions/**` 전수(오버뷰·API convention·audit-actions·swagger·error-codes·spec-impl-evidence 등)와 대조했으며, 이번 변경이 명명·출력 포맷·문서 구조·API 문서·금지 항목 중 어느 것과도 충돌 지점을 만들지 않았다.

## 관점별 검토

1. **명명 규약** — `codebase/backend/test/helpers/concurrency.ts` 는 기존 `helpers/db.ts` · `helpers/auth.ts` 와 동일한 디렉토리·명명 패턴을 따른다. 함수명 `raceUnderHeldLock` 은 기존 헬퍼(`registerAndLogin`, `createTeamWorkspace`, `createDbClient`)와 동일한 동사구 camelCase 컨벤션이다. 상수 `VACUITY_GUARD_MS` · `KNOWN_LOCK_TIMEOUTS_MS` 는 기존 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` (import 대상, `codebase/backend/src/modules/triggers/trigger-config-lock.ts:128`) 와 동일한 SCREAMING_SNAKE_CASE. 위반 없음.
2. **출력 포맷 규약** — 이 변경은 API 응답·이벤트 페이로드·에러 코드를 하나도 신설/변경하지 않는다 (`RESOURCE_NOT_FOUND`, `WEBAUTHN_CREDENTIAL_NOT_FOUND`, `MEMBER_NOT_FOUND`, `NOT_A_MEMBER` 등은 기존 코드를 그대로 단언하는 테스트 리팩터일 뿐). `spec/conventions` 상 출력 포맷 규약과 접점 없음.
3. **문서 구조 규약** — `spec/**` 파일을 하나도 건드리지 않았으므로 Overview/본문/Rationale 3섹션·`_product-overview.md`·`0-` prefix 규약과 무관하다. `PROJECT.md` 갱신(§e2e 작성 패턴 섹션에 헬퍼 사용법 추가)은 CLAUDE.md 의 "실제 명령·인프라·면제 화이트리스트·e2e 작성 패턴: PROJECT.md" SoT 배치와 정확히 일치한다 — 별도 `spec/conventions/` 문서를 신설하거나 다른 위치에 흩뿌리지 않았다.
4. **API 문서 규약** — OpenAPI/Swagger 데코레이터·DTO 를 건드리지 않는다 (`spec/conventions/swagger.md` 대상 표면 아님).
5. **금지 항목** — `spec/conventions/**` 전체에서 명시적으로 금지한 패턴(예: 외부 LLM 직접 호출, 도메인 감사 액션 명명 위반, 카탈로그 필드 임의 완화 등)과 이번 diff 사이에 접점이 없다.

## Plan frontmatter / Gate C 관련 확인 (참고, CRITICAL 아님)

- `plan/in-progress/e2e-race-helper.md` 의 `spec_impact: none` 은 `.claude/docs/plan-lifecycle.md` §Gate C 가 요구하는 **bare `none` 리터럴** 형태로 정확히 작성되어 있다 (리스트 `- none` 이나 빈 배열 `[]` 오류 형태 아님). in-progress 단계에서는 Gate C 강제 대상이 아니지만, 형식 자체는 이미 올바르다.
- `worktree: e2e-race-helper-8d1b6e` · `owner: developer` · `started: 2026-09-21` 3필드 모두 존재 — `plan-frontmatter.test.ts` 스키마 요구사항 충족.

## 발견사항

없음. 이번 변경 범위(테스트 헬퍼 추출 + PROJECT.md 문서화 + plan 신설)에서 정식 규약(`spec/conventions/**`) 위반 또는 규약과의 거리감이 발견되지 않았다.

## 요약

이번 브랜치는 `spec/**` 를 전혀 건드리지 않는 테스트 전용 리팩터(9개 e2e 파일에 흩어진 겹침 오케스트레이션을 `codebase/backend/test/helpers/concurrency.ts` 의 `raceUnderHeldLock()` 으로 추출)이며, 신규 API·출력 포맷·문서 구조·감사 액션·에러 코드를 하나도 신설하지 않는다. 명명(파일·함수·상수)은 기존 `helpers/*.ts` 패턴과 완전히 일치하고, `PROJECT.md` 갱신 위치도 CLAUDE.md 의 SoT 표(e2e 작성 패턴 → PROJECT.md)와 정확히 부합한다. `plan/in-progress/e2e-race-helper.md` 의 `spec_impact: none` 표기도 Gate C 형식 요구사항을 이미 만족한다. 정식 규약 준수 관점에서 이번 PR 은 위반·경고 사유가 없다.

## 위험도

NONE
