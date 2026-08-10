# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** plan 항목 "1줄 추가" 예고가 실제로는 함수+spec 파일(130줄 순증)로 확장됨
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:54-86`,
    `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts` (신규 파일 전체)
  - 상세: `plan/in-progress/auth-guard-reflection-hardening.md` 의 원 항목(수정 전 diff 좌측)은
    "값 유일성 단언(`new Set([...]).size === 7`) 1줄 추가" 로 예고돼 있었다. 실제 구현은
    (1) 판정을 `assertAllUnique` 순수 함수로 추출, (2) 전용 spec 파일 신설(경계·throw 메시지·
    호출부 배선·export 자동추출 테스트 5건), (3) 자동추출 로직의 vacuous 버그를 잡기 위한
    2차 수정까지 3커밋으로 확장됐다. 다만 이 확장은 무관한 영역으로의 이탈이 아니라 **같은
    가드 자체의 신뢰성**(뮤테이션 테스트로 U1/U2/U3 판정)을 좁혀 들어간 결과이고, 각 확장의
    근거(왜 순수 함수인가, 왜 하드코딩 목록이 vacuous 한가)가 커밋 메시지·주석에 모두 남아
    있다. 스코프 이탈이라기보다 "1줄" 이라는 최초 견적이 낙관적이었던 것에 가깝다.
  - 제안: 조치 불요. 다음에 plan 항목을 적을 때 "가드 로직 + 회귀 방지 테스트" 처럼 견적을
    보수적으로 잡으면 이런 사후 확장이 문서상 튀어 보이지 않는다.

- **[INFO]** plan frontmatter `worktree` 와 실제 커밋 위치 불일치 가능성
  - 위치: `plan/in-progress/auth-guard-reflection-hardening.md:3` (`worktree: auth-guard-reflection-hardening-9c31f2`)
  - 상세: 이 changeset(3커밋)은 `harness-changeset-exclusion` 브랜치/워크트리에서 만들어졌고,
    plan 이 선언한 전용 worktree(`auth-guard-reflection-hardening-9c31f2`)는 `git worktree list`
    에 더 이상 존재하지 않는다. 코드 diff 자체의 범위 위반은 아니지만(정확히 plan 의 두
    잔여 항목만 구현), worktree-per-task 관례상 이질적인 브랜치에 이 작업이 실렸다는 점은
    프로세스 위생 관점의 참고 사항이다.
  - 제안: 리뷰 대상 코드에는 영향 없음 — 필요 시 별도 확인.

## 요약

리뷰 대상 diff(4 파일: 신설 spec 파일 1개, `workspace-id-fixtures.ts`, `uuid.spec.ts`, plan
체크리스트)는 `auth-guard-reflection-hardening.md` 가 잔여로 등재해 둔 정확히 두 항목 —
"픽스처 값 유일성 단언 추가" 와 "nil-UUID 캐너리 정정 문단을 SoT 한 곳(`uuid.ts`)으로 축약" —
에 1:1 대응한다. `uuid.spec.ts` 와 `workspace-id-fixtures.ts` 의 docstring/주석 변경은 전량
삭제가 아니라 SoT 에 없던 사실(유일한 방어선·전역 라우트 예외)은 남기고 중복된 근거 산문만
포인터로 축약해, 커밋 메시지가 주장하는 "선별" 원칙과 diff 가 일치한다. 새로 추가된 코드
(`ALL_WS`, `assertAllUnique`) 는 전용 spec 으로만 커버되고, 다른 소비 스위트·무관 모듈·설정
파일·임포트 정리 등 범위 밖 수정은 발견되지 않았다(`git diff --stat` 로 4 파일 일치 확인).
plan 파일 수정도 실제로 완료된 두 항목의 체크박스·근거 갱신에 한정된다. 유일한 특이점은
최초 plan 견적("1줄")보다 구현이 커졌다는 점인데, 확장 사유가 전부 같은 가드의 mutation
검증 강화(자기 완결적 리팩토링)로 문서화돼 있어 무관한 리팩토링이나 기능 확장으로 보기
어렵다.

## 위험도
NONE
