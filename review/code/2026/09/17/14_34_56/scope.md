# 변경 범위(Scope) 리뷰 — `trigger-save-partial-patch`

## 검증 방법

`git diff origin/main --stat`(46 files, +3252/-34) 로 브랜치 전체 diff 를 확인하고,
`codebase/**` 5개 파일 각각을 `git diff origin/main -- <path>` 로 전량 대조했다. 저장소 파일은
쓰지 않았다(`git status --short` 재확인 불요 — 뮤테이션 없음).

## 발견사항

이번 diff 는 CHANGELOG 가 서술한 단일 결함(`PATCH /api/triggers/:id` 의 락 안 재읽기 뒤 통째
`save` 가 락 밖에서 커밋된 컬럼을 옛 값으로 되돌리는 lost-update)의 수정에 정확히 국한된다.
아래는 관점별 확인 결과이며, 모두 문제 없음(NONE)이다.

- **의도 이상의 변경**: 없음. `codebase/**` 변경은 정확히 5개 파일 —
  `triggers.service.ts`(`update()` 트랜잭션 블록 내부, 651~717행 부근만), `triggers.service.spec.ts`
  (해당 동작을 검증하는 기존 테스트 1건 교체 + 신규 테스트 1건 추가), `trigger-transaction-mock.ts`
  (`save` mock 을 실제 TypeORM 처럼 async·비-`undefined` 반환으로 맞추는 부분만), 신규
  `trigger-update-save-window.e2e-spec.ts`(이 결함 재현 전용 특성 테스트), `jest.config.ts`
  (새 e2e 파일이 여는 `DataSource` 예외를 기존 "e2e 는 pg Client 만 연다" 주석에 한 줄 추가). 전부
  같은 결함/수정과 직접 연결된다.
- **불필요한 리팩토링**: 없음. `triggers.service.ts` 의 저장 payload 를 `const patch` 하나로 통합한
  것(`save` 호출과 `Object.assign` 양쪽에서 재사용)은 1라운드 리뷰 WARNING(payload 중복) 대응이며
  변경 대상과 동일한 코드 블록 내부에 국한된다. 그 밖의 리팩토링(예: `update()` 메서드 분리)은
  하지 않았고, 2라운드 maintainability 리뷰가 제안한 헬퍼 추출도 명시적으로 "이번 PR 스코프는
  아님"으로 유보되어 있다(`review/code/2026/09/17/13_44_39/maintainability.md` INFO#2).
- **기능 확장**: 없음. 새 API·새 옵션·새 설정 플래그 추가 없음. 유일한 신규 산출물(e2e 특성 테스트
  파일)도 기존 기능이 아니라 이번 수정 자체의 근거를 고정하는 테스트다.
- **무관한 수정**: 없음. `git diff origin/main --stat` 전량을 확인했고, `codebase/**` 밖에서는
  `CHANGELOG.md`(신규 항목 서술), `plan/in-progress/trigger-save-partial-patch.md`(작업 추적,
  `spec_impact: none` 명시, "이 PR 이 안 하는 것" 절에서 스펙 갱신을 명시적으로 planner 후속으로
  분리), 그리고 `review/code/**`·`review/consistency/**` 산출물(이 저장소 CLAUDE.md 가 규정한
  `/ai-review`+`/consistency-check` 강제 워크플로의 정규 산출물, 매 라운드 새 타임스탬프 디렉터리에
  생성)만 있다. `spec/**` 등 developer 쓰기 권한 밖 영역은 건드리지 않았다.
- **포맷팅 변경**: 실질 변경과 섞인 의미 없는 공백/줄바꿈 재포맷 없음. `triggers.service.spec.ts`
  의 `Record<string, unknown>` 멀티라인 캐스트처럼 보이는 줄바꿈도 기존 타입 캐스트 방식 변경에
  따른 실질적 코드 형태다.
- **주석 변경**: 이번 diff 의 주석 변경은 전부 바로 아래/위 코드의 실제 동작 설명을 코드와 다시
  맞추기 위한 것이다(예: `triggers.service.ts` 658행 "재읽은 행을 저장 대상으로 쓴다" 머리말을
  "재읽은 행이 저장의 기준이다 — 저장 대상 자체는 아래에서 부분 객체로 좁힌다"로 수정 — 부분 객체
  `save` 도입에 따른 필수 정정). `trigger-transaction-mock.ts` 의 JSDoc 재측정치 갱신(53→"수십
  건")도 그 파일 스스로 못박은 "고칠 땐 다시 재라" 규약을 따른 것이며 이번 PR 이 실제로 그 mock 을
  고쳤으므로 트리거 조건이 성립한다. 무관한 주석 추가/삭제는 없음.
- **임포트 변경**: `codebase/**` diff 에 신규/삭제 import 없음(신규 파일
  `trigger-update-save-window.e2e-spec.ts` 의 import 는 그 파일 자신이 쓰는 `pg`·`typeorm`·
  `supertest`·기존 e2e 헬퍼뿐이다).
- **설정 변경**: `jest.config.ts` 변경은 실행 설정(옵션 값) 변경이 아니라 주석 3줄 추가뿐이며,
  새로 추가된 e2e 스펙이 `DataSource` 를 여는 예외적 패턴에 대해 기존 "detectOpenHandles 는 0 을
  보고하니 hang 나면 db.end() 빠뜨린 spec 을 찾아라"는 운영 지침을 무효화하지 않도록 정확히 그
  경계만 갱신했다. 그 외 설정 파일(`package.json`, `tsconfig*`, ESLint, docker-compose 등) 변경
  없음.

리뷰 산출물(`review/code/2026/09/17/13_44_39/**`, `review/code/2026/09/17/14_11_48/**`,
`review/consistency/2026/09/17/13_04_39/**`)이 diff 에 대량 포함된 것은 이 저장소의 CLAUDE.md 가
"구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"로 규정한 반복 라운드(fix→review→fix)의
정상 부산물이며, 코드 변경 자체의 스코프 일탈이 아니다. 각 라운드의 후속 fix 커밋
(`6d845d8a2`, `d60cc65aa`)도 직전 라운드 SUMMARY 의 WARNING 항목에만 반응한 최소 diff 임을
`git show --stat` 로 개별 확인했다 — 새로운 무관 변경을 끼워 넣지 않았다.

## 요약

브랜치 전체 diff(46 files)를 origin/main 대비 전량 대조한 결과, 실질 코드 변경은 트리거 PATCH
lost-update 수정이라는 단일 의도에 정확히 국한되어 있다. `codebase/**` 5개 파일 모두 그 수정과
직접 연결되고, 그 밖의 변경은 CHANGELOG·plan 추적 문서·강제 리뷰 워크플로 산출물뿐이다. 불필요한
리팩토링, 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅, 무관한 주석/임포트/설정 변경 — 어느
항목에서도 위반을 찾지 못했다.

## 위험도
NONE
