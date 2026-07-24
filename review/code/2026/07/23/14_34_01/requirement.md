# 요구사항(Requirement) 리뷰 — output-shape.ts JSDoc 재작성 + mutation 이월 테스트 2건 + plan 문서

## 검증 방법

- `git diff origin/main -- output-shape.ts` 로 실행 로직(함수 본문) 변경 여부를 직접 재확인 —
  diff 는 `isConversationOutput` JSDoc 블록에만 존재하고 `export function` 이하 코드는 unified
  diff 에 전혀 나타나지 않음. RESOLUTION.md 의 "non-comment diff 0줄" 주장을 코드로 재현.
- `npx vitest run .../output-shape.test.ts` 실측 → **41 passed (41)**. plan/RESOLUTION 의
  "39 → 40 → 41" 진행 주장과 일치.
- 신규 fixture 2건(`rejects result.messages when the endReason key is absent entirely`,
  `detects a terminal whose endReason sits at output.endReason, not result.endReason`)을
  `isConversationOutput` 실제 분기(top-level 게이트 → `unwrapNodeOutput` → `hasResultMessages`/
  `endReason`/`looksLikeConversationEnd`/`isCanonicalWaiting`)로 손 트레이스 — 두 fixture 모두
  주석이 서술한 고립 조건과 기대값(`false`/`true`)이 실제 코드 흐름과 정확히 일치.
- `@workflow/ai-end-reason` 패키지의 `CONVERSATION_END_REASONS` 배열에 `"completed"` 포함 확인
  (신규 2번째 테스트가 `true` 를 기대하는 근거).
- `grep isConversationOutput(` 로 호출부 3곳(`result-timeline.tsx:73`,
  `result-detail.tsx:1006`, `result-detail.tsx:1052`) 실측 — plan 문서의 chokepoint 주장과 일치.
- `grep -rn "from \"zod\"" src/lib/api/` → 0건, `executions.ts` 의 `outputData` 타입 실측 —
  plan "NO-GO(union 재설계)" 절의 사실 근거표와 일치.
- `spec/conventions/conversation-thread.md` 목차 확인 → `## 9. 미리보기 UI 렌더 규칙` 하위
  `### 9.9 UI Invariants`(619행) 에 Inv-8 테이블(632행) 존재 — 테스트 주석의
  `spec/conventions/conversation-thread.md §9.9 Inv-8` 인용이 정확.
- `spec/conventions/swagger.md` §1-4(85행) "discriminator 는 판별자가 sound 할 때만" 절 확인 —
  `interactionType` unsound 판별자 서술과 plan 인용이 일치. `spec/5-system/2-api-convention.md`
  §5.4(172행)도 실존 경로로 확인(직전 라운드 INFO 5 반영 검증).
- TODO/FIXME/HACK/XXX 신규 도입 여부 grep → 0건.

## 발견사항

