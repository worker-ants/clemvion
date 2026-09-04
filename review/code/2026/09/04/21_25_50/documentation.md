# 문서화(Documentation) 코드 리뷰

## 검토 방법

이번 changeset(`origin/main...HEAD`)은 실질 코드/문서 변경 6개 파일과, 그 6개 파일을 다루는
선행 4개 리뷰 라운드(코드 리뷰 `19_43_18`→`20_16_17`→`20_39_25`→`21_10_30`, consistency-check
`20_05_42`)의 산출물 59개 파일로 구성된다(`git diff --stat origin/main...HEAD` 로 실측 —
총 65파일, 5,190 삽입/15 삭제).

실질 변경 6개:
- `CHANGELOG.md`
- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`
- `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts`
- `plan/in-progress/spec-draft-nullable-notation-followups.md`

선행 4개 라운드가 매 라운드 문서화 관점 WARNING 을 지적하고 다음 커밋에서 조치하는 사이클을
반복했고, 직전 라운드(`21_10_30`)의 WARNING 2건(테스트 미검증 분기 1건 + plan 문서 재부모화
1건, `documentation` 담당분은 후자 1건)은 커밋 `40005a6e0` 로 조치됐다고 그 RESOLUTION.md 가
주장한다. 이번 라운드는 그 주장을 **저장소를 직접 열어 재검증**했다(Read/Grep 만 사용, 저장소
뮤테이션 없음, `git status --short` 로 확인된 유일한 변화는 이번 라운드 자신의 출력 디렉터리
`review/code/2026/09/04/21_25_50/`).

## 재검증 결과

- **plan 재부모화 (`21_10_30` W2) 조치 확인** — `plan/in-progress/spec-draft-nullable-notation-followups.md`
  를 직접 읽었다. "§5.4 drift 배치 — 2단계" 불릿의 연속 서술((a)/(b) → `(a) 가 왜 안 되는가` 표
  2개 → `ExecutionDto` 3문단 → `notifications` 부분 select 문단)이 다시 그 불릿 바로 아래로
  모여 있고, 신규 planner 항목 2개(`swagger.md` numeric 불변식, `spec/1-data-model.md:873`
  Float 라벨링) + 새로 추가된 3번째 planner 항목(`swagger.md` 내부서사/JSDoc 분리 가이드,
  `21_10_30` INFO#3)은 그 뒤로 밀려 있다. "(b) ... 아래 참조" 가 가리키는 대상도 다시 인접
  블록이 됐다. 재부모화 결함은 해소됐다.
- **`readOption` 캐너리 (`21_10_30` W1) 문서-코드 일치 확인** — `swagger-dto-contract.spec.ts`
  에 신설된 `describe('옵션 리더는 리터럴을 만날 때까지 훑는다', ...)` 의 JSDoc 이 뮤턴트
  (`if (picked !== undefined) return picked;` → `return picked;`)·예측·기존 원칙(`@Transform`
  예외 캐너리)과의 일관성을 정확히 서술하고, 인용한 `(21_10_30 W1)` 은 그 라운드의
  `SUMMARY.md` WARNING #1(`readOption` 미검증 분기)과 정확히 일치한다.
- **`CHANGELOG.md`** — "`GET /api/alerts`"(`/rules` 아님, 컨트롤러 `@Controller('alerts')`
  + `@Get()` 로 재확인), "`list`·`create`·`update` 세 응답 모두"(세 핸들러 모두 반환 타입
  미명시로 재확인), "**영향**: ..." codegen 캐비엇 문단 — 전부 소스와 일치.
- **`alert-rule-response.dto.ts`** — 내부 서사(`//` 주석, `nest-cli.json` swagger 플러그인이
  JSDoc 을 공개 `description` 으로 내보낸다는 경고 포함)와 소비자용 설명(JSDoc, "지금 무엇을
  지켜야 하는가"만)이 분리된 상태 그대로 유지됨.
- **`swagger-dto-contract-guard.ts`/`.spec.ts`** — `readColumnType`·`collectNumericFields`·
  `findNumericAsNumber`·`scanNumericExposure` 전부 "왜 이 축인가"·"왜 정규식이 아니라
  AST 인가"·"알려진 한계(`<Entity>Dto` 이름 관례)"·"왜 offenders 뿐 아니라 scan 결과도
  돌려주는가"를 docstring 에 명시. 인용된 라운드 ID(`20_16_17 W1/W2/W3`, `20_39_25 W1/W3`,
  `21_10_30 W1`)를 각 라운드의 `SUMMARY.md` W-번호와 대조 — 전부 일치.
- **`alerts-threshold-wire-type.e2e-spec.ts`** — 헤더 docstring 이 "왜 e2e 여야 하는가"를
  정적 가드의 구조적 한계(선언 대 선언 비교, 컨트롤러 미명시로 tsc 도 못 봄)로 설명하고, 인용한
  `20_39_25 W4`/`19_43_18 W1` 모두 해당 라운드의 실제 WARNING(런타임 계약 테스트 부재)과
  일치. 테스트 본문 주석("GET 은 DB 를 다시 읽는다 — POST/PATCH 응답은 in-memory 라 …")도
  실제 로직(별도 GET 재조회) 및 값 단언(`Number(...)`, `.toMatch(/^\d+\.\d{4}$/)`)과 부합.

## 발견사항

새로 발견된 문서화 결함 없음.

## 요약

이번 changeset 은 `AlertRuleDto.threshold` 의 OpenAPI 타입 오기(`number`→`string`)를 정정하고,
그 결함 클래스를 재발 방지하는 정적 가드(`findNumericAsNumber`)와 런타임 계약을 고정하는 e2e
테스트를 추가한 것이 실질 변경 전부다. 4차례의 선행 리뷰 라운드가 문서화 관점에서 지적한
항목(영향범위 축소 서술, codegen 영향 고지 누락, plan 산술 불일치, plan 구조적 재부모화, 캐너리
docstring-코드 정합)이 전부 소스 레벨에서 실제로 조치됐음을 이번 라운드가 코드를 직접 열어
독립적으로 재확인했다. 코드 주석·JSDoc·CHANGELOG·plan 트래커 간 상호 참조(라운드 ID·W-번호
인용)도 전수 대조했고 어긋난 자리를 찾지 못했다. `review/**` 하위 59개 산출물 파일은 이 저장소가
표준으로 삼는 "리뷰 라운드 산출물을 그 라운드가 촉발한 수정과 함께 커밋" 관례에 따른 것으로,
선행 scope 리뷰(`20_16_17`)가 이미 이 관례 부합을 확인했으며 이번 라운드에서 다시 볼 새로운
문제도 없다. 결론적으로 이 changeset 은 문서화 관점에서 수렴 상태다.

## 위험도

NONE
