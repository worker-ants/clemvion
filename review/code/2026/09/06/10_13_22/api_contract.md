# API 계약(API Contract) 리뷰

## 개요

이번 변경의 실질 목적은 `User` 엔티티가 응답에 통째로 실리는 것을 막는 **검출 계층**(정적 AST
가드 `user-entity-exposure-guard.ts` + 런타임 이름 기반 단언 `user-secret-absence.ts`)을
새로 두는 것이다. API 계약 관점에서 직접 건드리는 표면은 다음 두 가지뿐이다.

1. `WorkspaceMemberDto` 에 `joinedAt: string | null` 필드를 **추가 선언**
   (`codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`)
2. `GET /api/workspaces/:id/members` 응답 형태를 처음으로 무는 e2e 신설
   (`codebase/backend/test/workspace-rbac.e2e-spec.ts`)

나머지(가드·fixture·plan 문서·CHANGELOG)는 테스트 인프라·문서이고 wire 표면을 바꾸지 않는다.

## 발견사항

- **[INFO]** `WorkspaceMemberDto.joinedAt` 추가는 §5.4 를 정확히 지킨 사례다 — breaking change 아님
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:88-89`
  - 상세: `@ApiProperty({ format: 'date-time', nullable: true, type: String })` + non-optional
    `joinedAt: string | null` 로 선언했다. `@ApiPropertyOptional` (= `required:false`) 을 쓰지
    않고 `@ApiProperty` + `nullable:true` 를 쓴 것은, CHANGELOG·plan 문서가 밝히듯
    `WorkspacesService.listMembers` 가 `joinedAt: m.joinedAt` 으로 **무조건** 필드를 싣기
    때문이다(값이 없으면 키는 `null`). 즉 이 필드는 이미 wire 에 실려 있었고(FE 는 이미
    `joinedAt: string | null` 로 소비 중이라고 명시) 이번 커밋은 **선언을 실제에 맞춘 것**이지
    응답 동작을 바꾼 것이 아니다 — 기존 클라이언트에 영향 없음, 하위 호환성 문제 없음.
  - 제안: 없음(그대로 진행 가능). 다만 이 DTO 필드가 신설된 것이 아니라 "뒤늦게 선언"된
    사례라는 점을 PR 설명/리뷰 기록에 남겨 두면(이미 CHANGELOG·plan 에 남겨져 있음) 향후
    `swagger-dto-contract-guard`/`response-contract` 두 검증자 중 어느 쪽도 이 필드를 이전엔
    보지 못했다는 사실이 재조사 시 헷갈리지 않는다.

- **[INFO]** 신설 e2e(`workspace-rbac.e2e-spec.ts` 테스트 F)가 이름 축(`expectNoUserSecrets`)을
  선언 축(`assertMatchesContract`)보다 먼저 호출하는 순서가 의도적으로 검증됨
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:316-323`
  - 상세: 주석에 "선언 대조가 먼저면 그것이 먼저 던져 이름 축이 실행조차 안 된다(실측)" 라고
    적혀 있고 실제로 순서를 바꿔 확인했다고 기록돼 있다. API 계약 관점에서 봐도 타당한
    설계다 — 두 검증자는 서로 다른 결함 클래스(선언 오류 vs 이름 기반 유출)를 잡으므로 한쪽이
    다른 쪽을 가리면 회귀 검출력이 준다. findings 아님, 좋은 패턴으로 기록.

- **[INFO]** 새 e2e 가 처음으로 `GET /api/workspaces/:id/members` 응답 스키마를 문다 — 기존
  갭이었음을 확인
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:287-324`
  - 상세: 이 엔드포인트는 `User` 엔티티를 `relations:['user']` 로 통째로 로드하는 3곳 중
    하나인데(다른 둘은 `auth.service.ts#logout`/`#refresh`) 종전에는 응답 형태를 확인하는
    e2e 가 전혀 없었다. 이번 추가로 `assertMatchesContract`(선언 대조) + `expectNoUserSecrets`
    (이름 기반 부재 단언) 두 축이 배선됐다. API 계약 커버리지가 실질적으로 개선된 항목이라
    감점 요소 없음.

