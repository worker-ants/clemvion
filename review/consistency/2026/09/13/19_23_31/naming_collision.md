# 신규 식별자 충돌 검토 — `error-code-emission-axis` (--impl-done, scope=spec/conventions/)

## 조사 방법

`scope(spec/conventions/)` 델타는 실측 0개 파일이다(이 브랜치는 그 영역을 바꾸지 않았다).
실제 구현 diff(4파일/296줄, `git diff origin/main --stat` 로 재확인)는 전부
`codebase/frontend` 하위 harness 테스트 인프라 + 가이드 mdx 문장 정정이다:

- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (+104줄)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (+83줄)
- `codebase/frontend/src/content/docs/02-nodes/logic.mdx` / `logic.en.mdx` (문장 정정, 각 1줄)
- `CHANGELOG.md`, `PROJECT.md` (서술 갱신, 신규 식별자 없음)

target 이 실제로 새로 도입하는 식별자는 다음 7개로 특정된다(전부 위 diff `+` 라인):

| 식별자 | 종류 | export 여부 |
|---|---|---|
| `GUIDE_NON_EMITTED_VOCABULARY` | const 배열 (신규 방출-축 예외 목록) | export |
| `collectQuotedLiterals` | 함수 | export |
| `collectMessagePrefixes` | 함수 | export |
| `collectCatalogCodes` | 함수 | export |
| `QUOTED_LITERAL` | 모듈 내부 정규식 const | 비-export |
| `MESSAGE_PREFIX` | 모듈 내부 정규식 const | 비-export |
| `CATALOG_CODE` | 모듈 내부 정규식 const | 비-export |

각 식별자에 대해 워킹트리 전수(`codebase/`, `spec/`, `plan/`) grep 대조군을 돌렸다.

```
grep -rn "GUIDE_NON_EMITTED_VOCABULARY" codebase/ spec/ plan/
grep -rn "collectQuotedLiterals\|collectMessagePrefixes\|collectCatalogCodes" codebase/ spec/ plan/
grep -rn "\bQUOTED_LITERAL\b" codebase/
grep -rn "\bMESSAGE_PREFIX\b" codebase/
grep -rn "\bCATALOG_CODE\b" codebase/
```

## 발견사항

- **[INFO]** 신규 식별자 7개 전부 충돌 없음 — 자매 목록과의 명명 축 비교표는 코드 JSDoc에 이식 완료
  - target 신규 식별자: `GUIDE_NON_EMITTED_VOCABULARY` (export const), `collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes` (export function), `QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE` (모듈 내부 정규식)
  - 기존 사용처: 위 grep 결과 모두 target 이 만든 파일 내부 정의·호출·주석, 그리고 `plan/in-progress/error-code-emission-axis.md`(같은 작업의 plan) 참조뿐이다. 저장소 다른 곳에 동명·유사명 정의는 없다. 유일한 기존 자매 상수는 `GUIDE_EXTERNAL_VOCABULARY`(`guide-identifier-scan.ts:245` 부근, 존재 축 예외 목록)이며 이름이 `EXTERNAL`↔`NON_EMITTED` 한 토큰 차이지만 서로 다른 상수로 공존한다.
  - 상세: `--impl-prep`(`review/consistency/2026/09/13/18_40_54/naming_collision.md`)가 이 명명 인접성을 INFO로 지적하며 "제약이 정반대(기준집합에 없을 것 vs 있을 것)라는 대조표를 코드 JSDoc으로 이식하라"고 제안했다. 실제 구현 diff를 확인한 결과 `GUIDE_NON_EMITTED_VOCABULARY` 바로 위 JSDoc(`guide-identifier-scan.ts:288-306`)에 정확히 그 대조표(`GUIDE_EXTERNAL_VOCABULARY` = 존재 축/없을 것, `GUIDE_NON_EMITTED_VOCABULARY` = 발행 축/있을 것)가 이식되어 있다 — impl-prep 제안이 실제로 반영됐다.
  - 제안: 없음. 두 목록이 이름은 가깝지만 제약이 반대이고 그 사실이 코드에 상설돼 있어 향후 병합 시도를 막는 문서적 방어가 이미 마련됐다.

- **[INFO]** 가이드 문장 정정(`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`)은 새 식별자를 발행하지 않음 — spec 문서군과의 drift는 target 범위 밖 (재확인, 이번 target 결함 아님)
  - target 신규 식별자: 없음. 기존 두 토큰(`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`)의 가이드 서술 문장만 "코드"→"메시지 접두"로 정정
  - 기존 사용처: `spec/4-nodes/1-logic/0-common.md`, `spec/4-nodes/1-logic/7-map.md`, `spec/4-nodes/1-logic/9-foreach.md`, `spec/4-nodes/1-logic/3-loop.md`, `spec/3-workflow-editor/2-edge.md`, `spec/3-workflow-editor/0-canvas.md`, `spec/5-system/4-execution-engine.md` — 여전히 이 두 토큰을 정식 에러 코드처럼 backtick 인용
  - 상세: `--impl-prep` 리뷰가 이미 동일 사실을 INFO로 기록했고(§18_40_54 항목 2), 이번 diff는 그 spec 파일들을 건드리지 않는다(`git diff origin/main --stat`에 해당 경로 없음). target은 plan §D에서 스코프를 guide mdx 문장으로만 명시적으로 좁혔고 실제로 그렇게 구현됐다. 새 식별자 발행이 아니므로 본 checker의 관점(요구사항ID/엔티티/endpoint/이벤트/env/파일경로 충돌) 어디에도 해당하지 않는다.
  - 제안: 없음 — 이번 target 범위 밖. (§D가 예고한 "엔진이 전용 코드를 방출하게 한다" 후속 작업 착수 시, 신규 코드명이 이미 spec 7곳·가이드에 노출된 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`과 같을지 다를지를 `error-codes.md` 명명 정책에 비추어 그때 재판정하면 된다.)

- **[INFO]** 나머지 6개 관점(요구사항 ID·엔티티/API endpoint·이벤트/메시지명·환경변수·파일 경로)은 이번 diff에 해당 사항 없음
  - 상세: 이번 diff는 신규 spec 파일·신규 API endpoint·신규 이벤트명·신규 환경변수를 도입하지 않는다. 생성된 신규 파일도 없다(전부 기존 파일 수정). `spec/conventions/` 델타 0은 코드-전용(harness 테스트) PR에서는 정상이며 CRITICAL 근거가 아니다.

## 요약

이번 구현 diff(4파일/296줄)가 실제로 새로 붙이는 식별자는 `GUIDE_NON_EMITTED_VOCABULARY`(export const)와 `collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`(export function), 그리고 이들을 뒷받침하는 모듈 내부 정규식 3개(`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE`)로 총 7개이며, 저장소 전수 grep 결과 모두 target 자기 자신 이외의 기존 사용처와 충돌하지 않는다(0건). `--impl-prep` 단계에서 유일하게 지적됐던 명명 인접 위험(`GUIDE_EXTERNAL_VOCABULARY` ↔ `GUIDE_NON_EMITTED_VOCABULARY`, 이름은 한 토큰 차이지만 제약은 정반대)은 실제 구현에서 코드 JSDoc에 대조표로 이식되어 방어됐다. 가이드 문장이 정정한 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`은 새 식별자가 아니고, 그와 관련된 spec-vs-실체 drift는 이번 target이 만든 것도 손대는 것도 아니다. CRITICAL/WARNING 급 신규 식별자 충돌은 발견되지 않았다.

## 위험도

NONE
