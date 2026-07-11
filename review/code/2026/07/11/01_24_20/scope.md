# 변경 범위(Scope) 리뷰 — 프레시 재검토 (commit `6e08fe425`)

## 검증 방법

`_prompts/scope.md` 에 포함된 diff 페이로드는 5개 파일(CHANGELOG.md, workflows.service.spec.ts,
workflows.service.ts, reserved-variable-name.util.spec.ts, reserved-variable-name.util.ts)의 큰 diff
블록이었으나, 이는 브랜치 전체(origin/main 대비 누적) 컨텍스트로 보이고 **금번 재검토 대상인 단일 커밋
`6e08fe425` 과 1:1 대응하지 않는다** (아래 발견사항 참고). 오케스트레이터 지시에 따라 `git show 6e08fe425
--stat` / `git diff-tree --name-status` / 파일별 `git show 6e08fe425 -- <path>` 로 **커밋 실체를 직접
검증**했다.

## 커밋 `6e08fe425` 변경 파일 전체 (15개, numstat)

```
78  2  codebase/backend/src/modules/workflows/workflows.service.spec.ts
 4  0  codebase/backend/src/nodes/logic/_shared/reserved-variable-name.util.ts
 4  0  codebase/frontend/src/content/docs/02-nodes/logic.en.mdx
 4  0  codebase/frontend/src/content/docs/02-nodes/logic.mdx
 2  0  plan/in-progress/node-output-redesign/variable-declaration.md
 2  0  plan/in-progress/node-output-redesign/variable-modification.md
52  0  review/code/2026/07/11/00_59_29/RESOLUTION.md          (신규, 리뷰 산출물)
53  0  review/code/2026/07/11/00_59_29/SUMMARY.md              (신규, 리뷰 산출물)
59  0  review/code/2026/07/11/00_59_29/documentation.md        (신규, 리뷰 산출물)
57  0  review/code/2026/07/11/00_59_29/requirement.md          (신규, 리뷰 산출물)
43  0  review/code/2026/07/11/00_59_29/side_effect.md          (신규, 리뷰 산출물)
66  0  review/code/2026/07/11/00_59_29/testing.md              (신규, 리뷰 산출물)
 1  1  spec/4-nodes/1-logic/4-variable-declaration.md
 1  1  spec/4-nodes/1-logic/5-variable-modification.md
 3  2  spec/conventions/execution-context.md
```

**`codebase/backend/src/modules/workflows/workflows.service.ts` 는 이 커밋에 포함되지 않는다** — 즉
`validateReservedVariableNames` 등 L0 프로덕션 로직은 이전 커밋에서 이미 도입됐고, 금번 커밋은 손대지
않았다.

## 각 파일 내용 검증

1. **`reserved-variable-name.util.ts`** (+4/-0): `isReservedVariableName` 함수 바로 위에 2줄 JSDoc
   주석("세 계층 공통 술어…")만 추가됐다. 함수 본문(`typeof name === 'string' && name.startsWith(...)`)은
   1바이트도 안 바뀌었다 — 지시받은 "JSDoc 주석 하나"와 정확히 일치.
2. **`workflows.service.spec.ts`** (+78/-2): 순수 테스트 추가 2건 (`importWorkflow` 가 예약 이름을
   거부하는 케이스, offender.node 가 label 로 폴백하는 케이스) + 기존 테스트 내부 주석 1군데
   (`skipParamSchemaValidation` → `skipLegacyDataGates`, 이전 커밋의 파라미터 rename 을 반영하는 텍스트
   정정). 어떤 `expect`/mock 설정도 기존 동작을 바꾸지 않는다.
3. **`logic.mdx` / `logic.en.mdx`** (+4/+4): Variable Declaration/Modification 섹션에 `__` prefix 금지
   안내 문구 2줄씩 추가 (KO/EN parity). 순수 사용자 문서.
4. **`spec/4-nodes/1-logic/{4,5}-*.md`** (각 1/-1): §5 preamble 문장 하나 정정 — "config 검증 실패는
   pre-flight throw" → "대부분 pre-flight, 단 예약 `__` 이름의 L2 런타임 해석 후 검사만 실행 중 throw".
   기존 커밋에서 도입한 L2 동작을 문서에 반영하는 정정.
