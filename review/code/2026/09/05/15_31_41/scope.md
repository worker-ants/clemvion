# 변경 범위(Scope) Review

## 방법론 메모

프롬프트에 조립된 59개 파일은 `git diff origin/main..HEAD` 기준 **11개 커밋**으로 구성된다
(`0498d7362` docs(review) impl-prep → `ab6fa6863` feat(backend) → `df8be1859` test(backend) →
`abc87b2d4` docs(plan) → `2fa650b5a`/`9d0b876ad` docs(review) → `45c1cdf63` fix(backend) →
`ee755efbe` docs(review) → `db45d1b09` fix(backend) → `bf02fe328` test(backend) →
`4d8118956` docs(review)). `git diff --stat origin/main..HEAD -- codebase/` 로 codebase 범위만
별도 집계해 정확히 **8개 파일·945줄 추가/6줄 삭제**(신규 파일은 `response-contract.ts`/`.spec.ts`
뿐)임을 확인했고, 저장소 어디에도 뮤테이션을 가하지 않았다(`git status --short` 로 확인 — 이번
세션 산출물 디렉터리 외 변경 없음).

이 브랜치는 이전 세 라운드(`13_49_54`→`14_39_31`→`15_12_02`)의 scope reviewer 가 이미 같은
누적 diff 를 상세히 검증했다. `13_49_54`·`14_39_31`·`15_12_02` 세 라운드의 `scope.md` 를 직접
읽고, 그 사이 새로 추가된 커밋(`db45d1b09` 자기참조 순환 가드 fix, `bf02fe328` union
`allowUndeclared` 캐너리+미사용 파라미터 제거, `4d8118956` 직전 라운드 산출물 커밋)만 델타로
검증했다.

## 발견사항

