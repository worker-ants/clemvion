# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 행)을 Read 하고 `PROJECT.md` §변경 유형 →
갱신 위치 매핑 본문을 보조로 확인했다.

## 변경 파일 컨텍스트

`git diff --name-only origin/main...HEAD` 로 실측한 이번 changeset 은 44개 파일이며, 프롬프트에
포함된 파일 목록(1~44)과 정확히 일치한다:

- `CHANGELOG.md`, `PROJECT.md` — 가드 인벤토리 서술 갱신(`guide-error-code-existence` →
  `guide-identifier-existence` 리네임·설계 번복 반영)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` /
  `guide-error-code-scan.ts` — 삭제
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` /
  `guide-identifier-scan.ts` — 신규(대체)
- `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` — 자매 파일
  주석 1줄 갱신(자기참조 파일명 병기)
- `plan/in-progress/guide-identifier-existence.md`,
  `plan/in-progress/spec-draft-nullable-notation-followups.md` — 작업 plan/트래커
- `review/code/2026/09/13/14_41_14/**`(15개), `review/consistency/2026/09/13/12_33_41/**`(8개),
  `review/consistency/2026/09/13/14_41_43/**`(9개) — 이전 라운드의 `/ai-review`·`/consistency-check`
  산출물을 이번 커밋에 편입(이 저장소 관례상 `review/**` 는 커밋 대상)

**제품 코드 표면(노드, TSX, `content/docs/`, i18n dict, `backend-labels.ts`, auth, expression-engine,
`error-codes.ts`, `spec/**`) 변경은 0건.**

## 매칭 분석

매트릭스 21개 행의 trigger 를 이번 44개 파일에 전수 대조했다:

| 매트릭스 trigger | 대조 결과 |
|---|---|
| `new-node` (`codebase/backend/src/nodes/**`) | 매칭 없음 |
| `node-schema-change` | 매칭 없음 |
| `new-ui-string` (`codebase/frontend/src/**/*.tsx`) | 매칭 없음 — `.tsx` 파일 변경 0건 |
| `new-widget-chrome-string` (`channel-web-chat/**/*.tsx`) | 매칭 없음 |
| `integration-provider-change` | 매칭 없음 |
| `new-userguide-section-dir` (`content/docs/*/`) | 매칭 없음 — `content/docs/` 무변경 |
| `backend-api-change` | 매칭 없음 |
| `new-bullmq-queue` | 매칭 없음 |
| `new-warning-code` / `new-error-code` (`error-codes.ts`) | 매칭 없음 — `error-codes.ts` 는 신규 `guide-identifier-scan.ts` 주석·plan 안에서 **문자열로 인용**될 뿐 그 파일 자체는 diff 에 없다(`git diff --name-only` 확인) |
| `new-cross-cutting-enum` | 매칭 없음 |
| `new-backend-ui-zod-value` | 매칭 없음 |
| `new-handler-output-field` | 매칭 없음 |
| `auth-session-flow-change` (`modules/auth/**`) | 매칭 없음 |
| `auth-config-type-enum-change` | 매칭 없음 |
| `expression-language-change` (`packages/expression-engine/**`) | 매칭 없음 |
| `run-debug-flow-change` | 매칭 없음 |
| `env-runtime-change` | 매칭 없음 |
| `spec-major-change` (`spec/2-*/**` 등) | 매칭 없음 — `spec/**` 무변경(3개 checker + 이전 라운드 자체 리뷰도 동일 확인) |
| `userguide-gui-flow-section` (`02-nodes/**.mdx`, `06-integrations-and-config/**.mdx`) | 매칭 없음 |
| `spec-defect-found` (semantic) | 판단 대상은 됨 — 아래 "참고" 참조, 단 이미 정당하게 처리됨(신규 결함 아님) |

변경분 전체가 `codebase/frontend/src/lib/docs/__tests__/` 아래의 **가드 테스트 자신**(에러 코드+
환경변수 식별자 실재성 검증기, `#1330`→`#1331`)의 리네임·축 확장, 그 작업의 `plan/`, 그리고 두
차례(`/ai-review`, `/consistency-check`) 리뷰 산출물로 구성된다. 이들은 유저 가이드가 *무엇을
서술해야 하는가*를 바꾸는 제품 변경이 아니라, 유저 가이드가 *이미 서술한 내용의 진위*를 검증하는
harness 를 바꾸는 메타 변경이다 — 이 reviewer 매트릭스가 대상으로 삼는 "코드 변경 → 가이드 동반
갱신 누락" 방향의 대상 자체가 없다.

