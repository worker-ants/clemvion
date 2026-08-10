# 요구사항(Requirement) Review

## 리뷰 대상

`typescript-toolchain-followups.md` §1(공유 프리미티브 `_shared.ts` 분리)·§2(`validateWorkspacePatterns`
순수 함수 분리 + synthetic 테스트)·§4(타입·JSDoc 정리) 3건의 구현. §3(`catalog:` 마이그레이션)은
plan 상 명시적으로 미착수(`[ ]`)이며 이번 diff에 해당 코드 변경이 없다.

- `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts` (신규)
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts`
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts`
- `codebase/frontend/src/lib/repo-guards/__tests__/shared.test.ts` (신규)
- `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts`
- `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts`
- `plan/in-progress/typescript-toolchain-followups.md`

## 검증 수행

- 코드가 이미 커밋된 상태(`git log`: `1aa66a046` refactor → `2880e8e8a`/`e1b94ed88` ai-review 반영
  fix → `5186f2da9` docs fix)라 실행으로 직접 검증했다.
- `pnpm vitest run src/lib/repo-guards/__tests__/` → **3 files / 82 tests 전부 통과**
  (plan 체크리스트의 "양쪽 가드 74건 통과" + §2 신규 4건 + `_shared.ts` 신규 회귀 6건과 정합).
- `pnpm eslint src/lib/repo-guards/__tests__/` → 0 errors, warning 1건(`typescript-toolchain.test.ts:116`
  `_drop` unused) — 이 diff 이전부터 있던 것으로 plan이 밝힌 "기존 warning 13" 범주. 신규 아님.
- `tsconfig.json` 의 `exclude: ["src/**/__tests__/**"]`, `vitest.config.ts` 의
  `include: ["src/**/*.{test,spec}.{ts,tsx}"]` 확인 — 헤더 주석의 "이 파일은 tsc/next build 제외,
  vitest 자동 실행 대상도 아님" 주장과 실제 설정이 일치.
- `repoRoot`/`blockRange`/`findKeyLine`/`listAtPath`/`validateWorkspacePatterns`/
  `discoverWorkspaceDirs` 각 신규·변경 함수를 손으로 트레이스해 새 테스트(marker 우선순위, 상한
  경계, `null`/`[]` 분기, 호출부 관통 검증)의 기대값과 대조 — 전부 일치.
