# 테스트(Testing) 리뷰 — trigger-canary-hardening

## 검증 방법 메모

리포트 작성 전 다음을 직접 실행해 claim 을 재확인했다 (저장소 스코프 뮤테이션은 규약대로 원복 완료, `git diff`/`git status --short` 로 바이트 단위 원복 확인함):

- `npx jest repo-guards/__tests__/trigger-secret-columns.spec.ts src/shared/testing/trigger-workflow-ref.spec.ts` → 21/21 GREEN.
- `trigger-secret-columns-guard.ts` 의 `unwrap()` 에서 `ts.isSatisfiesExpression` 분기를 제거하는 뮤테이션을 **저장소 파일에 직접 적용**(cp 백업 후 원복)해 재실행 → 4/9 RED, 그리고 정본(`triggers.service.ts`)에 대한 `readStringArrayConst` 반환값이 실제로 **`null`**임을 확인. plan 체크리스트가 주장하는 "JSDoc 반증(빈 배열이 아니라 null)"과 "뮤턴트 RED" 두 claim 모두 실측 일치.
- `npx jest --config test/jest-e2e.json {schedule-trigger,trigger-workflow-ref,chat-channel-trigger-create}.e2e-spec.ts` → DB 미기동(`getaddrinfo ENOTFOUND postgres`)으로 런타임은 실패하지만, **ts-jest 컴파일 단계에서 타입 오류 0건** — 새로 추가된 `expectTriggerWorkflowRef(...)` 호출부 3곳이 타입 체크를 통과함을 확인(MEMORY 의 "run-test.sh 는 타입체크 ratchet 을 안 돈다" 우려에 대한 최소 방어선).

## 발견사항

