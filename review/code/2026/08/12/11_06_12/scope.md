# 변경 범위(Scope) 리뷰 — 커밋 17221ecb9

## 검증 방법

- `git show 17221ecb9` (전체 diff + 통계) 를 직접 열어 3파일 diff 전수를 확인.
- `codebase/backend` 에서 `prettier --check` 를 3파일에 개별 실행해 diff 의 wrapping 이
  이 저장소 `.prettierrc`(printWidth 기본 80) 기준으로 canonical 상태인지 실측.
- 콜백 파라미터 리스트를 단일 라인으로 되돌렸을 때의 실제 문자 길이를 계산해 wrap 이
  타입 주석 추가로 인한 printWidth 초과 때문인지(수동 개행이 아닌지) 확인.
- `cd codebase/backend && eslint "{src,apps,libs,test}/**/*.ts" --format json` 를 현재
  worktree HEAD(17221ecb9 포함 상태)에서 재실행해 잔여 warning 21건의 실제 파일 분포를
  독립적으로 재계산.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 를 열어 이 부분 작업이 참조하는
  "잔여 warning 47건 처분 방침" 표와 대조.
- `git log --oneline --all | grep 'wip('` 로 커밋 메시지 타입 접두사 선례 확인.

## 발견사항

- **[INFO]** 커밋 메시지 타입 접두사 `wip(backend)` 가 이 저장소 이력에서 유일한 사용례
  - 위치: 커밋 `17221ecb9` 제목 줄 (`wip(backend): lint warning 46→21 — …`)
  - 상세: `git log --oneline --all | grep -c "^[a-f0-9]* wip("` → 1건(본 커밋 자신)뿐이다.
    최근 로그는 `fix/docs/chore/refactor/feat/build/test` 만 쓴다. 저장소에 커밋 타입을
    규정한 `spec/conventions/*.md` 나 `PROJECT.md` 문서는 없어 **규약 위반은 아니다** —
    다만 "wip" 는 관례상 미완료를 뜻하므로, 이 상태로 최종 이력에 들어가는 것이 팀
    관례와 맞는지는 코드 스코프 밖의 판단(merge-coordinator/사용자) 사항으로 남긴다.
  - 제안: 그대로 머지해도 스코프 문제는 아니다. 다만 이력을 깔끔히 하고 싶다면 PR
    타이틀/스쿼시 커밋 시점에 `refactor(backend)` 류로 바꾸는 것을 고려할 수 있다.

그 외 CRITICAL/WARNING 급 스코프 이탈은 **발견되지 않았다.**

## 점검 관점별 확인 내역

1. **의도 이상의 변경** — 없음. 3파일 diff 전수(`execution-engine.service.ts` 3+/1-,
   `triggers.service.ts` 3+/3-, `migrate-node-output-refs.ts` 37+/7-)를 라인 단위로 대조한
   결과, 모든 변경이 (a) `String.replace`/`m.query()` 콜백·반환값에 타입 주석·제네릭을
   붙이는 것, (b) 그로 인해 prettier 가 강제하는 개행, (c) 그 타입 주석이 왜 필요한지
   설명하는 주석 2줄(`execution-engine.service.ts`) 뿐이다. 로직 분기·조건·리턴값 변경
   없음.
2. **불필요한 리팩토링** — 없음. 변수명·함수 구조·제어 흐름 어느 것도 바뀌지 않았다.
   `Object.getPrototypeOf(trigger)` → `Object.getPrototypeOf(trigger) as object` 도
   호출 자체는 그대로이고 타입 단언만 추가됐다.
3. **기능 확장** — 없음. 새 분기·새 옵션·새 export 없음.
4. **무관한 수정** — 없음. 커밋이 건드린 파일은 정확히 3개
   (`execution-engine.service.ts`, `triggers.service.ts`,
   `migrate-node-output-refs.ts`) 뿐이고 `git show --stat` 결과와 diff 내용이 일치한다.
5. **포맷팅 변경** — `migrate-node-output-refs.ts` 의 6개 콜백 시그니처가 여러 줄로
   펼쳐진 것 외에는 없다(아래 3번 질문 답변 참조). 다른 2파일은 순수 1줄 치환.
6. **주석 변경** — `execution-engine.service.ts` 에 추가된 2줄 주석(`EntityManager.query`
   가 `Promise<any>` 라 제네릭이 필요한 이유)뿐이며, 바로 그 줄의 타입 변경을 직접
   설명하는 내용이라 drive-by 가 아니다. 기존 주석 삭제·수정 없음.
7. **임포트 변경** — `triggers.service.ts` 한 곳, 기존 import 문
   (`from '../chat-channel/types'`) 의 named specifier 목록에 `SetupResult` 를
   추가했을 뿐 import 문의 위치·순서·다른 import 문은 전혀 건드리지 않았다("codemod 가
   import 를 알파벳 재정렬" 하던 과거 사고 패턴과 다름 — 재정렬 없음, 새 import 문
   신설도 없음). `migrate-node-output-refs.ts`/`execution-engine.service.ts` 는 import
   변경 자체가 0건(`git diff` 로 재확인).
8. **설정 변경** — 없음. `.prettierrc`/`.eslintrc`/`tsconfig*` 등 설정 파일은 diff 에
   등장하지 않는다.

## 질문별 답변

**Q1. 선언한 범위(타입 주석·제네릭)를 벗어난 변경이 있는가.**
없다. 위 8개 관점 전수 확인 결과 diff 는 정확히 "타입 주석 + 제네릭 + prettier 강제
개행 + 그 변경을 설명하는 주석 2줄"로만 구성된다.