5. **`spec/conventions/execution-context.md`** (+3/-2): 원칙 5 서술 정정(강제 갭→강제 3계층 언급) + Code
   노드 blast radius 문장 확장 + "import 경로" 절 신설. 전부 서술형 spec 본문, 코드 아님.
6. **`plan/in-progress/node-output-redesign/{variable-declaration,variable-modification}.md`** (각
   +2/-0): "7차 갱신" 노트 삽입 — 이전 커밋에서 바뀐 라인 번호를 추적하는 히스토리 주석. plan 문서
   컨벤션대로 append.
7. **`review/code/2026/07/11/00_59_29/*.md`** (전부 신규): `/ai-review` 실행 산출물(SUMMARY·RESOLUTION·
   세부 리뷰어 리포트). 코드 아님, 리뷰 프로세스 표준 산출물.

## 발견사항

- **[INFO]** `_prompts/scope.md` 페이로드가 이 커밋과 무관한 diff(CHANGELOG.md, 이전 커밋의
  `workflows.service.ts` L0 로직 신설분, `reserved-variable-name.util.spec.ts` 신규 파일)를 포함하고
  있어 대상 범위 파악에 혼선을 줄 수 있었다.
  - 위치: `_prompts/scope.md` 상단 "파일 1~5" 섹션
  - 상세: 해당 diff 들은 `git diff-tree --name-status 6e08fe425` 결과에 없다 — 즉 이번 재검토 대상
    커밋이 아니라 브랜치 누적(또는 이전 라운드) diff 로 보인다. 오케스트레이터 지시문이 "commit
    `6e08fe425`" 을 명시했으므로 이번 리뷰는 그 커밋 실체를 기준으로 삼았다.
  - 제안: 프로덕션 코드 변경이 아니므로 리뷰 결과에 영향은 없다. 다만 후속 라운드에서 페이로드
    생성 스크립트가 diff base(단일 커밋 vs 브랜치 전체)를 명확히 하면 혼선을 줄일 수 있다.
- 그 외 CRITICAL/WARNING 급 스코프 이탈 없음. `workflows.service.ts`(런타임 검증 로직의 실제 소재지)는
  이 커밋에서 전혀 건드리지 않았고, `reserved-variable-name.util.ts` 는 순수 JSDoc 추가뿐이다. 테스트
  추가는 지시된 W4(importWorkflow 대칭 테스트)·주석 정정(W8)과 정확히 일치하며 기존 assertion 을
  변경하지 않았다. `.mdx`/`spec/*.md`/`plan/*.md` 변경은 모두 서술 텍스트이며 커밋 메시지가 밝힌
  W1/W2/W3/W6 항목과 1:1 대응한다. `review/code/**` 산출물은 리뷰 프로세스 표준 부산물로 스코프 위반이
  아니다.

## 요약

`git diff-tree --name-status 6e08fe425` 로 확인한 15개 변경 파일 중 프로덕션 런타임 코드에 해당하는
유일한 소스 변경은 `reserved-variable-name.util.ts` 의 2줄 JSDoc 주석 추가뿐이며, 함수 본문·시그니처·
호출부는 무변경이다. `workflows.service.ts`(L0 게이트 실 로직)는 이 커밋에서 전혀 수정되지 않았다.
나머지는 테스트 추가(`workflows.service.spec.ts`, 지시된 대칭 케이스 2건 + 주석 리네임 1건),
사용자/스펙 문서(`logic.mdx`/`.en.mdx`, `spec/4-nodes/1-logic/{4,5}`, `spec/conventions/execution-
context.md`), plan 히스토리 노트(`plan/in-progress/node-output-redesign/*`), 리뷰 산출물
(`review/code/2026/07/11/00_59_29/*`) 로 구성되며 모두 커밋 메시지가 명시한 W1~W6/W8/INFO 항목과
정확히 대응한다. 지시된 범위("docs + tests + JSDoc 주석 하나, 프로덕션 로직 무변경")를 완전히 충족한다.

## 위험도

NONE

STATUS: DONE
