# 요구사항(Requirement) 리뷰 — frontend-layering 가드 스코프 확장 (src/types)

## 검증 방법

정적 리뷰에 더해 실제 실행으로 계획 문서(`plan/complete/spec-draft-frontend-layering.md`)의
주장을 재현·교차검증했다:

- `npx eslint src/lib src/types` → 0 errors, 2 warnings (기존 baseline과 동일, `src/types` 신규 위반 없음)
- `npx vitest run src/lib/__tests__/eslint-layering-guard.test.ts --reporter=verbose` → **47/47 통과**,
  신설된 "가드 스코프 — 실제 ESLint 경로 매칭" 스위트(13개 케이스, `src/lib`/`src/types` 차단 +
  `src/components`/`src/app` 비차단 포함)가 실제로 실행·통과함을 직접 확인
- `spec-status-lifecycle.test.ts` / `spec-pending-plan-existence.test.ts` / `spec-code-paths.test.ts` /
  `spec-plan-completion.test.ts` / `plan-frontmatter.test.ts` 전부 통과 — spec frontmatter
  `partial → implemented` 승격, `pending_plans` 제거, plan `spec_impact` 필드, `plan/complete/`
  이동이 각 가드의 요구 조건과 실측으로 일치
- `npx eslint eslint.config.mjs src/lib/__tests__/eslint-layering-guard.test.ts src/lib/conversation/rag-types.ts src/components/editor/run-results/conversation-utils.ts` → lint 클린
- `git show --stat HEAD` (`00b3b05a4`) 확인 — eslint.config.mjs / test / rag-types.ts 주석 / plan 이동 /
  spec 승격이 **단일 커밋**에 함께 있어, spec-impl-evidence.md §R "Phase 2·3 동일 커밋" 요구와 일치

## 발견사항

- **[INFO]** 메시지 문자열의 한국어 조사 처리
  - 위치: `codebase/frontend/eslint.config.mjs:50-52` (`STATIC_IMPORT_MSG` 등)
  - 상세: `레이어 역전: ${LAYERS_LABEL} 은 ...` — `LAYERS_LABEL` 이 항목 1개(`src/lib/**`)에서
    2개(`src/lib/** · src/types/**`)로 늘었지만 조사는 이전과 동일하게 고정 `"은"` 을 사용한다.
    두 표기 모두 영숫자/기호로 끝나 받침 유무 판정이 원래도 애매했던 지점이라 이번 변경으로 새로
    생긴 문제는 아니고(원본도 `"src/lib/** 은"` 이었음), 기능·검증에 영향 없는 순수 표기 이슈다.
  - 제안: 선택적 — 조사 없는 표현(`레이어 역전: {LAYERS_LABEL}에서 @/components/** 를 import 할 수 없습니다`) 으로 바꾸면 항목 수 변화에도 안전. fix 필수 아님.

- **[INFO]** spec §2 서술과 CI 커버리지 범위의 의도적 간극은 문서화됨 (문제 아님)
  - 위치: `spec/conventions/frontend-layering.md` §2 ("규약이 곧 집행은 아니라는 점을 문서가 숨기지 않는다")
  - 상세: 규약상 금지 방향(`types → lib`, `components → app`)과 CI 가드 대상(`{lib, types} → components`)이
    다르다는 점을 spec 이 명시적으로 인정하고 Rationale 에서 근거(관측된 역전 압력 0)를 제시한다.
    코드(`LOWER_LAYERS`)·테스트(`EXPECTED_LOWER_LAYERS`)·spec §4 규칙 표가 이 축소된 범위에서
    line-level 로 일치한다 — 회색지대가 아니라 의도적 설계로 문서화돼 있어 발견사항이라기보다
    참고 사항.

## 항목별 점검

