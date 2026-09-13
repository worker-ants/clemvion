# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

해당 없음.

## 근거

`.claude/config/doc-sync-matrix.json` (`rows[]` 19개 trigger: 새 노드 추가 · 노드 schema 변경 ·
신규 UI 문자열(TSX) · 위젯 chrome 문자열 · 통합/제공자 변경 · 유저 가이드 신규 섹션 디렉토리 ·
백엔드 API 변경 · 신규 BullMQ 큐 · 신규 warningCode · 신규 errorCode · cross-cutting enum ·
backend zod ui 값 · handler output field · 인증/권한/세션 흐름 변경 · AuthConfig enum 변경 ·
표현식 언어 변경 · 실행·디버깅 흐름 변경 · env/runtime 변경 · spec 대규모 변경 ·
user-guide GUI 흐름 절)와 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 적재해, 이번
변경 세트(`meta.json` 기준 125개 파일, 4개 세션치의 review/consistency 산출물 포함)를 전량
대조했다.

실제 diff 는 세 그룹으로만 구성된다.

1. **문서 정합성 가드 테스트/스캐너 자체의 리네임·확장** (matrix 의 *middle column*, 즉
   "동반 갱신 대상"에 해당하는 가드 인프라이지 matrix 가 지키려는 *source-of-truth 애플리케이션
   코드*가 아님)
   - `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` (삭제)
   - `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (삭제)
   - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (신규)
   - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (신규)
   - `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` (자매
     파일 crossref 주석 1줄 — 신·구 이름 병기)
2. **가드 카탈로그 문서 갱신** — `CHANGELOG.md`, `PROJECT.md` 는 위 가드 리네임/확장을 서술하는
   "가드 목록" 카탈로그 문구만 바뀌었다. 이 표는 doc-sync-matrix 가 아니며 매트릭스 trigger
   어디에도 매칭되지 않는다.
3. **plan/review 산출물** — `plan/in-progress/guide-identifier-existence.md`,
   `plan/in-progress/spec-draft-nullable-notation-followups.md`, 그리고
   `review/code/2026/09/13/{14_41_14,15_03_06,15_24_12,15_42_54}/**` ·
   `review/consistency/2026/09/13/{12_33_41,14_41_43,15_03_36,15_23_53,15_43_24}/**` 하위의
   이전 라운드 산출물(RESOLUTION/SUMMARY/meta.json/개별 리뷰 리포트). 코드도 유저 가이드 콘텐츠도
   아닌 작업 추적/리뷰 기록이라 매트릭스와 무관하다.

`meta.json`(파일 20 등) 에 열거된 전체 변경 파일 목록과 `git log --oneline -5`(라운드별 fix
커밋)를 대조한 결과, 매트릭스 trigger glob 이 가리키는 어떤 경로도 이번 diff 에 없다 —
`codebase/backend/src/nodes/**` · `codebase/backend/src/modules/auth/**` ·
`codebase/backend/src/nodes/core/error-codes.ts` · `codebase/packages/expression-engine/**` ·
`codebase/frontend/src/**/*.tsx` · `codebase/frontend/src/content/docs/**` ·
`codebase/frontend/src/lib/i18n/dict/**` · `codebase/frontend/src/lib/i18n/backend-labels.ts` ·
`codebase/frontend/src/lib/docs/locale.ts` · `spec/2-*/**`~`spec/5-*/**` ·
`spec/conventions/**` 전부 매치 0건.

신규/변경 TS 파일(`guide-identifier-existence.test.ts`, `guide-identifier-scan.ts`) 은 유저
가이드(MDX) 가 **인용하는** UPPER_SNAKE 식별자(에러 코드 + 환경변수)가 backend/packages
소스나 env 선언처에 실재하는지 검증하는 **정적 텍스트 스캐너**다 — 이 가드 자신이 매트릭스의
"동반 갱신 대상"(가이드 정합성 검증 인프라)이지, 노드·통합·인증·표현식·실행 흐름처럼 매트릭스가
동반 갱신을 요구하는 *원본* 코드가 아니다. 따라서 이 파일들이 바뀌었다고 해서 `02-nodes/*.mdx`,
`dict/{ko,en}/*.ts`, `backend-labels.ts`, `locale.ts` 등을 동반 갱신해야 할 이유가 없다.

`plan/in-progress/guide-identifier-existence.md` §D 를 확인한 결과, 이 배치가 필요로 하는
유일한 spec 갱신 대상(`spec/conventions/user-guide-evidence.md §2` 가드 가족 카탈로그 반영)은
**developer 권한 밖**이라 이번 diff 범위에서 의도적으로 제외되고 planner 백로그 항목으로 이미
등재돼 있다(`--impl-done` 라운드 1~4 전부 `BLOCK: NO`, developer 쪽 잔여 0 으로 확인). 즉 "동반
갱신이 누락됐다"가 아니라 "이번 diff 의 스코프에 애초에 본 매트릭스가 지키는 대상(노드·UI
문자열·통합·인증·표현식·실행 흐름 등 사용자 대면 콘텐츠/코드)이 없다"는 판정이다. 이 spec
갱신 항목은 `spec/conventions/**` 소관이라 본 reviewer(user-guide-sync, `codebase`/frontend
docs·i18n 초점)의 trigger 정의 범위 밖이기도 하다.

router 가 파일명(`guide-*`, `docs` 등)으로 본 리뷰어를 활성화했을 가능성이 있으나, 실제 내용은
유저 가이드 콘텐츠·i18n dict·backend-labels·노드/통합/인증/표현식/실행 흐름 코드가 아니라 그것들
자체를 검증하는 **테스트 하네스**이므로 무관 판정이 맞다. 동일 changeset 을 대상으로 한 직전 3개
라운드(`15_24_12`, 그리고 그 이전 라운드들)의 `user_guide_sync.md` 도 독립적으로 동일하게
"해당 없음 / NONE"으로 판정했으며, 이번 라운드(4번째)의 추가 diff(WARNING #1 fixture 보강 등)도
같은 test 파일 내부 조정이라 판정을 바꾸지 않는다.

## 요약

매트릭스 trigger 19개 전수 대조 결과 매칭 0건, 동반 갱신 누락 0건. 변경 세트는 유저 가이드
콘텐츠(MDX)·i18n dict·backend-labels·노드/통합/인증/표현식/실행 코드가 아니라, 유저 가이드가
인용하는 식별자(에러 코드+환경변수)의 실재를 검증하는 vitest 가드 테스트 자체의 리네임·스코프
확장(`guide-error-code-*` → `guide-identifier-*`)과 그 카탈로그 문서(CHANGELOG.md/PROJECT.md)·
plan/review 산출물로만 구성돼 있어 User Guide Sync 관점에서는 해당 없음이다. 유일한 spec 동반
갱신 필요 항목(`user-guide-evidence.md §2` 가드 3건 미등재)은 `spec/conventions/**` 소관이라
본 매트릭스(codebase 대면 문서/i18n) 범위 밖이며, 이미 4라운드 연속 `--impl-done` 이
developer 쪽 조치 없음으로 수렴 확인했고 planner 백로그에 완결된 형태로 등재돼 있다.

## 위험도

NONE
