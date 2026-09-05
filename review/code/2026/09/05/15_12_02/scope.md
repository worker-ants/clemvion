# 변경 범위(Scope) Review

## 방법론 메모

프롬프트에 조립된 46개 파일은 `git diff origin/main..HEAD` 기준 **9개 커밋**으로 구성된다
(`0498d7362` docs(review) impl-prep → `ab6fa6863` feat(backend) → `df8be1859` test(backend) →
`abc87b2d4` docs(plan) → `2fa650b5a`/`9d0b876ad` docs(review) → `45c1cdf63` fix(backend) →
`ee755efbe` docs(review)). 각 커밋의 `git show --stat`/전문을 열어 어느 파일이 왜 바뀌었는지
대조했고, `codebase/` 범위만 `git diff --stat origin/main..HEAD -- codebase/` 로 별도 집계해
8개 파일·928줄 추가/6줄 삭제임을 확인했다(추가 파일 없음, 무관한 코드베이스 변경 없음).

## 발견사항

- **[INFO]** 하나의 리뷰 라운드/브랜치가 서로 다른 4가지 성격의 변경을 함께 나른다 — 개별
  커밋은 각각 잘 분리돼 있지만, 냉정한 제3자가 "이 diff 가 범위 안인가" 를 판단하려면 9개
  커밋 이력을 전부 재구성해야 한다
  - 위치: 전체 브랜치(`origin/main..HEAD`) — 대표 커밋 `ab6fa6863`(신규 §5.4 검증자 feat),
    `df8be1859`(검증자를 3개 DTO 로 확장하는 test), `45c1cdf63`(감사 로그 유출 fix),
    `0498d7362`/`abc87b2d4`(plan 문서 유지보수)
  - 상세: (1) `plan/in-progress/spec-conventions-engine-error-code-surface.md` 의 stale
    체크리스트 정정(`0498d7362`)은 이번 PR 의 실제 작업 주제(§5.4 검증자/감사 로그)와 내용상
    전혀 무관하다. 다만 이것은 `--impl-prep` 게이트가 낸 WARNING 2건을 착수 *전*에 해소한
    것으로, CLAUDE.md 가 명시하는 "developer 는 구현 착수 직전 consistency-check --impl-prep
    의무" 절차의 산출물이다 — 무단 스코프 확장이 아니라 게이트가 요구하는 선행 정리다.
    (2) `session-revocation.e2e-spec.ts`/`workflow-crud.e2e-spec.ts`/
    `workflow-execution.e2e-spec.ts` 세 곳에 §5.4 계약 대조를 배선한 것은 이번 PR 이 고친
    감사 로그 유출과는 직접 관련이 없는 엔드포인트들이다. 다만 `git log --diff-filter=A --
    plan/in-progress/spec-draft-nullable-notation-followups.md` 로 확인한 결과 이 문서는
    `cce8a188b`(#1277)에서 이미 존재했고 "§5.4 검증자를 응답 DTO 전반으로 넓히는 스윕"을
    사전에 등재해 둔 추적 항목이다 — 이번 PR 이 사후에 지어낸 정당화가 아니라 선행 plan 이
    승인한 확장이다. (3) `45c1cdf63`(감사 로그 실 유출 수정)은 커밋 메시지가 명시하듯
    `/ai-review Critical #1` 의 same-turn 수정으로, CLAUDE.md 의 "구현 완료 후 자동
    review/fix 는 상시 승인된 강제 의무" 조항이 그대로 적용되는 사례다.
    세 갈래 모두 개별적으로는 이 저장소의 명시 워크플로 규약에 부합하지만, 결과적으로 "감사
    로그 비밀번호 해시 유출 수정" 이라는 표제 아래 (a) 무관 plan 문서 정리, (b) 별개
    엔드포인트 3곳으로의 테스트 인프라 확장 기능까지 한 리뷰 배치에 섞여 들어간다.
  - 제안: 조치 불요(각 항목이 근거를 가지고 있음을 확인) — 다만 다음에 유사 배치를 리뷰할
    때는 "이 파일이 왜 이 PR 에 있는가" 를 판단하려는 리뷰어가 커밋 이력 재구성 없이도 알 수
    있도록, PR 설명/CHANGELOG 요약에 "이번 diff 는 A(보안 수정)·B(§5.4 스윕 계속)·C(게이트
    선행 정리) 세 갈래로 구성된다" 는 한 줄 인덱스를 남기면 다음 리뷰가 더 빨라진다.

## 검증 결과 (문제 없음으로 확인 — 오탐 방지 기록)

- `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` 의 변경은 `import type
  { User }` 추가(실제로 `Pick<User, 'id'|'name'|'email'>` 에 사용, 죽은 임포트 아님) ·
  `leftJoinAndSelect` → `leftJoin`+`addSelect` · 반환 타입 좁힘 · 캐스트 1곳뿐이다. 포맷팅만
  바뀐 줄, 무관한 리팩토링, 사용하지 않는 임포트는 없다.
- `git diff --stat origin/main..HEAD -- codebase/` 로 codebase 전체를 집계한 결과 정확히
  8개 파일(928 insertions/6 deletions)만 바뀌었다 — 신규 파일은 `response-contract.ts`/
  `.spec.ts` 뿐이고, 나머지는 diff 에 조립된 6개 e2e/unit 스펙과 서비스 파일이 전부다.
  프롬프트에 열거된 나머지 38개 파일은 전부 `plan/**`·`review/code/**`·
  `review/consistency/**` 산출물로, CLAUDE.md 가 developer 의 쓰기 권한 영역으로 명시하고
  있고 이 저장소의 표준 다회 리뷰 워크플로(구현→`/ai-review`→fix→재리뷰)가 매 라운드마다
  남기는 산출물이다 — 무단 추가가 아니다.
- CHANGELOG.md 항목은 이번 PR 이 실제로 wire 를 바꾼 것(감사 로그 응답에서 26키→3키)에
  정확히 대응하고, 다른 무관 항목을 끼워 넣지 않았다.
- 주석 추가(서비스 파일의 join 설명 주석, e2e 파일들의 §5.4 대조 이유 주석)는 전부 이번
  fix/feature 의 근거를 설명하는 내용이며, 기존 무관 주석을 건드리거나 지운 곳은 없다.

## 요약

핵심 코드 변경(`codebase/` 8개 파일)은 "감사 로그 응답의 `User` 전 컬럼 유출을 3필드로
좁히고, 그 유출을 놓친 §5.4 검증자를 중첩까지 내려가게 고친다"는 단일 축으로 깔끔하게
좁혀져 있고 무관한 리팩토링·포맷팅·임포트 정리는 없다. 프롬프트에 함께 조립된 나머지 38개
파일은 전부 `plan/**`/`review/**` 산출물로, developer 쓰기 권한과 이 저장소의 다회 리뷰
워크플로가 규정하는 정상 산출물이다. 유일하게 주목할 지점은 (1) 무관 주제인
`spec-conventions-engine-error-code-surface.md` plan 정리가 `--impl-prep` 게이트 선행
절차로서 같은 브랜치에 섞여 있는 점과 (2) §5.4 검증자를 감사 로그와 무관한 3개 엔드포인트로
확장한 부분인데, 전자는 CLAUDE.md 의 게이트 의무, 후자는 #1277 부터 이어진 기존 plan
추적 항목(`spec-draft-nullable-notation-followups.md`)으로 각각 근거가 있어 무단 스코프
확장으로 보지 않는다. 다만 이 근거를 확인하려면 9개 커밋 이력을 재구성해야 했다는 점은
차기 PR 설명에 반영할 가치가 있는 INFO 다.

## 위험도

NONE
