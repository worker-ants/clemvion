# 변경 범위(Scope) 리뷰 — widget-presentation-restore (fresh review, --branch origin/main)

대상: 35개 파일 — 코드 4(`conversation.{ts,test.ts}`/`presentation.{ts,test.ts}`/`presentations.test.tsx` 중
실제 프로덕션 변경 1: `presentation.ts`), plan 1, 이전 `/ai-review` 산출물 11(`review/code/2026/07/10/23_04_23/**`),
`/consistency-check` 산출물 16(`review/consistency/2026/07/10/{22_27_45,22_41_55}/**`), spec 3
(`1-widget-app.md`/`_product-overview.md`/`conversation-thread.md`).

`git diff origin/main...HEAD --stat`(35 files changed, 1970 insertions, 5 deletions) 로 payload 와 파일 목록·라인 수
전량 대조 — payload 밖에 숨은 변경 없음. `git log origin/main..HEAD`(4 commits: `28a358375` spec →
`831ffb16a` fix+test → `da3d2672c` ai-review 반영(23_04_23 라운드 WARNING 1 해소) → `0ed3443ce` RESOLUTION 해시
확정 docs)로 이 리뷰가 이전 라운드(23_04_23)에서 지적된 WARNING 을 이미 반영한 상태의 fresh 재검토임을 확인.

## 발견사항

