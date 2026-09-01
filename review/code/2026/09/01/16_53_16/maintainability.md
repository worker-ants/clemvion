# 유지보수성(Maintainability) 리뷰 — audit-record-factory (2026-09-01 16:53:16, 6라운드)

## 검토 방법

`origin/main..HEAD` 의 `codebase/**` 순변경분(8파일, 859줄 추가)을 대상으로 했다. 그중
`audit-logs.service.ts`·`business-metrics.service.ts`·`auth-configs.service.ts`·
`audit-logs.spec.ts`·`business-metrics.service.spec.ts` 는 1~5라운드 maintainability 리뷰가
이미 반복 검토·수렴(NONE/LOW)한 코드이고, 이번 라운드 사이 실행 코드 변경이 없어 재확인만
했다. **실질적으로 새로운 표면**은 5라운드 fix 커밋(`4b15f0393`, 16:52 커밋 — 직전
maintainability 라운드 `16_29_11` 이후)이 추가한 `findMisboundHelpers` 및 그 지원 함수들
(`extractBoundResourceText`·`extractRecordedResourceText`·`normalizeResource`·
`collectStringConsts`)과 `audit-action-binding-fixture.ts` 의 신규 fixture 4종이다 — 이 라운드
maintainability 리뷰가 처음 보는 코드라 여기에 집중했다. 저장소는 뮤테이션하지 않았다
(`Read`/`Bash(grep, git diff --stat)` 만 사용, `git status --short` 로 무변경 확인).

## 발견사항

- **[INFO]** fixture 파일에서 "형태 5" 라벨이 서로 다른 두 fixture 에 중복 부여됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-fixture.ts:64`
    (`ARROW_FIELD_BARE_SOURCE` — "가드가 **잡아야** 하는 형태 5 — 화살표 함수 클래스 필드에 맨
    union"), `:98` (`WRONG_RESOURCE_BOUND_SOURCE` — "가드가 **잡아야** 하는 형태 5 — 묶이긴
    했는데 **엉뚱한 리소스**에 묶였다")
  - 상세: 형태 1~4(`BARE_UNION`·`NO_ACTION`·`POSITIONAL`·`LOOKALIKE_TYPE`)까지는 번호가 순차
    증가하다가, `ARROW_FIELD_BARE_SOURCE` 에서 "형태 5" 를 쓰고 그 뒤 `WRONG_RESOURCE_BOUND_SOURCE`
    에서도 다시 "형태 5" 를 쓴다(`UNRELATED_METHOD_SOURCE` 는 별도 카테고리라 번호 계열에서
    빠지는 것이 맞으나, 그로 인해 다음 잡아야 하는 형태가 6이 아니라 5로 재사용됐다). 기능에는
    영향 없다(각 상수는 이름으로 참조되고 번호는 주석 장식일 뿐) — 다만 이 주석은 "가드가 잡는
    구멍이 몇 종류인가" 를 사람이 셀 때 참조점 역할을 하므로, 번호가 꼬여 있으면 다음
    유지보수자가 "형태가 몇 개까지 커버됐는지" 를 셀 때 혼동한다.
  - 제안: `WRONG_RESOURCE_BOUND_SOURCE` 의 "형태 5" 를 "형태 6" 으로 정정(혹은 두 카테고리 —
    바인딩 부재 vs 오귀속 — 를 별도 번호 계열로 분리해 "형태 A-N/B-N" 처럼 명시).

- **[INFO]** `extractActionType` 과 `extractBoundResourceText` 가 "첫 파라미터의 타입 리터럴에서
  `action` 프로퍼티를 찾는" 순회 로직을 그대로 중복 보유
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:162-178`
    (`extractActionType`), `:247-273` (`extractBoundResourceText`)
  - 상세: 두 함수 모두 `first.type` 이 `TypeLiteralNode` 인지 확인 → `members` 를 순회 →
    `PropertySignature` 이고 이름이 `'action'` 인 멤버를 찾는 절차가 거의 동일하다(약 10줄
    분량). 차이는 그 뒤 처리뿐이다 — 전자는 `member.type.getText()` 를 그대로 반환하고,
    후자는 그 타입이 `AuditActionFor<X>` 참조인지 검사해 `X` 만 뽑는다. "action 프로퍼티를
    찾는 방식"(예: optional `action?:` 지원, 다른 프로퍼티명 허용 등)이 바뀌면 두 곳을 함께
    고쳐야 하는데, 이름이 서로 달라 한쪽만 고치기 쉽다. 다만 두 함수 모두 `audit-action-
    binding.spec.ts` 의 fixture 커버리지 아래 있어 divergence 가 나면 테스트가 잡을 가능성은
    높다.
  - 제안: `first.type` → `action` `PropertySignature` 를 찾아 그 `member.type`(`ts.TypeNode`)을
    돌려주는 공통 헬퍼(예: `findActionPropertyType(params): ts.TypeNode | null`)를 추출하고,
    두 함수를 그 위의 얇은 래퍼로 재작성. 급하지 않음 — 함수가 짧고 각각 단일 책임이라 현재도
    읽기는 어렵지 않다.