- **[INFO]** `readStringArrayConst` 가 대상 파일 부재(경로 오탈자·리네임)에 대해 방어하지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` — `readStringArrayConst` 함수 (게이트 45~52 라인 부근, `fs.readFileSync(abs, 'utf8')` 호출부)
  - 상세: `CANONICAL_SOURCE`/`MIRROR_SOURCES` 셋 중 하나가 파일 리네임 등으로 경로가 어긋나면 `fs.readFileSync` 가 `ENOENT` 를 던져 스펙 전체가 "무엇이 다른가"를 말해주지 못하는 raw Node 에러로 실패한다. 이 가드의 존재 이유(실패 메시지가 *무엇이* 문제인지 말하게 한다는 자기 설계 원칙, guard 파일 상단 `MIRROR_CONST` 주석 참고)와 다소 어긋나는 지점 — 지금은 발생 확률이 낮지만(3개 경로가 상수로 고정) 향후 4번째 비밀 컬럼 추가 시 이 파일들이 이동될 가능성은 낮지 않다.
  - 제안: `readStringArrayConst` 진입부에서 `fs.existsSync(abs)` 체크 후 `throw new Error(`파일 없음: ${relPath}`)` 형태로 감싸거나, 최소한 spec 쪽에 "대상 파일이 존재한다"를 확인하는 별도 케이스를 두면 향후 실패 시 진단 비용이 준다. 급하지 않음(INFO).

- **[INFO]** control-group 테스트(`[대조군] 정본은 as const satisfies …`)가 실제 소스 텍스트의 정확한 부분 문자열(`` `${CANONICAL_CONST} = [` ``, `'as const satisfies'`)에 결합돼 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts:64-85` (게이트 64~85)
  - 상세: 이 결합은 테스트 작성자가 의도적으로 선택한 것으로 보인다(주석: "전제가 바뀌면 여기서 터진다") — `triggers.service.ts` 가 향후 `TRIGGER_RESPONSE_STRIP_COLUMNS` 선언을 개행·포맷을 바꿔 재작성하면(`prettier` 가 `= [` 뒤에 개행을 넣는 등) 이 대조군이 실패할 수 있다. 다만 이는 "전제가 깨졌다"는 신호를 의도적으로 내려는 설계이므로 결함이라기보다 트레이드오프 — false negative 가 아니라 false alarm 방향이라 안전한 쪽으로 치우쳐 있다. 참고용으로만 남긴다.

- **[INFO]** `expectTriggerWorkflowRef` 신규 호출 3곳(`schedule-trigger.e2e-spec.ts` C-2/G/H)이 실제로 판별력이 있는지는 이번 세션에서 **런타임 재현이 불가능**했다(DB 미기동)
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:275-278, 390-393, 427-430`
  - 상세: plan(`trigger-canary-hardening.md` 체크리스트 2번 항목)이 "세 자리 `present: true`→`false` 뮤턴트 → 정확히 그 세 케이스만 RED" 를 주장하고 별도로 e2e 를 2회(뮤턴트 RED·원복 GREEN) 돌렸다고 적었다. 이번 리뷰 세션엔 docker/postgres 인프라가 없어 그 e2e 자체의 뮤턴트 재현은 못 했고, 대신 ts-jest 컴파일 통과만 독립 확인했다. 코드 자체는 `expectTriggerWorkflowRef` 헬퍼(기존 서명 그대로) 재사용이라 신규 로직 리스크는 낮다고 판단하지만, **claim 의 런타임 부분은 문서화된 실측을 신뢰**하는 수준에 머문다는 점을 명시해 둔다(부재 증거 아님).

## 위치별 평가 요약

1. **테스트 존재 여부** — 트래커가 지목한 3개 결함 클래스(비밀 컬럼 3중 사본 무결속, `TriggerDto.workflow` schedule 표면 양성 커버리지 0, 캐너리 주석 드리프트) 각각에 대응하는 테스트/정리가 추가됐다. 실제 프로덕션 로직 변경은 없고(순수 테스트+가드+문서 배치), `git diff --stat` 로 codebase 변경 6파일 전부 테스트/가드/주석임을 확인함.
2. **커버리지 갭** — `schedule-trigger.e2e-spec.ts` 에 새로 채워진 3자리(C-2 목록·G·H PATCH)는 plan §A.2 표가 스스로 지적한 "단건 GET 은 이 파일에 없다"를 그대로 남겨뒀다 — 의도적 스코프 축소(파일 스코프가 schedule 표면 한정)로 보이고 별도 결함으로 등재하지 않는다.
3. **엣지 케이스** — 신규 AST 가드 spec 이 좋은 대조군 구조를 갖췄다: 주석 안 이름 오탐 방지, `satisfies` 벗기기, 래퍼 없는 선언, 선언 부재(`null`) vs 빈 배열(`[]`) 구분, 비-문자열 원소(spread) 거절. `null`/`[]` 구분을 명시적으로 두 케이스로 나눈 것이 특히 좋다 — vacuous 테스트 방지 원칙(리포지토리 MEMORY 의 반복 교훈)에 부합.
4. **Mock 적절성** — 이 배치는 mock 을 쓰지 않는다(순수 AST 파서 + 실제 파일시스템 읽기 + 실제 e2e HTTP). 과도한 mock 으로 인한 실제 동작과의 괴리 리스크는 없음.
5. **테스트 격리** — 신규 guard spec 은 `fs.mkdtempSync`/`fs.rmSync` 로 독립 tmp 디렉터리를 쓰고 `beforeAll`/`afterAll` 로 정리한다 — 격리 양호. e2e 신규 assertion 은 기존 `it()` 블록 안에 줄만 추가한 것이라 격리 특성 변화 없음(`maxWorkers: 1` 로 이미 순차 실행).
6. **테스트 가독성** — JSDoc/주석이 "왜 이 fixture 를 골랐는가"를 뮤테이션 실측과 함께 명시하는 패턴을 일관되게 유지한다(`redis-fail-open-catalog-guard.ts` 등 형제 가드와 동일 관례). `trigger-workflow-ref.spec.ts` 의 번호 표기 통일(원문자→아라비아)도 `grep '가드 [0-9]'` 판별 도구와 실제 표기를 일치시켜 가독성/검색성이 개선됨 — 직접 `grep -n '가드 [0-9]' trigger-workflow-ref.spec.ts` 로 원문자 잔여 0·모든 케이스 헤딩(1~11, 결합 라벨 `3·4`/`3·5` 포함)이 걸리는 것 확인(plan 이 자체 정정한 "헤딩 개수" 수치까지는 재검산하지 않았다).
7. **회귀 테스트** — 기존 `trigger-workflow-ref.spec.ts`/e2e 파일들은 주석·문서만 바뀌었고 단언 로직은 그대로라 회귀 위험 없음(21/21, 5+5+13 컴파일 통과로 확인).
8. **테스트 용이성** — `readStringArrayConst(repoRoot, relPath, constName)` 형태로 매개변수화돼 있어 실제 저장소 대상뿐 아니라 스펙 안에서 임시 fixture 파일에도 재사용 가능하다 — 테스트 용이성이 좋은 설계.

## 요약

새 repo-guard(`trigger-secret-columns-{guard.ts,spec.ts}`)는 AST 파서 선택 근거·판별 fixture·null/빈배열 구분을 모두 뮤테이션으로 실증한 견고한 하드닝이며, 직접 재현한 결과도 plan 의 claim(뮤턴트 RED, `satisfies` 미처리 시 `null` 반환)과 정확히 일치했다. `schedule-trigger.e2e-spec.ts` 에 추가된 세 자리 `expectTriggerWorkflowRef` 호출은 기존 헬퍼를 그대로 재사용하는 저위험 변경이고 ts-jest 컴파일도 깨끗하지만, 그 자리의 뮤턴트 kill 자체는 이번 세션 인프라 제약(DB 부재)으로 독립 재현하지 못했다 — 문서화된 실측을 신뢰하는 선에 머문다. 나머지 변경(캐너리 주석 번호 통일, teardown 근거 정정)은 테스트 로직에 영향 없는 문서 정리다. Critical/Warning 급 결함은 발견하지 못했고, 남은 지적은 전부 INFO(가드의 파일 부재 방어 부재·control-group 의 텍스트 결합·미재현 claim 명시) 수준이다.

## 위험도

LOW