- **[INFO]** 프로덕션 코드 수정은 여전히 `presentation.ts` `asEnvelope` 1개 함수에 국한 — `TRUNCATION_KEYS`
  화이트리스트(4키) + `truncationMeta()` 헬퍼로 봉인됨(이전 라운드 WARNING/INFO 반영분)
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:107-284`
  - 상세: 23_04_23 라운드에서 `side_effect`/`testing`/`maintainability` INFO 로 지적된 "통째 spread → 장래 payload
    확장 시 렌더 필드 조용히 덮임" 위험이 `TRUNCATION_KEYS` 명시 화이트리스트로 봉인됐고, 병합 우선순위("충돌 시
    top-level truncation 우선")가 JSDoc 에 명문화됐다. 이 변경은 같은 함수·같은 목적(truncation 흡수)의 범위 내
    강화이며 새 함수·새 옵션 도입이 아니다 — scope creep 아님, 오히려 스코프 내 hardening.
  - 등급 사유: 정보 제공, 조치 불필요.

- **[INFO]** 신규 회귀 테스트 7건(파일 1·2·4 합산) 은 모두 이번 fix commit(`da3d2672c`)이 추가한 화이트리스트
  동작(non-object 방어, 미등록 키 비흡수, 충돌 우선순위 lock-in)에 1:1 대응
  - 위치: `presentation.test.ts` 4건(부재/false/충돌 lock-in/non-object/미등록 키), `conversation.test.ts`·
    `presentations.test.tsx` 는 이전 라운드에서 이미 스코프 내로 확인된 4종 렌더+truncation 배너 테스트 그대로
  - 상세: `conversation.test.ts` 신규 import(`classifyPresentation, toCarousel, toChart, toTable, toTemplate`)는
    같은 파일 신규 테스트가 즉시 소비 — 미사용 임포트 없음. 포맷팅/주석 변경은 새 로직을 직접 설명하는 것에
    한정.
  - 등급 사유: 정보 제공, 조치 불필요.

- **[INFO]** `review/code/2026/07/10/23_04_23/**`(11개 파일: SUMMARY·RESOLUTION·meta·7개 카테고리 리뷰·
  `_retry_state.json`)가 이번 diff 에 신규 포함됨은 이전 `/ai-review` 라운드의 의무 산출물이자 그 조치 기록
  - 위치: `review/code/2026/07/10/23_04_23/**`
  - 상세: CLAUDE.md 정보 저장 위치 표·`.claude/skills/code-review-agents` 규약상 코드 리뷰 산출물은
    `review/code/**` 커밋 대상이다. `RESOLUTION.md` 는 WARNING 1건(documentation) + 관련 INFO 5건에 대한 조치를
    commit 해시(`da3d2672c`)까지 명시해 기록했고, 그 조치가 실제로 파일 1~4 diff 에 반영돼 있음을 위에서
    확인했다. 워크플로 disk-write 갭(documentation·side_effect 파일 미기록)에 대한 정정 서술도 사실과 일치 —
    `git log`/파일 존재로 재검증됨. 임의 추가 파일이 아니라 프로젝트가 상시 요구하는 강제 단계의 산출물.
  - 등급 사유: 정보 제공, 조치 불필요.

- **[INFO]** `review/consistency/**` 16개 파일(2 라운드)과 spec 3파일은 이전 스코프 리뷰(23_04_23/scope.md)에서
  이미 NONE 판정된 항목과 동일 — 이번 라운드에서 추가·변경 없음
  - 위치: `review/consistency/2026/07/10/{22_27_45,22_41_55}/**`, `spec/7-channel-web-chat/1-widget-app.md`,
    `spec/7-channel-web-chat/_product-overview.md`, `spec/conventions/conversation-thread.md`
  - 상세: `git diff --stat` 라인 수가 파일 13(`scope.md`, 23_04_23 라운드)에서 서술한 근거와 정확히 일치하며,
    plan `## Rationale` R2-a(백로그 등재 위치 명시)까지 그대로 포함돼 있어 재확인만으로 충분. 새로운 무관 파일
    유입 없음.
  - 등급 사유: 정보 제공, 조치 불필요.

- 그 외 관점(불필요한 리팩토링/기능 확장/무관한 수정/포맷팅/주석/임포트/설정)에서 위배 없음:
  - 불필요한 리팩토링: 없음 — `asEnvelope` 외 함수 시그니처·로직 변경 없음. 이번 라운드의 추가 변경(`TRUNCATION_KEYS`
    화이트리스트)도 동일 함수 내 hardening.
  - 기능 확장: 없음 — 4개 cap 키 화이트리스트는 기존 흡수 범위를 좁히는 방향(제약 강화)이지 신규 기능 아님.
  - 무관한 수정: 없음.
  - 포맷팅 변경: 없음 — 순수 추가 hunk.
  - 주석 변경: 신규/수정 JSDoc 모두 이번 fix(truncation 화이트리스트·우선순위)를 직접 설명. 파일 상단 모듈 헤더
    주석도 `truncation?` 반영으로 갱신돼 `asEnvelope` JSDoc 과 재정합(23_04_23 documentation WARNING 해소분).
  - 임포트 변경: 없음(신규 import 는 전량 신규 테스트가 소비).
  - 설정 변경: 없음 — `package.json`/`tsconfig`/lint 설정 등 미변경.

## 요약

이번 fresh 리뷰(origin/main 기준)는 이전 스코프 라운드(23_04_23) 이후 `da3d2672c`(WARNING 1 fix)와
`0ed3443ce`(RESOLUTION 해시 확정 docs)가 추가된 상태를 다시 검토한 것이다. `git diff --stat`/`git log` 로
35개 파일 전량과 4개 커밋을 대조한 결과, 새로 추가된 코드는 여전히 `presentation.ts` `asEnvelope` 함수
내부에 국한(화이트리스트 봉인 + JSDoc 보강)되고, 신규 테스트는 그 화이트리스트 동작을 정확히 커버한다.
`review/code/23_04_23/**` 11개 파일은 이전 리뷰 라운드의 의무 산출물이자 그 조치 기록으로 CLAUDE.md 규약에
부합하며, `review/consistency/**`·spec 3파일은 이전 라운드에서 이미 검증된 범위와 동일하다. 불필요한
리팩토링·기능 확장·무관한 수정·포맷팅 뒤섞임·주석/임포트 오염·설정 변경은 발견되지 않았다.

## 위험도
NONE
