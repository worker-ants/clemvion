# 요구사항(Requirement) 리뷰

대상: `typescript-toolchain-followups` plan §1(`_shared.ts` 공유 프리미티브 분리)·§2(`validateWorkspacePatterns`
fail-closed 순수 함수 분리 + 호출부 주입) 구현. 5개 코드/테스트 파일 + 1개 plan 문서.

## 검증 방법

- `pnpm vitest run` 으로 대상 테스트 2개 파일 직접 실행 — `internal-package-registration.test.ts` 52건,
  `typescript-toolchain.test.ts` 24건, 합계 76/76 통과.
- `pnpm eslint` 대상 5개 파일 — 0 error, 기존(diff 무관) warning 1건만(`typescript-toolchain.test.ts:116`
  `_drop` 미사용 변수, 이 diff 이전부터 존재).
- 주석의 사실 주장 표본 검증: `tsconfig.json` exclude 에 `src/**/__tests__/**` 포함(주석 일치),
  `vitest.config.ts` test include 가 `*.{test,spec}.{ts,tsx}` 뿐(주석 일치), `.github/dependabot.yml` npm
  등록이 `/` 와 `/.claude/tools/mermaid-lint` 둘뿐(plan 문서 (3) 서술과 일치), `package.json` 전수에서
  `typescript`/`eslint` 선언 파일 수 각 10개(plan 문서 표와 일치).
- import 그래프 확인: `_shared.ts` 를 외부에서 import 하는 곳은 두 형제 가드뿐이고, 순환 import 없음.
  `internal-package-registration-guard.ts`/`typescript-toolchain-guard.ts` 를 `__tests__/` 밖에서
  import 하는 소비처 없음(주석의 "두 가드가 import 해서만 쓴다" 주장과 일치).

## 발견사항

- **[WARNING]** plan frontmatter `worktree: (unstarted)` 가 실제 작업 상태와 어긋남
  - 위치: `plan/in-progress/typescript-toolchain-followups.md:3` (전체 파일 컨텍스트 게이트 기준)
  - 상세: 이 diff 는 체크리스트의 §1·§2·§4·TEST WORKFLOW 를 `[x]` 로 갱신할 만큼 실제 코드 작업이 끝난
    상태를 반영한다(`git log` 확인 결과 같은 브랜치에 `refactor(guards): repo-guard 공유 프리미티브 중립
    모듈 분리…`·`fix(guards): ai-review 지적 반영…` 두 커밋이 이미 존재). 그런데 frontmatter 의
    `worktree:` 는 여전히 미착수 sentinel `(unstarted)` 다. `.claude/docs/plan-lifecycle.md` §4 는
    "착수 시 실제 `<task>-<slug>` 로 교체" 를 명시하고, §3 은 push-gate 의 "연결 판정" 이 정확히 이
    필드로 현재 worktree 를 매칭한다고 설명한다 — sentinel 이 그대로면 이 plan 은 어느 worktree 와도
    매칭되지 않아 gate 의 "연결된 plan 갱신 확인" 대상에서 조용히 빠진다.
  - 제안: 체크리스트를 갱신한 이 커밋에서 `worktree:` 필드도 실제 작업 디렉터리 이름으로 교체할 것.
    (코드 defect 아님 — plan 문서 자체의 메타데이터 정합성 문제.)

- **[INFO]** spec fidelity — 관련 `spec/` 문서 없음
  - 위치: 파일 1~5 전체(`codebase/frontend/src/lib/repo-guards/__tests__/*`)
  - 상세: `spec/` 전체를 `repo-guards`·`internal-package-registration`·`typescript-toolchain` 키워드로
    검색했으나 해당 없음. 이 코드는 제품 기능이 아니라 내부 harness/CI 가드(패키지 등록 목록 drift ·
    TypeScript 툴체인 계약 검사)이므로 spec 이 다루는 영역 밖이다. spec-impl 불일치 리스크 없음.

## 점검 관점별 평가

1. **기능 완전성**: `_shared.ts` 이관은 순수 코드 이동(로직 변경 없음, diff 로 확인 — `indentOf`/
   `isSkippable`/`blockRange`/`findKeyLine`/`listAtPath`/`repoRoot`/`ROOT`/`PackageManifest` 문자
   그대로 이동). 등록 가드는 4개 심볼(`ROOT`/`listAtPath`/`repoRoot`/`PackageManifest`)만 재export 해
   기존 소비처(`internal-package-registration.test.ts`) 계약을 그대로 유지 — 실측 테스트로 확인됨.
   `validateWorkspacePatterns` 분리는 종전 `discoverWorkspaceDirs` 내부 검증 로직을 그대로 순수 함수로
   추출했고, `readLines` 주입 파라미터의 기본값이 기존 실제 I/O 경로(`fs.readFileSync(WORKSPACE_YAML)`)
   를 그대로 보존한다 — 소비자 쪽 동작 불변.
