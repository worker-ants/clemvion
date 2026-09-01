# 문서화(Documentation) 리뷰 — audit-record-factory (2026-09-01 16:53:16, 6라운드)

## 검토 방법

이 changeset 은 이미 5라운드(`14_31_12`~`16_29_11`)에 걸쳐 문서화 관점 리뷰를 받았고, 매
라운드가 지적한 WARNING(CHANGELOG 누락, NF-OB-07 카탈로그 미등재, JSDoc/주석 물리적 분리
2건, plan draft 미이동)이 순차적으로 전부 해소됐다. 이번 라운드는 **직전 라운드
(`16_29_11`) 리뷰 시점 이후 새로 들어온 두 커밋**(`a09b4aee6` "12종→10종" 정정,
`4b15f0393` 5R 리뷰 반영 — `findMisboundHelpers` 신설)을 중심으로, 기존에 검증된 항목은
`git show`/`Read` 로 직접 재대조만 하고 새 표면 위주로 조사했다.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 의 가드 서술이 이 PR 자신이 나중에 닫은 더 중요한 갭
  (`findMisboundHelpers`, 5라운드 W1)을 반영하지 않는다 — "묶이지 않았다" 만 언급하고
  "묶였지만 엉뚱한 리소스" 케이스는 어디에도 없다
  - 위치: `CHANGELOG.md:22-25` (`### recordAudit 공통 팩토리 → won't-do, 가드로 대체` 절,
    "**팩토리를 추출하면 그것을 쓰는 곳만 안전해진다**..." 문단)
  - 상세: 이 문단은 라운드 1 시점의 가드 구현(`findUnboundHelpers` — `AuditActionFor<` 접두
    존재 여부만 검사)만을 서술한다: *"판정은 값이 아니라 형태로 한다 ... 정작 '묶이지
    않았다' 는 구조적 사실을 놓치지 않는다."* 그런데 5라운드(`4b15f0393`, `git show --stat`
    확인 결과 `CHANGELOG.md` 미포함)에서 정확히 그 접두 검사가 **이 가드가 지키려는
    불변식보다 한 칸 좁다**는 것이 뮤테이션(M3/M4, `tsc` 에러 5건 vs 5건 불변)으로 확정됐고,
    `findMisboundHelpers`(리소스 상수를 정규화해 실제로 자기 리소스에 묶였는지까지 비교)가
    새로 추가됐다. 이는 사소한 보강이 아니라 — 이 PR 이 auth-configs 에서 원래 고치려던
    바로 그 결함 클래스("다른 리소스의 액션을 이 resourceType 으로 기록해도 안 잡힘")가
    **화살표 함수 필드나 새 helper 선언 형태로 재도입될 때 컴파일러의 간접 방어가 닿지
    않는 자리**를 닫은 것이다. CHANGELOG 만 읽는 독자(이 저장소의 관례상 CHANGELOG 는
    git log 와 별도로 사람이 읽는 큐레이션 문서로 기능— 1라운드 documentation.md 도 이
    전제로 WARNING 을 걸었다)는 가드가 "묶임 여부" 만 검사한다고 오해하고, "묶였지만
    엉뚱한 리소스" 축은 존재를 모른다. 같은 절이 대조군 tsc 프로브·처방 전환 서사를
    상세히 서술하는 수준을 감안하면 이 누락은 비대칭이다 — `plan/in-progress/
    spec-sync-auth-gaps.md:135-149`(가드 완료 항목)에는 이 5라운드 보강이 상세히 기록돼
    있어 **은폐는 아니지만**, CHANGELOG 와 plan 사이에 정보 비대칭이 생겼다.
  - 제안: `### recordAudit 공통 팩토리 → won't-do, 가드로 대체` 절 끝에 한두 문장 추가 —
    "가드는 최초엔 '묶였는가' 만 봤으나, 그 술어가 '엉뚱한 리소스에 묶인' 경우를 통과시킨다는
    것이 리뷰에서 드러나 `findMisboundHelpers` 로 자기 리소스 일치까지 검사하도록 넓혔다"
    정도. 이 CHANGELOG 파일 자체에 이미 선례(`## 부수 —` 형태의 사후 addendum, 예:
    `CHANGELOG.md:103` "로그인 실패 카운터가 아바타 URL 을 되돌리고 있었다")가 있다.

