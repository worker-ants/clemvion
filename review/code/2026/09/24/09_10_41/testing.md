# 테스트(Testing) 리뷰 — `removeMember()` owner 보호 가드 TOCTOU 수정 (누적 diff, 3라운드째)

## 컨텍스트

이번 diff 는 신규 결함이 아니라 `review/code/2026/09/24/08_09_57`(1라운드) →
`08_46_47`(2라운드) 두 차례 `/ai-review` 를 거쳐 수렴한 최종 상태다. 테스트 관점 지적
후보(제3 상태 미검증·중복 단위 테스트) 는 이미 각 라운드에서 조치됐고 `RESOLUTION.md` 에
뮤턴트 예측=실측 표로 근거가 남아 있다. 아래는 그 수렴 결과를 재검증한 결과다.

## 검증 방법

저장소를 뮤테이션하지 않고 `Read`/`grep`/`git show` 로만 확인했고, 안전한 비파괴 검증으로
`npx jest workspaces.service.spec.ts -t "removeMember"` 를 1회 실행했다(파일 수정 없음,
`git status --short` 로 재확인 — 이 세션이 시작하기 전부터 있던
`review/code/2026/09/24/09_10_41/` 외 변경 없음).

```
Test Suites: 1 passed, 1 total
Tests: 66 skipped, 11 passed, 77 total
```

## 발견사항

- **[INFO]** 세 갈래(행 소실 / owner 승격 / 승격 후 강등)가 모두 단위 테스트로 고정돼 있다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1540`,
    `:1567`, `:1595` (세 `it` 블록) / 대응 프로덕션 분기
    `codebase/backend/src/modules/workspaces/workspaces.service.ts:859-873`.
  - 상세: 직전 라운드(`08_09_57` concurrency.md WARNING)가 지적한 "재조회가 강등된 행을
    보면 실재 멤버를 404 로 오보고한다" 제3 상태가, 판정 술어 자체를 `still?.role ===
    'owner'` → `if (still)` 로 바꾸는 방식으로 해소됐고, 그 정확한 분기가
    `재조회가 강등된 행을 봐도 403이다 — 막은 것은 owner였다`(`:1595`) 로 고정돼 있다.
    `RESOLUTION.md` 의 뮤턴트 표(B′: 옛 형태로 되돌리는 뮤턴트, B″: 분기 자체 제거)가
    각각 이 테스트로 죽는 것을 실측했다고 적고 있고, 이번 세션에서 재실행한 결과(11
    passed)도 일치한다.
  - 제안: 조치 없음 — 확인 목적의 기록.

- **[INFO]** 중복 단위 테스트 제거가 커버리지를 줄이지 않았음을 `git show 24f7a1ddf` 로
  직접 대조 확인.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` (제거된
    블록은 옛 diff 기준 `:1611-1626`, "DELETE 시점에 행이 사라졌으면 404다").
  - 상세: 제거된 블록과 남은 `진 쪽은 404이고 감사를 남기지 않는다`(`:1540`) 블록을 diff
    로 비교한 결과 `wireFindOne` 인자·`delete` mock·단언(`MEMBER_NOT_FOUND`)까지 완전히
    동일했다 — 진짜 중복이었고, 삭제로 관측 가능한 분기가 사라지지 않았다.
  - 제안: 조치 없음.

