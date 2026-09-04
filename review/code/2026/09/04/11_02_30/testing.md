# 테스트(Testing) 리뷰 — swagger DTO 계약 가드 + nullable 배치 3 잔여

## 발견사항

- **[WARNING]** `ContractMismatch.line`/`.file` 필드가 어떤 테스트에서도 단언되지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:43-54` (`judge`/`axes` 헬퍼)
  - 상세: `axes()` 헬퍼가 `judge(source).map((m) => m.axis).sort()` 로 `axis` 만 뽑아 비교하기 때문에, 가드가 실제로 실패를 보고할 때 개발자가 보게 될 `line`(`swagger-dto-contract-guard.ts:131-132` `sf.getLineAndCharacterOfPosition(...).line + 1`)과 `file`(`path.relative(srcRoot, file)`) 값의 정확성은 어떤 테스트도 검증하지 않는다. 판정(axis) 자체는 매우 촘촘히 대조군을 갖췄지만, 실패 메시지가 가리키는 위치가 틀려도 이 스위트는 계속 초록이다 — 저장소 전수 스캔에서 실제로 offender 가 나왔을 때 엉뚱한 줄을 가리켜도 아무도 못 잡는다.
  - 제안: `judge()`가 반환하는 `ContractMismatch[]` 원본(적어도 하나의 픽스처)에 대해 `line`(픽스처 내 실제 줄 번호)과 `file`(전달한 파일명 relative path)을 함께 단언하는 케이스를 최소 1개 추가한다.

- **[INFO]** `hasTopLevelNull` 이 `ParenthesizedTypeNode` 를 언랩하지 않는다 — `(T | null)` 형태 위음성 가능성, 테스트 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:83-90` (`hasTopLevelNull`)
  - 상세: `!ts.isUnionTypeNode(type)` 이면 즉시 `false` 를 반환한다. 필드 타입이 괄호로 감싼 유니온(`field: (string | null);`)이면 최상위 노드가 `ParenthesizedTypeNode` 라 `ts.isUnionTypeNode` 가 거짓이 되어 `null` 항이 있어도 못 잡는다(위음성). 이 파일의 docstring 은 "정규식으로 세 번 틀렸다" 며 AST 로 전환한 근거를 상세히 남겼는데, AST 구현 자신의 이 구석은 테스트가 없다. 다만 2026-09-04 실측(`grep`)으로 현재 저장소에 `(T | null)` 형태의 DTO 필드는 0건이라 지금 당장 은폐되는 실사례는 없다.
  - 제안: `hasTopLevelNull` 진입 시 `ts.isParenthesizedTypeNode(type)` 이면 `type.type` 으로 한 겹 벗기는 처리를 추가하고, `it('괄호로 감싼 유니온도 최상위로 본다', …)` 캐너리를 `swagger-dto-contract.spec.ts` 의 `[대조군] null 축` 블록에 추가해 회귀를 고정한다. 급하지 않다 — 현재 실사례 0건.

- **[INFO]** `temp-fixture.ts` 자체를 겨눈 전용 단위 테스트가 없다
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:16-42` (`withFiles`, `withFixture`)
  - 상세: `fn` 이 예외를 던져도 `finally` 로 정리되는지, `files` 가 빈 객체일 때의 동작 등은 이 파일만 겨눈 spec 이 없다. 다만 소비처 두 곳(`nullable-type-lie-cast.spec.ts` 30여 곳, `swagger-dto-contract.spec.ts` 20여 곳)이 정상 경로를 광범위하게 반복 호출하므로 정상 동작은 사실상 간접 검증되어 있다. 예외 경로(콜백이 throw 할 때도 tmpdir 이 지워지는지)만 미검증.
  - 제안: 낮은 우선순위. 필요 시 `withFiles({'a.ts':''}, () => { throw new Error('x'); })` 를 `try/catch` 로 감싸고 `fs.existsSync(dir)` 이 false 임을 확인하는 캐너리 1개로 충분하다.

- **[INFO]** `llmConfigId` nullable 수정에 대한 런타임(e2e/컨트롤러) 회귀 테스트가 없다 — 정적 계약 가드만 방어
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:12-19` (`llmConfigId?: string | null`)
  - 상세: 이 필드가 고쳐진 버그는 "OpenAPI `nullable:true` 인데 TS 타입은 `string`" 이라는 **정적 계약 불일치**였고, `swagger-dto-contract.spec.ts` 의 "nullable 선언인데 TS 가 null 불가면 잡는다 — 반대 방향" 테스트가 정확히 이 필드 모양(`@ApiPropertyOptional({ nullable: true }) llmConfigId?: string;`)을 대조군으로 캐너리 삼고 있어 재발은 막힌다. 다만 서비스 코드(`workflow-assistant-session.service.ts:91` `llmConfigId: dto.llmConfigId ?? null`)가 실제로 `null` 요청 바디를 정상 처리하는지 확인하는 e2e 케이스(`codebase/backend/test/workflow-assistant.e2e-spec.ts` — `llmConfigId` 언급 0건)는 이번에도 추가되지 않았다. `class-validator`의 `@IsOptional()`이 `null`/`undefined`를 동일하게 취급하므로 실제 런타임 버그였을 가능성은 낮지만, 이 필드에 대한 최초의 기능 테스트가 여전히 부재하다는 사실 자체는 남는다.
  - 제안: 급하지 않음 — 정적 가드가 재발 방지의 핵심 축을 이미 담당한다. 여유가 있으면 `workflow-assistant.e2e-spec.ts` A 케이스(`POST /sessions`)에 `llmConfigId: null` 페이로드 변형 1개를 추가해 두면 "타입만 고치고 실제 요청 경로는 안 확인했다"는 의문을 완전히 닫을 수 있다.