- **[INFO]** 목록 응답 봉투 형태가 `{ data: [...] }` — 페이지네이션 메타데이터 없음(이번 diff
  가 만든 것은 아님, 기존 동작)
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:312` (`res.body.data as
    Array<Record<string, unknown>>`)
  - 상세: `GET /:id/members` 는 워크스페이스 멤버라는 크기가 작고 자연히 유계인 컬렉션이라
    페이지네이션이 없는 것 자체는 부적절하지 않다. 다만 이 저장소에 "비-페이징 고정
    컬렉션은 `{data:{items:[...]}}` 형태로 감싼다" 는 취지의 선례가 있다면(과거 auth 목록
    엔드포인트 리뷰에서 그런 판단이 있었음) 이 엔드포인트가 그 컨벤션과 `{data:[...]}` 로
    다르게 나가는지 여부는 이번 diff 범위 밖의 기존 상태이므로 이번 PR 의 결함으로 잡지
    않는다. 새로 손댈 일이 생기면 그때 대조할 것.
  - 제안: 조치 불필요(this PR 범위 아님). 참고용 기록만.

- **[INFO]** 정적 가드(`user-entity-exposure-guard.ts`)의 화이트리스트(양방향 래칫)가 API
  응답 스키마 방어에 간접적으로 기여
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts:50-57`
    (`EXPECTED_USER_RELATION_LOADS`)
  - 상세: `User` 를 투영 없이 통째로 싣는 자리를 정확히 3곳(`auth.service.ts#logout`,
    `#refresh`, `workspaces.service.ts#listMembers`)으로 동결하고, `leftJoinAndSelect`/
    `innerJoinAndSelect` 축은 0을 강제한다. 이는 "API 응답에 실릴 수 있는 원재료" 자체가
    늘어나는 것을 코드 리뷰 시점에 막아 주므로, §5.4 응답 스키마 계약을 어기는 새로운
    엔드포인트/서비스 변경이 조용히 들어오는 것을 억제한다. 다만 이것은 **컴파일/테스트
    타임 검출**이지 런타임 방어(예: `select:false`, 전역 인터셉터)가 아니라는 점은
    CHANGELOG·plan 문서 스스로 명확히 인정하고 있고, 대안들의 비용(19곳 공유 로더 재배선,
    298개 e2e 전체 wire 변경)을 실측 근거로 배제했다는 근거도 충분하다. API 계약
    관점에서 추가로 요구할 사항 없음.

- **[INFO]** `expectNoUserSecrets`/`findUserSecretLeaks` 는 요청 검증이 아니라 응답 검증
  전용 — 요청 매개변수 검증 항목은 이번 diff 에 해당 사항 없음
  - 위치: `codebase/backend/src/shared/testing/user-secret-absence.ts` 전체
  - 상세: 점검 관점 5(요청 검증)에 해당하는 코드 변경은 이번 diff 에 없다(요청 DTO/Pipe/
    Validator 변경 없음). 명시적으로 "해당 없음"을 기록한다.

## 요약

이번 변경은 API 계약 표면을 실질적으로 넓히거나 깨는 변경이 아니라, `User` 엔티티가 API
응답에 원치 않게 노출되는 것을 잡는 **검출 인프라**(정적 관계-로드 가드 + 런타임 이름 기반
부재 단언)를 신설하고, 그 과정에서 발견된 미선언 필드(`WorkspaceMemberDto.joinedAt`)를
§5.4 규약(상시 존재 → `@ApiProperty`+`nullable:true`, non-optional)에 맞게 뒤늦게 선언한
것이다. 필드 추가는 실제 wire 동작을 바꾸지 않는 순수 문서화이므로 하위 호환성 문제가
없고, 신설 e2e 는 종전에 응답 형태를 전혀 검증하지 않던 엔드포인트(`GET
/api/workspaces/:id/members`)의 계약 커버리지를 개선한다. 에러 응답 형식, URL/경로 설계,
버전 관리, 요청 검증, 페이지네이션, 인증/인가 표면에는 변경이 없다. Critical/Warning 급
계약 위반은 발견되지 않았다.

## 위험도

NONE