- **[INFO]** `affected > 0`(정상 삭제) 경로에서 재조회 `findOne` 이 **호출되지 않음**을
  직접 단언하는 테스트는 없다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1501`
    (`한 행을 지우면 그 멤버의 감사를 남긴다`).
  - 상세: 프로덕션 코드 구조상(`if (affected === 0) { ... }` 블록 안에서만 재조회) 이
    경로가 재조회를 탈 수 없어 실질 위험은 낮지만, 이 블록의 단언은 `delete` 호출 인자와
    감사 로그만 확인하고 `memberRepo.findOne` 의 총 호출 횟수(선조회 1회로 끝나야 함)는
    보지 않는다. 향후 리팩터가 "0-행이든 아니든 항상 재조회" 형태로 바뀌어도 이 테스트는
    조용히 통과한다.
  - 제안: 우선순위 낮음. `expect(memberRepo.findOne).toHaveBeenCalledTimes(1)` 한 줄
    추가를 고려할 수 있으나, 그런 리팩터가 나타나면 감사 로그의 `memberUserId` 값이나
    다른 단위 테스트가 함께 깨질 가능성이 높아(예: mock 이 두 번째 호출에서 다른 값을
    반환하도록 `wireFindOne` 설계가 이미 돼 있음) 실질 검출력 손실은 제한적이다.

- **[INFO]** `FindOperator` 내부 필드(`criteria.role.type`/`.value`) 직접 검사는 TypeORM
  구현 세부사항에 결합돼 있으나, e2e 가 SQL 렌더링을 이중으로 고정하고 있어 리스크가 낮다
  (직전 라운드 `database.md` INFO 와 동일 사안, 재확인만).
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1509-1515`.
  - 제안: 조치 불필요, 현행 유지.

- **[INFO]** e2e 재진입(reentrant) 테스트의 격리·정리(finally) 로직을 직접 추적 확인.
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:231-275`.
  - 상세: `try` 블록 안 `expect(raced).toBe('pending')` 단언이 실패해도 `finally` 가
    `ROLLBACK` 으로 락을 풀고 `pending` 을 drain 하므로, 실패 시에도 다음 테스트로 락이
    새지 않는다. 전용 워크스페이스(`isolatedWorkspaceId`) 를 이 블록에서만 만들어
    raw UPDATE 가 남기는 "owner 2명"(애플리케이션 경로로는 도달 불가능한 상태)이 다른
    블록에 전파되지 않는다 — 직전 라운드 W4("이 블록은 파일의 마지막이어야 한다"는
    주석 의존 불변식)를 실제로 해소했다.
  - 제안: 조치 없음.

## 확인했으나 이 리뷰의 발견사항으로 올리지 않은 것

- 재진입 락 오케스트레이션이 `integration-rotate-concurrency.e2e-spec.ts` 와
  `member-remove-concurrency.e2e-spec.ts` 두 곳에 손으로 복제된 것 — 이미
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "세 번째 자리가 생기면
  헬퍼로 뽑는다" 는 명시적 임계값과 함께 등재돼 있고 developer SKILL 수렴 예외 4조건을
  충족한다. 재지적하지 않음.
- `removeMember` 의 권한 검사 순서 오라클(비-admin 노출 범위) — 이 PR 의 계약(owner 삭제
  방지) 과 다른 사안이며 별도 트래커 항목으로 CHANGELOG 에 명시돼 있다. 테스트 관점에서
  이 PR 이 새로 만들거나 넓힌 갭이 아니므로 재지적하지 않음.

## 요약

`removeMember()` owner 보호 가드 TOCTOU 수정은 단위(mock 기반, `Not()` 술어 직접 검사)와
e2e(재진입 기법으로 정확한 인터리빙 강제, 최종 DB 행 상태까지 직접 확인) 두 층에서 판별력
있게 검증돼 있다. 이전 두 라운드 리뷰가 지적한 "제3 상태 미검증"과 "중복 단위 테스트" 는
분기 형태 자체를 바꾸는 방식(`still?.role === 'owner'` → `if (still)`)과 중복 블록 제거로
실제로 해소됐으며, 그 근거(뮤턴트 예측=실측 표, `git show` 로 재확인한 순수 중복)를 직접
대조해 타당함을 확인했다. 남은 관찰은 전부 INFO 수준(성공 경로의 재조회 미호출을 명시
단언하지 않는 점, TypeORM 내부 구조 결합)이며 실질 위험은 낮다. 새로운 Critical/Warning
수준의 테스트 갭은 발견하지 못했다.

## 위험도

LOW
