# 문서화(Documentation) 코드 리뷰

## 검토 범위와 방법

`origin/main...HEAD` 실질 변경은 6개 파일이다(그 외 84개 파일은 이전 리뷰/consistency
라운드(`19_43_18`·`20_16_17`·`20_39_25`·`21_10_30`·`21_25_50`·`21_45_58`·`20_05_42`)의
산출물이 `review/**` 관례에 따라 신규 커밋된 아카이브이며, 이번 diff 가 만든 신규 서술이
아니다):

1. `CHANGELOG.md` (+38)
2. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` (+13/-2)
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (+245)
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` (+258)
5. `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` (신규 119줄)
6. `plan/in-progress/spec-draft-nullable-notation-followups.md` (+64/-4)

이 changeset 은 이미 6차례의 코드 리뷰(그중 5개 라운드에 documentation 관점 포함)와
1차례의 consistency-check 를 거쳤다. 매 라운드가 지적한 문서화 WARNING(라우트 표기
오기, 결함 영향 범위 축소 서술, CHANGELOG 영향 문단 누락, plan 문서 산술 불일치
59/57, JSDoc 이 공개 API 문서로 새는 문제, 정규식→AST 전환 후 docstring 과 구현의
모순, 포지셔널 `@Column` 을 놓치는 `readColumnType` 미문서화 한계, `readOption` 제네릭
캐너리의 인스턴스별 계약 등)이 후속 라운드에서 실제로 정정됐는지를 저장소 현재 상태
(`HEAD=a9e65ac64`)에서 직접 재확인했다(저장소 쓰기 없음, `Read`/`grep`/`git` 전용).

## 재확인 결과

- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — 내부
  서사는 `//`(20-23행), 소비자용 설명은 `/** */`(24-27행)으로 분리되어 있다. `swagger.md`
  §JSDoc 분리 가이드가 아직 규약화되지 않은 사실도 plan 에 planner 항목으로 정확히
  등재돼 있다(`spec/` 는 developer 쓰기 권한 밖).
- `CHANGELOG.md:1-38` — "`list`·`create`·`update` 세 응답 모두" 로 원인 범위가 정정되어
  있고, 다른 항목들과 동일한 형식의 `**영향**:` 문단도 포함한다. 라우트 표기는
  `GET /api/alerts`(정확 — `alerts.controller.ts` `@Controller('alerts')` + `@Get()`)로,
  더 이상 `GET /api/alerts/rules` 오기가 남아 있지 않다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md:285-303` — "불일치 59건"
  서술과 분류표 합계(46+6+4+**3**=59)가 일치한다.
- `swagger-dto-contract-guard.ts` — 파일 상단 docstring("정규식으로 세 번 틀렸다 → AST 로")
  과 `readColumnType`/`collectNumericFields` 의 실제 구현(포지셔널·옵션 두 형태 모두 AST 로
  읽음)이 서로 모순되지 않는다. 각 함수 JSDoc 이 라운드 ID(`20_16_17` W1, `20_39_25` W1/W3,
  `20_16_17` W2/W3)를 인용하는데, 대조(`grep`)해 보니 인용된 라운드의 `RESOLUTION.md`
  기록과 정확히 일치한다.
- `swagger-dto-contract.spec.ts` — `readOption` 제네릭의 두 인스턴스(boolean/string)가
  각각 캐너리로 고정돼 있고(`5076b7e81`), 테스트 이름이 "boolean 리더 —"/"string 리더 —"
  로 어느 인스턴스를 무는지 명시한다.
- `alerts-threshold-wire-type.e2e-spec.ts` — "왜 정수가 아니라 소수부 4자리 값을 쓰는가"
  (`CREATED_THRESHOLD = 12.3456`)에 근거 주석이 있고, 실제로 `numeric(12,4)` 의 scale 을
  가득 채우는 값이다(round `21_25_50` INFO#2 조치와 일치 확인).

## 발견사항

새로 발견된 CRITICAL/WARNING 없음.

- **[INFO]** `@ApiProperty({ type: String, ... })` 명시 스타일에 대한 사유 주석은 여전히
  코드에 없다 — 다만 이는 이미 실측·검토를 거쳐 의도적으로 유예된 항목이다
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:28`
  - 상세: 같은 파일의 다른 `string` 필드(`id`·`workspaceId`·`createdAt`·`updatedAt`)는
    `type: String` 을 명시하지 않고 리플렉션 추론에 맡기는데, `threshold` 만 명시한다.
    이 스타일 비일관성은 `20_16_17` maintainability 라운드에서 처음 지적됐고, 최신
    `21_45_58` RESOLUTION 의 "나머지 INFO 처분" 표 8번 항목에서 "이 필드는 방금
    `number → string` 으로 정정한 자리라 명시가 의도이지만, 그 의도가 코드에 안 적혀
    있다는 지적은 맞다 — 다음에 같은 자리를 건드릴 때 한 줄 남긴다" 로 **의도적으로
    미조치** 처분됐다. 소스를 직접 열어 확인한 결과 그 사유 주석은 지금도 없다 — 처분
    기록과 코드 상태가 일치하므로 이번 라운드의 새 결함은 아니다.
  - 제안: 조치 불요(이미 사유와 함께 유예됨). 참고로만 재확인.

