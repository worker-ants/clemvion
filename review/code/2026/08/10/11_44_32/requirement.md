# 요구사항(Requirement) Review

## 리뷰 대상 및 방법

`typescript-toolchain-followups.md` §1(공유 프리미티브 `_shared.ts` 분리 + DI 대칭화) · §2
(`validateWorkspacePatterns` 순수 함수 분리 + 호출부 관통 synthetic 테스트) · §4(타입/JSDoc 정리)
구현분 + plan 문서 갱신. §3(`catalog:` 마이그레이션)은 plan 상 명시적으로 미착수(`[ ]`)이고 실제
코드 변경도 없다. 대상 diff 는 이전 리뷰 라운드(`review/code/2026/08/10/11_22_14/`, R1~R4)의
전체 산출물(RESOLUTION/SUMMARY/각 reviewer 리포트)이 그대로 커밋에 포함돼 있어 이번 라운드는
그 수렴 결과에 대한 독립 재검증 성격이 강하다.

이번 세션에서 직접 수행한 검증(이전 라운드의 주장을 그대로 믿지 않고 재현):

- `pnpm exec vitest run src/lib/repo-guards/__tests__/` → **3 files / 82 tests 전부 통과** (RESOLUTION/SUMMARY 주장과 일치)
- `pnpm exec vitest run`(frontend 전체) → **284 files / 5920 passed, 1 skipped** — `SUMMARY.md` R4 의 수치와 정확히 일치. 단, **`plan/in-progress/typescript-toolchain-followups.md:125` 의 "TEST WORKFLOW" 체크리스트 항목은 여전히 "282 files / 5862 tests"로 stale** (아래 발견사항 참조).
- `pnpm exec tsc --noEmit` → 0 errors
- `pnpm exec eslint src/lib/repo-guards/__tests__/` → 0 errors, warning 1건(`typescript-toolchain.test.ts:116` `_drop` unused) — diff 범위 밖의 사전 존재 warning, plan·RESOLUTION 의 "기존 warning" 주장과 일치
- `_shared.ts`/`internal-package-registration-guard.ts`/`typescript-toolchain-guard.ts` 전체를 직접 `Read` 해 재export 경계(`ROOT`/`listAtPath`/`repoRoot`/`PackageManifest` 만 재export, `blockRange`/`findKeyLine`는 내부 헬퍼로 유지)와 호출부(`discoverWorkspaceDirs`→`validateWorkspacePatterns`→`listAtPath`, `blockScalarAtPath`→`blockRange`/`findKeyLine`)를 실제 코드로 대조 — 주석의 서술과 구현이 일치
- `repoRoot`/`validateWorkspacePatterns` 의 엣지 케이스(marker 최근접 우선순위, 파일시스템 루트 조기 종료, `MAX_ROOT_SEARCH_DEPTH` 상한 포화, `null` vs `[]` 실패 모드 분리)를 손으로 트레이스해 `shared.test.ts`/`typescript-toolchain.test.ts` 신규 단언의 기대값과 대조 — 전부 일치
- plan 문서의 실측 주장(`typescript`/`eslint` 매니페스트 10개 선언, `@types/node`는 `^20.0.0`(1) vs `^24`(3)로 갈림, `parseMajor("catalog:")` → `null`, `.github/dependabot.yml` npm 등록이 `/`와 `/.claude/tools/mermaid-lint` 둘뿐)을 `grep`으로 재현 — 전부 정확
- `spec/` 전체에 `repo-guard`/`internal-package-registration`/`typescript-toolchain`/`pnpm-workspace` 관련 문서 없음 재확인(grep 0건)

## 발견사항

