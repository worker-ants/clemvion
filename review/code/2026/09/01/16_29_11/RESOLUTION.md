# RESOLUTION — 감사 로깅 잔여 리뷰 5라운드

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **2** · INFO 10

두 WARNING 다 조치했다. W1 은 **유예하지 않고 닫았고**, 그 과정에서 내 근거와 리뷰어의 반증이
**둘 다 틀렸다**는 것이 드러났다.

## W1 — 가드가 "자기 리소스에 묶였는지" 를 안 봤다

`findUnboundHelpers` 는 `AuditActionFor<` **접두**만 검사한다. 그 술어는 이 가드가 지키려는
불변식보다 **한 칸 좁다** — `AuditActionFor<'workflow'>` 로 선언하고 `resourceType:
'auth_config'` 를 기록해도 통과한다.

### 내 유예 근거가 틀렸다 (이 PR 에서 두 번째)

3·4라운드 RESOLUTION 에 **"컴파일러의 `_NoCrossDomain` 가드가 다른 도메인 오귀속을 이미
정적으로 막는다"** 고 적고 그것으로 조치를 건너뛰었다. 뮤테이션이 갈랐다:

| # | 뮤턴트 | 예측 | 실측 |
|---|---|---|---|
| M3 | `auth-configs` helper 를 `AuditActionFor<'workflow'>` 로 오귀속 | RED | **tsc 에러 5건** + 가드 RED 1 |
| M4 | M3 + `_NoCrossDomain` 캐너리 제거 | 에러 감소 | **에러 5건 — 변화 없음** |

**M4 가 결정적이다.** 캐너리를 지워도 검출이 그대로면 잡는 주체는 캐너리가 아니다. 에러 5건은
전부 helper 선언부가 아니라 **액션 리터럴을 넘기는 호출부**에 찍힌다. `_NoCrossDomain` 은
`AuditActionFor` 유틸리티가 좁히기는 하는지를 하드코딩된 조합 하나로 확인할 뿐이다.

### 리뷰어의 반증도 틀렸다

architecture·testing 두 리뷰어가 각각 **"뮤턴트가 `tsc --strict` 에서 0 에러로 통과한다"** 를
근거로 살아있는 구멍이라 했다. 실제 저장소에서는 **5건**이 난다. 두 프로브 모두 **호출부가
없는 스크래치 재현**이었고, 하필 그 호출부가 오늘의 방어막이다 — 재현이 방어하는 요소를 빼고
만들어져 **없는 구멍을 만들어냈다**.

두 리뷰어가 독립적으로 같은 결론을 냈다는 사실이 이것을 확증으로 보이게 했다. 실제로는 둘 다
같은 방식으로 좁게 재현했을 뿐이다 — **합의는 검증이 아니다.**

하마터면 그 문장을 가드 JSDoc 에 **그대로 옮겨 적을 뻔했다.** 초안에 "캐너리도 이 방향을 막지
못한다 / 뮤턴트가 0 에러로 통과한다" 를 써 넣었다가, 저장소에서 직접 재 보고 지웠다.

### 그래도 표면은 실재한다 — 다만 이유가 다르다

호출부가 방어막이라면, **호출부가 없으면 방어가 없다.** 남는 갭은 두 가지다:

- 호출부가 아직 없는 helper (선언을 먼저 만든 경우)
- 호출부의 액션이 두 리소스 모두에 유효해 갈리지 않는 경우

`findMisboundHelpers` 로 **선언 단계**에서 닫았다 — 호출부 유무와 무관하고, 실패가 선언 한
줄로 보인다(호출부 N곳의 대입 에러로 흩어지지 않는다).

판정은 값이 아니라 형태로 하되, `typeof CONST` 와 `'literal'` 을 **상수 해석으로 정규화**해
비교한다. 표기만 바꿔 검사를 빠져나가는 것도, 표기가 달라 거짓 경보가 나는 것도 막는다.

### 뮤테이션 (예측 / 실측 — 전부 RED)

| # | 뮤턴트 | 예측 | 실측 |
|---|---|---|---|
| M1 | `boundResource !== recordedResource` 비교 무력화 | RED | **RED 3** |
| M2 | 상수 해석 제거(원문 문자열 비교) | RED | **RED 2** |
| M3 | 실제 서비스 오귀속 (저장소 단언이 vacuous 하지 않은가) | RED | **RED 1** |

**M1 에서 배운 것**: 위반 fixture 테스트 자체는 M1 을 **못 잡는다**(여전히 1건을 반환한다).
잡는 것은 **대조군 둘**이다. 위반 케이스만 넣었으면 이 뮤턴트가 살아남았다.

## W2 — 완료된 draft 가 `in-progress/` 에 남아 있었다 (3번째 재발)

`spec-draft-audit-resource-type-count.md` 를 `plan/complete/` 로 옮기고 `status: applied` ·
`completed: 2026-09-01` · 적용 완료 배너를 붙였다. 인입 링크 2곳(`spec-draft-audit-write-
failed-metric.md`, `spec-sync-auth-gaps.md`)도 **같은 커밋에서** 함께 고쳤다 — 링크만 남으면
docs 가드가 잡는다.

## 부수 — 내 코드에 타입 구멍이 있었다

`tsc --noEmit` 이 `audit-action-binding-guard.ts` 에서 `(node.name as ts.Identifier).text` 를
잡았다(`ts.Node` 에 `name` 없음). **jest 는 타입을 strip 하므로 116개 테스트가 전부 통과하는
동안 보이지 않았고**, lint 도 물지 않았다. 이 PR 의 앞선 커밋에서 내가 쓴 코드다.

캐스트를 늘리는 대신 **이미 선언 형태를 좁힌 자리**(`auditHelperParams`)에서 이름을 함께
돌려주도록 고쳤다 — 캐스트는 모르는 것을 안다고 주장하는 것이고, 그 주장이 틀렸다.

## INFO 10건

미조치. 전부 "조치 불요 / 낮은 우선순위 / 이미 등재" 판정이다. `record()` JSDoc(INFO 4)과
`clampLabel` 대칭 테스트(INFO 5)는 `spec-sync-auth-gaps.md` 에 등재된 이월 항목이고,
**미조치이며 우선순위 판단**이다 — 문서화되어 있어서가 아니다.

## 검증

lint(`--max-warnings 0`) · prettier · `tsc --noEmit` (repo-guards 에러 0) ·
repo-guards **7 suites / 116 passed** (신규 5건) · docs 가드 **3120**.
수치는 커밋 메시지에 실측으로 기록한다.