이 판정은 같은 diff 를 본 **직전 라운드(`review/code/2026/09/13/14_41_14/user_guide_sync.md`)의
독립 판정과 일치**한다 — 그 리뷰는 매트릭스 20개 행(당시 버전) 전부 매칭 0건으로 "해당 없음"
결론을 냈다. 이번 라운드는 그 판정 이후 추가된 파일(15개 리뷰 산출물 + consistency 산출물 9개,
plan 세부 정정)이 전부 `review/**`·`plan/**` 산출물이라 결론을 바꾸지 않는다.

## 참고 (경계 밖이지만 관측한 사항 — 발견사항으로 올리지 않음)

- `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`가 자칭하는 SoT
  (`spec/conventions/user-guide-evidence.md §2`)에 이 두 파일 및 자매
  `guide-sanitized-message-parity.test.ts`가 아직 등재돼 있지 않다는 gap 은 `documentation.md`·
  `requirement.md`(둘 다 `review/code/2026/09/13/14_41_14/`)와 3개 consistency checker
  (`cross_spec`·`plan_coherence`·`rationale_continuity`, `review/consistency/2026/09/13/12_33_41/`)가
  이미 독립적으로 지적했고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
  미해결 planner 항목(`- [ ]`)으로 등재돼 추적 중이다. 이는 **spec evidence 정합성** 문제(SoT 자칭
  vs 실제 spec 표 갱신)이지, 본 reviewer 가 다루는 "제품 코드 변경 → user-guide MDX/i18n
  dict/`backend-labels.ts` 동반 갱신" 방향의 결함이 아니므로 여기서는 새 발견으로 올리지 않는다.
  `developer` 는 `spec/` 쓰기 권한이 없어 이 PR 이 직접 고칠 수 없다는 점도 plan 에 이미 명시돼
  있다.
- `PROJECT.md` 변경분은 가드 카탈로그 산문(§4 근처, developer workflow 자가 점검 표) 1행 갱신뿐이며,
  본 reviewer 가 매칭하는 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표 자체는 건드리지 않았다.
- `CHANGELOG.md` Unreleased 섹션의 문구 stale(파일명·"허용목록 없음" 서술)과
  `guide-sanitized-message-parity.test.ts:16` 의 죽은 파일명 참조는 이미
  `documentation.md`/`maintainability.md`/`requirement.md`(3개 리뷰어 수렴, `review/code/.../14_41_14/`)가
  WARNING 으로 등재했고 `RESOLUTION.md` 가 "고침"으로 처분 완료를 기록했다 — doc-sync-matrix
  trigger 와는 무관한 별개 축(가드 계열 내부 자기참조 정합성)이라 본 리뷰의 범위 밖이다.

## 위험도 판정 근거

매트릭스 21개 행 중 어느 것도 이번 44개 파일에 매칭되지 않는다 — 매칭 0건, 따라서 동반 갱신
누락도 0건. 영역 무관으로 판정한다.

## 요약

이번 변경 set 은 유저 가이드가 이름 붙인 UPPER_SNAKE 식별자(에러 코드+환경변수)의 실재성을
검증하는 **가드 테스트 자체의 리네임·축 확장**(harness-only, `codebase/frontend/src/lib/docs/__tests__/`)과
그에 딸린 `plan/`·`review/code/`·`review/consistency/` 산출물로만 구성되며, doc-sync-matrix 가
요구하는 제품 코드 표면(노드, TSX, docs MDX, i18n dict, backend-labels, 인증, 표현식 언어,
실행·디버깅, warning/error code 발행, 신규 섹션 디렉토리) 어디에도 해당하지 않는다. 매트릭스
21개 trigger 중 매칭 0건, 동반 갱신 누락 0건 — "해당 없음". 직전 라운드의 동일 reviewer 판정과
결론이 일치한다.

## 위험도

NONE
