# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 20개 행) 을 Read 하고 `PROJECT.md` §변경 유형 →
갱신 위치 매핑 본문을 보조로 확인했다.

## 변경 파일 컨텍스트

리뷰 대상 커밋 `d03141e6e` (`fix(guards): 가드가 자기를 만들게 한 결함을 못 잡고 있었다 —
식별자 축으로 넓힌다`) 는 15개 파일을 건드린다:

- `PROJECT.md` — 가드 인벤토리 표 1줄 교체(`guide-error-code-existence.test.ts` →
  `guide-identifier-existence.test.ts` 서술)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` (삭제)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (삭제)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (신규)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (신규)
- `plan/in-progress/guide-identifier-existence.md` (신규 plan)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커 항목 정정)
- `review/consistency/2026/09/13/12_33_41/*` 8개 파일 (`--impl-prep` 산출물)

## 매칭 분석

이 리뷰어의 매트릭스는 **제품 코드 변경**(신규 노드, 노드 schema, TSX UI 문자열, 통합/제공자,
신규 섹션 디렉토리, 인증·세션 흐름, 표현식 언어, 실행·디버깅 흐름, warningCode/errorCode 발행)이
유저 가이드(MDX)·i18n dict·`backend-labels.ts` 동반 갱신을 요구하는지를 본다. 이번 변경 set 을
매트릭스 각 행의 trigger 에 대조했다:

| 매트릭스 trigger | 대조 결과 |
|---|---|
| `new-node` (`codebase/backend/src/nodes/**`) | 매칭 없음 — 노드 디렉토리 무변경 |
| `node-schema-change` | 매칭 없음 |
| `new-ui-string` (`codebase/frontend/src/**/*.tsx`) | 매칭 없음 — TSX 파일 변경 0건 |
| `new-widget-chrome-string` | 매칭 없음 — `channel-web-chat` 무관 |
| `integration-provider-change` | 매칭 없음 |
| `new-userguide-section-dir` (`content/docs/*/`) | 매칭 없음 — `content/docs/` 무변경 |
| `backend-api-change` | 매칭 없음 |
| `new-bullmq-queue` | 매칭 없음 |
| `new-warning-code` / `new-error-code` | 매칭 없음 — `error-codes.ts` 는 이번 diff 에서 **주석으로만 인용**될 뿐 실제 편집 대상이 아니다(가드 헤더 주석의 SoT 참조) |
| `auth-session-flow-change` | 매칭 없음 |
| `expression-language-change` | 매칭 없음 |
| `run-debug-flow-change` | 매칭 없음 |
| `userguide-gui-flow-section` (`02-nodes/**.mdx`, `06-integrations-and-config/**.mdx`) | 매칭 없음 |
| `spec-major-change` (`spec/2-*/**` 등) | 매칭 없음 — `spec/**` 무변경(cross_spec checker 도 동일 확인: "harness-only") |

변경분 전체가 `codebase/frontend/src/lib/docs/__tests__/` 아래의 **가드 테스트 자신**(에러 코드
+환경변수 식별자 실재성 검증기)의 리네임·축 확장, 그 작업의 `plan/`, 그리고 `--impl-prep`
`review/consistency/` 산출물로 구성된다. 이들은 유저 가이드가 *무엇을 서술해야 하는가*를 바꾸는
제품 변경이 아니라, 유저 가이드가 *이미 서술한 내용의 진위를 검증하는 harness* 를 바꾸는
메타 변경이다 — 즉 이 reviewer 매트릭스가 대상으로 삼는 "코드 변경 → 가이드 동반 갱신 누락"
방향의 대상 자체가 없다.

## 참고 (경계 밖이지만 관측한 사항)

- `plan/in-progress/guide-identifier-existence.md` 상단 note 와 `--impl-prep`
  `review/consistency/2026/09/13/12_33_41/SUMMARY.md` WARNING #1·#2 가 이미 지적했듯,
  `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 가 자칭하는 SoT
  (`spec/conventions/user-guide-evidence.md`)의 §2 가드 표·frontmatter `code:` 목록에 이 두
  파일(및 자매 `guide-sanitized-message-parity.test.ts`)이 아직 등재돼 있지 않다. 이는 **spec
  evidence 정합성** 문제이지 이 리뷰어가 다루는 "코드 변경 → user-guide MDX/i18n/backend-labels
  동반 갱신" 문제가 아니므로 본 리뷰의 발견사항으로 올리지 않는다(consistency-checker 영역).
  developer 는 `spec/` 쓰기 권한이 없어 이 PR 이 직접 고칠 수 없다는 점도 plan 에 이미 기록돼
  있다.
- PROJECT.md 변경분은 가드 카탈로그 산문(§4 근처, 개발자 workflow 자가 점검 표)의 파일명 갱신
  1줄뿐이며, 이 리뷰어가 매칭하는 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표 자체는 건드리지
  않았다.

## 위험도 판정 근거

매트릭스 20개 행 중 어느 것도 이번 diff 의 15개 파일에 매칭되지 않는다 — 매칭 0건, 따라서
동반 갱신 누락도 0건. 영역 무관으로 판정한다.

## 요약

이번 변경 set 은 유저 가이드가 이름 붙인 UPPER_SNAKE 식별자(에러 코드+환경변수)의 실재성을
검증하는 **가드 테스트 자체의 리네임·축 확장**(harness-only)과 그에 딸린 `plan/`·
`review/consistency/` 산출물로만 구성되며, 매트릭스가 요구하는 제품 코드 표면(노드, TSX, docs
MDX, i18n dict, backend-labels, 인증, 표현식 언어, 실행·디버깅, warning/error code 발행) 어디에도
해당하지 않는다. 매트릭스 20개 trigger 중 매칭 0건, 동반 갱신 누락 0건 — "해당 없음".

## 위험도

NONE
