# 요구사항(Requirement) 리뷰 — output-shape.ts / output-shape.test.ts / output-shape-comment-followups.md (3차 라운드)

## 컨텍스트

`review/` 산출물 21개(14_19_49, 14_34_01 두 라운드분)는 이미 지나간 리뷰 이력이며 실질 코드/스펙
변경은 파일 1~3(`output-shape.test.ts`, `output-shape.ts`, `output-shape-comment-followups.md`)
뿐이다. 실측으로 재검증한 결과는 아래와 같다.

- `git diff origin/main...HEAD -- output-shape.ts` 를 `+`/`-` 라인 기준으로 필터링해 주석(`*`/`//`)이
  아닌 라인이 **0건**임을 직접 확인 — RESOLUTION/SUMMARY 의 "non-comment diff 0줄" 주장이 사실과 일치.
- `npx vitest run .../output-shape.test.ts` → **42 passed** (RESOLUTION 의 "39→40→41→42" 수렴과 일치).
- `npx vitest run src/components/editor/run-results` → 16 files / **275 passed**, 회귀 없음.
- 신규 fixture 3건(`endReason` 키 부재 / `output.endReason` fallback / `result` 우선순위)을 실제
  `isConversationOutput` 로직과 손으로 트레이스 — 세 케이스 모두 실제 함수 동작과 `expect(...)` 기대값이
  일치함을 확인(아래 상세).
- 화이트리스트 SoT(`@workflow/ai-end-reason`)에 `'completed'` 가 실제로 포함돼 있음을 확인 —
  fallback 테스트의 `endReason: "completed"` fixture 가 유효한 값임을 검증.
- plan 문서의 실측 인용 3건(`executions.ts:27` 의 `outputData: Record<string, unknown> | null`,
  `lib/api/` 내 zod import 0건, `isConversationOutput` 호출부 정확히 3곳·전부 boolean 소비)을
  grep 으로 재확인 — 전부 사실과 일치.
- plan 문서의 `api-convention §5.4` 링크가 실제 경로(`spec/5-system/2-api-convention.md`)를 정확히
  가리킴을 확인 — 1차 라운드 INFO 5 반영이 실제로 적용됐다.
- `spec/conventions/swagger.md §1-4` 가 `interactionType` 을 EIA `getStatus.context` 문맥에서
  unsound discriminator 로 실제로 판정하고 있음을 확인 — plan 의 "NO-GO" 근거 인용이 사실에 부합
  (다른 서브시스템에서의 유비 논거이나 허위 인용은 아님).

## 발견사항

- **[INFO]** `endReason` 우선순위 fallback 의 `null` 케이스는 미고립 (사전 존재 갭, 신규 아님)
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:202-203`
    (`const endReason = (result?.endReason as string | undefined) ?? (output.endReason as string | undefined);`)
  - 상세: `??` 는 `null` 도 `undefined` 와 동일하게 다음 단으로 내려보낸다. 이번 라운드가 새로 고정한
    3개 fixture(키 완전 부재 / `output.endReason` fallback / 우선순위)는 `result.endReason` 이
    **`undefined`**(키 자체 부재)인 경우만 다룬다 — `result.endReason: null` 로 명시적으로 설정된
    입력이 fallback 을 타는지는 어떤 fixture 로도 관측되지 않는다. 다만 실제 backend 산출물
    (`spec/4-nodes/3-ai/1-ai-agent.md`, `3-information-extractor.md`)이 `endReason` 을 항상 문자열
    리터럴로 싣고 `null` 을 생산하는 경로가 없어(스펙 전수 grep 결과 `endReason: null` 케이스 없음),
    실무상 위험은 낮다. mutation 관점에서도 `??` → `||` 치환 정도가 유일하게 이 갭을 노출시킬 텐데
    `endReason` 이 빈 문자열일 producer 도 없어 관측 가능성이 낮다.
  - 제안: 병합 차단 사유 아님. 이번 PR 이 이미 "실측으로 재현되지 않는 이론적 갭은 이월하지 않는다"
    는 절제된 스코프 규율을 유지해 왔으므로(plan 항목 4 NO-GO 판정과 같은 결의 판단), 굳이 지금
    닫을 필요는 없다 — 다음에 `endReason` 관련 분기를 편집할 기회에 함께 검토 권장.

- **[INFO]** JSDoc "Stage 5 이후 종결" bullet 의 화이트리스트 서술이 함수의 실제 반환 로직과
  엄밀히는 다름 (문서적 단순화, 버그 아님)
  - 위치: `output-shape.ts` JSDoc — "화이트리스트에서 빠진 endReason 은 미리보기 탭을 통째로
    없앤다"
  - 상세: 실제로는 `looksLikeConversationEnd` 가 false 가 돼도 OR-체인의 다른 3개 분기
    (`hasLegacyMessages && (outputInteraction || metaInteraction)`, `hasConvConfig`,
    `isCanonicalWaiting`) 중 하나가 참이면 여전히 `true` 를 반환한다. JSDoc 문장은 "이 분기만
    참인 Stage-5 전용 페이로드에서" 라는 암묵적 전제 하의 서술로 읽히며, 함수 전체의 무조건
    반환값 주장은 아니다. 실제 프로덕션 위험(Stage 5 페이로드는 다른 분기가 동시에 참이 될
    필드를 갖지 않음)과도 부합해 실질적 오해 소지는 낮다.
  - 제안: 없음 (기록용). 원한다면 "(다른 분기가 동시에 참이 아닌 한)" 같은 단서를 덧붙일 수 있으나
    필수는 아니다.

## 요약

3개 실질 변경 파일 모두 실측으로 재검증했다. `output-shape.ts` 는 이번 diff 전 구간에서 non-comment
라인 변경이 0줄이라는 이전 라운드들의 주장이 grep 기준으로 사실이며, 신규/개정된 JSDoc 은
`isConversationOutput` 의 실제 OR-체인·`endReason` 2단 조회·우선순위(`result` 우선) 동작과 line-level
로 정확히 일치한다. `output-shape.test.ts` 에 3라운드에 걸쳐 누적 추가된 3개 fixture(`endReason`
키 부재/`output.endReason` fallback/`result` 우선순위)를 함수 로직과 손으로 트레이스한 결과 각각의
`expect` 기댓값이 실제 반환값과 정확히 일치했고, 42/42 vitest green 과 룸 없는 non-comment diff
로 로직 무변경도 재확인했다. `plan/in-progress/output-shape-comment-followups.md` 의 실측 인용
(API 타입, zod 부재, 호출부 개수, spec 링크, discriminator 판정)도 grep/Read 로 전수 대조해 전부
사실과 부합했다 — 근거를 지어내거나 과장한 흔적이 없다. spec 자체는 `isConversationOutput` 이라는
frontend 방어적 파서 함수를 이름으로 다루지 않으며(`@workflow/ai-end-reason` 값 도메인, AI Agent/IE
`output.result.endReason` 필드 정의만 SoT로 존재), 이번 diff 가 다루는 "봉투 밖 `output.endReason`
fallback" 은 마이그레이션-이전 프론트엔드 방어 로직으로 spec 이 침묵하는 영역이라 SPEC-DRIFT 대상도
아니다. TODO/FIXME/HACK/XXX 신규 삽입 없음, 모든 반환 경로가 boolean 을 반환함을 재확인, 에러
시나리오는 해당 없음(순수 판정 함수). CRITICAL/WARNING 없음 — 잔여 2건은 이론적 엣지케이스에 대한
INFO 로, 병합을 막을 사유가 아니다.

## 위험도
NONE
