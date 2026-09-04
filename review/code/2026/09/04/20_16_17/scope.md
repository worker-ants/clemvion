# 변경 범위(Scope) 리뷰

## 검토 방법

프롬프트 번들에 실린 26개 파일 diff 외에, `git log`/`git show --stat`으로 실제 3개 커밋
(`a65a4f85e`, `5a7de8ab1`, `dc83c0312`)의 파일 구성과 각 diff 를 직접 대조했다. 저장소 트리에는
아무것도 쓰지 않았다(`git status --short` 로 확인, 기존 미커밋 산출물 `review/code/2026/09/04/20_16_17/` 외 잔여물 없음).

## 발견사항

- **[INFO]** 세 커밋 모두 "코드 수정 + 그 수정을 유발한 리뷰 라운드의 산출물 커밋"이 한 쌍으로 묶여 있다
  - 위치: `a65a4f85e`(fix+CHANGELOG+plan), `5a7de8ab1`(guard+test+`review/code/2026/09/04/19_43_18/**` 12개 파일), `dc83c0312`(JSDoc 정정+`review/consistency/2026/09/04/20_05_42/**` 9개 파일)
  - 상세: 처음엔 review artifact 21개 파일(전체 diff 26개 중 다수)이 코드 변경과 무관해 보였으나, `git show --stat`으로 커밋 단위를 쪼개 보니 각 커밋은 "그 라운드가 지적한 항목을 고치면서 그 라운드 산출물을 함께 커밋"하는 이 저장소의 표준 워크플로(`CLAUDE.md` "일관성 검토자/코드 리뷰어" 산출물 위치 표 — `review/` 는 gitignored 아님, RESOLUTION.md 관례)를 그대로 따른 것이었다. 세 커밋 다 diff 대상 실코드(`codebase/**`)·`CHANGELOG.md`·`plan/**`은 오직 `AlertRuleDto.threshold` 결함(및 그 결함이 촉발한 재발방지 가드)에만 결속되어 있고, review artifact 는 그 결함을 다룬 리뷰 라운드 자신의 기록일 뿐 다른 주제를 섞지 않는다. 무관한 파일·영역 수정 없음.
  - 제안: 없음 (조치 불요 — 프로젝트 관례에 정확히 부합).

- **[INFO]** 신규 가드 축(`findNumericAsNumber`, 84줄)은 "DTO 타입 정정"보다 넓은 신규 정적분석 기능이지만, 같은 결함 클래스에 직결된 정당한 회귀 방지책이다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (새 `interface NumericAsNumberOffender`, `findNumericAsNumber` — 원본 파일 끝에 순수 추가, 기존 `findSwaggerContractMismatches` 등 기존 코드는 한 줄도 안 건드림)
  - 상세: `git diff origin/main..HEAD`로 확인한 결과 이 파일·`swagger-dto-contract.spec.ts` 모두 **순수 append**(기존 함수·테스트 무변경)이고, import 변경(`withFiles` 추가)도 사용처가 있다(대조군 테스트 3개). "이 DTO 하나만 고치면 될 일에 저장소 전역 스캔 가드를 새로 추가"한 것은 기능 확장처럼 보일 수 있으나, 이 저장소는 같은 패턴(결함 발견 → DTO 타입 자체 수정 + 그 결함 클래스를 잡는 전역 가드 신설)을 직전 커밋들에서도 반복해 왔다(`e55b3a74a` "OpenAPI 선언과 TS 타입이 어긋난 9곳 + 그 축을 무는 AST 가드", `d8b7cb93e` 등). over-engineering 이 아니라 이 저장소의 확립된 컨벤션.
  - 제안: 없음 (조치 불요 — scope 이탈 아님, 참고용 기록).

- **[INFO]** `dc83c0312`가 CHANGELOG·plan 의 라우트 표기 오기(`GET /api/alerts/rules` → `GET /api/alerts`)를 정정
  - 위치: `CHANGELOG.md`(신규 섹션 내), `plan/in-progress/spec-draft-nullable-notation-followups.md`(같은 섹션)
  - 상세: 이 정정은 이번 PR **자신이 이전 커밋(`a65a4f85e`)에서 써 넣은 오기**를 고치는 것이지 다른 파일·다른 주제를 건드리는 게 아니다. 범위 이탈 아님.
  - 제안: 없음.

## 요약

3개 커밋(`a65a4f85e`/`5a7de8ab1`/`dc83c0312`)을 파일 단위·diff 단위로 전수 대조한 결과, 실질 코드·문서·plan 변경(`CHANGELOG.md`, `alert-rule-response.dto.ts`, `swagger-dto-contract-guard.ts`, `swagger-dto-contract.spec.ts`, `spec-draft-nullable-notation-followups.md` — 5파일 248줄)은 전부 "`AlertRuleDto.threshold` 가 `number`라고 문서화됐지만 wire 는 `string`이다"라는 단일 결함과 그 재발 방지에만 결속되어 있다. 기존 함수·테스트·다른 필드·다른 엔드포인트에는 손을 대지 않았고(모두 append-only), import·주석 변경도 실사용처가 있다. 나머지 21개 파일은 review artifact(코드리뷰 19_43_18 + 일관성검토 20_05_42)로, 이 저장소가 표준으로 삼는 "리뷰 라운드 산출물을 그 라운드가 지적한 수정과 함께 커밋" 관례를 그대로 따른 것이며 다른 주제를 섞지 않는다. 불필요한 리팩토링·기능 확장(over-engineering)·무관한 파일 수정·의미 없는 포맷팅·불필요한 주석/임포트·의도치 않은 설정 변경 — 어느 것도 발견되지 않았다.

## 위험도

NONE
