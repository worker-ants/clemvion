# 문서화(Documentation) 리뷰 — update-returning-tuple-shape (누적본, 라운드 3)

## 검토 방법

`origin/main...HEAD` 누적 diff(11개 코드/plan 파일 + 이전 두 라운드 `/ai-review`·`/consistency-check`
산출물 39개, 총 50개)를 프롬프트 기준으로 훑고, 프롬프트가 크기 제한으로 생략한 파일
(`knowledge-base.service.ts`, `update-returning-tuple-shape.md`, `retry-turn-terminal-guard.md` 등)은
`Read`/`Grep`/`git log`로 실제 워크트리 소스를 직접 열어 대조했다. 이전 두 라운드가 이미 발견·조치한
CRITICAL(모순 주석)은 diff 로 직접 재확인해 실제로 해소됐음을 검증했으므로 재기재하지 않는다.

## 발견사항

- **[CRITICAL]** plan 문서가 "두 plan 모두에 소급 정정 배너를 넣었다"고 적었지만 실제로는 한 곳뿐이다 — 12+ 라운드짜리 다른 plan 은 정정되지 않은 채 여전히 `in-progress` 로 열려 있다
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:105` (거짓/과장 완료 서술), 대상
    `plan/in-progress/retry-turn-terminal-guard.md` (배너 부재 — 파일 전체에 `8332d9a20`·
    `persisted`·`소급`·`⚠` 관련 언급 0건, `Grep` 로 확인)
  - 상세: `update-returning-tuple-shape.md:94-98`은 스스로 정확히 진단한다 — `retry-turn-terminal-guard.md`
    가 12+ 라운드에 걸쳐 검증한 "동시 cancel 방어"는 `retry-turn.service.spec.ts:101`의
    `updateExecutionStatus: jest.fn().mockResolvedValue(true)` **boundary mock** 뒤에 숨어 있었고,
    그 mock 경계 너머 실제 `persisted` 값(이번 PR 이 고친 바로 그 버그로 인해 4개월간 상수 `true`)은
    어느 라운드도 검사한 적이 없다고 명시한다. 이는 `ie-resume-turn-boundary-cancel.md`(6~8차
    라운드)가 같은 버그 위에서 "닫았다"고 오판했던 것과 **완전히 동형(同型)**인 문제다. 그런데 이
    plan 은 line 105에서 "두 plan 모두에 소급 정정 배너를 넣고"라고 단정했지만, 실제로 이번 PR 의
    `git diff origin/main...HEAD --stat -- plan/`에는 `ie-resume-turn-boundary-cancel.md` 만 있고
    `retry-turn-terminal-guard.md` 는 없다(`git log --oneline origin/main..HEAD -- plan/in-progress/retry-turn-terminal-guard.md` 결과도 0건, `git status`도 clean). `retry-turn-terminal-guard.md` 는
    `status: in-progress`로 아직 `plan/complete/`에 옮겨지지 않았고, `spec_impact` 주의 배너까지 갖춘
    민감한 P1 plan이다 — 이 소급 정정 누락 상태로 완료 처리되면, 실제로 한 번도 발동하지 않았을 수
    있는 "동시 cancel 방어"가 코드/문서 양쪽에서 영구히 "검증 완료"로 굳는다. 이 세션은 이미 같은
    부류의 거짓 완료 선언으로 CRITICAL 을 두 번 냈다(`20_36_35` requirement, `22_45_24`
    testing/requirement — "이미 덮는다"/"아래 두 테스트"가 검증 없이 쓴 문장이었던 사례들). 이번이
    세 번째 재발이며, 이번엔 코드가 아니라 **plan 문서 자체의 서술 정확성**이 대상이라는 점에서
    이 리뷰 관점(문서화)의 핵심 결함이다. 참고로 `review/consistency/2026/08/13/22_45_25/plan_coherence.md`
    (WARNING 1)가 이미 이 문제(`retry-turn-terminal-guard.md` 누락)를 정확히 지목했는데, 같은
    문서의 다른 항목(WARNING 2 — KB CAS 락 spec 두 곳 footnote 위임 누락)은 plan `후속` 절에
    반영됐지만(현재 `update-returning-tuple-shape.md:184-191`에 `8-embedding-pipeline.md`·
    `10-graph-rag.md` 가 추가돼 있음), WARNING 1(`retry-turn-terminal-guard.md` 배너)만 빠졌다.
  - 제안: `retry-turn-terminal-guard.md`에 `ie-resume-turn-boundary-cancel.md`와 동일한 형태의
    소급 정정 배너를 추가하고(왜 1R~12R 의 "닫았다" 판정이 boundary mock 뒤에서 나왔는지, 실제
    `persisted` 는 `8332d9a20` 이전엔 상수 `true` 였다는 것), `plan/complete/` 이동 전 그 plan 의
    핵심 판정을 코드로 재검증할 것. `update-returning-tuple-shape.md:105` 의 "두 plan 모두"라는
    서술도 그 전까지는 "한 plan 은 정정, 다른 한 plan 은 후속 필요"로 정정해야 한다.

- **[WARNING]** RESOLUTION 이 "조치"로 분류한 항목의 실제 코드는 여전히 미수정 상태이고, 그 잔여 항목은 plan 후속 체크리스트 어디에도 등재돼 있지 않다
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:533`
    (`retryFailedDocuments` 의 `scope === 'embedding'` 분기, `const rows = await this.dataSource.query<{ id: string }[]>(...)`), 대비 `review/code/2026/08/13/22_45_24/RESOLUTION.md:32`
    (WARNING #2 처분 "조치")
  - 상세: 이 줄은 `UPDATE ... RETURNING id` 결과를 여전히 "행 배열"(`<{ id: string }[]>`)이라고
    주장하는 제네릭을 달고 있는데, 바로 세 줄 뒤(`:544`)에서 `updateReturningRows<{ id: string }>(rows, ...)`
    로 튜플을 언랩한다 — **이 PR 전체의 근본 원인("타입 주장과 실제 shape 불일치를 아무도 검증하지
    않았다")과 동일한 패턴이 같은 diff 안에 그대로 남아 있다.** 33줄 아래의 짝인 graph 분기(`:569`)는
    `const rows: unknown = await this.dataSource.query(...)`로 정확히 고쳐져 있어 나란히 보면 하나만
    미수정임이 바로 드러난다. `RESOLUTION.md`(`22_45_24`) WARNING #2는 이 지점을 "조치"로 표시했지만,
    실제 텍스트를 읽으면 그 "조치"는 코드 수정이 아니라 **"7곳"이라던 완료 선언을 "6곳"으로 정정한
    것**뿐이다(`git log --oneline origin/main..HEAD -- codebase/.../knowledge-base.service.ts` 결과
    이 파일은 최초 수정 커밋(`8332d9a20`) 이후 손댄 적이 없음을 확인). 원 문서화 리뷰(`22_45_24/documentation.md`)가 제시한 두 대안("코드를 unknown 으로 통일" 또는 "RESOLUTION 서술을
    6곳+1곳 후속으로 정정") 중 실질적으로는 후자만 반쯤 이행됐고, 그 "1곳 후속"이
    `plan/in-progress/update-returning-tuple-shape.md`의 어떤 체크리스트·후속 항목에도 등재되지
    않아 추적이 끊겼다. 기능 결함은 아니다 — `updateReturningRows` 가 런타임에 두 shape 을 모두
    안전하게 처리하므로 동작은 정확하다. 순수하게 타입 정직성/문서 정확성 문제다.
  - 제안: `knowledge-base.service.ts:533` 의 `.query<{ id: string }[]>` 를 `: unknown` 으로 통일하거나
    (한 줄짜리 변경), 그럴 계획이 없다면 `update-returning-tuple-shape.md` 후속 절에 이 잔여 항목을
    명시적으로 등재해 "왜 아직 안 고쳤는지"가 다음 세션에서도 보이게 할 것.

- **[INFO]** `assert-row-array.ts` 의 JSDoc 이 여전히 `updateReturningRows`/SELECT-vs-UPDATE 분담을 상호 참조하지 않는다 (2회째 반복 지적, 선택사항)
  - 위치: `codebase/backend/src/common/utils/assert-row-array.ts:1-15`
  - 상세: 이 분담("SELECT → `assertRowArray`, UPDATE/DELETE → `updateReturningRows`")은
    `assert-row-array.spec.ts:76-81`의 신규 주석과 `update-returning-rows.ts` JSDoc 의 관용구 표에는
    나타나지만, 두 함수 자체의 JSDoc 상단에는 서로를 가리키는 포인터가 없다. `22_45_24/documentation.md`
    가 이미 "선택 사항, 차단 아님"으로 같은 항목을 제안했고 이번 라운드에도 반영되지 않았다 — 계속
    보류돼도 무방하지만, 세 번째 라운드까지 반복되는 항목이라 기록만 남긴다.
  - 제안: 필수 아님. 여력이 되면 `assertRowArray` JSDoc 상단에 한 줄 추가.

- **[INFO]** `auth-oauth.service.ts` 호출부만 `detail` 진단 인자를 생략한다 — 다른 8곳은 전부 채워져 있다
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:146`
    (`updateReturningRows<AuthOAuthState>(await this.dataSource.query(...))` — 두 번째 인자 없음)
  - 상세: `update-returning-rows.ts` JSDoc 은 `detail`을 "종전 `assertRowArray` 가 주던 호출부
    문맥을 잃지 않기 위함"이라고 명시하고, KB 5개 호출부(`knowledge-base.service.ts:346,544,578,729,751`)와
    execution-engine 2곳(`:2947,8550`)은 실제로 `` `KB re-extract CAS 락, kb ${id}` `` 류의 문맥을
    싣는다. `auth-oauth.service.ts` 는 뒤늦게(별도 커밋 `08d3c7fa3`) 추가된 8번째 지점이라 이
    일관성 있는 패턴에서 빠졌다. 동작에 영향은 없다(`Array.isArray` 실패시에만 쓰이는 값). 이미
    `review/code/2026/08/13/22_45_24/concurrency.md` INFO 로 지적된 항목이며 지금도 그대로다.
  - 제안: `` updateReturningRows<AuthOAuthState>(..., `OAuth state 소비, provider ${provider}`) `` 류로
    한 줄 추가하면 나머지 8곳과 일관돼진다. 필수는 아님.

- **[INFO]** (확인) CHANGELOG 미기재는 유실이 아니라 근거와 함께 추적되고 있음
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:172-175` (`후속` 체크리스트),
    `review/code/2026/08/13/20_36_35/RESOLUTION.md:63` (WARNING #3 "넘김" 근거)
  - 상세: `CHANGELOG.md`(리포 루트)를 확인한 결과 이번 건 관련 Unreleased 항목은 아직 없다. 다만
    이는 "잊혔다"가 아니라 명시적으로 미룬 것 — RESOLUTION 이 "배포 영향 서술과 함께 써야 의미가
    있어 릴리스 시점 판단으로 미뤘다"고 근거를 남겼고, plan 후속 체크리스트에도 무엇을 적을지(소셜
    로그인 상시 실패·admission cap 미집행·KB CAS 락 미작동·재큐 `documentId: undefined`)까지
    구체적으로 등재돼 있다. 이 저장소가 이미 여러 차례 겪은 "미룬 항목이 plan 에 안 남아 유실"
    패턴과 달리 이번은 제대로 추적되고 있다 — 문제 없음, 참고용 확인.
  - 제안: 없음.

- **[INFO]** (확인) 이전 라운드 CRITICAL(모순되는 옛 주석)은 실제로 완전히 해소돼 있다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2916-2945`
    (`admitExecutionOrDefer`)
  - 상세: 직접 `Read`로 재확인 — "`RETURNING id` 이므로 실제 shape 은 행 배열이다"라는 옛 문장은
    삭제됐고, 새 주석("제네릭을 달지 않는다... 실제 shape 은 `[rows, rowCount]` 다")으로 통합돼
    있다. `20_36_35/RESOLUTION.md` CRITICAL 2의 "조치 완료" 서술과 실제 코드가 일치한다.
  - 제안: 없음.

## 요약

이 diff 의 실제 소스 변경(`update-returning-rows.ts`/`.spec.ts` 신설, execution-engine·knowledge-base·
auth-oauth 8개 호출부 치환)은 문서화 수준이 높다 — 헬퍼 JSDoc 은 실측 DB 프로브 결과·과거 3개
관용구와의 관계·신규 지점이 따라야 할 규칙을 표로 명시하고, 각 호출부 주석은 "무엇이 왜 깨져
있었는지"를 정확히 설명하며 이전 라운드가 지적한 모순 주석 CRITICAL 도 실제로 제거돼 있다. 다만
이 PR 이 반복해서 스스로 경고해 온 "완료 선언이 사실과 어긋난다"는 실패 패턴이 이번에도 재발했다 —
plan 문서(`update-returning-tuple-shape.md:105`)가 "두 plan 모두에 소급 정정 배너를 넣었다"고
적었지만, 12+ 라운드짜리 `retry-turn-terminal-guard.md` 는 실제로 정정되지 않은 채 여전히
`in-progress` 로 열려 있다 — 이 plan 이 그대로 `plan/complete/` 로 이동하면 실효되지 않았을 수 있는
"동시 cancel 방어" 검증이 영구 기록으로 굳는다(CRITICAL). 부수적으로 `RESOLUTION.md`(`22_45_24`)가
"조치"로 표시한 KB `retryFailedDocuments` 임베딩 분기의 제네릭 타입 잔존 문제는 실제로는 서술만
정정됐을 뿐 코드도 후속 등재도 안 된 채 남아 있다(WARNING). CHANGELOG 지연은 근거와 함께 정상
추적되고 있어 문제 없다. 그 외에는 두 차례 이미 지적된 저위험 INFO(헬퍼 상호 참조 부재,
`detail` 인자 불균일)가 반복 확인됐을 뿐이다.

## 위험도

CRITICAL — 기능 결함은 아니지만, plan 문서의 "완료" 서술이 실제 상태와 어긋난 채 남아 있고 그
대상(`retry-turn-terminal-guard.md`)이 아직 `plan/complete/` 로 닫히지 않은 P1 plan 이라 병합 전
정정하지 않으면 잘못된 "검증 완료" 판정이 그대로 굳을 위험이 있다. 코드 자체의 문서화 품질은 높다.
