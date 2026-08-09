# Cross-Spec 일관성 검토 — `spec-draft-canary-count-relation`

## 검토 대상
- target: `plan/in-progress/spec-draft-canary-count-relation.md`
- 변경 지점: `spec/5-system/1-auth.md` §부트 캐너리 — "단언 대상은 라우트 목록이 아니라 '0건이
  아님'" 문단과 "알려진 한계" 문단 사이에 한 문단 삽입(포함관계 명문화, 구체 수치 미기재)

## 검증 방법
target 문서가 인용하는 실제 spec 두 파일을 직접 열어 (a) 인용 앵커(`§Rationale`, 섹션 헤딩)가
실재하는지, (b) 삽입될 문장의 사실관계("캐너리는 `@Roles()` 유무와 무관하게 전부 세고, 73건은
그 부분집합")가 두 문서의 기존 서술과 정합하는지, (c) 동일 관계를 이미 기술하려 예정해 둔
다른 plan(`auth-guard-reflection-hardening.md` §후속)과 문구·위치 선택이 충돌하지 않는지 대조했다.

## 발견사항

검토한 6개 관점(데이터 모델 / API 계약 / 요구사항 ID / 상태 전이 / RBAC / 계층 책임) 중
어느 것도 위반되지 않았다. target 은 신규 엔티티·필드·엔드포인트·요구사항 ID·상태 머신·권한
구조를 도입하지 않으며, 기존에 서술된 두 수치의 관계를 spec 에 미러링만 한다.

- **[INFO] 근거 확인 — 삽입 문장의 사실관계는 두 spec 원문과 정합**
  - target 위치: 변경안 삽입 인용문 ("캐너리가 세는 집합은 ... 그쪽이 부분집합이다")
  - 대조 대상: `spec/5-system/1-auth.md:773-778`(부트 캐너리 — "`@WorkspaceId()` 를 소비하는
    라우트 수를 세고, 0 이면 throw" — `@Roles()` 필터 없음) · `spec/data-flow/12-workspace.md:319`
    (Rationale "멤버십 검증은 가드 1곳에서" — "`@WorkspaceId()` 를 소비하면서 `@Roles()` 가 없는
    것 **73건**")
  - 상세: 두 원문을 직접 대조한 결과 target 이 주장하는 포함관계(캐너리 집합 ⊇ 73건 집합)는
    기존 spec 서술에서 논리적으로 이미 따라 나오는 사실이며 모순이 없다. 코드 인용
    (`handlerConsumesWorkspaceId`)도 두 문서에서 동일 함수를 가리켜 일관된다.
  - 제안: 없음 (확인만).

- **[INFO] 앵커 정합성 확인 — `§Rationale` 인용이 실제 헤딩 위치와 일치**
  - target 위치: Overview 문단 2곳("§Rationale 의 '73건'"), Rationale "왜 `1-auth.md` 한 곳인가"
  - 대조 대상: `spec/data-flow/12-workspace.md` — "멤버십 검증은 가드 1곳에서" 헤딩(L313)이
    `## Rationale`(L278) 하위에 있음을 확인. `spec/5-system/1-auth.md` — "부트 캐너리"
    헤딩(L773)도 `## Rationale`(L524) 하위에 있음을 확인.
  - 상세: 두 인용 모두 실제 문서 구조와 일치한다. 삽입 지점("단언 대상은 라우트 목록이 아니라
    '0건이 아님'" 문단 뒤, "알려진 한계" 앞)도 `1-auth.md:791-795` 실제 텍스트와 정확히 대응한다.
  - 제안: 없음.

- **[INFO] 동일 관계를 예고해 둔 기존 backlog 항목과 문구·범위가 일치**
  - target 위치: 체크리스트 "`auth-guard-reflection-hardening.md` §후속 의 해당 항목 체크"
  - 대조 대상: `plan/in-progress/auth-guard-reflection-hardening.md:255-263` — 미체크 항목
    "73건(subset) / 142건(superset) 관계를 spec Rationale 에도 미러링" ("숫자 자체는 미러링하지
    말 것... 관계만 적는다")
  - 상세: 이 항목은 `1-auth.md` **또는** `data-flow/12-workspace.md` 둘 중 하나에 적으면 된다고
    열어 뒀고, target 은 `1-auth.md` 단일 위치를 선택하며 그 이유를 Rationale 에 명시했다(오독
    발생 지점이 전자, 양쪽 복제는 과거 두 차례 sync 실패 재발 위험). 문구도 "캐너리가 세는 것은
    `@Roles()` 유무와 무관한 `@WorkspaceId()` 소비 라우트 전체" 로 원 backlog 항목의 지정 문구와
    거의 동일하며 숫자(142)를 적지 않는 제약도 그대로 지켰다. 두 문서 간 모순 없음, 위치 선택은
    정당화된 결정이다.
  - 제안: 없음 (적용 후 해당 backlog 항목 [x] 체크 — target 체크리스트에 이미 포함).

- **[INFO] "73건" 을 인용하는 다른 문서들과의 잠재 충돌 스캔 — 충돌 없음**
  - target 위치: 체크리스트 "side-effect — 73건을 인용하는 다른 문서에 모순이 생기지 않는지 확인"
  - 대조 대상: `plan/complete/auth-workspace-membership-guard.md` · `plan/complete/spec-draft-workspace-header-membership-invariant.md` · `plan/complete/spec-draft-auth-invariants-sync.md` · `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` · `plan/in-progress/spec-sync-auth-gaps.md` · `plan/in-progress/spec-fix-swagger-forbidden-response.md`
  - 상세: 이들 문서는 모두 "73건 = `@WorkspaceId()` 소비 & `@Roles()` 부재" 정의로 일관되게
    사용하며, target 이 추가하려는 "캐너리 = `@Roles()` 무관 전체 집합" 서술과 상충하지 않는다.
    target 이 두 수를 spec 에 병기하지 않기로 한 결정(§Rationale "왜 `1-auth.md` 한 곳인가")도
    이 문서들의 기존 인용 방식을 변경하지 않으므로 side-effect 는 없다.
  - 제안: 없음.

## 요약
target 은 이미 spec 전역에 일관되게 서술돼 있는 두 수치("캐너리 카운트" ⊇ "`@Roles()` 부재
73건")의 포함관계를 `1-auth.md` §부트 캐너리 Rationale 에 명문화하는 순수 문서 보강이며, 신규
엔티티·API·요구사항 ID·상태 전이·RBAC 구조를 도입하지 않는다. 인용 앵커(§Rationale 헤딩)와
삽입 지점 모두 실제 spec 텍스트와 정확히 대응함을 직접 대조로 확인했고, 동일 관계를 이미
예고해 둔 `auth-guard-reflection-hardening.md` §후속 backlog 항목과도 문구·제약(숫자 비기재)이
일치한다. "73건" 을 인용하는 다른 6개 plan/spec 문서와도 정의 충돌이 없다. Cross-Spec 관점의
발견사항은 전부 정합성 확인(INFO)이며 CRITICAL/WARNING 은 없다.

## 위험도
NONE