- **[WARNING]** JSDoc 이 "근거의 SoT" 를 자임하면서 정작 `endReason` 2단 조회(fallback)는
  branch 목록에서 누락
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts` JSDoc
    "Stage 5 이후 종결" bullet (약 265~269행) 및 그 아래 신설된
    `> 근거의 SoT 는 이 JSDoc 이다.` blockquote
  - 상세: 이번 diff 는 JSDoc 말미에 "왜 이 분기가 존재하는가 서술은 여기서만 한다 —
    테스트 주석은 포인터로 위임한다" 는 새 SoT 원칙을 명문화했다. 그런데 실제 소스는
    `endReason = result?.endReason ?? output.endReason` 로 **2단 조회**이고, 이 diff 는
    바로 이 fallback 단을 단독 고립하는 신규 테스트(`detects a terminal whose endReason
    sits at output.endReason, not result.endReason`)를 mutation 실측까지 거쳐 추가했다
    (plan 문서 "측정 1b" — fallback 제거 시 tsc clean + 40/40 green 으로 생존 확인, 즉
    실제로 머지될 수 있는 회귀). 그럼에도 JSDoc "Stage 5 이후 종결" bullet 은 여전히
    "`output.result.messages` + `CONVERSATION_END_REASONS` 에 속한 `endReason`" 이라고만
    적어 `endReason` 이 `result.endReason` 우선·`output.endReason` fallback 순으로
    조회된다는 사실을 전혀 언급하지 않는다. 반면 바로 위 "봉투 대기" bullet 은 동일 성격의
    방어적 fallback(`meta.interactionType` 유실 시 `status`+`output.messages` 단독 허용)을
    JSDoc 에 명시적으로 적어 두었다 — 같은 diff, 같은 함수 안에서 처리 일관성이 어긋난다.
    결과적으로 이 diff 가 방금 확립한 "JSDoc = 유일한 근거 SoT" 원칙이 스스로 불완전한
    상태로 남는다. 새 독자가 JSDoc 만 읽으면 이 fallback 의 존재·근거를 알 수 없고, 테스트
    주석("2단 조회다")과 JSDoc 사이에 정보 비대칭이 생긴다.
  - 제안: "Stage 5 이후 종결" bullet 에 한 절을 추가 — 예: "`endReason` 은
    `result.endReason` 을 우선 보고, 없으면 `output.endReason` 으로 내려가는 방어적
    2단 조회다 (마이그레이션 이전 페이로드가 `endReason` 을 한 단계 위에 실은 경우 대비)."
    plan 체크리스트 항목 3("이월 주석 정리")의 후속으로 처리 가능한 소규모 수정.

- **[INFO]** plan 문서의 `api-convention §5.4` 인용이 주장(sound 판별자 부재)과 다소 느슨하게
  연결됨
  - 위치: `plan/in-progress/output-shape-comment-followups.md` "기각 근거(실측)" 표 3번째 행
  - 상세: 해당 행은 "`interactionType` 은 이미 unsound 로 판정된 판별자" 라는 주장을
    `swagger.md §1-4`(discriminator 는 판별자가 sound 할 때만 — 실제로 `interactionType`
    unsound 사례를 직접 다룸) 와 `api-convention §5.4`(null vs 키 생략 부재 표현 규약 —
    discriminator 건전성과는 다른 주제) 두 곳에 병기한다. 전자만으로 주장이 충분히
    지지되고, 후자는 같은 PR(#904)의 부속 규약이라는 맥락상 병기이지 논거 자체는 아니다.
    직전 라운드 INFO 5(깨진 경로)는 정확히 고쳐졌으나, 인용의 논거 적합성은 이번에도
    재검토되지 않았다.
  - 제안: 병합 차단 사유 아님. 다음에 이 표를 편집할 기회에 `api-convention §5.4` 를
    "관련 규약" 정도로 격을 낮추거나 제거해도 무방.

- **[INFO]** 코드 실행 로직 무변경 확인(양성 확인)
  - 위치: `output-shape.ts` 전체
  - 상세: `git diff origin/main` 실측으로 `export function isConversationOutput` 이하 및
    파일의 다른 모든 함수(`unwrapNodeOutput`/`extractIeSnapshot`/`extractAiMetadata` 등)에
    diff 가 전혀 없음을 확인했다 — 오직 `isConversationOutput` JSDoc 블록(111~152행 근방)만
    변경. RESOLUTION.md 의 "e2e 재실행 불요" 근거(non-comment diff 0줄)가 실측과 일치한다.
  - 제안: 없음(기록용).

## 요약

`output-shape.ts` 변경은 함수 본문 diff 가 0줄인 순수 JSDoc 재작성(영어→한국어 통일 + 구조화)이고,
`output-shape.test.ts` 변경은 이전 라운드에서 지적된 두 mutation 커버리지 갭(`endReason` 키 부재,
`output.endReason` fallback 단 고립)을 닫는 신규 테스트 2건 + 기존 테스트 주석의 SoT 위임 정리다.
두 신규 fixture 를 실제 판정 로직으로 손 트레이스한 결과 기대값이 정확했고, `vitest run` 실측으로도
41/41 green 을 확인했다. plan 문서(`output-shape-comment-followups.md`)가 인용하는 spec 절
(conversation-thread.md §9.9 Inv-8, swagger.md §1-4)과 사실 주장(호출부 3곳, zod 미사용, 타입
정의)도 grep/파일 대조로 전부 실측 확인됐다. 유일한 실질적 갭은 이번 diff 가 새로 못박은 "JSDoc =
근거의 유일한 SoT" 원칙이 정작 이번 diff 로 추가된 `endReason` 2단 조회 fallback 자체를 JSDoc
분기 목록에서 누락시켜 자기모순적이라는 점(WARNING 1건) — 기능적 결함이 아니라 문서 완결성 갭이며
후속 소규모 수정으로 닫을 수 있다. TODO/FIXME 류 미완성 표식은 없다.

## 위험도
LOW
