# Plan 정합성 검토 — `plan/in-progress/spec-draft-numeric-wire-convention.md`

## 검토 방법

target 문서(`spec-draft-numeric-wire-convention.md`)와 프롬프트에 번들된 `plan/in-progress/**`
전체(본문 포함 파일 다수 + 컨텍스트 예산으로 절단된 61개 목록)를 대조했다. 절단된 파일은
저장소에서 `grep`으로 `numeric`/`decimal`/`threshold`/`cost_usd`/`swagger.md`/`JSDoc`/
`introspectComments`/`nest-cli` 키워드를 전수 확인해 본문 미노출 위험을 보완했다. 또한
target 이 인용하는 실측(가드 존재, DTO 분리 적용례, spec 현재 라벨)을 저장소에서 직접 재확인했다.

## 발견사항

- **[WARNING]** 소스 plan 의 대응 체크박스 3건에 대한 backport 의무가 target 문서에 명시돼 있지 않음
  - target 위치: target 문서 전체 (frontmatter + 본문) — "종결 조건"/체크리스트 갱신 지시 없음
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 후속` 섹션의
    미체크 항목 3건 —
    - `swagger.md 에 numeric 불변식 성문화` (planner, `20_05_42` W2)
    - `spec/1-data-model.md:873 이 threshold 를 Float 로 라벨링` (planner, `19_43_18` INFO#6)
    - `swagger.md 에 JSDoc 분리 가이드` (planner, `21_10_30` INFO#3)
  - 상세: target 문서 자신이 상단에 "출처: `spec-draft-nullable-notation-followups.md` 의
    planner 트랙 3건" 이라고 명시하며 이 세 항목을 그대로 이어받아 처리한다. 그런데 target
    문서에는 이 세 항목을 완료 후 소스 plan 의 `## 후속` 체크박스를 `[x]` 로 갱신하라는
    지시나 "종결 조건" 절이 없다. 소스 plan 쪽에는 "**아래 표에 개수를 적지 않는다** —
    미체크 체크박스가 단일 진실" 이라는 자체 경고문까지 있어(같은 문서에서 두 번 낡은
    전례), 체크박스 동기화가 이 프로젝트에서 반복적으로 놓치는 지점임이 이미 기록돼
    있다. target 이 머지된 뒤 소스 plan 을 열어보지 않으면 세 항목이 실제로는 완료됐는데도
    "미해결" 로 계속 남아, 다음 사람이 같은 작업을 중복 시도하거나 소스 plan 의 완료
    판정("`## 후속` 체크박스가 전부 닫히는 것이 종결 조건")이 영구히 막힐 수 있다.
  - 제안: target 문서(또는 이를 적용하는 커밋)가 완료될 때 `spec-draft-nullable-notation-followups.md`
    의 해당 세 체크박스를 `[x]` 로 갱신하고 target 문서(또는 그 산출 커밋)를 근거로 남길 것.
    두 문서의 `worktree` 값이 동일(`plan-in-progress-items-b0c80b`)해 같은 세션에서 처리될
    가능성이 높으므로 실무적 리스크는 낮지만, target 문서 자체에 그 의무를 적어 두지 않으면
    세션이 갈릴 경우 누락된다.

## 검증해 확인한 사항 (문제 없음)

- **미해결 결정과의 충돌 없음**: `plan/in-progress/**` 전체에서 numeric/decimal/wire-type/
  threshold/JSDoc-공개노출 축에 "결정 필요" 로 남겨진 항목을 찾지 못했다(`결정 필요` 키워드
  교차 검색 0건). `rag-quality-improvement.md` 의 `threshold` 언급은 RAG 리랭킹 컷오프
  설정값으로 완전히 다른 개념이라 오탐 배제.
- **선행 plan 미해소 없음**: target 이 전제하는 두 사실 — ① `findNumericAsNumber` 가드가
  `swagger-dto-contract-guard.ts`/`swagger-dto-contract.spec.ts` 에 실재, ②
  `alert-rule-response.dto.ts` 의 `threshold` 가 `//` 내부서사 / JSDoc 공개설명 분리를 이미
  적용 — 둘 다 저장소에서 직접 재확인했고 다른 in-progress plan 이 이를 뒤집거나 진행 중인
  변경으로 두고 있지 않다.
- **spec 현재 상태와 정합**: `spec/1-data-model.md:873` 은 지금도 `threshold | Float` (미수정),
  `swagger.md` 에는 아직 `1-6` 섹션도 "JSDoc 은 공개" 문단도 없음 — target 이 다른 병렬
  작업으로 이미 선반영된 stale draft 가 아님을 확인. 삽입 위치(§1-5 다음/§2 앞, §3 길이 표
  뒤/캐비엇 인용 앞)도 현재 `swagger.md` 구조와 정확히 일치.
- **§2.25 AlertRule 존재 전제 정합**: target 은 `threshold (§2.25)` 를 편집 대상으로 삼는데,
  `spec-sync-auth-gaps.md` 가 과거 "AlertRule 이 데이터 모델 SoT 에 없다" 고 지적했던 항목은
  이미 `[x]` 로 종결되어 §2.25 가 실재한다 — 전제 충돌 없음.
- **다른 plan 과의 콘텐츠 중복/모순 없음**: `numeric`/`decimal`/`costUsd`/`introspectComments`/
  `nest-cli` 키워드로 전체 in-progress 코퍼스를 훑었을 때 target 과 같은 규약을 다르게
  제안하는 plan 은 없었다. `swagger.md §3` 을 함께 건드리는 `spec-sync-user-profile-gaps.md`
  의 미결 항목(엔드포인트 description 길이 캐비엇 확장)은 같은 절이지만 다른 하위 문단을
  대상으로 하는 별개 편집이라 논리적 충돌은 아니다(동시 편집 시 diff 인접 가능성은 병렬
  세션 이슈로 범위 밖).

## 요약

target 초안이 세 번 인용하는 실측(가드 존재·DTO 분리 적용례·현재 spec 라벨)은 모두
저장소 상태와 일치하고, plan 전역에서 이 규약과 충돌하는 미해결 결정이나 미해소 선행
조건은 발견되지 않았다. 유일한 정합성 리스크는 target 이 정확히 이어받는다고 밝힌 소스
plan(`spec-draft-nullable-notation-followups.md`)의 대응 체크박스 3건에 대한 갱신 의무가
target 문서 자체에는 적혀 있지 않다는 점이며, 두 문서가 같은 worktree 에 속해 있어 실무
누락 가능성은 낮지만 명시적으로 기록해 두는 편이 안전하다.

## 위험도

LOW
