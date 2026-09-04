# 변경 범위(Scope) 리뷰

## 검증 방법

- 리뷰 대상 diff 13개 파일 중 "실제 코드/문서" 는 2개(`nullable-type-lie-cast.spec.ts`,
  `entity-nullable-column-type-mismatch.md`)이고 나머지 11개는 직전 리뷰 라운드
  (`review/code/2026/09/04/08_18_51/`)의 산출물(SUMMARY/RESOLUTION/agents 결과/meta/retry_state)이다.
- `git log --oneline -5` 로 이 diff 가 두 커밋(`242c3d5de` 캐너리 2건 추가,
  `6dada6b16` 리뷰 1R INFO#2 후속 수정 + 리뷰 산출물 커밋)에 걸쳐 있음을 확인했다.
  `git show --stat` 로 각 커밋이 건드린 파일 목록을 대조했다.
- 테스트 파일의 "전체 파일 컨텍스트" 게이트 417~444 를 직접 대조해, 직전 라운드가 지적한
  두 번째 대조군의 `findStaleSpecCasts` 생략(INFO#2)이 이미 `b.spec.ts` fixture + 단언
  추가로 해소돼 있음을 확인했다.

## 발견사항

- **[INFO]** 리뷰 대상 diff 에 실제 코드/plan 변경(2파일) 외에 직전 리뷰 라운드
  (`08_18_51`)의 산출물 11개 파일이 신규 파일로 포함돼 있다.
  - 위치: `review/code/2026/09/04/08_18_51/RESOLUTION.md`, `SUMMARY.md`,
    `_retry_state.json`, `meta.json`, `documentation.md`, `maintainability.md`,
    `requirement.md`, `scope.md`, `security.md`, `side_effect.md`, `testing.md`
    (전부 커밋 `6dada6b16` 에서 신설)
  - 상세: 이 저장소 컨벤션(`CLAUDE.md` "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`")상
    구현 완료 후 `/ai-review` 산출물을 코드와 함께 커밋하는 것은 상시 승인된 강제 워크플로다.
    또한 이 11개 파일은 바로 이 두 파일(`nullable-type-lie-cast.spec.ts`,
    `entity-nullable-column-type-mismatch.md`)에 대한 리뷰 결과이므로 "무관한 파일" 이
    아니라 변경 의도와 직결된 프로세스 부산물이다. 스코프 위반은 아니지만, 13개 파일 중
    11개가 리뷰 메타데이터라는 사실이 "무엇이 실질 변경인가" 를 흐릴 수 있어 명시적으로
    기록해 둔다.
  - 제안: 조치 불요.

- **[INFO]** 실질 코드 변경(`nullable-type-lie-cast.spec.ts`)은 단일 hunk(게이트
  372~445)로, 직전 리뷰(10R INFO#12)가 요구한 "관계 데코레이터끼리의 동명 충돌 캐너리"
  범위만 정확히 추가했다 — 기존 테스트·`withFiles` 헬퍼·import·프로덕션 가드 구현
  (`nullable-type-lie-cast-guard.ts`)은 diff 에 등장하지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:372-445`
  - 상세: 두 신규 `it()` 는 이미 존재하는 `[대조군]` 패턴(엔티티 A/B + 선택적 spec 캐스트)을
    그대로 재사용하며, 직전 라운드가 지적한 "두 번째 대조군만 `findStaleSpecCasts` 생략"
    (INFO#2)은 이번 diff 시점 기준으로 `:436, :441` 에 `b.spec.ts` fixture 와
    `findStaleSpecCasts` 단언이 이미 들어 있어 해소된 상태다 — 즉 이 스코프 리뷰 시점에는
    형제 테스트 간 검증 깊이 비대칭도 남아 있지 않다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/entity-nullable-column-type-mismatch.md` 변경은 단일
  hunk(게이트 233~245)로, 코드 변경과 1:1 대응하는 체크박스 승격(`[ ]`→`[x]`)과 그 근거
  서술뿐이다. 인접한 다른 체크박스·서술(예: `247` 이하 별개 planner-턴 후속 항목)은
  손대지 않았다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:233-246`
  - 상세: diff 밖 구간(예: §배치 2, §배치 3, "한 자리만 고치는 버릇" 표 등)은 전체 파일
    컨텍스트에 나타나지만 diff 게이트가 비어 있어 이번 변경에 포함되지 않았음을 확인했다.
  - 제안: 조치 불요.

포맷팅·주석·임포트·설정 파일 변경 중 실질 변경과 무관하게 섞여 들어온 것은 없다. 기능
확장(over-engineering)도 없다 — 프로덕션 가드 로직은 이번 diff 에서 전혀 수정되지 않았고,
순수하게 이미 옳던 동작을 고정하는 캐너리 테스트만 추가됐다.

## 요약

이번 diff 는 실질적으로 두 파일(테스트 2건 추가, plan 체크박스 승격)만 바꾸며 각각 단일
hunk 로 요청된 범위(직전 리뷰 10R INFO#12 의 "관계 데코레이터 동명 충돌 캐너리 부재")에
정확히 대응한다. 나머지 11개 신규 파일은 직전 리뷰 라운드의 산출물로, 이 프로젝트의 상시
승인된 리뷰 워크플로(구현 후 `/ai-review` 결과를 `review/code/**` 에 커밋)에 따른 기대되는
부산물이지 스코프 이탈이 아니다. 프로덕션 가드 구현 파일·import·설정·포맷팅 등 무관한 영역은
전혀 건드리지 않았고, 직전 라운드가 지적한 검증 깊이 비대칭(INFO#2)도 이 diff 시점에는 이미
해소돼 있다. 스코프 관점에서 지적할 결함이 없다.

## 위험도
NONE
