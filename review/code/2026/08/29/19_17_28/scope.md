# 변경 범위(Scope) 리뷰

## 조사 요약

`git diff origin/main...HEAD --stat` 로 확인한 변경 파일은 정확히 9개이며, 프롬프트에 실린
9개 파일과 1:1 일치한다(추가 파일 없음). `code.handler.spec.ts` 는 프롬프트에 전체 컨텍스트가
실리지 않아 `git diff` 로 직접 재확인했고, 프롬프트의 unified diff 와 동일했다(주석 3줄
치환뿐). 프로덕션 동작 코드 중 실제로 바뀐 곳은 `secret-resolver.service.ts` 의 주석 1줄뿐이고,
`GlobalExceptionFilter` 구현체(`http-exception.filter.ts`) 자체는 이번 diff 에 포함되지 않았다
(`git diff` 로 확인 — 0 hunks). 즉 이 PR 은 **런타임 동작을 하나도 바꾸지 않고** 테스트 추가·
신규 가드·주석 정리·plan 체크박스 갱신으로만 구성된다.

## 발견사항

- **[INFO]** 두 개의 독립된 장기 백로그 트래커를 한 PR 에서 동시에 갱신한다
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:2` (worktree 필드),
    `plan/in-progress/deps-peer-gating-and-eslint10.md:3` (worktree 필드)
  - 상세: 이 PR 은 (1) `backend-lint-gate-broken-on-main.md` 의 "다른 Redis fail-open 소비자
    배선" 항목 아래에 `redis-fail-open-catalog-guard.ts`/`.spec.ts` 3자 정합 가드를 추가하고,
    (2) `deps-peer-gating-and-eslint10.md` 의 "`cause` 비노출 불변식 계측 지점" +
    "`secret-resolver.service.ts` 형제 3곳→4곳" + "근거 서술 중복 정리" 세 체크박스를 함께
    완료 처리한다. 서로 다른 두 백로그 문서의 항목이 한 워크트리 세션에서 묶였다는 뜻이다.
    다만 은폐된 확장은 아니다 — `deps-peer-gating-and-eslint10.md` 본문이 "셋 다 spec-linked
    파일이라 주석 한 줄만 건드려도 리뷰·`--impl-done` 이 동시에 재무장된다 — 그래서 묶어서
    처리한다 (developer SKILL §수렴 예외)" 라고 자기 근거를 명시하고 있고, redis-fail-open
    가드 쪽도 워크트리 이름(`eia-failopen-observability`) 자체가 그 작업을 가리킨다.
  - 제안: 리뷰어는 두 트래커 각각의 체크박스 변경이 실제로 그 트래커의 기존 미해결 항목에
    대응하는지만 대조 확인하면 충분하다 — 별도 조치는 불요.

- **[INFO]** `deps-peer-gating-and-eslint10.md` 의 worktree 필드 재변경이 파일 자신의 기존
  서술과 어긋날 수 있다
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:3` (diff 로 `eslint10-upgrade-5e3cf9`
    → `eia-failopen-observability-18dc47` 변경), 같은 파일 17번째 줄(diff 밖, 미수정 기존 서술)
  - 상세: 이 diff 는 worktree 필드를 `eia-failopen-observability-18dc47` 로 되돌리는데, 같은
    파일 상단의 2026-08-29 주석(이번 diff 로 건드리지 않은 기존 문장)은 "§2 이후는
    `eslint10-upgrade-5e3cf9` 워크트리에서 진행 중이라 값을 그리로 옮겼다" 고 적혀 있다. 두
    서술이 서로 다른 워크트리를 가리키는 상태로 남는다 — 이 파일이 이미 `--impl-done`
    (`01_30_29`) `plan_coherence` INFO #9 로 한 번 지적된 것과 같은 형태의 plan-worktree
    불일치를 재발시킬 소지가 있다.
  - 제안: §2 이후 항목이 실제로 어느 워크트리에서 진행 중인지 재확인하고, 필요하면 17번째 줄
    주석도 같은 커밋에서 함께 갱신한다(별도 스코프 위반은 아니고 plan 위생 확인 차원).

- **[INFO]** 스코프 관점에서 결함으로 볼 사항 없음 — 아래는 확인 결과 기록
  - `secret-resolver.service.ts:93-94` 주석 1줄 수정 외에 프로덕션 코드 변경 없음
    (`http-exception.filter.ts` 는 diff 에 없음 — 계측 테스트만 추가).
  - 신규 파일 `redis-fail-open-catalog-guard.ts`/`.spec.ts` 는 기존 컨벤션
    (`masked-reject-callers-guard.ts` + `.spec.ts` 쌍)과 동일한 배치(`repo-guards/__tests__/`)를
    따른다 — 임포트·포맷팅·기능 확장 소지 없음.
  - 임포트 변경 없음(신규 파일 제외 기존 파일들의 import 문은 diff 에 포함되지 않음).
  - 포맷팅 전용 변경(공백·줄바꿈만) 섞인 흔적 없음 — 모든 hunk 가 의미 있는 주석/코드/테스트
    본문 변경이다.

## 요약

diff 는 9개 파일로 정확히 국한되고, 프로덕션 동작 코드는 주석 1줄 외에 전혀 바뀌지 않았다.
신규 산출물(가드 2종, `cause` 비노출 테스트, 주석 정본화)은 모두 두 plan 트래커의 기존 미해결
체크박스 항목에 1:1 대응하며, 두 트래커를 한 PR 로 묶은 것도 plan 본문이 "수렴 예외" 근거로
자기 정당화하고 있어 은폐된 스코프 확장이 아니다. 유일하게 짚을 만한 것은 plan 메타데이터
(worktree 필드)의 내부 서술 불일치 가능성으로, 코드 스코프 위반이 아니라 plan 위생 확인
사항이다.

## 위험도

LOW