- **[INFO]** `review/**` 아카이브 33개 파일(코드리뷰 6라운드 + consistency 1라운드)이
  각 라운드 시점의 스냅숏 서술을 그대로 담고 있어, 이후 라운드가 정정한 사실과 문자
  그대로는 어긋나는 문장이 다수 남아 있다(예: `19_43_18/documentation.md` 의 "list() 만
  언급" 지적, `20_05_42/naming_collision.md` 의 이후 삭제된 `NUMERIC_COLUMN` 정규식 상수
  서술)
  - 위치: `review/code/2026/09/04/19_43_18/documentation.md`,
    `review/consistency/2026/09/04/20_05_42/naming_collision.md` 등
  - 상세: 이는 결함이 아니라 이 저장소가 명시적으로 채택한 "리뷰 산출물 = 시점 스냅샷"
    관례다(`20_39_25`·`21_45_58` documentation 라운드가 이미 같은 결론을 냈다). 각 라운드의
    `RESOLUTION.md` 가 후속 조치를 명시적으로 기록하므로 독자가 시점을 추적할 수 있고,
    현재 상태의 SoT 는 `CHANGELOG.md`/`plan/**` 최신본이다.
  - 제안: 조치 불요. 이미 6라운드째 동일 판단이 반복되고 있어, 다음 documentation 라운드가
    또 같은 재확인을 반복하지 않도록 이번 `RESOLUTION.md`(작성 예정)에 "이 관례는 확립됐고
    더 이상 재검증 대상이 아니다" 라는 한 줄을 남기는 것을 고려할 만하다(선택 사항, 리뷰
    비용 절감 목적).

## 항목별 점검 결과

1. **독스트링/JSDoc**: 신규 함수(`readOption`/`readColumnType`/`findNumericAsNumber`/
   `scanNumericExposure` 등) 전부에 "왜 필요한가·어떤 위음성을 재현했는가·알려진 한계"가
   함수 단위로 기록되어 있고 실제 구현과 대조해도 정확하다.
2. **README 업데이트**: 사용자 대면 기능·설정 추가가 아니므로 불요.
3. **API 문서**: `AlertRuleDto.threshold` OpenAPI 타입 변경이 `CHANGELOG.md` 에 영향
   문단까지 포함해 기록되어 있다.
4. **주석 정확성**: 가드 파일의 라운드 ID 인용 전부(`20_16_17`/`20_39_25`/`20_05_42`)를
   해당 라운드 `RESOLUTION.md` 와 대조해 정확함을 확인했다.
5. **인라인 주석**: e2e 스펙의 정밀도-손실 논거, 가드의 "리터럴을 만날 때까지 훑는다"
   논거 등 비직관적 결정에 근거 주석이 있다.
6. **변경 이력**: `CHANGELOG.md` 갱신 충분. 내부 test/repo-guard 전용 변경은 이 저장소
   관례상 CHANGELOG 대상이 아니다(선행 커밋 `b79dafdf9` 도 동일).
7. **설정 문서**: 신규 환경변수·설정 옵션 없음.
8. **예제 코드**: `swagger-dto-contract.spec.ts` 의 `[대조군]` 테스트들이 술어 사용법의
   실행 가능 예제 역할을 한다.

## 요약

이번 changeset 의 실질 문서화 대상은 6개 파일이며, 6차례의 선행 코드 리뷰(+1 consistency
라운드)가 지적한 모든 문서화 WARNING 이 저장소 현재 상태에서 실제로 정정돼 있음을 소스
레벨(`Read`/`grep`)로 재확인했다 — CHANGELOG 영향범위·형식, plan 문서 산술 일치, JSDoc
내부/공개 서사 분리, 가드 docstring 과 구현의 정합성, 라운드 ID 교차 참조 정확성 전부
이상 없다. 새로 발견된 CRITICAL/WARNING 은 없다. 유일하게 남은 항목(`type: String` 명시
스타일에 사유 주석 부재)은 이미 최신 라운드가 근거와 함께 명시적으로 유예한 상태이고,
`review/**` 아카이브의 시점-스냅숏 서술 잔존도 이 저장소의 기존 관례에 부합해 결함이
아니다.

## 위험도

NONE
