# 테스트(Testing) 리뷰 — trigger-config 락 developer 후속 5건

## 검토 범위

실제 코드 변경 대상 6개 파일을 전문(全文)으로 직접 `Read` 했고, 그중 4개 테스트 관련 파일은
production 코드와 대조했다:

- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (production, 수정)
- `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts` (신규 테스트 3건 + 헬퍼 확장)
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (공용 mock 보강)
- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (신규 테스트 1건)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (이름 변경만, 행동 불변)
- `CHANGELOG.md` (문서, 테스트 관점 해당 없음)
- 나머지 `plan/**`·`review/consistency/**` 신규 파일은 이 PR 의 산출물(작업 로그)이라 테스트
  관점 리뷰 대상이 아니라고 판단했다(별도 발견사항 없음).

검증을 위해 다음을 직접 실행했다(저장소 파일은 쓰지 않음 — 아래 "관측된 이상 상태" 항목의
사고 실험 하나만 제외하고는 뮤테이션도 시도하지 않았다):

```
npx jest src/modules/triggers/trigger-config-lock.spec.ts \
         src/modules/triggers/triggers.service.spec.ts \
         src/modules/triggers/triggers.web-chat.spec.ts \
         src/modules/schedules/schedules.service.spec.ts
```

결과: **4 suites / 194 tests, 193 passed + 1 pre-existing skip(`structural anchor`), 0 failed**
(재현 가능한 안정 GREEN — 아래 "관측된 이상 상태" 참조). `grep` 으로 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`
소비자가 정확히 2곳(`triggers.service.ts:1039`, `schedules.service.ts:316`)임과, `SchedulesService.remove()`
의 `if (schedule.triggerId)` 가드가 실재함(`schedules.service.ts:311`)을 실측으로 확인해 plan 의
전제 주장과 대조했다 — 둘 다 일치했다.

## 발견사항

- **[INFO]** 리뷰 도중 공유 워킹트리에서 병렬 리뷰어의 뮤테이션으로 추정되는 일시적 상태 변화를
  관측했다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (해당 함수:
    `rewriteTriggerConfigLocked` 말미의 `if (result.affected === 0) return false;`)
  - 상세: 4개 스펙 파일을 한 번에 실행했을 때 `trigger-config-lock.spec.ts` 의
    `'UPDATE 가 0행에 매치되면 false 를 돌려준다'` 테스트가 `Expected: false / Received: true`
    로 1회 실패했다. 재조사 중 같은 파일을 두 번의 개별 `Read`/`sed` 호출로 다시 열었더니, 한
    번은 `if (!result.affected) return false;`(로직은 동치이나 다른 식) 형태였고 바로 다음
    호출에서는 커밋된 원본 `if (result.affected === 0) return false;` 로 돌아와 있었다. `git status`/
    `git diff` 는 그 시점에 이미 clean 이었다(추적 대상 파일 변경 0). 이 저장소의
    `triggers.service.spec.ts:3978` 코멘트("공교롭게도 리뷰 도중 다른 리뷰어가 정확히 그 뮤턴트를
    워킹트리에 만들었다가 원복했다")가 정확히 같은 클래스의 선례를 이미 기록하고 있어, 이번
    관측도 동일한 원인(다른 리뷰 세션의 뮤테이션 검증이 겹친 순간을 포착)으로 판단한다. 이후
    같은 4-스펙 조합을 2회 더 재실행해 안정적으로 GREEN 을 확인했고 `git status --short` 는
    이 리뷰 세션의 산출물 디렉터리 외에 어떤 변경도 보고하지 않았다. **이 리뷰 대상 코드/테스트
    자체의 결함이 아니라고 판단한다** — 다만 "관측한 이상 상태는 보고하라" 는 규약에 따라
    기록한다. 내가 시도했던 별도 뮤테이션 스크립트는 대상 문자열이 일치하지 않아 `assert` 단계에서
    중단됐고 파일에 쓴 적이 없음을 즉시 다음 `grep` 으로 확인했다(빈 출력).
  - 제안: 조치 불요 — 정보성 기록. 후속 세션이 같은 파일에서 비슷한 순간적 diff 를 보면 먼저
    `git diff`/`git status` 로 실제 커밋 상태를 확인하고, 병렬 리뷰 세션의 뮤테이션 검증 창일
    가능성을 배제 사유 1순위로 둘 것.

- **[INFO]** `acquireTriggerConfigLock` 의 유한성 검증 테스트가 `NaN`·`+Infinity` 만 다루고
  `-Infinity` 는 다루지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts` — `describe`
    `'acquireTriggerConfigLock — timeoutMs 는 SQL 에 보간되기 전에 좁혀진다'` 안의
    `it('유한하지 않으면 던진다 — clamp 하지 않는다')`
  - 상세: production 쪽 가드는 `!Number.isFinite(value)` 단일 분기라 `NaN`·`+Infinity`·
    `-Infinity` 모두 같은 코드 경로를 지나므로 뮤테이션 커버리지 관점에서 실효는 낮다. 다만
    "유한하지 않은 값" 이라는 제목이 약속하는 범위를 fixture 가 완전히 덮지는 않는다(이
    저장소의 기존 관례 — 3라운드 지적됐던 "제목이 말하는 두 값을 실제로 둘 다 건다" 원칙과
    같은 결의 문제).
  - 제안: `for (const bad of [Number.NaN, Number.POSITIVE_INFINITY])` 배열에
    `Number.NEGATIVE_INFINITY` 를 추가하는 정도의 저비용 보강.

