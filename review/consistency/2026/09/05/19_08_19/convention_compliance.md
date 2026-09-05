# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base origin/main)

검토 범위: 이번 브랜치는 `spec/5-system/` 델타가 0개 파일이다(정상 — 코드 전용 PR). 검토는
코드 diff(`origin/main...HEAD`, `codebase/` 26개 파일)가 `spec/5-system/2-api-convention.md`
§5.4(부재 표현) 및 그 자매 규약 `spec/conventions/swagger.md` 를 따르는지에 집중했다.
프롬프트 예산으로 diff 본문 상당수가 잘려 있어, 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`)를
절대경로로 직접 읽어 실측했다.

**선행 검토와의 관계**: 같은 스코프의 직전 검토(`review/consistency/2026/09/05/18_23_03`)가
지적한 CRITICAL 1건(§5.4 금지 조합을 응답 DTO 17개 필드에 확대) · WARNING 2건은 그 뒤 두
커밋(`dfb2664af`, `cb17f0870`)에서 전건 정정되었고, 정정 자체(래칫 가드 신설·전 필드
재분류·트리거 secret 이중 유출 차단)도 코드 레벨로 재확인했다 — 재발 없음.

## 발견사항

- **[WARNING]** §5.4 를 새로 시행하는 정적 가드 파일이 `2-api-convention.md` 자신의
  `code:` 프런트매터에 없다 — 문서 자신이 적은 "양쪽 등재" 원칙을 문서 자신이 어기고 있다
  - target 위치: `spec/5-system/2-api-convention.md` 프런트매터 `code:` (11항목) 및
    §5.4 "검증 층 — 이 규칙을 무엇이 강제하는가" 절(번들 라인 1169~1190)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` = "본 spec 이 약속한
    surface 의 구현 경로") 및 `2-api-convention.md` 자신의 §5.4 검증 층 절이 명시한 원칙
    ("그래서 그 검증자는 **양쪽 문서의 `code:` 에 모두 등재**돼 있다 — 한쪽만 등재하면
    다른 축의 변경이 재검토 트리거를 못 건드린다")
  - 상세: §5.4 "검증 층" 표는 이 규칙을 시행하는 "두 검증자"로
    `repo-guards/__tests__/swagger-dto-contract-guard.ts`(선언↔선언, 정적)와
    `shared/testing/response-contract.ts`(값↔선언, 런타임)를 명시한다. 같은 날 커밋
    (`21182db02`)이 후자(`response-contract*.ts`)와 `swagger-probe*.ts`를
    `2-api-convention.md`·`swagger.md` **양쪽** 프런트매터에 등재했으나, 전자
    (`swagger-dto-contract*.ts`)는 `swagger.md`의 프런트매터에는 이미 있었음에도
    `2-api-convention.md` 쪽에는 **끝내 추가되지 않았다** (`grep` 실측 — 현재
    `2-api-convention.md`의 `code:` 11항목 중 `swagger-dto-contract*` 부재).
    이번 PR 이 정확히 그 사각지대를 실증한다 — `swagger-dto-contract-guard.ts` 에
    `findOptionalNullableResponseFields`(§5.4 가 응답 바디에서 금지한
    `required:false`+`nullable:true` 조합을 잡는 세 번째 축)를 신설했는데, 이 파일 변경은
    §5.4 를 직접 구현/시행하는 변경이면서도 `2-api-convention.md`의 `code:` 매칭 범위 밖에
    있다.
  - 왜 WARNING 인가: 지금 당장 어떤 소비자 계약도 깨지 않지만(§5.4 본문은 여전히 정확하고
    실제 강제는 살아 있다), `2-api-convention.md`의 `code:`를 근거로 "이 spec 이 영향받는
    코드 변경"을 판별하는 도구(`--impl-done`/spec-coverage 류)는 앞으로
    `swagger-dto-contract-guard.ts`만 바뀌고 `response-contract.ts`/`swagger-probe.ts`가
    안 바뀌는 PR에서 이 문서를 재검토 대상으로 못 띄운다 — 바로 문서 자신이 "한쪽만
    등재하면 다른 축의 변경이 재검토 트리거를 못 건드린다"고 경고한 실패 모드다.
  - 제안: `2-api-convention.md` 프런트매터 `code:` 에
    `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts` 한 줄을 추가한다
    (planner 턴 — `spec/` 쓰기 권한 필요). `swagger.md` 쪽은 이미 등재돼 있으므로 변경 불요.

- **[INFO]** 신규 DTO 클래스의 클래스-레벨 JSDoc 에 보안 사고 경위(내부 서사)가 그대로
  들어갔다 — 같은 PR 의 형제 파일이 지키는 `//`/`/** */` 분리 관례와 어긋난다
  - target 위치: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts`
    의 `ScheduleTriggerWorkflowRefDto`/`ScheduleTriggerRefDto` 클래스 선언 바로 위
    `/** ... */` (신규)
  - 위반 규약: `spec/conventions/swagger.md` §3 "JSDoc 은 공개 OpenAPI 로 나간다 — 내부
    서사를 담지 않는다" ("정정 경위·리뷰 참조·'왜 이렇게 바꿨는지' 같은 내부 서사는
    JSDoc 이 아니라 그 위의 `//` 주석에 적는다")
  - 상세: 두 클래스 선언 위 JSDoc 에 "종전 응답은 조인된 `Trigger` **엔티티 전체**를 실어
    보냈고, 거기에는 `notificationSecretV2`(평문 서명 secret)와 `chatChannelTokenV2`가
    들어 있었다 — … **조인을 타고** 새어 나왔다" 는 과거 보안 결함의 경위를 그대로 적었다.
    같은 파일의 다른 클래스(`ScheduleDto`·`CronPreviewDto` 등)와, 같은 PR 의
    `trigger-response.dto.ts`/`integration-response.dto.ts`가 지키는 패턴 — 경위는 `//`,
    `/** */`는 한 줄 소비자 설명 — 과 대조된다. `TriggersService.sanitizeForResponse` 의
    JSDoc(`triggers.service.ts`)도 같은 유출 경위를 담고 있으나 그 파일은 DTO 가 아니라
    서비스라 `swagger.md` §3 대상이 아니다(적용 범위 표 — "DTO·컨트롤러의 JSDoc" 한정).
  - **검증 — 실제로 새어 나가는가**: `@nestjs/swagger` CLI 플러그인
    (`node_modules/@nestjs/swagger/dist/plugin/visitors/model-class.visitor.js`)의
    `createDescriptionAndTsDocTagPropertyAssignments`는 **프로퍼티 선언 노드에만** 호출되고
    (`inspectPropertyDeclaration`/`createDecoratorObjectLiteralExpr` 경유), 클래스 선언
    자체의 JSDoc 을 스키마 `description` 으로 승격하는 경로는 이 버전에 **없다**(실측 —
    `ApiSchema`/클래스 코멘트 처리 코드 grep 0건). 따라서 이번 건은 **현재는** 공개
    OpenAPI 로 새지 않는다 — 위 CRITICAL 후보를 INFO 로 낮추는 근거다.
  - 제안: 그럼에도 규약 문면("DTO 의 `/** ... */`")은 클래스/프로퍼티를 구분하지 않으므로,
    플러그인 동작에 기대지 말고 경위 문단을 `//` 로 옮겨 같은 파일의 다른 클래스·형제 PR
    파일과 패턴을 맞추는 편을 권한다(필수는 아님 — 현재 실해 없음).

## 요약

이번 브랜치의 코드 diff 는 직전 검토(18_23_03)가 지적한 §5.4 위반(CRITICAL 1·WARNING 2)을
전건 정정했고, 트리거 회전 secret 의 이중 유출 차단·§5.4 스윕 24필드 선언·third-axis 래칫
가드 신설 모두 코드·테스트로 재확인된다(뮤턴트 RED 확인 포함). 새로 발견된 것은 기능적
결함이 아니라 **문서-대-문서 정합**의 잔여 틈 하나(§5.4 검증자 중 정적 가드가
`2-api-convention.md`의 `code:` 프런트매터에서 빠져 있음 — 같은 날 커밋이 나머지 한
검증자는 양쪽에 등재하며 세운 원칙을 정작 자신이 완전히 지키지 못한 경우)와, 실해는 없지만
관례 일관성이 아쉬운 클래스 JSDoc 서사 배치 1건이다. 전체적으로 이 PR 은 §5.4/§5-1 규약을
더 촘촘하게 만드는 방향으로 수렴했다.

## 위험도

LOW