- **[INFO]** (carry-over, 5라운드 `16_29_11/maintainability.md` 에서 이미 지적, 미조치 유지)
  JSDoc 한 줄이 인접 줄 대비 눈에 띄게 길어 줄바꿈이 없음
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:179`
    (`recordAuditWriteFailed` JSDoc "왜 클램핑인가" 절, "**컴파일러가 닫힘을 증명하지 못한다**.
    증명되지 않은 닫힘을 타입으로 주장하는 대신" 문장)
  - 상세: 이번 라운드 사이 이 줄은 수정되지 않았다(직접 대조 확인). 5라운드에서 "우선순위 낮음"
    으로 명시 처분된 항목과 동일 — 재확인 목적으로만 기록한다.
  - 제안: 조치 불요(기존 처분 유지).

- **[INFO]** (carry-over, 5라운드에서 이미 지적, 미조치 유지) `audit-logs.spec.ts` 신설 테스트
  3건이 바로 위 `build()` 헬퍼를 쓰지 않고 조립 보일러플레이트를 인라인 반복
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:202-221`
    (`metrics 호출이 던져도 삼킨다`), `:223-237`(`metrics provider 없이 DI 조립이 성공한다`),
    `:239-249`(`metrics 없이도 감사 기록은 동작한다`); 헬퍼 정의는 `:154`
  - 상세: 각 테스트가 `metrics` mock 의 동작(던지는 mock·provider 부재·인자 자체 생략)이 서로
    달라 `build()` 시그니처를 그대로는 재사용할 수 없어서 생긴 결과라는 5라운드 판단이 이번
    확인에서도 유효하다. 새로 바뀐 것 없음.
  - 제안: 조치 불요(기존 처분 유지).

## 요약

이번 라운드에서 maintainability 관점에서 처음 검토하는 코드는 5라운드 fix 커밋이 추가한
`findMisboundHelpers`·`extractBoundResourceText`·`extractRecordedResourceText`·
`normalizeResource`·`collectStringConsts` 및 fixture 4종이다. 함수는 대체로 짧고 단일 책임이며,
"형태가 아니라 값으로 판정" · "모르는 것은 위반으로 세지 않는다" 같은 설계 원칙이 JSDoc 에
구체적 근거(뮤테이션 실측 수치 포함)와 함께 일관되게 남아 있어 왜 이렇게 짰는지 추적이 쉽다.
네이밍도 도메인 의도를 정확히 드러낸다(`findMisboundHelpers` vs `findUnboundHelpers` 의 구분이
그 자체로 두 불변식의 차이를 설명). 발견한 두 항목(fixture 라벨 번호 중복, 두 extract 함수의
순회 로직 중복)은 둘 다 순수 가독성/DRY 수준으로 기능·정합성에 영향이 없고, 이미 fixture
테스트가 실질 커버리지를 보장하고 있어 시급하지 않다. 나머지 두 항목은 5라운드에서 이미
처분된 사안의 재확인이며 상태 변화 없음. 차단 사유가 될 만한 발견은 없다.

## 위험도

NONE