- **[INFO]** fixture 파일의 "형태" 번호가 5에서 중복된다 — `ARROW_FIELD_BARE_SOURCE` 와
  `WRONG_RESOURCE_BOUND_SOURCE` 가 둘 다 "형태 5" 로 라벨링됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-fixture.ts:64`
    (`* 가드가 **잡아야** 하는 형태 5 — 화살표 함수 클래스 필드에 맨 union.`),
    같은 파일 `:98` (`* 가드가 **잡아야** 하는 형태 5 — 묶이긴 했는데 **엉뚱한 리소스**에
    묶였다.`)
  - 상세: 형태 1(`BARE_UNION_SOURCE`, :23)~형태 4(`LOOKALIKE_TYPE_SOURCE`, :53)까지는
    순번이 맞고, 형태 5(`ARROW_FIELD_BARE_SOURCE`, :64 — 5라운드 이전에 이미 있던 fixture)
    다음에 5라운드가 `WRONG_RESOURCE_BOUND_SOURCE` 를 추가하면서 번호를 이어 붙이지 않고
    다시 "형태 5" 를 썼다(:98). 판정 로직이나 테스트 커버리지에는 영향 없는 순수 주석
    오기이지만, 이 파일 자체가 "형태 커버리지를 여기 불변으로 박아 둔다" 는 것을 존재
    이유로 내세우는 만큼(파일 헤더 :1-10), 번호가 형태 개수의 카운트 역할을 하는데 여기서
    깨졌다 — 다음 사람이 "형태가 몇 종류 커버되는가" 를 번호로 세면 하나 적게 센다.
  - 제안: `WRONG_RESOURCE_BOUND_SOURCE`(:97-98)를 "형태 6" 으로 정정.

- **[INFO]** (재확인 — 신규 아님) `AuditLogsService.record()` 바로 위 JSDoc 이 여전히
  이 PR 이 추가한 관측 동작(카운터·로그 4필드)을 서술하지 않는다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-75`
    (`/** Record an audit event. Failures are swallowed ... */`)
  - 상세: 1~5라운드가 매 라운드 동일 지점을 지적·유예했고, `plan/in-progress/
    spec-sync-auth-gaps.md:154-163` 에 "미조치이며 우선순위 판단(문서화되어 있어서가
    아니다)" 으로 명시 등재돼 있다. 이번 라운드에도 변화 없음을 `Read` 로 확인했다.
    부가로 — 이 JSDoc 은 저장소의 나머지 신규 주석이 전부 한국어인 것과 달리 여전히
    영어다. 다만 이 JSDoc 자체는 이 PR 이전부터 있던 것(`git log -L` 확인 결과 최초
    도입 커밋은 `ff14584b2`, integration 모듈 구현 시점)이라 이 PR 이 새로 만든 언어
    불일치는 아니다.
  - 제안: 조치 불요(기존 처분 유지, 이미 plan 추적). 다음에 이 메서드를 건드릴 계기가
    있으면 관측 동작 한 줄 + 한국어로 통일.

- **[INFO]** (재확인 — 신규 아님) `recordExecutionError` 쪽에 `clampLabel` 클램핑을
  실제로 무는 65자 경계 테스트가 없다 — `recordAuditWriteFailed` 형제 테스트와 비대칭
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts:51-56`
    (`recordExecutionError` 테스트, 클램핑 경계 미검증) vs `:75-83`
    (`recordAuditWriteFailed` 의 65자 클램핑 테스트)
  - 상세: 4~5라운드가 이미 지적·`plan/in-progress/spec-sync-auth-gaps.md:154-161` 에
    등재했다. 공유 상수 `PROMETHEUS_LABEL_MAX_LEN` 자체의 계약은 다른 뮤턴트(64→128)가
    이미 물고 있어 리팩터 근거는 무너지지 않는다 — 갭은 호출부 대칭뿐이라는 plan 의
    구분을 재확인했다.
  - 제안: 조치 불요(기존 처분 유지, 이미 plan 추적).

- **[INFO]** `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md` —
  이번 changeset 이 새로 등재한 별개 트래커. 문서 품질 자체는 양호
  - 위치: 파일 전체(신규, 62줄)
  - 상세: `codebase/packages/expression-engine` 의 main 선재 컴파일 실패를 다루는 별도
    문서로, frontmatter(`spec_impact: none`)·재현 불가능성이 아니라 "선재임을 어떻게
    확정했나" 절의 명시적 증거(`git diff --name-only origin/main` 0파일)·선례
    (`backend-lint-gate-broken-on-main.md`) 인용·체크리스트가 모두 갖춰져 있다. 이
    changeset 의 실제 diff(`codebase/packages/**` 무변경)와 정확히 정합한다.
  - 제안: 없음 — 확인 목적.

## 요약

이 changeset 의 문서화 수준은 1~5라운드에 걸친 반복 리뷰로 이미 이 저장소 평균 이상으로
끌어올려져 있다 — CHANGELOG·spec 3개 파일(NF-OB-07 카탈로그, 두 `record` 비대칭 서술,
개수 오기 정정)·plan 트래커·신규 가드 3파일의 JSDoc·테스트 docstring 모두 실측과 대조해
정확했고, 이전 라운드가 지적한 WARNING(CHANGELOG 부재·spec 카탈로그 미등재·주석 물리적
분리 2건·plan draft 미이동)은 전부 해소된 상태로 재확인됐다. 이번 라운드에서 새로 찾은
것은 하나뿐이다 — 직전 라운드 리뷰 **이후**에 들어온 5라운드 수정(`findMisboundHelpers`
신설, 가드가 지키는 불변식을 실제로 넓힌 변경)이 `CHANGELOG.md` 의 가드 서술에는 반영되지
않아, 이 PR 이 스스로 여러 차례 강조한 "정확한 자기서술" 원칙과 어긋나는 비대칭이 하나
남았다. 그 외에 fixture 주석의 순번 중복(형태 5 두 번) 같은 사소한 오기 하나를 새로
찾았고, 나머지는 이미 plan 에 명시 등재된 이월 항목의 재확인이다. Critical 급 문서화
결함은 없다.

## 위험도

LOW
