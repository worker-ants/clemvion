# 정식 규약 준수 검토 — eslint10-upgrade (spec/5-system/, --impl-done)

## 검토 범위 및 방법

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
- diff 실체 확인: 워크트리(`/Users/gehrig/orca/workspaces/clemvion/oystercatcher/.claude/worktrees/eslint10-upgrade-5e3cf9`)를 절대경로로 직접 열어 대조.
- 이 PR 의 diff 는 **`spec/**` 를 전혀 건드리지 않는다** — 전부 `codebase/**`(eslint 10 상향 + 관련 lint-fix)다. 따라서 "target 문서(spec/5-system/)가 규약을 따르는가"의 실질 검토 대상은 (a) 번들에 온전히 실린 `spec/5-system/1-auth.md`·`3-error-handling.md` 의 문서 구조, (b) diff 가 `spec/5-system/3-error-handling.md` §1~§2(에러 코드·응답 봉투)·`spec/conventions/secret-store.md`(SS-SE-05)·`spec/conventions/error-codes.md` 가 규정한 불변식을 코드 레벨에서 위반하지 않는가, 두 갈래다.
- 프롬프트 번들은 컨텍스트 예산으로 `spec/conventions/*` 대부분(`error-codes.md`·`secret-store.md`·`swagger.md`·`node-output.md` 등)과 `spec/5-system/2,4~16` 을 절단했다(의도된 절단 표기 확인). 해당 파일은 필요한 범위에서 저장소 원본을 직접 열어 대조했다(`spec/conventions/secret-store.md` SS-SE-05 확인 등).

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** `cause` 노출 정책의 문서화 비대칭
  - target 위치: diff `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (eslint-disable 주석) vs. `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts`, `codebase/backend/src/nodes/data/code/code.handler.ts` (동일 eslint 10 룰 `preserve-caught-error` 적용 지점)
  - 위반 규약: 직접 위반 아님 — `spec/conventions/secret-store.md` SS-SE-05(자격증명 관련 에러는 상세를 로그 전용으로 한정) 취지의 **일관 적용** 여부에 대한 참고 사항
  - 상세: `secret-resolver.service.ts` 는 `{ cause: err }` 를 추가하면 crypto 에러 상세가 Activity API 로 노출된다는 이유로 `preserve-caught-error` 를 명시적으로 disable 하고 근거(SS-SE-05, `#814`)를 주석과 회귀 테스트(`cause` 부재 단언)로 고정했다. 반면 `expression-resolver.service.ts`(`Expression error in config.${path}: ${message}`)와 `code.handler.ts`(`code has a syntax error: ${message}`)는 같은 eslint 10 룰에 맞춰 반대로 `{ cause: err }` 를 **추가**했다. 두 경로 모두 이미 원본 `err.message` 를 바깥 Error 의 `message` 에 그대로 이어붙이므로(`cause` 유무와 무관하게 원문이 이미 노출) 실질적인 추가 노출은 없다고 판단되나, `secret-resolver.service.ts` 만큼의 명시적 "왜 이 경로는 cause 를 붙여도 안전한가" 서술은 없다.
  - 제안: 필수 수정 사항은 아니다(정보 노출 관점에서 실질 차이 없음을 확인). 다만 향후 `secret-store.md`/`error-codes.md` 갱신 시 "message 에 이미 원문이 포함된 경로는 cause 부착이 안전하다"는 판별 기준을 한 줄로 명문화해 두면, 다음에 유사 disable/추가 판단을 할 때 이 PR 처럼 매번 재추론하지 않아도 된다.

## 점검한 항목 (위반 없음 확인)

1. **명명 규약**: diff 가 추가한 식별자(`readInstalledPackageJson`, `SemverTriple`, `parseGteFloor` 등)는 모두 `src/repo-guards/__tests__/**` 내부 메타-도구용이며 spec 이 규정하는 API/도메인 식별자가 아니다. 신규 에러 코드·API endpoint·DTO 없음.
2. **출력 포맷 규약**: 에러 응답 봉투(`spec/5-system/3-error-handling.md` §2.1/§2.2, `{ error: { code, message, requestId, details? } }`)를 변경하는 diff 없음. `{ cause: err }` 추가 3건은 JS `Error.cause` 로 JSON 직렬화 대상이 아니며, `output.error`/HTTP 응답 스키마에 반영되는 지점(`GlobalExceptionFilter`, 노드 핸들러의 `output.error` 조립부)은 diff 에 포함되지 않았다.
3. **문서 구조 규약**: 번들에 전문이 실린 `spec/5-system/1-auth.md`(L44~L917)·`3-error-handling.md`(L919~L1469) 모두 frontmatter(`id`/`status`/`code`)·`## Overview`·본문·`## Rationale` 3섹션 구성을 갖추고 있어 CLAUDE.md 규약과 일치. 이 PR 로 인한 구조 변경 없음(diff 가 spec 파일을 건드리지 않음).
4. **API 문서 규약**: swagger/OpenAPI 데코레이터·DTO 를 건드리는 diff 없음(`swagger.md` 규약과 무관한 변경).
5. **금지 항목**: `eslint-disable-next-line preserve-caught-error` 1건은 근거·범위가 주석에 명시돼 있고, 기존 `unicorn/catch-error-name` 단일 룰 pin 관행과 동일한 패턴(사유 문서화 후 예외)이라 conventions 가 금지하는 "무근거 규칙 우회"에 해당하지 않는다. `secret-resolver.service.spec.ts` 에 추가된 회귀 테스트가 "disable 주석이 실수로 지워지고 cause 가 붙어도 메시지 단언만으로는 못 잡는다"는 vacuous-test 함정까지 `cause` 부재를 별도로 단언해 방지하고 있어 오히려 규약 강화 방향.

## 요약

이번 PR 은 eslint 8→10 계열 상향에 수반된 backend/packages 전역 devDependency 갱신과, 새 recommended 룰(`no-useless-assignment`, `preserve-caught-error` 등)이 잡아낸 지점의 최소 수정으로 구성되어 있고 `spec/**` 파일은 diff 에 전혀 포함되지 않았다. `spec/5-system/1-auth.md`·`3-error-handling.md`(번들에 전문이 실린 두 문서)는 문서 구조·frontmatter 규약을 그대로 만족하며, diff 가 건드린 에러 처리 코드(`secret-resolver`·`expression-resolver`·`code.handler`)는 `spec/conventions/secret-store.md` SS-SE-05·`#814` 근거를 코드 주석과 회귀 테스트로 명시 인용하며 기존 에러 응답 봉투 규약을 그대로 유지한다. CRITICAL/WARNING 급 규약 위반은 발견되지 않았고, `cause` 노출 판단의 문서화 비대칭 1건만 INFO 로 남긴다.

## 위험도
NONE