- plan 문서의 실측 주장("typescript 10개 매니페스트 선언" · "eslint 10개" · "`@types/node` 는
  `^20.0.0`/`^24` 로 갈림") 을 `grep` 으로 재현 — 정확함(허위 주장 없음).
- `spec/` 전체에 `repo-guard`/`internal-package-registration`/`typescript-toolchain`/
  `pnpm-workspace` 관련 문서 없음 확인(grep 0건).

## 발견사항

- **[INFO]** 관련 spec 문서 부재.
  - 위치: 변경 전체(리포지토리 harness/CI 가드 코드)
  - 상세: `spec/` 어디에도 이 가드들(내부 패키지 등록 drift·TS 툴체인 계약)을 정의하는 문서가 없다.
    성격상 제품 기능이 아니라 개발 인프라(harness) 코드라 `spec/` SoT 대상이 아닌 것으로 판단된다
    (CLAUDE.md 의 정보 저장 위치 표에서도 이런 류의 가드는 `spec/` 이 아니라 `plan/`·코드 자체 주석이
    SoT). 결함이 아니라 회색지대 기록.
  - 제안: 조치 불필요. 다만 이런 harness 가드의 설계 규약(공유 프리미티브 배치 기준·fail-closed
    원칙 등)이 반복적으로 이 파일 헤더 주석에만 쓰이고 있어, 세 번째 가드가 생길 때 같은 논쟁이
    재발할 수 있다 — `spec/conventions/` 로 승격할지는 `project-planner` 판단 영역.

- **[INFO]** 사전 존재 lint warning 1건은 이 diff 의 변경 범위 밖.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts:116`
    (`_drop` unused var)
  - 상세: 이번 diff 가 건드리지 않은 기존 코드이며, plan 문서가 이미 "기존 warning 13, 신규 0" 으로
    이 상태를 실측·고지했다. 신규 결함 아님.
  - 제안: 조치 불필요(참고용 기록).

CRITICAL·WARNING 등급 발견사항 없음.

## 관점별 요약

1. **기능 완전성**: §1(중립 모듈 이관)·§2(fail-closed 순수 함수 분리 + 호출부 관통 테스트)·§4(타입/JSDoc
   정리) 모두 plan 이 서술한 목표대로 구현됐고 회귀 테스트로 고정됨을 실행으로 확인. §3 은 착수하지
   않았다고 plan·코드 양쪽이 일치되게 밝히고 있어 "완료 표시했는데 미구현" 류의 괴리 없음.
2. **엣지 케이스**: `repoRoot` 의 형제-marker 우선순위, 파일시스템 루트 조기 종료, 상한(`MAX_ROOT_SEARCH_DEPTH`)
   포화, `validateWorkspacePatterns` 의 `null` vs `[]` 두 실패 모드 분리 — 전부 손으로 트레이스한 결과
   테스트 기대값과 실제 구현이 일치.
3. **TODO/FIXME**: 대상 6개 코드 파일에 TODO/FIXME/HACK/XXX 없음(grep 확인).
4. **의도와 구현 간 괴리**: `loadTypescriptFrom` 반환 타입 `unknown | null` → `unknown` 변경과
   `missingCompilerApi` JSDoc 정정 모두 실제 동작과 일치하도록 정확히 고쳐졌음을 테스트로 확인(TS7
   스텁 입력이 정말 `filter` 분기를 타는지 실행 검증). "형제 모듈" 표현이 이전 커밋(`5186f2da9`)에서
   "같은 파일"이라는 오기를 정정한 이력이 있고, 현재 문구는 정확함.
5. **에러 시나리오**: `repoRoot`/`validateWorkspacePatterns`/`fnBody` 등 fail-closed throw 가 모두
   진단 가능한 메시지(원인·시작 위치)를 포함하고, 새 synthetic 테스트가 각 throw 분기를 개별 겨냥.
6. **데이터 유효성**: YAML 서브셋 파서(`listAtPath`/`blockScalarAtPath`)의 인라인 주석 제거, 리스트
   항목 vs 키 선언 구분, 빈 값/미발견 시 `null`/`[]` 반환 후 상위에서 vacuity 단언 — 검증 규칙이
   합성 fixture 로 고정됨.
7. **비즈니스 로직**: "가드 자신이 조용히 무력화되면 안 된다"는 이 저장소의 반복 실패 클래스(#960·
   #962·#968·#1047)에 대한 대응이 이번 변경 전반의 논리적 축이며, 실제로 그 축을 겨냥한 신규
   테스트(`repoRoot` fail-closed, `validateWorkspacePatterns` 호출부 관통)로 뒷받침됨.
8. **반환값**: 점검한 모든 함수(`repoRoot`/`blockRange`/`findKeyLine`/`listAtPath`/
   `validateWorkspacePatterns`/`discoverWorkspaceDirs`/`loadTypescriptFrom`)가 모든 분기에서 명시적
   반환 또는 throw — 누락 경로 없음.
9. **spec fidelity**: 위 INFO 참조 — 관련 spec 문서 없음(harness/CI 코드 성격상 기대되는 부재이며
   결함 아님).

## 요약

이번 변경은 `typescript-toolchain-followups.md` 의 §1·§2·§4 를 plan 이 서술한 그대로 구현했고,
이미 두 차례(`2880e8e8a`, `e1b94ed88`) 이전 `/ai-review` 지적(공개 표면 확장·`repoRoot` 주입
비대칭)을 반영해 수렴한 상태다. `pnpm vitest run` 으로 신규·기존 82개 테스트가 실제로 통과함을
확인했고, `repoRoot`/`validateWorkspacePatterns`/`listAtPath` 등 핵심 로직의 엣지 케이스(marker
우선순위·상한 포화·`null` vs `[]` 분리·호출부 관통)를 코드와 대조해 기대값과 실제 동작이 일치함을
검증했다. TODO/FIXME 없음, 반환값 누락 없음, plan 문서의 실측 주장(패키지 매니페스트 개수 등)도
grep 재현으로 사실임을 확인했다. §3(`catalog:` 마이그레이션)은 미착수임을 plan·코드 양쪽이 일관되게
밝히고 있어 허위 완료 주장이 없다. 관련 spec 문서는 존재하지 않으나 이는 harness/CI 코드의 정상적인
부재로 판단해 INFO 로만 기록했다. CRITICAL·WARNING 급 발견사항 없음.

## 위험도

NONE
