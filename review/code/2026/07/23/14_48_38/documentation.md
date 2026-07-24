# 문서화(Documentation) 리뷰 — output-shape.ts / output-shape.test.ts / plan / 이전 라운드 review 산출물

이 diff 는 `isConversationOutput` 이월 항목 처분(#983 후속) plan 의 3차 라운드다. 소스
`output-shape.ts` 는 논리 변경 없이 JSDoc 재작성뿐이고, `output-shape.test.ts` 는 신규 고립
fixture 3건 + 주석 정리다. `review/code/2026/07/23/14_19_49/**`, `14_34_01/**` 는 앞선 두
라운드의 리뷰 산출물이 커밋된 것(프로젝트 관례상 review/ 는 커밋 대상)이라 diff 에 나타난다.

## 발견사항

- **[INFO]** 이전 라운드 지적사항 전수 반영 확인 — 실코드 대조로 검증
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:134-143` (JSDoc "Stage 5 이후 종결" bullet), `__tests__/output-shape.test.ts:629-720` (신규 fixture 3건)
  - 상세: 1차 라운드 INFO 1(소스 줄번호 하드코딩)·INFO 2(mutation 실측 수치 이중 기록)와 2차 라운드 WARNING 1(`endReason` 2단 조회가 JSDoc "Stage 5 이후 종결" bullet 에 미서술)·INFO 1(우선순위 역전 mutation 미고립)·INFO 2(2차 신규 테스트에서 수치 재중복) 를 현재 파일 상태로 직접 대조 확인했다. JSDoc bullet 에 "방어적 2단 조회"·"`result` 쪽이 그 종결의 정본" 서술이 들어갔고, 3건의 신규 테스트 주석 모두 구체 수치나 줄번호 없이 "plan 문서 §측정 1b/1c" 포인터로만 참조한다. `rejects result.messages when the endReason key is absent entirely` 주석도 더 이상 `output-shape.ts:202` 를 인용하지 않고 코드 앵커(`typeof endReason === "string"` conjunct, `ReadonlySet<string>`)로 서술한다.
  - 제안: 없음 (양성 확인).

- **[INFO]** `plan/in-progress/output-shape-comment-followups.md` 의 spec 링크 경로 실재 확인
  - 위치: `plan/in-progress/output-shape-comment-followups.md:42`
  - 상세: 2차 라운드에서 지적된 `api-convention.md` 경로 오류가 `spec/5-system/2-api-convention.md` 로 수정돼 있고, 실제로 그 경로에 파일이 존재함을 확인했다(`swagger.md` 도 `spec/conventions/swagger.md` 에 실존). "관련 규약 — 직접 논거 아님" 격하 표현도 2차 라운드 INFO 3 조치와 일치한다.
  - 제안: 없음.

- **[INFO]** 테스트 주석이 인용하는 spec 앵커(`§9.9 Inv-8`) 정확성 확인
  - 위치: `__tests__/output-shape.test.ts:577-579` ("accepts every unified endReason as a conversation terminal" 상단 주석)
  - 상세: `spec/conventions/conversation-thread.md` 를 직접 열어 `### 9.9 UI Invariants` 절의 표에 `Inv-8` 행이 실재함을 확인했다(상세 rationale 은 `§8.5`에 있고 `§9.9` 는 그 요약 표라 두 절 모두 유효한 앵커). 오독 위험 없음.
  - 제안: 없음.

- **[INFO]** JSDoc SoT 위임 원칙이 신규 테스트 3건 전체에 일관 적용됨
  - 위치: `output-shape.ts:158-161` (JSDoc 말미 위임 규약) / `__tests__/output-shape.test.ts` 신규 fixture 3건
  - 상세: "근거는 JSDoc, 필드 존재/부재 격리 조건은 테스트 주석" 이라는 이번 diff 자체가 세운 원칙이 새로 추가된 3번째 fixture(`prefers result.endReason over output.endReason when both are present`)에도 동일하게 지켜진다 — 내부 변수명은 언급하지 않고 필드 우선순위 서술로만 고립 조건을 적는다. 과거 3회 회귀(#959 계열)의 근본 원인이던 "근거 이중 기록" 이 이 라운드까지 재발하지 않았다.
  - 제안: 없음 (긍정적 관찰).

- **[INFO]** CHANGELOG / README / API 문서 미갱신 — 적절
  - 위치: 저장소 루트 `CHANGELOG.md`
  - 상세: 이번 diff 는 `output-shape.ts` non-comment 라인 변경 0줄(RESOLUTION.md·SUMMARY.md 실측으로 반복 확인됨)이고 신규 공개 API·엔드포인트·환경변수·설정 옵션이 없다. CHANGELOG/README/API 문서 갱신 대상이 아니며 실제로 갱신되지 않은 것이 맞다.
  - 제안: 없음.

- **[INFO]** 파일 내 언어 혼재 잔존 — 스코프 의도적 축소 (재확인, 조치 불요)
  - 위치: `output-shape.ts` — `unwrapNodeOutput`/`extractIeSnapshot`/`extractAiMetadata`/`extractTurnDebug` 등 JSDoc 은 여전히 영어, `isConversationOutput` 만 한국어
  - 상세: plan 항목 3 이 스코프를 `isConversationOutput` 로 명시했고 1·2차 라운드 리뷰어들이 이미 "의도된 결정, 조치 불요"로 합의한 사항이다. 3차 라운드에서도 상태 변화 없음.
  - 제안: 향후 해당 함수들을 편집할 기회에 언어 통일 검토(비차단, 반복 기록 목적).

- **[INFO]** plan 체크리스트 마지막 항목 미체크 — 현재 라운드 진행 상태에 부합
  - 위치: `plan/in-progress/output-shape-comment-followups.md:119`
  - 상세: `- [ ] /ai-review + Critical/Warning 반영` 이 이번 리뷰 자체가 완료해야 할 절차이므로 현재 미체크는 타당하다. frontmatter `spec_impact: none` 도 규약(bare `none`)에 부합.
  - 제안: 이번 라운드 결과(Critical/Warning 0 시) 반영 후 체크박스 갱신.

## 요약

3차(현재) 라운드는 실질적으로 앞선 두 라운드가 지적한 문서화 관련 항목(소스 줄번호 하드코딩,
mutation 실측 수치 이중 기록, JSDoc의 `endReason` 2단 조회 누락, 우선순위 mutation 미고립,
plan 의 spec 링크 오류)을 전부 실제 파일 상태 대조로 반영 확인했다. `output-shape.ts` 는 여전히
non-comment diff 0줄이고, JSDoc 은 "근거는 한 곳(JSDoc)에만" 이라는 원칙을 스스로 세우고 신규
fixture 3건 전체에 일관되게 지켰다 — 과거 3차례 회귀(#959 계열)의 원인이던 이중 SoT drift 가
이번 라운드까지 재발하지 않았다. README/API 문서/CHANGELOG/설정 문서 갱신 필요성은 없으며(신규
공개 API·환경변수 없음, 실행 로직 무변경), spec 앵커(`§9.9 Inv-8`, `swagger.md §1-4`,
`api-convention §5.4`)도 실재 경로로 검증됐다. 남은 관찰 사항은 전부 이전 라운드에서 이미 합의된
비차단 INFO(파일 내 잔존 언어 혼재, 체크리스트 진행 중 상태)뿐이다.

## 위험도
NONE