2. **엣지 케이스**: `validateWorkspacePatterns` 가 `null`(키 부재)과 `[]`(항목 부재) 두 실패 형태를
   갈라서 각각 테스트로 고정. `discoverWorkspaceDirs` 의 새 `readLines` 주입 경로로 두 실패가 실제
   호출부에서도 발동하는지(호출부가 검증을 건너뛰지 않는지) 별도 테스트로 확인 — 이 축은 종전에
   "저장소가 정상인 한 자연 발동하지 않아 합성 입력으로 겨냥 불가" 였던 갭을 정확히 메운다.
3. **TODO/FIXME**: 5개 대상 파일 전체 grep 결과 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리**: 없음. `_shared.ts` 헤더 주석의 "여기 두는 기준(두 가드가 실제로 공유하는
   것만)" 이 실제 export 표면과 일치 — 등록 가드 전용(`PACKAGES_DIR`/`TEST_STAGES`)·툴체인 가드 전용
   (`WORKSPACE_YAML`)은 각자 파일에 남아 있고, `_shared` 는 공용 4심볼 + 그 헬퍼만 갖는다.
   `missingCompilerApi` JSDoc 정정("이 경로가" → "TS7 스텁은 객체라 filter 를 탄다")도 실제 분기
   흐름과 일치함을 코드로 확인(비-객체 조건 `mod === null || typeof mod !== "object"` 는 거짓,
   `filter` 가 3건 모두 낙제).
5. **에러 시나리오**: `repoRoot()` 미발견 시 `MAX_DEPTH` 상한에서 명시적 throw(fail-loud, 조용한
   무한루프/오탐 방지) — 이관 전후 동일. `validateWorkspacePatterns` 는 두 실패 형태 모두 명시적
   에러 메시지로 throw, 테스트로 메시지 정규식까지 고정.
6. **데이터 유효성**: `listAtPath` 의 인라인 주석 제거 로직(`m[1].replace(/\s+#.*$/, "")`)에 새
   회귀 테스트가 추가돼 "이 축만 합성 커버리지가 비어 있었다"는 주석의 주장이 실제로 검증 가능해짐
   (직접 계산해 기대값과 일치함을 확인).
7. **비즈니스 로직**: `loadTypescriptFrom` 반환 타입 `unknown | null` → `unknown` 변경은 TS 상 동치
   (union with unknown collapses to unknown)이므로 런타임/타입 동작 변화 없음 — 순수 명확성 개선이며
   주석의 근거(다른 함수의 진짜 좁히는 시그니처와의 혼동 방지)도 타당.
8. **반환값**: `validateWorkspacePatterns` 는 통과 경로에서 입력 그대로 반환(항등, 값 변경 없음) —
   전용 테스트로 고정됨. 모든 신규/변경 함수가 명시된 타입대로 모든 경로에서 반환.
9. **spec fidelity**: 위 발견사항 INFO 참고 — 해당 영역에 spec 문서 없음(harness 내부 도구).

## 요약

`_shared.ts` 신설을 통한 공유 프리미티브 분리(§1)와 `validateWorkspacePatterns` fail-closed 검증의
순수 함수 추출 + 호출부 주입 테스트(§2)는 순수 리팩터/커버리지 보강으로, 로직 변경 없이 export 표면만
재구성했고 재export 로 기존 소비처 계약을 보존했다. 실제로 대상 테스트 스위트 76/76 통과·lint 신규
warning 0 을 직접 확인했고, 주석에 적힌 사실 주장(tsconfig exclude·vitest include·dependabot 등록
위치·package.json 선언 수)도 표본 검증 결과 모두 정확했다. TODO/FIXME 없음, spec 문서는 해당 영역이
없어 spec fidelity 리스크 없음(INFO). 유일한 흠은 plan 문서 frontmatter 의 `worktree:` sentinel 이
실제 작업 진행 상태를 반영하지 못한 점으로, 코드 defect 이 아니라 plan-lifecycle 메타데이터 정합성
문제다.

## 위험도

LOW
