# 요구사항(Requirement) 리뷰 — `removeMember` owner 보호 가드 TOCTOU 수정

## 검증 방법

`codebase/backend/src/modules/workspaces/workspaces.service.ts`(전체),
`workspaces.service.spec.ts`(diff 대상 블록 + `wireFindOne` 헬퍼 전체),
`test/member-remove-concurrency.e2e-spec.ts`(신규 블록 전체),
`plan/in-progress/member-owner-toctou.md`, `spec/5-system/1-auth.md`,
`spec/data-flow/12-workspace.md` 를 직접 `Read`/`grep` 으로 확인. 추가로
TypeORM `FindOperator`/`Not` 소스(`node_modules/.../typeorm/find-options/FindOperator.js`,
`.../operator/Not.js`)를 열어 `.type`/`.value` getter 가 `_type`/`_value` 를 그대로
반환함을 확인했고, `transferOwnership()` 이 대상 멤버 행에 실제로
`lock: { mode: 'pessimistic_write' }` 를 걸고 같은 트랜잭션에서 `role='owner'` 로
UPDATE 함을 확인해 코드 주석이 주장하는 EvalPlanQual 재평가 메커니즘의 전제(같은 행에
대한 락+갱신)가 실제로 성립함을 검증했다. 저장소에 뮤테이션 없음(`git status --short` 는
review 산출물 디렉터리만 표시).

## 발견사항

- **[INFO]** 진단용 재조회(`still = await this.memberRepository.findOne(...)`)는 잠그지 않으므로,
  `affected === 0` 판정과 그 재조회 사이에 또 다른 변경이 끼어들면 반환되는 에러 코드(403 vs
  404)가 실제 DELETE 시점의 상태보다 한 틱 늦은 상태를 반영할 수 있다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:863` (`const still = await this.memberRepository.findOne(...)`)
  - 상세: 데이터 정합성(실제 삭제 여부)은 원자적 `DELETE ... role: Not('owner')` 술어가 이미
    보장하므로 이 창은 **응답 코드의 정확성**에만 영향을 준다 — owner 행이 지워지는 회귀는
    없다. 코드 주석(`workspaces.service.ts:861-862`)이 "이 재조회는 잠그지 않는다: 고르는
    것은 에러 코드뿐이고 어느 답이든 어떤 직렬화의 정당한 결과다" 라고 이 트레이드오프를
    명시적으로 인지하고 있고, `--impl-prep` WARNING 1 도 같은 지점을 짚어 plan §B "기각한
    대안" 에서 의도적으로 저울질된 결정이다. 새 결함이 아니라 이미 문서화된 설계 트레이드오프임을
    기록해 둔다.
  - 제안: 조치 불요(설계 의도). 다음 리뷰어가 "왜 재조회를 안 잠갔나" 로 재지적하지 않도록 이
    INFO 로 남겨 둔다.

- **[INFO]** 이른 가드 `if (member.role === 'owner') this.throwCannotRemoveOwner();` 가
  여전히 `assertAdmin(workspaceId, requesterId)` **이전**에 실행돼, 관리자 권한이 없는
  요청자도 대상의 role 을 (403 vs 다른 코드로) 간접적으로 알 수 있는 순서 문제가 남아 있다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:826` (`if (member.role === 'owner') this.throwCannotRemoveOwner();`)
  - 상세: 이번 diff 가 만든 문제가 아니라 리팩터(리터럴 → 헬퍼 추출) 전부터 있던 순서이고,
    `plan/in-progress/member-owner-toctou.md` §F "하지 않는 것" 이 "권한 검사 순서
    오라클(비-admin 에게 대상의 role 을 흘린다) — 트래커 별 항목" 이라고 명시적으로 스코프
    밖으로 뺐다. 이번 PR 의 요구사항(owner TOCTOU 방지)과는 계약이 다른 별개 사안이라
    CRITICAL/WARNING 으로 올리지 않는다.
  - 제안: 조치 불요(별도 트래커 항목으로 이미 분리됨). 재-flag 방지를 위해 기록만 남긴다.

## Spec fidelity

- `spec/5-system/1-auth.md:377-381` (§3.2 각주 †) 은 "Admin 의 멤버 삭제는 대상이 Owner 인
  경우 거부된다(`CANNOT_REMOVE_OWNER`)" 라고만 서술하고 **동시성 메커니즘을 규정하지
  않는다**. `spec/data-flow/12-workspace.md:141` 도 "owner 는 제거 불가" 만 적고 락/원자성
  방식은 명시하지 않는다(반면 `:188`~`:189` 의 `deleteWorkspace`/`leaveWorkspace` 행은 비관적
  락을 명시). 이 PR 이 고른 메커니즘(단일 원자적 `DELETE` + `role: Not('owner')` 술어 +
  0-행 시 무락 재조회)은 spec 이 침묵하는 영역이므로 **회색지대(INFO)** 이고 `spec_impact:
  none` 판단은 타당하다 — 신규 락도, 신규 상태 전이도, 신규 필드/에러 코드도 추가하지
  않았고 기존 `CANNOT_REMOVE_OWNER`/`MEMBER_NOT_FOUND` 코드·메시지 리터럴을 그대로
  헬퍼로 추출했을 뿐이다. spec-drift 항목 없음.

## 요구사항 충족 평가

`removeMember()` 의 owner 보호 가드가 무락 선조회 위에 서 있어 동시 `transferOwnership`
에 뚫리는 TOCTOU 를, 새 락을 들이지 않고 DELETE 문 자체의 `role: Not('owner')` 술어로
막는다는 의도가 코드에 정확히 반영돼 있다. 메커니즘 주장("Postgres READ COMMITTED 의
EvalPlanQual 재평가로 승격된 행이 제외된다")을 `transferOwnership()` 의 실제 락/갱신
경로까지 직접 확인해 검증했고, 이론과 구현이 일치한다. 0-행 판정을 "행 소멸(404)" 과
"owner 승격(403)" 두 갈래로 가르는 무락 재조회 로직도 `still` 이 `null`/`editor`/`owner`
세 값을 받는 경로가 각각 별도 unit 테스트(및 e2e 재진입 테스트)로 고정돼 있어 엣지 케이스
누락이 없다. 단위 테스트의 `wireFindOne` 확장(`targetOnReread` 파라미터)은 JSDoc 이 설명한
"두 번째 조회부터"·"생략 시 항상 target" 의미와 실제 카운터 로직이 정확히 일치하고,
`Not('owner')` FindOperator 를 `toHaveBeenCalledWith` 대신 `.type`/`.value` 로 직접 풀어
검증하는 방식도 TypeORM 소스와 대조해 타당함을 확인했다. e2e 재진입 테스트는 레이스
대신 "락 보유 + 관측된 대기 상태에서 승격 주입" 이라는 결정적 재현 방식을 쓰고 공허성
가드(`expect(raced).toBe('pending')`)까지 갖춰 TOCTOU 를 실제로 행사한다. TODO/FIXME/HACK
성 미완성 표식은 없고, 모든 코드 경로(성공/0-행-소멸/0-행-승격)가 명시적 반환·예외로
종결된다. Spec 은 이 자리의 동시성 메커니즘에 침묵해 spec-drift 대상이 아니며, 발견된
두 사안은 모두 이번 diff 범위 밖(기존 설계 트레이드오프·별도 트래커 항목)이라 INFO 로만
기록한다.

## 위험도

NONE