- **[INFO]** plan 체크리스트의 "TEST WORKFLOW" 항목 수치가 같은 diff 안의 최신 산출물과 어긋난다 (stale)
  - 위치: `plan/in-progress/typescript-toolchain-followups.md:125` (`- [x] **TEST WORKFLOW** — frontend 282 files / 5862 tests passed, ...`)
  - 상세: 이번 세션에서 `pnpm exec vitest run`(frontend 전체)을 직접 실행한 결과는 **284 files / 5920 passed, 1 skipped** 다. 같은 diff 에 포함된 `review/code/2026/08/10/11_22_14/SUMMARY.md:52`는 이미 이 정확한 수치("284 files / 5920 passed, 1 skipped")를 기록하고 있어 SUMMARY 쪽이 맞다. §1 체크리스트의 125행은 R1 이전(초기 리팩터 커밋 `1aa66a046`) 시점의 스냅샷이 R2~R4(`repoRoot` DI 대칭화, `listAtPath` 테스트 이관 등)로 늘어난 테스트 수를 반영하지 못한 채 남아 있다. 기능 결함은 아니며(테스트는 실제로 전부 통과), 완료 기록의 수치가 diff 내 다른 문서와 불일치하는 순수 문서 정확성 이슈다.
  - 제안: 다음 편집 시 125행 수치를 최신 실측값(SUMMARY.md 의 284/5920/1 skipped, 혹은 그 시점 재실측값)으로 맞춘다. 차단 사유 아님.

- **[INFO]** 관련 `spec/` 문서 부재 (정상적 부재)
  - 위치: 변경 전체(`codebase/frontend/src/lib/repo-guards/__tests__/**` — 리포지토리 harness/CI drift 가드)
  - 상세: `spec/` 어디에도 이 가드들(내부 패키지 등록 drift, TypeScript 툴체인 계약)을 규정하는 문서가 없음을 grep 으로 재확인했다. 이 코드는 제품 기능이 아니라 개발 인프라(harness/CI) 코드이고, plan frontmatter `spec_impact: none`과 일치하며, CLAUDE.md 의 정보 저장 위치 표 상으로도 이런 류의 가드는 `spec/`이 아니라 `plan/`·코드 자체 헤더 주석이 SoT다. 결함이 아니라 정상적인 spec 부재(회색지대) 기록.
  - 제안: 조치 불필요.

CRITICAL·WARNING 등급 발견사항 없음.

## 관점별 요약

