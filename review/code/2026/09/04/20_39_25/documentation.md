# 문서화(Documentation) 코드 리뷰

## 검토 방법

이번 changeset(`origin/main...HEAD`, 38개 파일)은 실질 코드 3개(`CHANGELOG.md`,
`alert-rule-response.dto.ts`, `swagger-dto-contract-guard.ts`/`.spec.ts`), plan 문서 1개, 그리고
직전 두 라운드(코드 리뷰 `19_43_18`·`20_16_17`, consistency-check `20_05_42`)의 산출물 33개로
구성된다. 이 산출물들은 이미 이 diff 범위 안의 문서화 관점을 **두 차례(코드 리뷰 8명 ×2)와
consistency-check 5개 checker** 로 매우 촘촘히 검토했고, `20_16_17` 라운드의
`documentation.md`(위험도 NONE)는 CHANGELOG·JSDoc·plan 문서를 실제 엔티티·컨트롤러·프런트엔드
소스와 line-level 대조까지 마쳤다.

이번 라운드에서 새로 추가된 것은 `20_16_17` 리뷰가 지적한 `maintainability` WARNING(정규식→AST,
경로 정규화, 이름 관례 한계)에 대한 fix 커밋(`c15489e61`) 뿐이다. 저장소를 직접 읽어 이 fix 가
실제로 반영됐는지, 그리고 그 과정에서 새 문서화 결함이 생기지 않았는지 독립 재검증했다(저장소
뮤테이션 없음, `Read`/`grep`/`git`만 사용).

## 재검증 결과

- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 전체를 열어 확인 —
  `findNumericAsNumber`/`collectNumericFields`/`collectDtoFieldTypes`가 실제로 AST(`callDecorators`,
  `readStringOption`)로 구현되어 있고, 각 함수 JSDoc 이 "왜 정규식이 아닌가", "왜 이름 관례에
  의존하는가(알려진 한계)", "경로는 POSIX 정규화 후 비교한다"는 이유를 정확히 서술한다. 파일
  상단의 "정규식으로 세 번 틀렸다" docstring 과 신규 함수의 실제 구현이 이제 서로 모순되지 않는다
  (`20_16_17` W1 시정 확인).
- `codebase/backend/src/common/__test-utils__/source-scan.ts` 에 `toPosixPath`/`toPosixRelative`
  export 존재를 확인 — guard 파일의 import 가 유효하다.
- `codebase/backend/src/common/__test-utils__/temp-fixture.ts` 에 `withFiles` export 존재를 확인 —
  `swagger-dto-contract.spec.ts` 의 신규 import 가 유효하다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 분류 표를 현재 상태로 재확인 —
  `46 + 6 + 4 + 3 = 59` 로 정정되어 있고("마지막 행을 처음엔 '실제 불일치 1' 로 적었다…" 원인
  설명 포함), `19_43_18` W4 산술 불일치가 실제로 닫혔다.
- `CHANGELOG.md` 상단 항목을 재확인 — `list`/`create`/`update` 세 응답 모두 언급, `**영향**:`
  코드젠 캐비엇 포함, 라우트 표기 `GET /api/alerts`(정확) — `19_43_18` W2/W3 시정 확인.
- `git show c15489e61` 커밋 메시지가 W1~W4 조치를 실측(뮤테이션 예측/실측 표 포함)과 함께
  정확히 서술하며, `review/code/2026/09/04/20_16_17/RESOLUTION.md` 의 조치 서술과 코드 상태가
  정확히 일치한다.

이 fix 커밋은 내부 test/repo-guard 도구 변경이라 CHANGELOG 항목이 없다 — 같은 성격의 선행
커밋(`b79dafdf9`, repo-guard walker 통합)도 CHANGELOG 항목이 없어 저장소 관례와 일치한다(API
계약 변경이 아니므로 정상).

## 발견사항

- **[INFO]** consistency-check 산출물(`naming_collision.md`)이 이후 fix 커밋으로 제거된 심볼을
  여전히 "존재"로 서술 — 스냅샷 관례상 결함 아님
  - 위치: `review/consistency/2026/09/04/20_05_42/naming_collision.md` (`NUMERIC_COLUMN
    (정규식 상수) | swagger-dto-contract-guard.ts:216`)
  - 상세: 이 파일은 20:05 시점(fix 커밋 `c15489e61`, 20:32 이전)에 실행된 consistency-check
    산출물이며, 그 시점엔 `NUMERIC_COLUMN` 정규식 상수가 실제로 216번째 줄에 있었다. 그러나
    `c15489e61` 이 정규식 축을 AST 로 전면 교체하면서 `NUMERIC_COLUMN` 자체가 삭제됐다(현재
    저장소 전수 `grep` 결과 0건). 따라서 이 committed 산출물은 지금은 존재하지 않는 심볼을
    "모듈-로컬, 충돌 없음"으로 서술하고 있다. 다만 이는 `20_16_17` 라운드의 `documentation.md`
    가 이미 확립한 것과 동일한 패턴이다 — 그 라운드는 `19_43_18` 산출물에 남은 잘못된
    `/api/alerts/rules` 라우트 표기를 두고 "리뷰 산출물은 그 시점의 기록을 보존하는 것이
    이 저장소의 관례이고, 실제 오류는 이미 후속 라운드가 인지·정정했으므로 새 결함으로 보고하지
    않는다"고 명시적으로 판단했다. 같은 논리가 이번 `NUMERIC_COLUMN` 케이스에도 적용된다 — 판정
    결론("충돌 없음") 자체는 지금도 여전히 참이고, 서술 대상 심볼명만 fix 커밋으로 사라졌을 뿐이다.
  - 제안: 조치 불요(기존 확립된 스냅샷 보존 관례를 따름). 참고로만 기록.

## 요약

이번 라운드의 실질 신규 변경은 `20_16_17` 리뷰의 maintainability WARNING(정규식→AST 전환·경로
정규화·이름 관례 한계 문서화)에 대한 fix 커밋(`c15489e61`) 하나이며, 소스를 직접 열어 재검증한
결과 JSDoc/docstring 이 실제 구현(AST 기반, POSIX 정규화, 알려진 한계 서술)과 정확히 일치했다.
이전 두 라운드가 지적한 CHANGELOG 영향범위·codegen 캐비엇·plan 산술(59 vs 57) 문제도 모두
소스 레벨에서 재확인된 상태로 남아 있다. 유일하게 새로 관측한 것은 committed consistency-check
산출물(`naming_collision.md`)이 fix 커밋으로 삭제된 `NUMERIC_COLUMN` 심볼을 여전히 존재하는
것처럼 서술한다는 점인데, 이는 이 저장소가 이미 확립한 "리뷰 산출물은 시점 스냅샷" 관례에 정확히
부합하므로 결함으로 보지 않는다. 이번 diff 5개 실질 파일에서 새로운 문서화 결함은 발견하지
못했다.

## 위험도

NONE
