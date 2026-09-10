# 테스트(Testing) 리뷰 — `trigger-workflow-ref` 캐너리 (2라운드)

대상: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts`(헬퍼) +
`trigger-workflow-ref.spec.ts`(self-spec, 8→12) + `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`(e2e, 라벨 `1.~5.`→`A.~E.`).

이번 라운드 초점(오케스트레이터 지시): (a) 저자의 "3 신규 단언 각각 정확히 1건 RED" 주장 재검증,
(b) 신규 4 케이스 중 vacuous 한 것이 없는지, (c) 기존 단언의 판별력이 약화됐는지.

## 검증 방법

- 원본 `trigger-workflow-ref.ts` 를 스크래치(`/private/tmp/claude-501/.../scratchpad/trigger-workflow-ref-mutation/trigger-workflow-ref.ts.orig`)에 `cp` 로 백업.
- 저장소 파일을 직접 뮤테이션 → `codebase/backend/node_modules/.bin/jest --config codebase/backend/jest.config.ts src/shared/testing/trigger-workflow-ref.spec.ts --rootDir codebase/backend` 로 실행(각 실험 직후 스크래치 백업으로 `cp` 원복, `git checkout`/`restore` 미사용).
- 4번째 실험(id `toString` 스푸핑 프로브)은 저장소 안에 새 파일을 만들지 않기 위해 `--roots`/`--testRegex` 로 스크래치 디렉터리의 임시 spec 만 별도로 실행.
- 최종 `git status --short` — `codebase/` 하위 diff **없음**(clean) 확인. 미추적으로 남은 것은 이 리뷰 세션 자신의 산출물 디렉터리(`review/code/2026/09/10/15_52_06/`)뿐이고 코드와는 무관.

## (a) 저자 주장 재검증 — 3건 모두 직접 재현, 참으로 확인

`RESOLUTION.md`(`review/code/2026/09/10/14_34_18/RESOLUTION.md:44-45`)의 "세 신규 단언(`name`
타입 · identity · 최상위 `null`)을 각각 지우는 뮤턴트에서 하나씩 정확히 1건만 RED" 주장을 세 개의
독립 뮤턴트로 각각 재현했다. 베이스라인은 12/12 GREEN.

| 뮤턴트 | 지운 줄 (`trigger-workflow-ref.ts`) | 결과 | RED 테스트 |
|---|---|---|---|
| 1 | 132-134행 `if (opts.expectedWorkflowId !== undefined) { expect(ref.id).toBe(opts.expectedWorkflowId); }` | **1 failed, 11 passed** | `` `expectedWorkflowId` 가 다르면 실패한다 — shape 만 맞는 엉뚱한 relation 을 잡는다 `` |
| 2 | 104행 `expect(dto).not.toBeNull();` | **1 failed, 11 passed** | `` 최상위 `dto` 가 `null` 이면 두 판정 모두에서 실패한다 `` |
| 3 | 129행 `expect(typeof ref.name).toBe('string');` | **1 failed, 11 passed** | `` `name` 이 문자열이 아니면 실패한다 — 타입 단언의 대조군 `` |

세 실험 모두 정확히 1건씩만 RED, 나머지 11건은 GREEN, 원복 후 12/12 GREEN 회복까지 확인했다.
**저자 주장은 참이다.**

## (b) 신규 4 케이스 중 vacuous 한 것 발견 — `id` 비-문자열 케이스

`RESOLUTION.md:36`은 "비-문자열 `name` 4값 · 비-문자열 `id` · 최상위 `null` 양방향 ·
`expectedWorkflowId` 불일치 — 4 케이스 추가"라고 4건을 나열하지만, 위 §(a) 검증은 **3건만**
다룬다(`RESOLUTION.md:44` 자체도 "세 신규 단언"이라고 스스로 3건으로 한정한다). 나머지 1건 —
`` `id` 가 문자열이 아니면 실패한다 — 같은 이유의 자매 대조군 ``
(`trigger-workflow-ref.spec.ts:105-112`, `id: 42` 케이스) — 을 같은 방법으로 검증한 결과
**vacuous 였다.**

### 발견사항

- **[WARNING]** 신규 4 케이스 중 1건(`id` 비-문자열)이 자신이 검증한다고 주장하는 대상을 실제로 검증하지 못한다 — `isUuidShaped` 의 우연한 중복 방어로 가려진다
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:125`(`expect(typeof ref.id).toBe('string');`) / `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts:105-112`(신규 테스트) / `spec.ts:79-86`(기존 "UUID 아니면" 테스트, 중복 원인)
  - 상세: `trigger-workflow-ref.ts:125` 한 줄만 지우는 뮤턴트를 넣고 self-spec 전체(12개)를 돌리면 **12 passed, 12 total** — 어떤 테스트도 이 줄의 삭제를 감지하지 못한다(재현: 베이스라인 12/12 → 125행 삭제 후 재실행 → 12/12, `--no-cache` 로도 재확인). 원인은 바로 다음 줄(128행) `expect(isUuidShaped(String(ref.id))).toBe(true)` 다 — `id: 42` 를 넣으면 `String(42)` = `'42'` 가 UUID shape 패턴(`^[0-9a-f]{8}-...`)에 안 맞아 **이 줄이 typeof 체크 유무와 무관하게 항상 먼저(또는 대신) 던진다**. `expect(() => ...).toThrow()` 는 "무엇이 던졌는지" 가 아니라 "던졌는지" 만 보므로, 신규 테스트(`spec.ts:105-112`)는 `typeof ref.id` 가 아니라 사실상 이미 존재하는 `` `id` 가 UUID 가 아니면 실패한다 ``(`spec.ts:79-86`, `id: 'not-a-uuid'`)와 **완전히 같은 축(`isUuidShaped`)을 재검증**할 뿐이다. 반대 방향(125행은 두고 128행만 지움)도 실측했다 — 이 경우엔 `` `id` 가 UUID 가 아니면 실패한다 `` 만 RED 이고 신규 `` `id` 가 문자열이 아니면 `` 테스트는 여전히 GREEN(타입 체크가 여전히 잡아줌) — 즉 **두 검사 중 어느 하나만 있어도 이 신규 테스트는 항상 통과**하며, 신규 테스트가 단독으로 잡는 뮤턴트는 하나도 없다.
    바로 위 self-spec 의 docstring(`spec.ts:88-93`, `name` 테스트에 붙어 있음)도 스스로 "`id` 는 `isUuidShaped` 가 간접 방어하지만 `name` 에는 그런 이차 방어가 없다"고 적어 이 비대칭을 이미 알고 있다 — 그런데 바로 다음 신규 테스트의 라벨(`spec.ts:105`)은 "같은 이유의 자매 대조군"이라고 적어, 인접 서술("이유가 다르다")과 스스로 어긋난다.
    실제 위험이 낮은 이유도 확인했다 — 이 헬퍼의 두 실제 호출처(self-spec 의 손으로 쓴 fixture, e2e 의 `res.body.data`)중 e2e 쪽은 HTTP JSON 응답이라 `JSON.parse` 산출물만 들어온다. JSON 값(string/number/boolean/null/array/plain object)은 모두 `String()` 변환 시 UUID shape 를 우연히 만족할 수 없으므로, **실전 입력 도메인에서는 125행이 있으나 없으나 128행이 항상 막아준다** — 즉 지금 당장 새는 회귀는 없다. 다만 이 헬퍼는 `export` 된 공용 테스트 유틸이라, 장래 JSON 이 아닌 소스(예: 커스텀 `toString()` 을 가진 mock 객체)에 재사용되면 얘기가 달라진다 — `{ toString: () => <유효 UUID 문자열> }` 를 `id` 자리에 넣으면 `typeof` 는 `'object'` 라 원본 코드(125행 존재)에서는 정상적으로 막히지만, 125행을 지운 뮤턴트에서는 `isUuidShaped(String(ref.id))` 가 `true` 가 되어 **조용히 통과**한다 — 이를 스크래치의 임시 spec(저장소 밖, `--roots` 로 별도 실행)으로 직접 실증했다: 원본 코드는 이 값을 거부(테스트 PASS)했고, 125행 삭제 뮤턴트에서는 거부하지 못했다(테스트 FAIL, "Received function did not throw").
  - 제안: (1) 테스트 라벨/문서에서 "같은 이유의 자매 대조군" 문구를 정정 — 이 케이스는 `name` 케이스와 달리 이미 `` id가 UUID가 아니면 `` 테스트와 축이 겹친다는 것을 명시하거나, (2) 진짜로 `typeof ref.id` 를 독립적으로 검증하려면 `id: 42` 대신 `id: { toString: () => WF_ID }` 처럼 "`String()` 변환은 UUID 모양이지만 `typeof` 는 문자열이 아닌" fixture 로 교체할 것. 둘 중 하나를 하지 않으면 이 4번째 케이스는 카운트("8→12")에는 들어가지만 실질 판별력에는 기여가 없다.