**Q2. 부분 작업으로 커밋한 것이 정당한가 — 남은 21건이 다른 7파일에 있고 겹치지 않는가.**
재확인 결과 **맞다.** 현재 HEAD 기준 `eslint --format json` 을 직접 돌려 severity=1
(warning) 만 집계하면 총 21건이 다음 7파일에만 분포한다: `workspace-reflection-canary.ts`(1),
`chat-channel.dispatcher.ts`(2), `executions.service.ts`(2),
`idempotency.interceptor.ts`(8), `chat-channel-config.dto.ts`(1), `ai-agent.schema.ts`(1),
`render-tool-provider.ts`(6). 이번 커밋이 건드린 3파일은 이 21건 목록에 **전혀 등장하지
않는다** — 즉 3파일 모두 residual warning 0건으로 완결 상태다. 이 분포는
`plan/in-progress/backend-lint-gate-broken-on-main.md` 의 "잔여 warning 47건 처분 방침"
표(migrate-node-output-refs.ts 17 · idempotency.interceptor.ts 8 · triggers.service.ts 6 ·
render-tool-provider.ts 6 · 기타 5파일 8)와도 정확히 정렬한다 — 이번에 처분한 17+6+2=25건이
그 표의 앞 3줄(정확히는 migrate 17 + triggers 6 + "기타" 항목에 속한 execution-engine 의
`m.query()` 2건)에 해당한다. 다음 세션이 남은 7파일을 건드릴 때 이 3파일과 겹칠 여지가
구조적으로 없다(파일 단위로 완전히 분리).

**Q3. `migrate-node-output-refs.ts` 의 +44/-11 이 불필요하게 부풀린 것인가, prettier 강제인가.**
**prettier 강제다.** 콜백 파라미터에 타입 주석을 붙인 뒤의 단일 라인 폭을 실측하면
(예: `(match: string, dbl: string | undefined, sgl: string | undefined, field: string) => {`,
선행 들여쓰기 4칸 포함) **89자**로 이 저장소 `.prettierrc` 의 기본 `printWidth: 80` 을
초과한다 — 그래서 prettier 가 강제로 4줄로 접는다. 반대로 짧은 시그니처
(`(match: string, op: string, status: string) => {`, 52자)는 80자 이내라 실제로 diff 에서도
**한 줄 그대로 유지됐다** — 즉 wrap 여부가 라인 길이에 정확히 대응하며 사람이 임의로
선택한 스타일이 아니다. 추가로 3파일 모두에 대해 `prettier --check` 를 실행해 현재 커밋
상태가 이미 prettier 의 canonical 포맷과 100% 일치함을 확인했다(재포맷해도 diff 가 나지
않음). 부풀림이 아니라 규칙 준수의 부수 효과다.

**Q4. 머지 가능한가 — 아니면 21건을 마저 해야 한 PR 로 의미가 있는가.**
스코프 관점에서는 **머지 가능**하다고 판단한다. 근거:
- diff 가 선언한 범위(타입 주석·제네릭)를 한 줄도 벗어나지 않았다(Q1).
- 3파일은 이 커밋으로 residual warning 0건에 도달해 자기완결적이다(Q2 재확인).
- 남은 21건은 이 3파일과 겹치지 않는 별도 7파일에 있어, 다음 세션이 이어받아도 이 3파일을
  다시 열거나 되돌릴 이유가 없다.
- 커밋 메시지 자체가 검증 수치(lint 46→21, typecheck ratchet 증감 0, jest 1285 passed)를
  명시해 부분 작업임을 숨기지 않는다.
"21건을 마저 해야 한 PR 로 의미가 있다"는 대안도 나쁘지 않지만(리뷰 단위를 크게 가져가면
warning 처분 전체를 한 번에 판정할 수 있다는 장점), 그건 **PR 크기/리뷰 정책 선택**의
문제이지 이번 diff 가 스코프를 어겼기 때문에 강제되는 것은 아니다. 파일 단위로 완전히
분리돼 있어 병합 순서·충돌 위험도 없다.

## 요약

커밋 `17221ecb9` 는 3개 backend 파일에서 `any` 로 새는 라이브러리 경계(TypeORM
`manager.query`, `String.replace` 콜백, `let result;` 미주석 선언, `Object.getPrototypeOf`)
에 타입 주석·제네릭만 붙인 순수 타입 강화 커밋이다. `migrate-node-output-refs.ts` 의 상대적으로
큰 diff(+44/-11)는 타입 주석이 printWidth 80 을 넘겨 prettier 가 강제한 개행이며 실측(89자
vs 80 한도, 대조군 52자는 한 줄 유지)으로 확인했다. import 재정렬·주석 drive-by·설정 변경·
로직 변경은 전혀 없다. "46건 중 25건만 처분" 하는 부분 커밋이라는 선언도 실측(현재 eslint
재실행 결과 잔여 21건이 다른 7파일에만 분포, 3파일 residual 0)으로 검증되어 정당하다 — 다음
세션이 이 3파일을 다시 건드릴 필요가 없는 구조다. 스코프 관점의 결함은 없으며, 유일한
관찰(INFO)은 `wip(` 커밋 타입 접두사가 이 저장소에서 전례 없는 표기라는 점뿐이고 이는 규약
위반이 아니라 이력 정리 선호의 문제다.

## 위험도

NONE

STATUS: OK
