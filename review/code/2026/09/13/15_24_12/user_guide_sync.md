# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

해당 없음.

## 근거

`.claude/config/doc-sync-matrix.json` 의 `rows[]` 14개 trigger(신규 노드 · 노드 schema 변경 ·
신규 UI 문자열 · 위젯 chrome 문자열 · 통합/제공자 변경 · 신규 섹션 디렉토리 · 백엔드 API 변경 ·
신규 BullMQ 큐 · 신규 warning/error code · cross-cutting enum · backend zod ui 값 · handler
output field · 인증/세션 흐름 변경 · AuthConfig enum · 표현식 언어 변경 · 실행·디버깅 흐름 변경 ·
env/runtime 변경 · spec 대규모 변경 · user-guide GUI 흐름 절)와 `PROJECT.md` §변경 유형 → 갱신
위치 매핑 본문을 함께 적재해 이번 변경 파일 71개(`meta.json` 기준, 4개 세션의 리뷰/컨시스턴시
산출물 포함) 전량을 대조했다.

실제 diff 는 다음 세 그룹으로만 구성된다.

1. **문서 정합성 가드 테스트/스캐너 자체의 리네임·확장**
   - `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` (삭제)
   - `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (삭제)
   - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (신규)
   - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (신규)
   - `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` (주석 1줄)

   이 파일들은 매트릭스 trigger 의 **middle column(동반 갱신 대상)** 쪽에 해당하는 존재다 —
   유저 가이드(MDX) 가 인용하는 UPPER_SNAKE 식별자가 backend/packages 소스에 실재하는지
   검증하는 **가드 인프라**이지, 노드·UI 문자열·통합·인증·표현식·실행 흐름 등 매트릭스가
   지키려는 **원본(source-of-truth) 애플리케이션 코드**가 아니다. `codebase/backend/src/nodes/**`,
   `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**`,
   `codebase/backend/src/nodes/core/error-codes.ts`, `codebase/frontend/src/**/*.tsx`,
   `codebase/frontend/src/content/docs/**`, `codebase/frontend/src/lib/i18n/dict/**`,
   `codebase/frontend/src/lib/i18n/backend-labels.ts`, `spec/2-*/**`~`spec/5-*/**`,
   `spec/conventions/**` 어느 glob 도 이번 diff 에 없다(`meta.json` 파일 목록 전수 대조로 확인).

2. **가드 카탈로그 문서 갱신** — `CHANGELOG.md`, `PROJECT.md` 는 위 가드 리네임/확장을
   기술하는 카탈로그 문구만 바뀌었다. 이 표는 doc-sync-matrix 가 아니라 "가드 목록" 섹션이며,
   매트릭스 trigger 어디에도 매칭되지 않는다.

3. **plan/review 산출물** — `plan/in-progress/guide-identifier-existence.md`,
   `plan/in-progress/spec-draft-nullable-notation-followups.md`, 그리고
   `review/code/**`·`review/consistency/**` 하위의 이전 세션(14_41_14 · 15_03_06 · 12_33_41 ·
   14_41_43 · 15_03_36) 산출물들이다. 코드도 문서도 아닌 작업 추적/리뷰 기록이라 매트릭스와
   무관하다.

`plan/in-progress/guide-identifier-existence.md` §D 를 직접 확인한 결과, 이 배치가 등재를
필요로 하는 실제 spec 갱신 대상(`spec/conventions/user-guide-evidence.md §2` 에 가드 3건
카탈로그 반영)은 **의도적으로 이번 diff 범위 밖**이며 developer 권한 밖이라 planner 항목으로
이미 별도 등재돼 있다고 명시한다(`spec_impact: none` frontmatter 와 일치). 즉 "동반 갱신이
누락됐다"가 아니라 "이번 diff 의 스코프에 애초에 매트릭스가 지키는 대상이 없다"는 판정이다.

router 가 본 리뷰어를 활성화했더라도(파일명에 `guide-*`, `docs` 등이 포함돼 트리거된 것으로
추정) 실제 내용은 문서 콘텐츠·i18n·노드·통합·인증·표현식·실행 흐름 코드가 아니라 그것들을
검증하는 **테스트 하네스**이므로 무관 판정이 맞다.

## 요약

매트릭스 trigger 19개 전수 대조 결과 매칭 0건, 동반 갱신 누락 0건. 변경 세트는 유저 가이드
콘텐츠(MDX)·i18n dict·backend-labels·노드/통합/인증/표현식/실행 코드가 아니라, 유저 가이드가
인용하는 식별자의 실재를 검증하는 vitest 가드 테스트(`guide-error-code-*` → `guide-identifier-*`
리네임·스코프 확장)와 그 카탈로그 문서(CHANGELOG.md/PROJECT.md)·plan/review 산출물로만
구성되어 있어 User Guide Sync 관점에서는 해당 없음이다.

## 위험도

NONE
