# 요구사항(Requirement) 리뷰 — 세션 `12_40_58` (4라운드째 누적 diff, backend lint warning 처분 + `--max-warnings 0` + WARNING 2건 조치)

대상: `origin/main...HEAD` 누적 diff. 실질 코드는 backend lint `no-unsafe-*` warning 전량 처분
(46→0, 12개 소스 파일, 타입 주석/제네릭/단언만) + `package.json` `--max-warnings 0` +
`idempotency.interceptor.ts` 관련 신규 테스트 10건(`spec.ts`) + README 문구 정정 + plan 문서
갱신이다. 나머지는 앞선 3라운드(`11_06_12`, `12_05_39`, `12_24_14`) 리뷰 산출물 커밋.

이번 세션은 직전 라운드(`12_24_14`)가 낸 WARNING 2건에 대한 fix 커밋(`b0b57366f`)이 실제로
주장대로 반영됐는지를 `git show HEAD:<path>` 로 직접 대조하는 데 집중했다.

## 검증 방법 및 유의사항 — 작업 중 워크트리 오염을 직접 관측

작업 도중 `git status` 결과 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
가 **uncommitted 상태로 수정돼 있었다**(`M`). 실제로 그 시점에 `grep`/`Read` 로 이 파일을 읽으면
`if (statusCode >= 400) return;` 이 아니라 `if (statusCode === 400) return;` 로 보였고,
곧이어 `git diff`로 다시 대조하면 그 줄은 원상태이고 대신 catch 분기(`return of(null);`)가
바뀌어 있는 등, **읽을 때마다 다른 내용이 나왔다**. 같은 세션 디렉터리에 다른 reviewer(들)의
산출물(`dependency.md`/`maintainability.md`/`scope.md`/`security.md`/`side_effect.md`)이
동시에 쓰이고 있는 것으로 보아, **병렬로 실행 중인 다른 리뷰어 sub-agent가 RESOLUTION.md 가
기록한 뮤테이션(`>= 400` → `=== 400`, catch 분기 무력화)을 이 공유 워크트리에서 라이브로
재현·복원하는 중**인 것으로 판단된다(이 저장소 메모리에 이미 등재된 실패 패턴과 동일 형태).

이 오염 때문에 **라이브 워크트리에 대한 직접 `Read`/`grep`/`jest` 실행 결과는 신뢰하지 않았다.**
대신 `git show HEAD:<path>` 로 커밋된 진짜 상태만 근거로 삼았다. 아래 모든 확인은 이 방법으로
재검증한 것이다.

## Fix 커밋(`b0b57366f`) 재검증 — `git show HEAD:` 기준

| 직전 라운드 WARNING | RESOLUTION 주장 | `git show HEAD:` 대조 결과 |
|---|---|---|
| requirement — R8 대비 캐시 제외 범위가 넓다 | 동작은 안 고치고 테스트 이름만 좁힘 + 409 캐너리 신설 | `idempotency.interceptor.ts` 의 `if (statusCode >= 400) return;` **불변 확인**(HEAD). `idempotency.interceptor.spec.ts` 에 `400 VALIDATION_ERROR 는 캐시하지 않는다 (Spec EIA §R8)`(정확한 범위로 개명)와 `409 도 캐시되지 않는다 — R8 위반 상태를 고정하는 캐너리`(신설) 둘 다 확인 |
| testing — 손상 캐시 JSON catch 분기 미검증 | `'not-valid-json{'` 케이스 추가 | `idempotency.interceptor.spec.ts:261` 에 해당 테스트 확인(`downstream 호출·정상 응답·재적재` 3가지 단언) |
| — | plan 백로그에 R8 항목 등재 | `plan/in-progress/backend-lint-gate-broken-on-main.md:489-517` 에 spec 원문 인용·`=== 400` 오답 경고·캐너리 위치까지 명시된 항목 확인 |
| — | README `lint` 행 정정 | `codebase/backend/README.md:19` = `ESLint — 트리를 고치지 않음(\`--fix\` 없음). **warning 1건도 실패**(\`--max-warnings 0\`)` 확인 |
| — | `package.json` `--max-warnings 0` | `codebase/backend/package.json:20` 확인 |