1. **기능 완전성**: `files: ["src/lib/**"]` → `files: LOWER_LAYERS`(`["src/lib/**", "src/types/**"]`) 확장이
   `no-restricted-imports`/`no-restricted-syntax` 양쪽 블록에 동일하게 적용됨. 메시지 3종(`STATIC_IMPORT_MSG`/
   `DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG`) 모두 `LAYERS_LABEL` 파생으로 단일화돼 스코프 확장 후 "src/lib/** 만
   지목" 하던 이전 문구가 거짓이 되는 문제를 실제로 막았다. 완전 구현.
2. **엣지 케이스**: `src/types` 는 import 0건 leaf(`grep -rn "^import\|require(" src/types` 무매치 확인) —
   오탐 위험 0. bare/서브패스/중첩(`nested/deep`)/컴포넌트-app 비대상 전부 신규 스위트로 커버.
3. **TODO/FIXME**: 변경 파일 5종 grep 결과 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리**: 없음. `LOWER_LAYERS` 라는 이름·주석("계층 지위"가 근거)과 실제 배열 값·용도가 일치.
   기존 스위트의 `files.includes("src/lib/**")` 탐색 리터럴도 배열이 여전히 그 문자열을 포함해 무손상 —
   plan 의 주장대로 47/47 그대로 통과함을 직접 재현 확인.
5. **에러 시나리오**: 변경 자체가 lint 규칙 확장이라 런타임 에러 시나리오는 해당 없음. 테스트의
   `layeringErrors()` 는 fatal 파싱 에러를 별도로 throw 해 "위반 0건" 위장을 방지하는 기존 안전장치를
   그대로 보존.
6. **데이터 유효성**: 해당 없음(설정 값 자체가 입력).
7. **비즈니스 로직**: "types → components 역전은 lib → components 보다 더 나쁘다"는 판단(§Rationale)이
   가드 스코프 확장으로 정확히 반영됨. `app` 미가드 결정(D3)도 그대로 유지.
8. **반환값**: 해당 없음(config/lint 규칙 변경, 함수 반환값 로직 없음). 테스트 헬퍼 `errorsAt`/`layeringErrors`
   는 항상 배열을 반환하며 빈 배열 케이스도 명시적으로 검증됨.
9. **spec fidelity**: `spec/conventions/frontend-layering.md` 가 SoT. §1 계층 표, §2 금지 방향/CI 범위,
   §4 CI 강제 표(`files: LOWER_LAYERS`, selector 2종×2), §4.1 스코프 항목, frontmatter
   (`status: implemented`, `pending_plans` 제거, `code:` 2개 경로)가 실제 `eslint.config.mjs`/
   `eslint-layering-guard.test.ts` 와 line-level 로 일치함을 실행으로 확인. `plan/complete/`로 이동한
   plan 의 Phase 1~3 체크리스트(✅)도 실제 커밋(`00b3b05a4`) 내용과 정확히 대응 — 과장된 완료 표시 없음.
   spec 결함 의심 사항 없음.

## 요약

`src/lib/**` 전용이던 레이어 가드를 `src/types/**` 까지 확장하는 변경으로, ESLint config·회귀 테스트·
spec 문서·plan 완료 처리가 하나의 커밋(`00b3b05a4`) 안에서 정확히 정합한다. 특히 이번 변경의 핵심 리스크—
"글롭 확장이 실제로 경로에 걸리는지"—를 합성 config 우회 문제까지 인지하고 별도의 실제 `ESLint` API
기반 스코프 스위트로 보강했으며, 본 리뷰에서 해당 스위트(13개 케이스 포함 총 47개)를 직접 재실행해
통과를 확인했다. spec lifecycle 가드(`spec-status-lifecycle`/`spec-pending-plan-existence`/
`spec-code-paths`/`spec-plan-completion`/`plan-frontmatter`) 전부 실측 통과로 frontmatter 승격·plan
이동 절차도 규약을 어기지 않는다. 발견된 문제는 기능에 영향 없는 표기 수준의 INFO 2건뿐이며 CRITICAL/
WARNING 은 없다.

## 위험도

NONE