## (c) 기존 단언의 판별력 약화 여부 — 발견 없음

- `expect(dto).not.toBeNull()` 을 `toBeDefined()` 앞에 추가한 것은 순수 강화이고 기존 단언을
  대체/약화하지 않는다(§(a) 뮤턴트 2로 재확인).
- `expectedWorkflowId?: string` 옵션은 `opts.expectedWorkflowId !== undefined` 로 게이트돼
  있어 기존 호출부(옵션 미전달)의 동작·판별력에 영향이 없다.
- 손으로 쓴 UUID 정규식 → `isUuidShaped` 교체(`trigger-workflow-ref.ts:128`)는 이번 라운드
  검증 범위는 아니지만, `` `id` 가 UUID 가 아니면 실패한다 `` 테스트가 쓰는 값(`'not-a-uuid'`)은
  16진수 문자가 아니라 신-구 패턴 어느 쪽으로도 거부되므로 이 교체로 인한 판별력 저하는 없다.
- 부수 관찰(INFO, 이번 라운드 초점은 아님): `expect(dto).not.toBeNull()` 과 `expect(dto).toBeDefined()` 가 순서대로 통과해야만 아래로 내려가므로, 106행 `const record = (dto ?? {})` 의 `?? {}` 는 이제 도달 시점에 `dto` 가 `null`/`undefined` 일 수 없어 사실상 죽은 코드다 — 기능·판별력에는 영향 없는 잔여 방어 코드.

