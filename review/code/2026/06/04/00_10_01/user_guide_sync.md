# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 매트릭스 적재 결과

`/Volumes/project/private/clemvion/.claude/config/doc-sync-matrix.json` 로드 완료 (19 rows). `PROJECT.md` §변경 유형 → 갱신 위치 매핑 보조 참조.

## 변경 파일 식별

총 40개 파일 변경 (git diff HEAD~5..HEAD 기준). 유형별 분류:

**codebase/ (5건):**
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` (신규)
- `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` (신규)
- `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` (신규)
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (신규)
- `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` (신규)

**spec/ (35건):**
- `spec/2-navigation/` 하위 다수 (anchor 수정, 영역 맵 추가)
- `spec/4-nodes/` 하위 다수 (anchor 수정)
- `spec/5-system/` 하위 다수 (anchor 수정, 영역 맵 추가)
- `spec/7-channel-web-chat/_product-overview.md` (구성요소 spec 링크 추가)
- `spec/conventions/` 하위 다수 (anchor 수정, Gate C/D 추가)
- `spec/data-flow/8-notifications.md` (anchor 수정)

**review/ (기타):** 이전 리뷰 산출물 파일들

## trigger 매칭

매트릭스 19개 trigger 중 glob 매칭:

| trigger id | glob 패턴 | 매칭 여부 | 근거 |
|---|---|---|---|
| `new-node` | `codebase/backend/src/nodes/**` | NO | backend nodes 변경 없음 |
| `node-schema-change` | `codebase/backend/src/nodes/**` | NO | 동상 |
| `new-userguide-section-dir` | `codebase/frontend/src/content/docs/*/` | NO | 신규 docs 섹션 디렉토리 없음 |
| `new-error-code` | `codebase/backend/src/nodes/core/error-codes.ts` | NO | 해당 파일 변경 없음 |
| `expression-language-change` | `codebase/packages/expression-engine/**` | NO | 해당 패키지 변경 없음 |
| `userguide-gui-flow-section` | `codebase/frontend/src/content/docs/02-nodes/**.mdx` 등 | NO | MDX 파일 변경 없음 |
| **`spec-major-change`** | `spec/2-*/**`, `spec/4-*/**`, `spec/5-*/**`, `spec/conventions/**` | **YES** | 다수 spec 파일 변경됨 |

semantic trigger (`new-ui-string`, `integration-provider-change`, `new-warning-code`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field`, `auth-session-flow-change`, `auth-config-type-enum-change`, `run-debug-flow-change`, `env-runtime-change`, `spec-defect-found`) — 모두 semantic 판단 결과 매칭 없음. TSX 신규 한국어 리터럴 없음, 신규 provider/warningCode/errorCode/enum 없음, auth 흐름 변경 없음.

## 변경 내용 성격 분석

spec/ 하위 35개 파일의 diff 전수 검토 결과, **모든 변경이 다음 세 유형의 내부 정합 수정**에 한정됨:

**유형 A — heading 변경으로 깨진 anchor fragment 일괄 수정 (최다 빈도):**
- `#44-실행-진행-이벤트` → `#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input`
- `#1-conditiongroup-구조` → `#1-condition-구조`
- `#7-integration-노드-3종` → `#7-integration-노드-4종`
- `#9-presentation-노드-6종` → `#9-presentation-노드-5종`
- `#7-dry-run` → `#7-dry-run-모드-정의`
- `#42-hmac-서명` → `#42-hmac-서명--authconfigtypehmac`
- `#55-표현식-해석` → `#55-표현식-해석-단계`
- 기타 다수 — 모두 heading 슬러그 변경을 따라가는 기계적 수정

**유형 B — 상대 경로 오류 수정:**
- `../../1-data-model.md` → `../1-data-model.md` (동일 폴더 내 파일 참조 경로 수정)
- `../4-execution-engine.md` → `4-execution-engine.md` (동일 디렉토리 참조로 수정)
- `plan/in-progress/parallel-p2.md` → `plan/in-progress/parallel-p2-followups.md` (파일명 변경 반영)

**유형 C — 영역 index 완전성 추가 (item 6):**
- `spec/5-system/_product-overview.md`: 16개 spec 링크 map 신설
- `spec/2-navigation/_product-overview.md`: 내비게이션 화면 spec 맵 신설
- `spec/7-channel-web-chat/_product-overview.md`: 구성요소 spec 링크 추가

**유형 D — Gate C/D 문서화 (item 7):**
- `spec/conventions/spec-impl-evidence.md`: 가드 수 4→5, `spec-plan-completion.test.ts` 행 추가, §4.0 인접 지식저장소 가드 소절 신설

어떤 spec 파일의 `status:`, `code:`, `pending_plans:` frontmatter 도 변경되지 않음. 요구사항 본문·구현 계약·데이터 모델 정의 변경 없음.

## 동반 갱신 누락 검출

`spec-major-change` trigger 의 target 세 가지를 각각 점검:

**1. `frontmatter code: / status: / pending_plans: 정합 갱신`**

변경된 spec 파일 모두 `status:` / `code:` / `pending_plans:` frontmatter 미변경. 변경 내용이 구현 상태·완성도·미구현 사항에 영향을 주지 않으므로 frontmatter 갱신 의무가 발생하지 않음. `spec/conventions/spec-impl-evidence.md` 의 `code:` 에 `spec-plan-completion.test.ts` 경로가 추가됐으나, 이는 해당 문서 자신이 추적하는 guard test 를 self-consistent 하게 갱신한 것으로 의무 충족.

**2. `status: partial 이면 pending_plans: 의 plan 신설`**

이미 `partial` 인 파일들(`spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md` 등)의 `pending_plans:` 는 이번 변경 전부터 존재하며, 이번 anchor 수정으로 새 미구현 사항이 생기지 않음.

**3. `status: implemented 이면 code: 글로브 ≥1 매치 보장`**

anchor 수정은 code: 글로브 대상 구현 파일에 영향 없음. 매칭 상태 불변.

**누락 동반 갱신: 없음.**

## 발견사항

없음. 변경 내용은 spec 내부 cross-reference anchor 수정·영역 맵 추가·가드 문서화로 구성되며, 유저 가이드(docs MDX), i18n dict, backend-labels, locale 등록과 관련된 어떤 trigger 에도 실질적 동반 갱신 의무를 발생시키지 않는다.

## 요약

매트릭스 19개 trigger 중 `spec-major-change` 1개가 glob 매칭됨 (`spec/2-*/**` · `spec/4-*/**` · `spec/5-*/**` · `spec/conventions/**` 경로). 그러나 35개 변경 spec 파일의 diff 전수 검토 결과 모두 (A) heading 슬러그 변경 반영 anchor 일괄 수정, (B) 상대 경로 오류 수정, (C) 영역 index 맵 추가, (D) Gate C/D 가드 문서화에 한정되며, frontmatter `status:`/`code:`/`pending_plans:` 변화가 없어 동반 갱신 의무가 발생하는 누락 0건이다. codebase/ 변경은 `__tests__/*.ts` 신규 파일 5건뿐으로 TSX/UI 문자열·노드 schema·auth 흐름·표현식 언어·error/warning code 관련 trigger 는 전혀 매칭되지 않는다.

## 위험도

NONE

---

STATUS=success ISSUES=0