- **[NONE]** 델타 커밋(`db45d1b09`, `bf02fe328`) 둘 다 이번 PR 이 세운 단일 파일
  (`response-contract.ts`/`.spec.ts`)의 결함 수정에 정확히 국한된다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts`,
    `codebase/backend/src/shared/testing/response-contract.spec.ts`
  - 상세: `git show db45d1b09`/`git show bf02fe328` 를 직접 열어 확인했다. `db45d1b09` 는
    자기참조 DTO 가 검사 없이 통과하던 순환 가드 결함과 `oneOf` 미처리를 고치고,
    `bf02fe328` 은 직전 라운드(`15_12_02`)가 낸 INFO#1(union 의 `allowUndeclared` 면제 분기가
    어떤 테스트에도 안 걸림 — 뮤턴트로 실측)·INFO#2(`visitUnion` 의 미사용 `_onPath`
    파라미터)를 커밋 메시지에 그 라운드 경로(`review/code/2026/09/05/15_12_02` INFO#1/#2)로
    명시 인용하며 닫는다. 두 커밋 모두 `codebase/` 안에서 이 두 파일 밖을 건드리지 않고,
    무관한 리팩토링·포맷팅·주석 정리는 없다.
  - 제안: 없음.

- **[NONE]** `4d8118956`(직전 라운드 산출물 커밋)은 `review/code/2026/09/05/15_12_02/**` 신규
  11개 파일만 추가한다 — `codebase/`·`plan/` 변경 없음
  - 위치: `review/code/2026/09/05/15_12_02/` 전체
  - 상세: `git show 4d8118956 --stat` 로 확인 — 신규 파일 전부 이전 라운드가 생성한 리뷰
    산출물(RESOLUTION/SUMMARY/개별 checker 리포트/meta.json)이며, CLAUDE.md 가 명시하는
    "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 저장 위치 규약을
    그대로 따른다. 이 저장소의 다회 리뷰 워크플로(구현→`/ai-review`→fix→재리뷰)가 매 라운드
    남기는 정상 산출물로, 이전 두 라운드의 scope reviewer 가 이미 같은 판단을 내렸다.
  - 제안: 없음.

- **[INFO]** (이전 라운드 지적 재확인, 조치 불요) `codebase/` 8개 파일 외 51개 파일은 전부
  `plan/**`·`review/code/**`·`review/consistency/**` 산출물이며, 그중 일부(`spec-conventions-
  engine-error-code-surface.md`, `spec-draft-nullable-notation-followups.md` 의 `## Overview`
  불일치 항목)는 이번 §5.4/감사 로그 작업과 주제가 다르다
  - 위치: `plan/in-progress/spec-conventions-engine-error-code-surface.md`(취소선 처리된 두
    불릿), `plan/in-progress/spec-draft-nullable-notation-followups.md`(`## Overview` 불일치
    신규 불릿)
  - 상세: 두 항목 모두 같은 브랜치 안의 `--impl-prep 12_48_13` consistency-check 가 낸
    WARNING/INFO 를 그 자리에서 반영한 것으로, `git show 0498d7362`/`abc87b2d4` 로 이미
    직전 라운드(`13_49_54`) scope reviewer 가 근거를 추적해 두었다(CLAUDE.md 메모리 —
    "consistency WARNING 은 BLOCK:NO 여도 반영"). 델타로 새로 추가된 내용은 없다 — 두 파일
    모두 이번 라운드에서 추가 편집되지 않았다(`git log --oneline -- <path>` 로 확인, 마지막
    수정 커밋이 `0498d7362`/`abc87b2d4` 에서 멈춰 있음).
  - 제안: 없음(기존 세 라운드가 이미 같은 결론에 도달했고 재확인만 했다).

## 검증 결과 (문제 없음으로 확인 — 오탐 방지 기록)

- `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`/`.spec.ts` 는 이번 라운드에서
  추가 변경이 없다(마지막 수정 커밋 `45c1cdf63`, 이전 라운드가 이미 검증). `import type { User }`
  는 `Pick<User, 'id'|'name'|'email'>` 에 실사용되고, `leftJoin`+`addSelect` 전환과 반환 타입
  좁힘·캐스트 1곳뿐이라는 이전 라운드 판단이 그대로 유효하다.
- `db45d1b09`/`bf02fe328` 두 델타 커밋의 diff 를 라인 단위로 읽었을 때, 대상 파일(2개) 밖으로
  번지는 수정·포맷팅·불필요한 import 는 없다.
- CHANGELOG.md 는 이번 라운드에서 추가 편집되지 않았다(마지막 수정 `45c1cdf63`) — 새 항목이
  wire 변경 없이 끼어드는 일은 없다.
- `review/consistency/2026/09/05/12_48_13/**`(8개 파일)은 `--impl-prep` 게이트가 착수 전
  의무적으로 남기는 산출물이며 이번 라운드에서 추가 편집되지 않았다.

## 요약

이번 라운드(`15_31_41`)가 검토하는 누적 diff는 이전 세 scope 라운드가 이미 상세히 검증한 것과
동일한 몸통(감사 로그 `User` 컬럼 유출 수정 + §5.4 응답 계약 검증 헬퍼 신설/배선)에 두 개의 작은
델타 커밋(`db45d1b09` 자기참조 순환 가드 fix, `bf02fe328` union 면제 캐너리+미사용 파라미터
제거)과 직전 라운드 산출물 커밋(`4d8118956`)만 얹은 것이다. 두 델타 커밋 모두 커밋 메시지에
그 근거(직전 라운드의 정확한 INFO 항목 경로)를 명시하며 대상 파일(`response-contract.ts`/
`.spec.ts`) 밖을 건드리지 않는다. `codebase/` 변경은 여전히 8개 파일·945줄 추가/6줄 삭제로
좁혀져 있고, 나머지 51개 파일은 전부 `plan/**`/`review/**`의 정상 산출물이다. 새로운
CRITICAL/WARNING 급 범위 이탈은 없다.

## 위험도

NONE