1. **기능 완전성**: §1(중립 모듈 이관 + DI 대칭화)·§2(fail-closed 순수 함수 분리 + 호출부 관통 테스트)·§4(타입/JSDoc 정리) 모두 plan 이 서술한 목표대로 구현됐고, 이전 3라운드(R1~R3)의 지적(공개 표면 확장·`repoRoot` DI 비대칭·JSDoc "같은 파일" 오기)이 실제로 반영돼 있음을 코드로 직접 확인했다. §3 은 착수하지 않았다고 plan·코드 양쪽이 일관되게 밝히고 있어 "완료 표시했는데 미구현" 류의 괴리 없음.
2. **엣지 케이스**: `repoRoot` 의 최근접 marker 우선순위, 파일시스템 루트(`dirname("/") === "/"`) 조기 종료, `MAX_ROOT_SEARCH_DEPTH` 상한 포화(정확히 12회에서 throw), `validateWorkspacePatterns` 의 `null`(키 부재) vs `[]`(항목 부재) 두 실패 모드 분리 — 전부 손으로 트레이스한 결과 테스트 기대값과 실제 구현이 일치.
3. **TODO/FIXME**: 대상 6개 코드 파일에 TODO/FIXME/HACK/XXX 없음(grep 확인).
4. **의도와 구현 간 괴리**: `loadTypescriptFrom` 반환 타입 `unknown | null` → `unknown` 변경과 `missingCompilerApi` JSDoc 정정(비객체 분기가 아니라 filter 경로를 탄다는 서술) 모두 실제 동작과 일치. `repoRoot` JSDoc 의 "같은 파일" → "형제 모듈 `typescript-toolchain-guard.ts`" 정정도 실제 파일 배치와 일치.
5. **에러 시나리오**: `repoRoot`/`validateWorkspacePatterns`/`fnBody`/`expandWorkspaceGlobs` 의 fail-closed throw 가 모두 진단 가능한 메시지(원인·시작 위치·함수명)를 포함하고, 각 throw 분기를 겨냥한 synthetic 테스트가 실제로 그 메시지·조건을 단언한다. `validateWorkspacePatterns` 만 뽑아두고 호출부(`discoverWorkspaceDirs`)의 관통 여부를 놓치는 뮤턴트(`?? []`)가 실제로 생존했었다는 기록이 있고, 이를 `readLines` 주입으로 막은 호출부 관통 테스트가 실재함을 확인했다.
6. **데이터 유효성**: YAML 서브셋 파서(`listAtPath`/`blockScalarAtPath`)의 인라인 주석 제거, 리스트 항목(`- `) vs 키 선언 구분, 빈 값/미발견 시 `null`/`[]` 반환 후 상위 `validateWorkspacePatterns`에서 vacuity 단언 — 검증 규칙이 합성 fixture 로 고정돼 있고, 인라인 주석 케이스는 뮤테이션 실측으로 커버리지 갭이었음을 밝히고 실제로 메운 이력이 코드/주석/테스트 3자에 일관되게 남아 있다.
7. **비즈니스 로직**: "가드 자신이 조용히 무력화되면 안 된다"(이 저장소의 반복 실패 클래스 #960·#962·#968·#1047)는 이번 변경 전반의 논리적 축이며, `repoRoot`/`validateWorkspacePatterns`/`discoverWorkspaceDirs` 각각의 fail-closed 경로가 실제 synthetic 입력으로 겨냥돼 뮤테이션에 안 죽는다는 것을 이번 세션에서도 실행으로 재확인했다.
8. **반환값**: 점검한 모든 함수(`repoRoot`/`blockRange`/`findKeyLine`/`listAtPath`/`blockScalarAtPath`/`validateWorkspacePatterns`/`discoverWorkspaceDirs`/`loadTypescriptFrom`/`missingCompilerApi`/`parseMajor`)가 모든 분기에서 명시적 반환 또는 throw — 누락 경로 없음.
9. **spec fidelity**: 위 INFO 참조 — 관련 spec 문서 없음(harness/CI 코드 성격상 기대되는 정상적 부재이며 결함 아님). spec 자체의 결함 의심 사항 없음.

## 요약

`typescript-toolchain-followups.md` §1·§2·§4 의 구현은 plan 이 서술한 목표를 완전히 충족하며, 이미 4차례(R1~R4) 리뷰 라운드를 거쳐 수렴한 상태임을 이번 세션에서 코드 실행(vitest 82/82 및 frontend 전체 284/5920/1 skipped, tsc 0 errors, eslint 0 errors)과 코드 직독을 통해 독립적으로 재확인했다. `repoRoot`/`validateWorkspacePatterns`/`listAtPath` 등 핵심 로직의 엣지 케이스와 fail-closed 에러 시나리오가 합성 입력으로 실제로 겨냥돼 있고, plan 문서의 모든 실측 주장(매니페스트 선언 수, dependabot 등록 경로, `parseMajor` 동작 등)이 grep 재현으로 사실임을 확인했다. TODO/FIXME 없음, 반환값 누락 없음, §3 미착수를 plan·코드 양쪽이 정직하게 일치시켜 표시하고 있어 허위 완료 주장이 없다. 유일한 발견사항은 두 건 모두 INFO 다 — spec 문서 부재는 harness 코드 성격상 정상이고, plan 체크리스트의 테스트 수 스냅샷(125행)이 같은 diff 에 포함된 더 최신 문서(SUMMARY.md)의 실측치와 어긋나는 사소한 문서 staleness다. CRITICAL·WARNING 급 발견사항 없음.

## 위험도

NONE
