# 테스트(Testing) 리뷰 — trigger-canary-hardening (라운드 2, `11_52_13`)

## 검증 방법

이 diff 는 이미 `/ai-review` 1라운드(`review/code/2026/09/14/11_27_40`)를 거쳐 WARNING#2(vacuous
삼항식)를 고친 뒤 상태다. 재검토가 그 라운드를 그대로 되풀이하지 않도록, 직접 실행/열람으로
독립 확인했다(저장소 파일은 전혀 수정하지 않음 — 종료 시점 `git status --short` 로 확인, 세션 중
쓰기는 이 리뷰 산출물 디렉터리뿐):

- `npx jest repo-guards/__tests__/trigger-secret-columns.spec.ts` → **9/9 GREEN**, 커밋된 소스에
  vacuous 삼항식이 이미 `if (value === null) throw` 형태로 고쳐져 있음을 직접 확인.
- `npx jest src/shared/testing/trigger-workflow-ref.spec.ts` → **12/12 GREEN**, `grep '가드 [0-9]'` /
  `grep '[①-⑪]'` 로 라벨 1~11 전수·원문자 잔존 0 확인 — plan 의 "9건/12건 GREEN" 수치와 실측 일치.
  (plan 자신이 과거 "9자리" 오카운트를 라운드 1 에서 이미 정정한 상태 — 재확인만 함.)
  RESOLUTION.md 는 `readStringArrayConst` 뮤테이션(상수 오타 → 못 읽음, 경로 리네임 → 부재)의
  RED + 메시지 일치를 주장한다. 재현은 안 하고 grep 으로 해당 분기 코드가 실제로 그 메시지를
  내는 자리인지만 대조 확인.
- `npx tsc --noEmit -p tsconfig.json` → 이 diff 가 건드린 6개 codebase 파일 관련 에러 **0건**.
- `grep -rln "trigger-secret-columns-guard"` → 소비처가 `trigger-secret-columns.spec.ts` **하나뿐**임을
  확인 — 커버리지 판단의 전제(다른 곳에서 간접 커버 안 됨)를 뒷받침.
- `triggers.service.ts` 의 `update()` 를 직접 읽어, schedule 타입 트리거는 PATCH 로 `chatChannel` 을
  구조적으로 보낼 수 없음(`disallowed.push('chatChannel')`)을 확인 — G/H(`schedule-trigger.e2e-spec.ts`)
  가 원 회귀(chatChannel 재조회 시 `relations` 누락)의 정확한 분기를 재현하지 않는 것은 결함이
  아니라 타입 제약상 불가능한 조합이었음을 실측으로 확인(아래 INFO 참고).

## 발견사항