## 트래커 등재 확인 (재지적 아님, 명시만)

1라운드가 남긴 두 갭 — schedule 타입 `workflow` 양성 커버리지 0건, e2e `afterAll` 의
`secret_store` 고아 row — 은 `RESOLUTION.md` "Warning — 코드 밖으로 이관 4건" 표(항목 3·4)에
트래커 신규 항목으로 등재됐고, `trigger-workflow-ref.e2e-spec.ts:145-157` 의 `afterAll` 주석도
동일 경계를 명시한다. 새 발견 아님.

## 회귀·격리·가독성

- 12개 `it()` 모두 순수 동기 함수 호출이고 공유 가변 상태가 없다(`WITH_WORKFLOW`/`WITHOUT_WORKFLOW`
  는 각 테스트에서 스프레드로만 쓰이고 직접 변형되지 않음) — 테스트 간 순서 의존성 없음, 셔플 실행에도 안전.
  Mock 은 전혀 쓰지 않으며(순수 함수 직접 호출) 이 성격의 헬퍼에 적절하다.
- 가독성: 각 실패 경로를 개별 `it()` 로 분리하고 실패 이유를 라벨에 명시하는 원칙을 유지한다.
  다만 `` `expectedWorkflowId` 가 다르면 실패한다 ``·`` 비밀 컬럼이 섞여 들어오면 실패한다 ``·
  `` 최상위 `dto` 가 `null` 이면 `` 세 테스트는 한 `it()` 안에 순차 `expect(...).toThrow()` 를
  2개 이상 두는데, 앞쪽이 예기치 않게 실패하면(던지지 않으면) 뒤쪽은 실행되지 않아 진단 정보가
  가려진다 — 지금은 문제를 안 일으키지만(§(a) 뮤턴트 2 재현에서 실제로 첫 줄에서 멈추는 것을
  확인) 향후 회귀 진단 시 "그 아래도 깨졌는지"는 별도로 다시 지워봐야 안다. — INFO

## 요약

이번 라운드의 핵심 질문(a)에는 명확한 답이 나온다 — 저자가 `RESOLUTION.md` 에 적은 "세 신규
단언을 지우면 각각 정확히 1건만 RED" 주장은 세 뮤턴트 모두로 직접 재현되어 **참**이다. 그러나
같은 표(`RESOLUTION.md:36`)가 "4 케이스 추가"라고 뭉뚱그린 것 중 검증되지 않은 네 번째 —
`` `id` 가 문자열이 아니면 실패한다 `` — 는 실제로 뮤테이션을 넣어 보니 **어떤 테스트도 감지하지
못하는 vacuous 케이스**였다(`trigger-workflow-ref.ts:125` 삭제 → 12/12 GREEN 유지). 원인은
바로 아래 줄의 `isUuidShaped` 체크가 이미 같은 입력을 다른 이유로 걸러내 `.toThrow()` 를
우연히 만족시키기 때문이고, 이는 기존 `` id가 UUID가 아니면 `` 테스트와 축이 겹치는 구조적
중복이다. 실전 위험은 낮다 — 이 헬퍼의 두 실제 호출처(손-작성 fixture, e2e 의 JSON 응답)에서는
어떤 non-string 값도 `String()` 변환으로 UUID 모양을 우연히 만들 수 없어 `isUuidShaped` 단독으로
충분히 막아주지만, `toString()` 을 커스터마이즈한 객체(JSON 이 아닌 입력)를 스크래치 프로브로
직접 넣어 보니 원본 코드는 막고 뮤턴트(125행 삭제)는 못 막는 것을 실증했다 — 이 exported
공용 헬퍼가 장래 비-JSON 호출처에 재사용될 때를 대비한 방어선이 지금은 이름만 있고 테스트로는
비어 있다는 뜻이다. 그 외 (c) 기존 단언의 판별력 약화는 발견되지 않았고, 1라운드가 이미 등재한
갭(schedule 커버리지·secret_store teardown)은 트래커에서 확인만 했다. 검증 전 과정에서 저장소
파일은 스크래치 백업/복원만 사용했고 `git status --short` 로 `codebase/` clean 을 확인했다.

## 위험도

LOW — 프로덕션 코드는 이 diff 에 없고, 발견된 vacuous 케이스도 현재 실전 입력 도메인(JSON)에서는
`isUuidShaped` 가 이미 충분히 방어한다. 다만 "4 케이스 추가·검증 완료"라는 서술이 실제로는
"3 케이스만 검증됨 + 1 케이스는 라벨과 달리 기존 축의 중복"이라는 사실과 어긋나므로, RESOLUTION
서술 정정 또는 fixture 교체(§b 제안)를 다음 턴에 반영할 것을 권한다.
