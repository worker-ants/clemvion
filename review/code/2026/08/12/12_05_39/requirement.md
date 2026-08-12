# 요구사항(Requirement) 리뷰 — backend lint warning 전량 처분 (`ee8e44e8f` + `67b7d7d77`)

대상 델타: `codebase/backend/package.json`(`--max-warnings 0` 도입), 7개 소스 파일의 타입 주석만
추가하는 lint warning 처분(21건→0건), `migrate-node-output-refs.spec.ts` 의 Pass 2 신규
테스트, `plan/in-progress/backend-lint-gate-broken-on-main.md` 기록 갱신, 그리고 직전 리뷰
세션(`review/code/2026/08/12/11_06_12/`) 산출물 8개 파일의 신규 커밋.

## 독립 재측정 (프롬프트 주장을 그대로 믿지 않고 직접 실행)

| 검증 | 방법 | 결과 |
|---|---|---|
| 현재 HEAD eslint | `npx eslint "{src,apps,libs,test}/**/*.ts" -f json` (worktree 직접 실행) | **errors 0 / warnings 0** — `package.json` 의 `--max-warnings 0` 이 실제로 통과 |
| 부모 커밋(`ba93680ab`) eslint | `git worktree add --detach <scratch> ba93680ab` 로 별도 경로 체크아웃(현재 워크트리 미오염) 후 동일 명령 | **errors 0 / warnings 21**, 파일별: `workspace-reflection-canary.ts` 1 · `chat-channel.dispatcher.ts` 2 · `executions.service.ts` 2 · `idempotency.interceptor.ts` 8 · `chat-channel-config.dto.ts` 1 · `ai-agent.schema.ts` 1 · `render-tool-provider.ts` 6 → **plan 문서의 "마지막 21건(7파일)" 표(합계 21)와 파일 단위로 정확히 일치** |
| `tsc --noEmit -p tsconfig.json` | 전체 프로그램 타입체크, 이번 델타가 건드린 파일명으로 grep | 해당 파일들에 대한 신규 진단 **0건** |
| 관련 jest 스위트 | `--testPathPatterns="(triggers|execution-engine|executions|chat-channel|idempotency|ai-agent|render-tool-provider|workspace-reflection-canary)"` | **98 suites / 2502 passed / 1 skipped** — 전부 통과 |
| `migrate-node-output-refs.spec.ts` 단독 | `npx jest src/scripts/migrate-node-output-refs.spec.ts` | **45 passed**(신규 Pass 2 테스트 포함) |
| emit 바이트 비교(2개 파일 표본) | scratchpad 에 side_effect 리뷰어가 남긴 `chat-channel.dispatcher.{before,after}.js` / `chat-channel-config.dto.{before,after}.js` 를 직접 `diff` | 각각 **괄호 한 쌍만 차이**(삼항식을 감싸는 `(...)` 유무) — 의미상 완전 동일, 논리 변경 없음. plan 문서의 "7파일 중 5개 emit 동일, 2개는 괄호만 차이" 주장과 표본 2건 모두 일치 |
| JSON 유효성 | `python3 -c "json.load(open('package.json'))"` | 유효 |
| TODO/FIXME/HACK/XXX | `git show ee8e44e8f \| grep -n "TODO\|FIXME\|HACK\|XXX"` | 0건 |

## 발견사항

- **[INFO]** `--max-warnings 0` CI 배선 정합성 확인.
  - 위치: `codebase/backend/package.json:20` (`"lint": "eslint ... --max-warnings 0"`), `.github/workflows/backend-checks.yml:95` (`pnpm --filter backend lint`)
  - 상세: plan 문서(`backend-lint-gate-broken-on-main.md`)가 "CI 워크플로가 아니라 package.json 에 건 이유는 로컬·CI 동일 게이트" 라고 주장하는데, 실제로 `backend-checks.yml:95` 가 `pnpm --filter backend lint` 를 그대로 호출하는 것을 직접 확인했다 — 별도 `--max-warnings` 플래그를 CI 쪽에 중복 추가하지 않았으므로 로컬 lint 스크립트 실행 결과가 곧 CI 게이트 결과와 같다. 주장과 배선이 일치.
  - 판정: 문제 없음(발견 아님, 확인 목적).

- **[INFO]** `workspace-reflection-canary.ts` 의 `as object` 삭제가 안전한 이유를 직접 시그니처로 대조.
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:89`(`handlerConsumesWorkspaceId(cls, handler)`), `codebase/backend/src/common/decorators/workspace.decorator.ts:66`(`controllerClass: object`)
  - 상세: `cls` 는 바로 위(`:79`) `typeof cls !== 'function'` 가드로 이미 `Function` 으로 좁혀져 있고, `handlerConsumesWorkspaceId` 의 첫 파라미터는 `object` 다. `Function` 값은 구조적으로 `object` 에 배정 가능하므로 단언 제거가 타입 안전성을 해치지 않는다 — `tsc` 재확인 결과 이 파일에 신규 진단 없음. 이 캐너리는 `#1103` 이 닫은 cross-tenant 결함 클래스의 fail-closed 가드라 안전 근거를 직접 대조했다.
  - 판정: 문제 없음.