## 회귀·격리·가독성·Mock 평가 (양호 — 발견사항 아님)

- `swagger-dto-contract-guard.ts`/`.spec.ts` 는 mock 을 전혀 쓰지 않고 실제 `typescript` AST 파서 + 실제 `fs` tmpdir 을 사용한다 — 판정 로직과 실제 컴파일러 동작 사이의 괴리 위험이 없다.
- 각 테스트가 `withFixture`/`withFiles` 로 독립된 `mkdtempSync` 디렉터리를 받고 `finally` 에서 지우므로 테스트 간 격리가 보장된다. `it.each` 반복도 매번 새 tmpdir 을 받아 순서 의존이 없다.
- `[전제]`(vacuous-test guard) 태그로 스캔 대상이 비어 있지 않음을 먼저 단언한 뒤 본 판정을 검사하는 패턴이 두 spec 파일 모두 일관되게 적용돼, "빈 목록이라 통과했다"는 거짓 GREEN 을 구조적으로 막는다.
- `nullable-type-lie-cast.spec.ts` 리팩터(로컬 `withFiles` 제거 → 공유 `temp-fixture.ts` 임포트)는 골격이 100% 동일해 회귀 위험이 없다. 기존 40여 개 테스트 케이스가 모두 그대로 남아 있고 동작 변경이 없다.
- 정규식이 실패했던 3가지 형태(객체 리터럴 타입 안의 `;`, 데코레이터 인자 안의 화살표 함수 `)`, `required` 데코레이터-이름 추론)를 각각 겨눈 대조군 테스트가 `swagger-dto-contract.spec.ts` 에 정확히 대응되어 있어, 회귀 테스트로서의 목적성이 뚜렷하다.
- DTO 변경 2건(`background-run-response.dto.ts`, `create-assistant-session.dto.ts`)은 새 저장소 전수 가드(`OpenAPI 선언과 TS 타입이 어긋난 필드가 없다`)가 그 자체로 회귀 테스트 역할을 한다 — 별도 유닛 테스트가 DTO 파일마다 필요하지 않은 구조.

## 요약

새 `swagger-dto-contract-guard.ts` + `.spec.ts` 는 정규식이 세 번 실패한 이력을 각각 대조군으로 캐너리화하고, `[전제]` 태그로 vacuous-test 를 구조적으로 차단하며, mock 없이 실제 파서·실제 파일시스템으로 검증하는 등 이 저장소의 테스트 관례를 모범적으로 따른다. `temp-fixture.ts` 로의 헬퍼 통합도 골격 변경 없는 순수 추출이라 회귀 위험이 없다. 남은 갭은 모두 경미하다 — 가드가 보고하는 `line`/`file` 필드 자체의 정확성이 테스트되지 않은 점(WARNING), `hasTopLevelNull` 의 괄호-유니온 미언랩(현재 실사례 0건, INFO), `temp-fixture.ts` 자체의 예외 경로 미검증(INFO), `llmConfigId` 수정의 런타임 e2e 부재(INFO, 정적 가드로 사실상 충분) 정도다. 블로킹할 결함은 없다.

## 위험도

LOW
