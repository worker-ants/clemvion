# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 1라운드 리뷰(`review/code/2026/09/20/01_00_21`)가 지적한 문서화 항목 4건(INFO 1·2·7, W1)이 실제로 커밋에 정확히 반영됐음을 코드 대조로 확인
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (파일 헤더 25~29행, `readOnlyDataSourceOptions()` 207~220행, 두 신규 `it` 590~663행)
  - 상세: 커밋 `a71642fe0` 를 직접 열어(`git show a71642fe0`) 다음을 실측했다.
    1. 파일 최상단 JSDoc "**컬럼 층은 양방향이다**" 절 끝에 "그 뒤 두 테스트가 이 층의 빈칸을 막는다 — 비교기 연결이 정말 읽기 전용인가(예방 계층의 회귀), 새로 선언한 기본값이 insert 뒤 돌아오는가. 근거: `plan/complete/column-guard-gaps.md`." 가 정확히 추가됨(RESOLUTION INFO 7 조치와 일치).
    2. "비교기 연결은 읽기 전용이다" 테스트가 `initialize()` 를 `try` 안으로 옮겨 컬럼 층 테스트(568행)와 같은 관용구가 됨(RESOLUTION INFO 1 조치와 일치).
    3. "선언한 DB 기본값은..." 테스트가 `connect()`/`startTransaction()` 을 `try` 안으로 옮기고, `finally` 가 `isTransactionActive` 확인 후 롤백 → 중첩 `finally` 에서 무조건 `release()` 하도록 바뀜(RESOLUTION W2 조치와 일치). 새 인라인 주석("롤백이 실패해도 연결은 풀에 돌려준다 — 새면 뒤 테스트들의 풀 여유를 갉아먹는다", 656행)도 실제 동작과 일치.
  - 제안: 없음(검증 기록).

- **[WARNING]** (스코프 밖 · 우발적 관측) `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 트래커 항목이 이 작업을 `[x]` **완료**로 표시하며 `plan/complete/column-guard-gaps.md` 를 근거로 인용하는데, 그 경로의 파일이 아직 존재하지 않고 실제 plan(`plan/in-progress/column-guard-gaps.md`)의 체크리스트도 `/ai-review 수렴` · `--impl-done` · `트래커 해소 · plan/complete/ 이동` 세 항목이 아직 `[ ]` 로 남아 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4892-4895` (해당 트래커 항목), 대조 대상 `plan/in-progress/column-guard-gaps.md` 체크리스트 섹션
  - 상세: 이 트래커 파일은 이번 diff(`22727e287`..`HEAD`)에 포함되어 있지 않다 — `git diff 22727e287 HEAD -- plan/in-progress/spec-draft-nullable-notation-followups.md` 결과 없음. `git blame` 으로 확인한 결과 해당 3줄은 **현재 워킹트리에서 커밋되지 않은 상태**(`git status --short` 에 `M plan/in-progress/spec-draft-nullable-notation-followups.md` 로 표시)다. 즉 이 리뷰가 받은 diff 가 만들어진 뒤, 리뷰가 진행되는 지금 이 순간 다른 프로세스(오케스트레이터로 추정 — 같은 타임스탬프에 `plan/in-progress/harness-review-gate-followups.md` 에도 이 PR 이 드러낸 `--impl-prep`/`--impl-done` scope 제약을 §O 로 등재하는 중)가 마무리 작업을 진행 중인 것으로 보인다. 실제로 RESOLUTION 이 약속한 "무관한 spec 공백을 트래커에 planner 항목으로 등재" 조치는 같은 파일 4943~4949행에 이미 반영돼 있어, 마무리 흐름 자체는 정상 진행 중으로 보인다. 다만 4892~4895행의 "**2026-09-20 해소** `plan/complete/column-guard-gaps.md`" 라는 문구는 — plan 이동과 체크박스 완결이 프로젝트 컨벤션상 "한 동작" 이어야 함에도 — plan 이 아직 `in-progress/` 에 남아 있고 체크리스트도 안 끝난 시점에 앞서 기록된 상태다. 이 상태로 커밋되면 존재하지 않는 경로를 가리키는 죽은 참조가 된다.
  - 제안: 이 finding 은 이번 diff 의 결함이 아니라 **관측 시점의 워킹트리 상태**에 대한 보고다(뮤테이션 정책에 따라 이 세션은 해당 파일을 고치지 않았다). 마무리 커밋 전에 트래커의 "해소" 문구와 실제 plan 이동 순서를 맞출 것 — 체크리스트 3항목(`/ai-review` 수렴 · `--impl-done` · plan 이동)이 실제로 끝난 뒤에 트래커를 `[x]` 로 닫고 `plan/complete/column-guard-gaps.md` 를 인용해야 한다.

- **[INFO]** README·API 문서·CHANGELOG·환경변수 문서 갱신은 이번 변경 범위에서 불필요함을 재확인
  - 위치: 해당 없음(범위 확인용)
  - 상세: 이번 diff 의 실제 코드 변경은 e2e 테스트 파일 1개(`entity-schema-declarations.e2e-spec.ts`)뿐이며 신규 공개 API·환경변수·설정 옵션·기능 플래그가 없다. 나머지는 `plan/` 문서와 `review/` 산출물(자동 생성 리뷰 리포트, 코드 아님)이다.
  - 제안: 없음.

- **[INFO]** `review/code/2026/09/20/01_00_21/**` · `review/consistency/2026/09/20/00_34_58/**` 산출물이 이번 diff 에 신규 파일로 포함된 것은 프로젝트 컨벤션(리뷰 산출물은 `review/` 에 보존, gitignore 대상 아님)과 일치
  - 위치: 해당 파일들 전체
  - 상세: 1라운드 SUMMARY·RESOLUTION·각 reviewer 산출물, `--impl-prep` consistency 산출물이 커밋에 편입됐다. 인용된 커밋 SHA(`d8fb708d5`, `a71642fe0`, `6949b5a93`)와 트래커 참조는 모두 `git log` 로 실재를 확인했다. 문서화 관점에서 별도 지적 없음.
  - 제안: 없음.

## 요약

핵심 코드 변경(`entity-schema-declarations.e2e-spec.ts`)의 문서화 품질은 1라운드 리뷰에서 지적된 4건(파일 헤더가 신규 테스트를 언급 안 함, `try`/`finally` 관용구 불일치 2건, 연결 자원 정리 취약점)이 커밋 `a71642fe0` 로 정확히 조치됐음을 소스 대조로 확인했다 — 새 JSDoc·인라인 주석은 실제 동작과 전부 일치한다. 다만 이번 diff 범위 밖에서, 리뷰 진행 중인 워킹트리에 커밋되지 않은 상태로 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커가 이 작업을 존재하지 않는 `plan/complete/column-guard-gaps.md` 를 인용하며 완료 처리한 것을 관측했다 — 실제 plan 체크리스트는 아직 3항목이 남아 있다. 이는 이 changeset 자체의 결함이 아니라 동시 진행 중인 마무리 작업의 중간 상태로 보이며, 커밋 전에 순서(테스트 → 리뷰 수렴 → impl-done → plan 이동 → 트래커 닫기)를 맞출 필요가 있다는 점만 기록해 둔다. README·API 문서·CHANGELOG·환경변수 문서 갱신은 이번 범위에서 필요하지 않다.

## 위험도

LOW