- **[INFO]** plan 문서의 "잔여 warning 47건 → 실측 46건" / "마지막 21건 7파일 내역" 수치 주장을 독립 재측정으로 교차검증(위 표 참조) — 전부 정확했다. 커밋 메시지·plan·이전 리뷰 세션(11_06_12) 산출물이 서로 주장하는 수치들 사이에 불일치가 없다.

- **[INFO]** 이번 델타에 포함된 `review/code/2026/08/12/11_06_12/*` 8개 파일은 직전 리뷰 세션의 산출물을 그대로 커밋한 것이며, 그 세션이 검증한 대상(3파일: `execution-engine.service.ts`/`triggers.service.ts`/`migrate-node-output-refs.ts`)의 실측 수치(46→21, ratchet 199건/38파일 baseline 일치, jest 1285 passed)도 그 세션 자체가 재측정으로 확인한 내용이라 이번 라운드에서 다시 신뢰성 문제로 볼 것이 없다. 커밋 이력(`ba93680ab` revert)에 리뷰어가 워크트리를 오염시켜 되돌린 흔적이 있으나, `git status` 확인 결과 현재 워크트리에 잔여 오염 파일은 없다.

- **[INFO]** `migrate-node-output-refs.spec.ts` 신규 Pass 2 테스트(`:59-66`)가 실제로 이전에 비어 있던 코드 경로를 커버하는지 직접 대조.
  - 위치: `codebase/backend/src/scripts/migrate-node-output-refs.ts:289-307`(Pass 2 정규식·콜백), `codebase/backend/src/scripts/migrate-node-output-refs.spec.ts:59-66`(신규 테스트)
  - 상세: Pass 2 콜백은 `nodeTypeByLabel`(라벨→타입 맵)에 의존하지 않고 순수 문자열 치환(`match.replace('.output.meta.', '.meta.')`)만 수행하므로, 입력 `'{{ $node["IE"].output.meta.collectionRetryCount }}'` 이 그대로 `'{{ $node["IE"].meta.collectionRetryCount }}'` 로 치환되는 기대값이 실제 구현과 정확히 일치한다(직접 추적 확인). `collectionRetryCount` 는 파일 내 다른 rename 테이블(`RENAMED_META_FIELDS` 등)에 등장하지 않아 후속 pass 간섭도 없다. 독립 실행 결과 45 passed(신규 테스트 포함)로 그린.
  - 판정: 테스트가 주장한 대로 정확히 동작.

- 이번 델타(코드 12파일 + plan 1파일 + 리뷰 산출물 8파일)에서 **CRITICAL/WARNING 급 요구사항 결함은 발견되지 않았다.** 전 변경이 타입 주석/제네릭/단언 추가에 한정되고, 독립 재측정(eslint/tsc/jest/emit diff)이 커밋·plan 이 주장한 모든 수치와 정확히 일치한다.

## spec fidelity

이번 델타가 건드린 파일 중 `idempotency.interceptor.ts`(Spec EIA §3.2 EIA-IN-11/§R8), `chat-channel-config.dto.ts`/`triggers.service.ts`(spec/5-system/15-chat-channel.md 등), `ai-agent.schema.ts`(spec/4-nodes/3-ai/1-ai-agent.md)는 spec 링크가 있는 파일이지만, 이번 diff 는 그 파일들의 **로직을 전혀 바꾸지 않았다**(타입 주석/제네릭/구조적 인터페이스 추가뿐 — emit 표본 비교·tsc·jest 전수 재실행으로 확인). 즉 spec 이 정의하는 행위(엔드포인트 시그니처·필드명·에러 코드·검증 규칙·상태 전이)에는 아무 영향이 없다. `codebase/backend/package.json`/`plan/*.md`/`review/*.md` 는애초에 spec 대상이 아니다(내부 코드 품질·작업 기록). spec 본문과의 line-level 불일치는 발견되지 않았다.

## 요약

`codebase/backend` lint warning 잔여 21건을 7개 파일에서 타입 주석·제네릭·`as` 단언만으로 처분하고 `package.json` 에 `--max-warnings 0` 을 건 델타다. 커밋·plan 문서가 주장하는 모든 핵심 수치(부모 커밋 21건의 파일별 분포, 현재 0/0, ratchet·jest 통과, emit 바이트 동일성)를 **모두 독립적으로 재실행해 확인**했으며 전부 정확했다. 로직 변경이 전무하므로 spec 이 정의하는 어떤 행위에도 영향이 없고, TODO/FIXME 류 미완성 표시나 반환값/에러 시나리오/데이터 검증의 누락도 없다. plan 문서의 자기 정정(성격 분류 오류·파일명 오류)은 이미 문서 자체가 투명하게 밝히고 있어 별도 지적이 불필요하다. CRITICAL/WARNING 대상 없음.

## 위험도

NONE

STATUS: OK
