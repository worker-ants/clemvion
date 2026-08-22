STATUS=success testing review complete — 0 CRITICAL, 0 WARNING, 3 INFO

===REPORT_MARKDOWN_BELOW===

# 테스트(Testing) 리뷰 — `execute` 요청 본문 OpenAPI 문서화 (재검토, `00_07_27` fix 반영 후)

## 배경

이 라운드는 직전 리뷰(`00_07_27`)의 테스트 WARNING("PR 의 실제 목적인 OpenAPI 노출 자체를 검증하는
테스트가 없다")에 대한 fix 를 재검토한다. `RESOLUTION.md` W3 에 따라
`workflows-execute-body.spec.ts` 에 `describe('POST /workflows/:id/execute OpenAPI 노출', ...)`
블록(가드 4건)이 추가됐다. 실제 파일(`codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts`,
168줄)을 직접 `Read` 로 열어 확인했다 — 프롬프트 게이트 번호와 실제 파일 줄 번호가 1:1 일치한다.

## 발견사항

- **[INFO]** 신규 가드가 `@nestjs/swagger` 의 비공개 내부 메타데이터 키 문자열
  (`'swagger/apiParameters'`)에 의존한다
  - 위치: `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts:101-103`
    (`Reflect.getMetadata('swagger/apiParameters', WorkflowsController.prototype.execute)`)
  - 상세: `design:paramtypes`(기존 캐너리, TS 표준 reflect-metadata 키)와 달리
    `swagger/apiParameters` 는 `@nestjs/swagger` 패키지 내부 구현 상수(`DECORATORS.API_PARAMETERS`)를
    문자열로 재현한 것이다. 라이브러리 메이저 업그레이드로 키 이름이 바뀌면 이 테스트는 조용히
    다른 결과를 내는 대신 `expect(params).toBeDefined()` 에서 즉시 loud 하게 실패하므로 안전 방향
    실패이긴 하나, 유지보수 시점에 "이게 왜 깨졌지" 라는 디버깅 비용이 생긴다.
  - 제안: 필수 아님(현재도 loud failure 라 안전). 주석에 "내부 상수 문자열 의존, 버전 업그레이드 시
    재확인" 정도만 남겨도 충분.

- **[INFO]** "스키마 렌더링" 서브블록은 실제 `WorkflowsController` 가 아니라 로컬 `StubController` 로
  문서를 생성한다 — 실제 앱의 `paths['/workflows/{id}/execute'].post.requestBody` 가 `$ref` 로
  `ExecuteWorkflowDto` 를 정확히 가리키는지는 이 스펙이 직접 검증하지 않는다
  - 위치: `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts:118-141`
    (`beforeAll` 안의 `StubController` + `SwaggerModule.createDocument`)
  - 상세: 이 파일은 두 메커니즘으로 나눠 검증한다 — (1) 실 컨트롤러의 `swagger/apiParameters`
    메타데이터가 `ExecuteWorkflowDto`/`required:false` 를 갖는지(라인 100-113), (2) `ExecuteWorkflowDto`
    자체가 `SwaggerModule.createDocument()` 를 통해 올바른 스키마로 렌더링되는지(라인 115-166, 단
    stub 컨트롤러로). 둘을 합치면 "실 컨트롤러가 올바른 DTO 를 참조" + "그 DTO 가 올바르게
    렌더링됨" 은 커버되지만, "실 컨트롤러 기준으로 빌드한 전체 문서의 `paths[...].requestBody`
    노드가 정확히 그 스키마를 `$ref` 하는가" 라는 end-to-end 체인 자체는 어느 쪽도 직접 단언하지
    않는다. 다만 이 트레이드오프는 저장소 기존 관례(`interact-ack-response.dto.spec.ts` 도 동일하게
    실 컨트롤러 대신 `StubController` 사용)와 일치하고, `RESOLUTION.md` 가 보고한 뮤테이션 실측
    (`@ApiBody({ type: ExecuteNodeDto })` 로 바꿨을 때 새 가드만 단독 RED)이 정확히 이 시나리오의
    가장 유력한 회귀(형제 DTO 오참조)를 실증적으로 잡아낸다는 점에서 실질 위험은 낮다.
  - 제안: 조치 불요(선택). 원한다면 `AppModule` 전체를 부팅해 `doc.paths['/workflows/{id}/execute'].post.requestBody`
    를 직접 단언하는 e2e 성격 테스트를 별도로 추가할 수 있으나, 비용 대비 이미 확보된 뮤테이션
    증거를 고려하면 필수는 아니다.

- **[INFO]** "마커 거부 규칙" 가드가 부분 문자열 포함 여부만 확인하는 약한 단언이다
  - 위치: `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts:160-165`
    (`expect(prop.description).toEqual(expect.stringContaining('마커'))`)
  - 상세: 두 필드 description 어딘가에 "마커" 라는 단어만 있으면 통과한다 — 실제 거부 규칙의
    정확한 문구(예: "정확히 일치하는 값은 400 거부")까지는 검증하지 않는다. 이는 의도적 설계로
    보인다(`egress-masking.md §3` 에 따라 마커 리터럴을 테스트에 재적지 않기로 한 plan 상의 결정과
    일치) — 즉 "개념이 언급됐는가" 캐너리이지 "문구가 정확한가" 캐너리가 아니다. W1 재발(한쪽
    필드에만 적고 다른 쪽 누락)은 이 단언으로 확실히 잡히므로 원래 목적은 충분히 달성한다.
  - 제안: 조치 불요. 필요시 `stringContaining('마커')` 대신 두 필드가 **동일한** 거부 문구를 공유하는지
    (`toContain`) 비교하는 방식으로 더 강화할 수 있으나 선택 사항.

## 검증한 내용 (문제 없음 확인)

- `it('[가드] 실 컨트롤러의 @ApiBody 가 ExecuteWorkflowDto 를 참조한다', ...)` 는 `RESOLUTION.md` 가
  보고한 뮤테이션(`@ApiBody({ type: ExecuteNodeDto })`)이 정확히 여기서만 RED 가 됨을 실측으로
  확인했다고 기록돼 있다 — 직전 라운드 WARNING("복붙 실수가 전혀 안 잡힘")이 구조적으로 해소됐다.
  이 가드는 `WorkflowsController.prototype.execute` 라는 **실 컨트롤러**를 직접 읽으므로, "스키마
  렌더링" 블록의 stub 우회와 달리 실제 배선 오류(형제 DTO 오참조·데코레이터 누락)를 정확히 잡는다.
- Mock 사용 없음 — `CustomValidationPipe` 는 실제 인스턴스, `SwaggerModule.createDocument` 도 실제
  Nest 모듈 컴파일 결과로 문서를 생성한다. Mock/실제 동작 괴리 위험이 낮다.
- 테스트 격리: `it.each` 3케이스(정상/여분 키/빈 객체) 각각 `new CustomValidationPipe()` 를 새로
  생성해 상태 공유가 없다. `beforeAll` 로 만든 Nest 앱은 `finally` 블록에서 `app.close()` 로 정리돼
  (라인 138-140) 리소스 누수·다른 스펙 파일과의 간섭 위험이 낮다. `schema` 변수는 세 `it` 에서
  읽기 전용으로만 쓰여 순서 의존성이 없다.
- 회귀: 이 diff 는 `@ApiBody` 데코레이터 추가와 신규 import 뿐이라 `workflows.controller.spec.ts`
  등 `execute()` 를 직접 호출하는 기존 유닛 테스트에는 영향이 없다 — `execute()` 의 런타임 로직
  (`parameterValues ?? input.parameters` 병합, `resolveTriggerParametersRejectingMasked` 호출)은
  이번 diff 로 전혀 바뀌지 않았다(`workflows.controller.ts` 300줄대, 코드 직접 대조).
  `ExecuteWorkflowDto`/`ApiBody` import 충돌도 없음(기존 `ApiBadRequestResponse` 등과 이름 중복 없음).
- 대조군(`it.each`) 케이스 선택이 적절하다 — 정상/여분 키/빈 객체 세 경계를 다뤄 "class-validator
  데코레이터가 없어 **빈 객체조차** 거부한다"는 docstring 의 강한 주장(라인 70-73)까지 실제로
  단언한다.
- 테스트 가독성: `[캐너리]`/`[대조군]`/`[가드]` 라벨링과 "여기가 RED 면 …" 형태의 한국어 docstring 이
  각 테스트의 존재 이유·실패 시 의미를 명확히 설명한다.

## 요약

직전 라운드 테스트 WARNING(OpenAPI 노출 자체를 검증하는 테스트 부재)은 `swagger/apiParameters`
실 컨트롤러 메타데이터 가드 + `ExecuteWorkflowDto` 전용 스키마 렌더링 검증 3건으로 구조적으로
해소됐고, `RESOLUTION.md` 가 보고한 뮤테이션 실측(형제 DTO 오참조 뮤턴트에서 새 가드만 단독 RED)도
그 판별력을 뒷받침한다. Mock 미사용·테스트 격리 양호·라벨링을 통한 가독성도 확보됐다. 남은 항목은
전부 INFO 수준(내부 메타데이터 키 문자열 의존·stub 컨트롤러 기반 렌더링이라 실 컨트롤러 기준
`requestBody.$ref` 체인 자체는 미검증·마커 단언이 부분 문자열 수준)으로, 셋 다 기존 저장소 관례와
일치하거나 실측된 뮤테이션 증거로 실질 위험이 낮다. 신규 로직 없이 순수 문서화 diff 라는 점을
감안하면 테스트 커버리지는 충분하다.

## 위험도

LOW