- **[WARNING] 새로 추가된 "파일 부재" 방어 분기가 영구 회귀 테스트로 결속되지 않았다 — 검증은 세션 중 수기 뮤테이션뿐**
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` 의
    `readStringArrayConst` 함수 — `if (!fs.existsSync(abs)) { throw new Error(...) }` 분기
    (`abs = path.join(repoRoot, relPath)` 직후, 함수 본문 초입).
  - 상세: 이 분기는 이번 PR 이 라운드 1 리뷰(`review/code/2026/09/14/11_27_40/testing.md` INFO#5,
    `RESOLUTION.md` INFO#4)를 받고 **새로 추가**한 코드다 — raw `ENOENT` 대신 "옮겨졌거나 이름이
    바뀌었다"는 진단 메시지를 내려는 의도. `RESOLUTION.md` 는 이 분기를 "대상 경로 리네임 →
    RED + 메시지 일치"로 검증했다고 적지만, 그 검증은 **리뷰 세션 중 저장소 실제 파일을 임시로
    리네임했다가 원복하는 수기 뮤테이션**이었다(규약상 cp 백업 후 원복) — 그 절차 자체가 스펙
    파일에 영구 테스트 케이스로 남지 않는다. 실제로 커밋된 `trigger-secret-columns.spec.ts` 를
    전수 grep 한 결과(`existsSync`/`가 없다`/`파일이 옮겨졌거나` 어느 키워드로도) 이 분기를
    호출하는 `it()` 이 **0건**이다 — `describe('[대조군] readStringArrayConst 가 무엇을 읽고
    무엇을 거절하는가')` 블록의 6개 케이스(`missing.ts` 포함)는 전부 **파일은 존재하되 상수
    선언이 없거나 형태가 다른** 경우만 다루고, "파일 자체가 없는" 경로는 다루지 않는다. 형제
    가드(`redis-fail-open-catalog-guard.ts`, `masked-reject-callers-guard.ts`)는 애초에 이런
    `existsSync` 방어가 없어 참조할 선례도 없다. 결과적으로 이 진단 메시지 분기는 **CI 에서
    한 번도 실행되지 않는 코드**이고, 다음 사람이 메시지 문구를 바꾸거나 이 체크를 실수로
    지워도 `npx jest` 는 계속 9/9 GREEN 을 낸다 — 정확히 이 저장소가 반복 지적해 온 "실측했다"
    주장이 영구 증거가 아니라 세션 한정 증거로 남는 패턴(MEMORY `feedback_deferral_rationale_must_be_measured.md`
    류)이다.
  - 제안: `describe('[대조군] readStringArrayConst...')` 블록에 한 케이스를 추가한다 — 예:
    `expect(() => readStringArrayConst(tmp, 'no-such-file.ts', 'X')).toThrow(/가 없다|옮겨졌거나/)`.
    tmp 디렉터리 안에서 존재하지 않는 파일명만 넘기면 되므로 비용이 낮다.

- **[INFO] `readStringArrayConst` 가 같은 이름의 비-최상위 선언과 실제 대상을 구분하지 않는다 — 이 축은 어떤 테스트도 다루지 않음**
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` 의
    `visit()` 함수 (`found === null && ts.isVariableDeclaration(node) && ... node.name.text === constName`).
  - 상세: `visit` 은 `ts.forEachChild` 로 소스 파일을 사전순회(pre-order)하며 이름이
    일치하는 **첫 번째** `VariableDeclaration` 을 채택한다 — 그 선언이 모듈 최상위 `const` 인지,
    함수/블록 내부의 지역 변수인지는 구분하지 않는다. 만약 대상 파일에 같은 이름의 지역
    선언이 실제 목록보다 **소스상 앞에** 오면(예: 헬퍼 함수 안에서 임시로 같은 식별자를 쓰는
    경우), 가드는 조용히 그 값을 읽고 진짜 목록은 절대 보지 않는다 — `found === null` 게이트가
    그 뒤로도 계속 걸려 있어 올바른 선언까지 도달해도 무시한다. 9개 테스트 케이스 중 이 축을
    다루는 것은 없다(전부 "선언이 정확히 하나, 최상위" 가정 위에서 설계됨). 지금 감시 대상 3개
    실 파일에서는 해당하지 않아 실질 위험은 낮지만, 이 파일 자체가 "대조군으로 판별 자리를
    전부 고정한다"는 설계 철학을 표방하고 있어(JSDoc 전반), 이 축만 비어 있는 점을 기록해 둔다.
  - 제안: 급하지 않음(INFO) — 후속에서 "동명의 지역 변수가 앞에 있어도 최상위 선언을 찾는다"
    같은 케이스를 추가하거나, 최소한 JSDoc 에 "최상위 선언 하나만 있다고 가정한다"는 전제를
    한 줄 명시.

- **[INFO] G/H(`schedule-trigger.e2e-spec.ts`) 의 `expectTriggerWorkflowRef` 는 원 회귀의 정확한 분기를 재현하지 않는다 — 단, 구조적으로 불가능한 조합이라 결함 아님**
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — `it('G. ...')`/`it('H. ...')`,
    둘 다 `.send({ isActive: false })`/`.send({ isActive: true })` 만 보낸다.
  - 상세: `expectTriggerWorkflowRef` 의 JSDoc 이 인용하는 원 회귀(`review/code/2026/09/06/01_13_50`
    W4)는 PATCH 바디에 `chatChannel` 이 있을 때만 타는 재조회 분기(`triggers.service.ts` 의
    `update()`, `if (chatChannel) { ... relations: ['workflow'] ... }`)에서 발생했다. `update()`
    를 직접 읽어보면 `trigger.type === 'schedule'` 인 경우 `chatChannel` 필드 자체가 PATCH 로
    거부되므로(`disallowed.push('chatChannel')`), G/H 는 그 재조회 분기를 원리적으로 절대 타지
    않는다 — 즉 이 두 자리가 지키는 것은 "재조회 분기의 `relations` 누락" 이 아니라 "`findById`
    가 로드한 `workflow` 관계가 `save()` 경유로 응답까지 살아남는가"라는 **더 일반적인** 회귀다.
    plan 의 서술("이 파일이 이미 고정하던 `ScheduleDto.trigger.workflow` 와는 다른 표면이고,
    이쪽엔 양성이 한 건도 없었다")도 "원 버그의 정확한 재현"을 주장하지 않고 "커버리지 0 이었다"
    만 주장하므로 과장은 아니다. 원 버그의 정확한 재현은 `trigger-workflow-ref.e2e-spec.ts`
    (chat-channel 타입 트리거 대상)가 정본으로 맡고 있어 스코프 중복도 없다 — 설계가 의도대로
    분리돼 있음을 확인한 긍정적 기록.
  - 제안: 조치 불필요 — 다음 사람이 "G/H 가 원 회귀를 재현한다"고 오독하지 않도록, 필요하면
    `expectTriggerWorkflowRef` 호출부 주석에 "이 자리는 chatChannel 비허용 타입이라 재조회
    분기는 안 탄다" 한 줄을 덧붙이는 정도면 충분(문서화 성격, testing 결함 아님).

- **[INFO] vacuous 삼항식 수정(라운드 1 WARNING#2) 실장 확인 — 회귀 없음**
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts`
    (`it('[vacuity] 목록이 비어 있지 않다...')`).
  - 상세: 커밋된 코드가 `if (value === null) throw new Error(...)` 형태로 분리돼 있음을 직접
    열람 확인 — 문자열을 숫자와 `.toBe(0)` 비교하던 vacuous 분기는 사라졌다. `throw` 안의
    `` `${rel}: ${'상수를 못 읽었다 — ...'}` `` 는 문자열 리터럴을 불필요하게 템플릿 보간한
    형태(가독성 사소한 흠)이지만 동작에는 영향 없음 — 조치 불필요.

## 관점별 요약

1. **테스트 존재 여부** — 신규 로직(AST 파서 2함수) 전부 대응 테스트 있음. 신규 방어 분기(파일
   부재) 하나만 예외(위 WARNING).
2. **커버리지 갭** — 위 WARNING 1건 외에는 갭 없음. `readAllTriggerSecretColumnLists` 자체는
   간접적으로 첫 `it()` 이 실행하므로 별도 단위 테스트 불필요.
3. **엣지 케이스** — `null` vs `[]`, 주석 오탐 방지, `satisfies`/`as`/괄호 언랩, 비-문자열 원소
   거절까지 대조군이 촘촘함. 유일하게 비어 있는 축은 "동명 지역 선언"(INFO)과 "파일 부재"(WARNING).
4. **Mock 적절성** — mock 없음(순수 함수 + 실제 파일시스템). 문제 없음.
5. **테스트 격리** — `fs.mkdtempSync`/`afterAll` 로 격리. e2e 는 기존 `it()` 안에 단언만 추가돼
   격리 특성 변화 없음.
6. **테스트 가독성** — JSDoc 이 "왜 이 fixture 인가"를 뮤테이션 근거와 함께 일관되게 남긴다.
7. **회귀 테스트** — 기존 21개(9+12) 테스트 전부 GREEN, 로직 변경 없는 3개 e2e 파일의 주석
   diff 는 회귀 위험 없음.
8. **테스트 용이성** — `readStringArrayConst(repoRoot, relPath, constName)` 매개변수화가 좋아
   실 대상/tmp fixture 양쪽에 재사용 가능. 위 WARNING 도 기존 `write()` 헬퍼로 한 줄이면 메꿔진다.

## 요약

라운드 1(`11_27_40`)에서 지적된 vacuous 삼항식 WARNING 은 커밋된 코드에서 올바르게
`if (value === null) throw` 형태로 수정돼 있고 9/9·12/12 GREEN 을 직접 재확인했다. 독립적으로
찾은 새 발견은, 같은 라운드 1 이 "파일 부재 방어 없음"을 지적받고 **추가한 새 코드**
(`existsSync` 분기)가 그 자체로는 옳지만 **영구 테스트로 결속되지 않았다**는 점이다 — 검증은
리뷰 세션 중 저장소 파일을 수기로 리네임했다 되돌리는 방식으로만 이뤄졌고, 그 절차는 스펙
파일에 케이스로 남지 않아 CI 는 이 분기의 회귀를 잡지 못한다(WARNING). 그 외에는 "동명 지역
선언" 축 미검증(INFO, 실위험 낮음)과 G/H e2e 케이스가 원 회귀의 정확한 분기가 아니라 더 일반적인
회귀를 지킨다는 점(INFO, 결함 아님— 오독 방지용 기록)을 남긴다. 프로덕션 코드 변경이 없는
테스트/가드 하드닝 PR 로서 전반적인 테스트 설계 품질은 높다.

## 위험도

LOW