- **[INFO]** `toLockTimeoutMs` 의 clamp 경계값 자체(정확히 `1`·`60000`)는 테스트되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts` —
    `it('범위를 벗어난 유한 값은 clamp 한다 — 그리고 정상 값은 그대로 통과한다')` 의 `cases` 배열
  - 상세: 현재 케이스는 하한 아래(-5)·상한 위(999,999)·중간값(5,000)·소수(1,500.9) 를 덮지만
    경계값 그 자체(`1`, `60_000`)는 없다. `Math.min`/`Math.max` 조합이라 오프바이원 뮤테이션
    표면은 실질적으로 좁지만(예: `>` ↔ `>=` 로 바꿀 조건문이 코드에 없다), 경계값 정확 통과를
    명시적으로 거는 것이 "정상 값은 그대로 통과한다" 는 테스트 제목의 약속을 더 촘촘히 지킨다.
  - 제안: 우선순위 낮음 — 필요 시 `cases` 배열에 `[1, "SET LOCAL lock_timeout = '1ms'"]` ·
    `[60_000, "SET LOCAL lock_timeout = '60000ms'"]` 추가.

- **[INFO]** `triggerLockEvents` 모듈 스코프 배열이 `beforeEach` 가 아니라 각 테스트 안의 수동
  `.length = 0` 으로만 리셋되는 기존 패턴이 이번 PR 로 4번째 사용처를 얻었다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:29`(선언),
    신규 테스트 `'삭제 — triggerId 가 없으면 락도 잡지 않고 trigger 도 지우지 않는다'`
    (`triggerLockEvents.length = 0` 호출 지점)
  - 상세: 현재는 이 배열을 참조하는 4개 테스트 전부가 자기 테스트 맨 앞에서 리셋을 먼저 하므로
    실질적 오염 위험은 없다(각 테스트가 "이전 테스트의 잔여물" 이 아니라 "자기 자신의 초기화된
    상태" 를 보고 단언한다). 다만 이 규율은 **다음에 이 배열을 참조하는 테스트를 추가하는
    사람의 기억**에 의존한다 — `beforeEach(() => { triggerLockEvents.length = 0; })` 로
    구조화하면 그 의존이 사라진다. 이번 PR 이 만든 새 결함은 아니고, 기존 패턴을 그대로 따른
    것뿐이다.
  - 제안: 이번 PR 스코프에서 고칠 필요는 없다 — 다음에 이 파일의 `describe` 블록을 만질 때
    `beforeEach` 리셋으로 리팩터링을 고려할 오래된 부채로만 기록.

## 각 관점별 평가

1. **테스트 존재 여부**: 5개 항목(개명·JSDoc 일반화·`timeoutMs` 검증·`affected` 확인·
   `triggerId` falsy 분기) 중 개명·JSDoc 은 행동 불변이라 뮤턴트가 존재하지 않음을 스스로
   인정하고 `grep` 기반 기계적 확인으로 대체했다 — 이 구분(뮤테이션 가능/불가능)을 명시한 점이
   정확하다. 나머지 3개는 각각 전용 테스트를 갖췄다.
2. **커버리지 갭**: 핵심 신규 분기(`affected === 0` → `false`, `affected` 미보고 → `true` 유지,
   `timeoutMs` 비유한 → throw, clamp, `triggerId` falsy)는 모두 직접 커버됐다. 서비스 레벨에서
   재현 불가능한 레이스(재읽기·UPDATE 사이의 FK CASCADE)를 헬퍼 단위 테스트로 내린 설계 판단이
   타당하다 — 기존 `rotateBotToken` 의 `'그 사이 삭제되면 404'` 테스트(`triggers.service.spec.ts:3959`)
   는 이미 `!fresh` 분기를 통해 호출부의 `if (!wrote)` 계약을 일반적으로 검증하고 있어, 그
   계약이 *어느* 내부 분기에서 `false` 가 왔는지와 무관하게 성립함을 재확인했다. 위 INFO 3건
   외에 남은 갭은 발견하지 못했다.
3. **엣지 케이스 테스트**: `affected: 0` vs `null`/`undefined` 를 대조군으로 짝지은 설계(위
   테스트 파일의 "«모른다» 를 «없다» 로 읽으면 안 된다" 주석)가 정확히 이 클래스의 버그(0 과
   nullish 를 같은 것으로 취급하는 편집)를 겨냥한다. `NaN`/`Infinity`/음수/소수/경계-초과 값도
   각각 다른 출력을 요구하는 판별 fixture(`-5`·`999_999`·`5_000`·`1_500.9`)로 구성돼 있어
   "존재만 확인하는" 뮤테이션-vacuous 패턴을 피했다. 세부 보강 여지는 위 INFO 2건.
4. **Mock 적절성**: `trigger-transaction-mock.ts` 의 `update` mock 을 `async` 로 바꾸고
   기본값 `{ affected: 1 }` 을 주도록 한 변경은, 실제 TypeORM `UpdateResult` 형태를 프로덕션
   코드가 소비하는 필드(`affected`)만큼 충실히 흉내내는 정확한 방향이다 — "프로덕션을
   `result?.affected` 로 느슨하게 만드는 대신 대역을 충실하게 만든다" 는 판단이 실제로 옳다
   (반대 방향으로 프로덕션 쪽에 optional chaining 을 넣었다면 `null`/`undefined` 오분류 버그를
   프로덕션 코드에 영구히 심는 것과 같다). `result ?? { affected: 1 }` 은 `null`/`undefined`
   만 대체하므로 `{ affected: 0 }` 같은 명시적 반환은 그대로 보존된다 — 확인함.
5. **테스트 격리**: `trigger-config-lock.spec.ts` 의 신규 테스트들은 `makeManager()` 로 매번
   독립된 mock 을 생성해 서로 의존하지 않는다. `schedules.service.spec.ts` 쪽은 위 INFO(4)에
   적은 대로 모듈 스코프 배열에 대한 수동 리셋 의존이 있으나 현재는 실질적으로 안전하다.
6. **테스트 가독성**: 모든 신규 테스트가 "왜 이 케이스가 필요한가" 를 이전 리뷰 라운드의 구체적
   지적(`INFO#`/`WARNING#` 번호, 실측 수치)과 함께 주석으로 남겨 의도가 매우 명확하다. 특히
   대조군 테스트(`affected` 0 vs null/undefined, `timeoutMs` 하한/상한/통과)에 "왜 이 쌍이
   필요한가" 를 명시한 점이 다음 사람의 판단을 돕는다.
7. **회귀 테스트**: 기존 스위트(`triggers.service.spec.ts`·`triggers.web-chat.spec.ts`·
   `schedules.service.spec.ts`)가 `withTransactionMock` 의 `update` 반환값 변경(`undefined`
   → `{ affected: 1 }`) 이후에도 전부 통과함을 직접 실행으로 확인했다 — plan 이 주장한
   "부수 발견: 서비스 테스트 전부가 TypeError 로 깨졌었다" 는 회귀를 대역 보강으로 정확히
   막았다는 근거가 실측과 일치한다.
8. **테스트 용이성**: `toLockTimeoutMs` 를 별도 함수로 뽑아 `acquireTriggerConfigLock` 를 통해
   간접적으로 관측 가능하게 만든 구조, `rewriteTriggerConfigLocked` 가 `EntityManager` 만
   받아 duck-typed mock 으로 충분히 대체 가능한 구조 모두 기존 관례를 유지하며 테스트하기
   쉬운 형태다. private 함수를 새로 export 하지 않고도 SQL 문자열 관측으로 검증 가능하게
   설계한 것이 적절하다.

## 요약

핵심 변경 5건(개명·JSDoc 일반화·`timeoutMs` 검증·`affected` 확인·`triggerId` falsy 분기) 각각에
대해 전제를 실측하고 그에 맞는 테스트(또는 행동 불변이므로 기계적 확인)를 배치한 설계가
탄탄하다. 특히 `affected === 0` 처리는 서비스 레벨 mock 으로는 재현 불가능한 레이스를 헬퍼
단위 테스트로 정확히 끌어내렸고, `null`/`undefined` vs `0` 을 가르는 대조군 테스트를 갖춰
"모른다를 없다로 읽는" 클래스의 회귀를 구조적으로 막는다. 공용 트랜잭션 mock(`update`
반환값 보강)이 기존 3개 스펙 파일 전체(직접 실행 확인: 194 케이스, 193 통과 + pre-existing
skip 1)에 회귀 없이 전파됐음을 실측으로 확인했다. 남은 갭은 전부 INFO 수준(음의 무한대
fixture 누락·clamp 경계값 자체 미검증·모듈 스코프 배열의 수동 리셋 관례)이며 BLOCK 사유가 될
결함은 없다. 별도로, 리뷰 도중 공유 워킹트리에서 병렬 리뷰 세션의 것으로 추정되는 일시적 파일
상태 변화를 관측했으나 재확인 결과 커밋 상태는 계속 clean 했고 코드/테스트 결함이 아니라고
판단해 INFO 로만 기록한다.

## 위험도

LOW