`spec/5-system/14-external-interaction-api.md:1055`(§R8)을 직접 열람해 RESOLUTION·plan 이
인용한 문구("4xx 응답 중 `400 VALIDATION_ERROR` 만 idempotency cache 에서 제외하고, 그 외
(성공 2xx / `409 Conflict` / `410 Gone`) 는 캐시한다")가 spec 원문과 정확히 일치함을 확인했다.
**방향 판정: 코드가 틀림(spec 이 권위)** — 이 자체는 2026-05-21 원본 구현(`35ff9c19b`)부터
있던 선재 결함이며, 이번 lint 처분 델타가 만든 것이 아니다. 이 PR 의 스코프(타입 전용, 런타임
미접촉)를 지키기 위해 동작을 고치지 않고 캐너리로 고정한 판단, 그리고 리뷰어가 제안한
`=== 400` 이 실제로는 R8 을 더 어기는 방향(400 의 다른 코드·5xx 까지 캐시)이라는 지적도
spec 원문과 대조해 정확함을 확인했다.

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` 아님 — 잔존 결함: `cacheTapped()` 의 JSDoc 주석이 이번에 막
  고친 것과 **동일한 형태의 부정확한 spec 인용**을 여전히 하고 있다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:118`
    (`* 4xx 는 캐시 제외 (Spec EIA §R8) — 사용자가 재시도해야 함.`, `git show HEAD:` 기준
    `cacheTapped` 메서드 바로 위 JSDoc)
  - 상세: 이 fix 커밋(`b0b57366f`)의 문제 정의 자체가 "내가 붙인 테스트 이름이 spec 이
    반대로 말하는 동작을 spec 으로 정당화했다" 였고, `4xx 응답은 캐시하지 않는다 (Spec EIA §R8)`
    라는 테스트 이름을 `400 VALIDATION_ERROR 는 캐시하지 않는다 (Spec EIA §R8)` 로 정확히
    좁혔다. 그런데 같은 파일의 `cacheTapped()` JSDoc(`:118`)은 정확히 같은 실수를 그대로
    갖고 있다 — "4xx 는 캐시 제외" 라고 **일반화**한 뒤 그 근거로 "(Spec EIA §R8)" 를 붙인다.
    spec 원문(§R8)은 400 VALIDATION_ERROR 한정이고 409/410 은 캐시하라고 명시하므로, 이
    주석은 정확히 이번 커밋이 "다음 사람이 spec 이 그렇다니까로 읽는다" 며 경계했던 바로
    그 오독을 계속 유발한다. 참고로 같은 파일의 다른 두 자리는 정확하다 — 클래스 docstring
    (`:54`, "`400 VALIDATION_ERROR` 응답은 캐시 제외")과 `IdempotencyEntry` 필드 주석
    (`:42`, "4xx 중 VALIDATION_ERROR 는 캐시 제외") 모두 400 으로 한정해 적었고, `:145` 의
    trailing comment("4xx/5xx 모두 캐시 제외 (특히 400 VALIDATION_ERROR 는 R8 으로 명시
    제외)")도 R8 근거를 VALIDATION_ERROR 부분에만 붙여 정확하다. `:118` 만 유일하게
    "4xx 전체가 R8 이 요구하는 것" 처럼 읽힌다.
  - 이번 diff 와의 관계: 이 줄 자체는 이번 PR 이 건드리지 않았다(2026-05-21 원본부터 존재,
    `git blame` 상 이번 lint 델타의 hunk 밖). 다만 바로 이 라운드가 "같은 파일 안에서 spec
    을 잘못 인용해 결함을 정당화하는 문구"를 찾아 고치는 작업이었고, plan 백로그
    (`:489-517`)에도 이 파일의 R8 문제를 상세히 적어 뒀는데 정작 그 원인 메서드 바로 위
    주석은 대조되지 않았다.
  - 제안: 코드 동작은 이미 의도적으로 유예됐으므로(정당한 판단) 바꾸지 않되, `:118` 문구를
    예컨대 "`400 VALIDATION_ERROR` 는 캐시 제외(Spec EIA §R8) — 단, 현재 구현은 `>= 400`
    전체를 제외해 409/410 도 함께 떨어진다(§후속 백로그, `plan/in-progress/
    backend-lint-gate-broken-on-main.md` 참조)" 류로 정정해, 소스를 읽는 사람도 테스트를
    읽는 사람과 같은 정보를 얻게 한다. `developer` 권한 범위의 사소한 주석 수정이며 별도
    planner 턴 불필요.

- **[INFO]** 워크트리 동시 오염 관측(위 "검증 방법" 절 참조) — 코드 결함 아님, 방법론적
  투명성 목적으로만 기재.
  - 상세: 같은 리뷰 세션 디렉터리에 병렬로 다른 reviewer 산출물이 쓰이는 동안
    `idempotency.interceptor.ts` 가 `git status` 상 uncommitted 로 잡혔고, 그 순간의 라이브
    읽기 결과가 `git show HEAD:` 와 달랐다(뮤테이션 재현 중으로 추정). 이 리포트의 모든
    구체적 확인은 `git show HEAD:<path>` 기준으로만 작성했고, 라이브 워크트리에서의 직접
    실행 결과(예: 그 순간의 `jest` 실행)는 근거로 사용하지 않았다.
  - 제안: 조치 불요(리뷰 프로세스 관측). 이 저장소 메모리에 이미 등재된 "병렬 리뷰어가
    저장소를 뮤테이션해 서로를 오염시킨다" 패턴의 재확인이다.

- **[INFO]** 나머지 12개 소스 파일(타입 주석/제네릭/단언 추가)의 요구사항 충족 여부는 앞선
  3라운드(`11_06_12`/`12_05_39`/`12_24_14`)의 requirement 리뷰가 각각 독립 재측정(eslint
  0/0, 타입체크 ratchet 199건/38파일 baseline 일치, 관련 jest suite 전수 통과, emit md5/괄호
  비교)으로 상세 검증했고, 이번 fix 커밋은 그 12파일을 재수정하지 않았다(`git show
  b0b57366f --stat` 확인 — 변경은 `idempotency.interceptor.spec.ts` + plan + review 산출물
  뿐). 재확인 결과 판정을 바꿀 이유가 없다.

- 그 외 CRITICAL 급 요구사항 결함은 **발견되지 않았다.** TODO/FIXME/HACK/XXX 신규 추가 없음,
  반환값 누락 없음(모든 분기가 `Observable` 을 반환), 에러 시나리오(손상 캐시 JSON·body 불일치
  409·응답 형태 없음)는 이번 라운드가 새로 채운 테스트로 커버리지가 실제로 늘었음을
  `git show HEAD:` 로 확인했다.

## spec fidelity 요약

`idempotency.interceptor.ts` 가 구현하는 `spec/5-system/14-external-interaction-api.md`
§R8/EIA-IN-11 은 이 델타 이전부터 있던 선재 결함(캐시 제외 범위가 spec 보다 넓음)이 여전히
남아 있다. 이번 라운드는 그 결함을 "고치지 않기로" 한 판단 자체는 spec 재확인·오답 후보
배제(`=== 400`)·캐너리·백로그 등재까지 갖춰 타당하다고 재확인했다. 다만 그 판단을 뒷받침하는
같은 파일의 JSDoc 한 곳(`:118`)이 여전히 잘못된 spec 인용을 담고 있어 이번 라운드의 자기
교정이 완전하지 않다 — 위 WARNING 참조.

## 요약

직전 라운드(`12_24_14`) WARNING 2건에 대한 fix 커밋(`b0b57366f`)은 `git show HEAD:` 기준으로
주장대로 정확히 반영됐다 — R8 범위와 정확히 일치하는 테스트 이름 정정, R8 위반 상태를 고정하는
409 캐너리 신설(오답 후보 `=== 400` 을 쓰지 않은 이유까지 spec 대조로 타당함을 재확인), 손상
캐시 JSON 테스트 추가, plan 백로그 등재, README/`package.json` 정정 모두 확인됐다. 유일한
결함은 같은 파일의 `cacheTapped()` JSDoc(`:118`)이 이번에 정정한 것과 동일한 형태로 spec 을
과대 인용하고 있다는 점(WARNING) — 런타임 동작에는 영향 없고 이미 백로그에 등재된 문제의
문서적 잔재이지만, 이 라운드가 정확히 이 패턴을 없애려 한 라운드였다는 점에서 지적할 가치가
있다. 부가적으로, 리뷰 도중 공유 워크트리가 병렬 reviewer 에 의해 라이브로 뮤테이션되는
것을 직접 관측했으며, 이 리포트는 그 오염을 피하기 위해 `git show HEAD:` 기준으로만 결론을
냈다(INFO, 코드 결함 아님).

## 위험도

LOW

STATUS=success requirement review completed for session 12_40_58 — 1 WARNING (stale spec-citation comment), all prior-round WARNING fixes verified via git show HEAD
