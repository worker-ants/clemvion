# 변경 범위(Scope) 리뷰 — widget-presentation-restore

대상: `codebase/channel-web-chat/src/lib/{conversation,presentation}.{ts,test.ts}`,
`codebase/channel-web-chat/src/widget/components/presentations.test.tsx`,
`plan/in-progress/widget-presentation-restore.md`,
`spec/7-channel-web-chat/1-widget-app.md` · `_product-overview.md`,
`spec/conventions/conversation-thread.md`,
`review/consistency/2026/07/10/{22_27_45,22_41_55}/**`(16개 산출물)

`git diff --stat origin/main...HEAD` 로 24개 파일 전체가 payload 와 정확히 일치함을 확인 — payload 밖에 숨은 변경 없음.

## 발견사항

- **[INFO]** 프로덕션 코드 수정은 `presentation.ts` `asEnvelope` 1개 함수, 실질 1줄(`output: { ...payload, ...asRecord(o.truncation) }`)에 국한
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:107-217`
  - 상세: diff 대부분(1,133 insertions 중 production 코드는 11줄)이 테스트·spec 문서·`/consistency-check` 산출물이다. 실제 동작 변경은 `truncation` top-level 필드를 `output` 으로 흡수하는 단일 지점뿐이며, JSDoc 확장(§107-206)은 이 한 줄의 근거(EIA §7.10 대비 spec §10.4)를 설명하는 데 그쳐 범위를 벗어나지 않는다. plan §4-2 의 "TDD red 확인: truncation 2건만 실패, 복원 4종 렌더는 처음부터 통과" 진술과도 정확히 일치 — 의도 이상의 프로덕션 변경 없음.
  - 등급 사유: 정보 제공 목적, 조치 불필요.

- **[INFO]** spec 3개 파일(`1-widget-app.md`, `_product-overview.md`, `conversation-thread.md`) 동시 수정은 plan 이 명시적으로 예정·근거를 남긴 범위
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 두 행, `_product-overview.md` §2 비목표 4행 추가, `spec/conventions/conversation-thread.md` §2.1 1문단 추가
  - 상세: widget-app.md 변경은 plan §4-1 이 사전에 정확히 명시한 내용(부정확한 "알려진 제약(Planned)" 서술 삭제 + 두 shape 수용 명문화 + truncation 계약 명시)과 라인 단위로 일치한다. `_product-overview.md`·`conversation-thread.md` 추가분은 애초 plan §4-1 범위에는 없었으나, 같은 조사 과정에서 나온 `/consistency-check --spec`(22_27_45) WARNING 1건("신규 확정 제약이 SoT 컨벤션 문서에 미등록")·INFO 1건(비목표 목록 누락)의 제안을 그대로 반영한 것이며, plan Rationale R2-a 가 등재 위치 결정을 명시적으로 기록했다. 사후 편입이지만 동일 조사·동일 커밋 내에서 근거를 남긴 채 처리돼 은닉된 범위 확장이 아니다.
  - 등급 사유: 절차상 스코프 밖 파일이 늘었으나 완전히 문서화·정당화됐으므로 조치 불필요.

- **[INFO]** `review/consistency/**` 16개 산출물은 워크플로 필수 산출물이며 코드 스코프 침범 아님
  - 위치: `review/consistency/2026/07/10/22_27_45/**`, `review/consistency/2026/07/10/22_41_55/**`
  - 상세: CLAUDE.md "정보 저장 위치" 표에 따라 일관성 검토 산출물은 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 에 커밋되는 것이 규약이며(`developer`/`project-planner` 워크플로 의무 단계), plan §4-3 체크리스트에도 두 회차(`--spec`, `--impl-prep`)가 실행 완료로 기록돼 있다. 임의 추가 파일이 아니라 의무 단계의 자연스러운 산출.
  - 등급 사유: 정보 제공 목적, 조치 불필요.

- 그 외 관점(불필요한 리팩토링/기능 확장/무관한 수정/포맷팅/주석/임포트/설정)에서 위배 없음:
  - 불필요한 리팩토링: 없음 — `asEnvelope` 외 함수 시그니처·로직 변경 없음.
  - 기능 확장: 없음 — 이미 spec(`0-common.md §10.4`)에 규정된 계약을 코드가 못 지키던 상태를 바로잡는 정정이며, 신규 API·신규 옵션 도입 없음.
  - 무관한 수정: 없음 — 위 INFO 2건을 제외하면 모든 수정이 truncation 흡수 버그 + 그 회귀 테스트 + 직접 근거 spec 문서에 한정.
  - 포맷팅 변경: 없음 — 모든 diff hunk 가 순수 추가 또는 표적 라인 교체.
  - 주석 변경: 새 JSDoc 은 변경된 로직(`truncation` 흡수)을 직접 설명하는 것으로 적절. 기존 주석 삭제/무관한 수정 없음.
  - 임포트 변경: `conversation.test.ts` 의 신규 import(`classifyPresentation, toCarousel, toChart, toTable, toTemplate`)는 같은 파일의 신규 테스트가 즉시 소비 — 미사용 임포트 없음.
  - 설정 변경: 없음 — `package.json`/`tsconfig`/lint 설정 등 미변경.

## 요약

24개 변경 파일 전량을 `git diff --stat origin/main...HEAD` 로 대조한 결과 payload 밖의 숨은 변경은 없다. 프로덕션 코드 변경은 `presentation.ts` `asEnvelope` 의 `truncation` 흡수 1줄로 극히 좁고, 동반된 테스트(`conversation.test.ts`, `presentation.test.ts`, `presentations.test.tsx`)는 그 수정의 직접적 회귀 가드다. spec 3개 파일 수정 중 `1-widget-app.md` 는 plan 이 사전 명시한 범위와 정확히 일치하고, `_product-overview.md`·`conversation-thread.md` 추가분은 같은 조사에서 나온 consistency-check WARNING/INFO 를 그대로 흡수한 것으로 plan Rationale(R2-a)에 근거가 명문화돼 있어 은닉된 스코프 확장이 아니다. `review/consistency/**` 16개 파일은 프로젝트 규약상 커밋 의무가 있는 워크플로 산출물이다. 불필요한 리팩토링·기능 확장·무관한 수정·포맷팅 뒤섞임·주석/임포트 오염·설정 변경은 발견되지 않았다.

## 위험도
NONE
