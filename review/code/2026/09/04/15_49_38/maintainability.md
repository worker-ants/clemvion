# 유지보수성(Maintainability) 리뷰

## 검토 범위

`origin/main..HEAD` 45개 파일 중 실질 애플리케이션/테스트 코드는 2개뿐이다:

- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` — `ExecutionStatusDto` 5필드(`durationMs`·`currentNode`·`context`·`result`·`error`)를 `@ApiPropertyOptional` + `field?:` 에서 `@ApiProperty` + `field:` 로 전환 (mechanical, 동작 불변).
- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts` — 위 5필드 목록을 `NULL_PRESENT_FIELDS` 상수로 추출해 `nullable` 단언과 신설 `required` 단언이 같은 목록을 공유하게 리팩터.

나머지는 `CHANGELOG.md`, `plan/**` 갱신, `review/code/14_54_36`·`review/code/15_22_06`·`review/consistency/**` 하위의 신규 리뷰 산출물(write-once report)이다. 후자는 "유지보수되는 코드"가 아니라 특정 시점 스냅샷이라 함수 길이·중첩·매직넘버 같은 코드 관점 기준이 적용되지 않는다 — 문서/plan 관점에서만 훑었다.

## 발견사항

- **[INFO]** 테스트 코드 리팩터가 실제로 유지보수성을 개선한다
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts` — `NULL_PRESENT_FIELDS` 상수 선언부 및 이를 소비하는 두 `it`/`it.each` 블록
  - 상세: 종전에는 `nullable` 축을 검사하는 `it.each` 가 필드 목록을 하드코딩만 하고 있어, 새 nullable 필드가 추가돼도 `required` 축 검사가 없었다(이번 diff 이전 상태). 이번 변경은 (1) 목록을 `NULL_PRESENT_FIELDS` 상수 하나로 통합해 두 단언이 같은 SoT 를 공유하게 하고, (2) `required` 배열을 직접 단언하는 테스트를 신설했다. 목록이 늘어날 때 한쪽만 갱신되는 drift 경로를 구조적으로 차단한다 — 중복 코드 제거의 좋은 예다.
  - 제안: 없음 (개선 사항 기록 목적).

- **[INFO]** DTO 소스 변경은 순수 기계적 치환이라 유지보수성 리스크가 낮다
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` — `ExecutionStatusDto` 클래스 내 5개 필드 데코레이터
  - 상세: `@ApiPropertyOptional({...})` → `@ApiProperty({...})` + `field?:` → `field:` 로 5곳 모두 동일 패턴 적용. 같은 파일의 `WaitingContextBaseDto.conversationThread` 는 여전히 `@ApiPropertyOptional` 을 쓰므로(진짜 optional 의미), `ApiPropertyOptional` import 가 죽지 않고 남아 있는 것도 올바르다. 필드별 JSDoc(예: "종결 전에는 null (키 present — API 규약 §5.4)")이 이미 존재해 변경 의도가 코드 자체에서 드러난다.
  - 제안: 없음.

- **[INFO]** 테스트 코드 내 "리뷰 1R W2" 류 회귀 근거 주석은 이 저장소의 기존 컨벤션과 일치
  - 위치: `execution-status-response.dto.spec.ts` — `## \`required\` 축을 직접 단언한다 (리뷰 1R W2)` 주석 블록
  - 상세: 리뷰 라운드/발견 번호를 코드 주석에 남기는 패턴은 `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`, `websocket.gateway.ts`, `websocket-events.types.ts`, `temp-fixture.ts` 등 기존 코드베이스에 다수 선례가 있어 새로 도입된 스타일이 아니다. 다만 이런 주석이 참조하는 리뷰 세션 산출물(`review/code/**`)은 `plan/complete/archive` 처럼 영구 보존이 보장되는 위치가 아니므로, 시간이 지나 그 산출물이 정리되면 "왜 이 단언이 필요한가" 의 1차 근거는 결국 주석 본문(§5.4 인용 포함)에 남아 있어야 한다 — 이번 diff 는 그 본문을 충분히 상세하게 남겨 문제가 없다.
  - 제안: 없음, 기록 목적.

- **[INFO]** `CHANGELOG.md` 신규 항목이 매우 장문의 자기서사(self-narrating) 형식 — 기존 컨벤션과 일관되나 항목이 누적되며 파일 길이가 계속 커진다
  - 위치: `CHANGELOG.md:3` (`## Unreleased — \`ExecutionStatusDto\` 5곳의 \`required\` 가 \`false\` → \`true\`` 항목 전체)
  - 상세: 이 저장소의 `CHANGELOG.md` 는 이미 2,000줄을 넘었고, 각 `## Unreleased` 항목이 "왜 처음 판단이 틀렸는가" 를 포함한 서사형 문단을 여러 개 갖는 형식이 정착돼 있다(바로 아래 기존 항목도 동일 패턴). 이번 항목도 그 컨벤션을 그대로 따르므로 **새로운 문제는 아니다**. 다만 항목 하나가 코드 변경 내용(5필드 데코레이터 전환)보다 "그 결론에 도달한 과정"(104→83→15→5로 좁힌 서사) 서술에 더 많은 분량을 쓰고 있어, 이 파일을 "무엇이 바뀌었는가" 를 빠르게 훑는 용도로 쓰는 독자에게는 스캔 비용이 계속 증가한다.
  - 제안: 조치 불요(기존 컨벤션 일관 적용). 장기적으로 항목이 더 누적되면 "요약 1~2문장 + 상세 접기/링크" 형태로의 포맷 전환을 고려할 수 있으나 이번 diff 범위의 문제는 아니다.

## 요약

이번 changeset 의 실질 애플리케이션/테스트 코드 변경은 `ExecutionStatusDto` 5필드의 `@ApiPropertyOptional`→`@ApiProperty` 기계적 전환 1건과, 그 필드 목록을 공유 상수로 추출해 두 축(`nullable`/`required`) 단언의 drift 를 구조적으로 막은 테스트 리팩터 1건뿐이며 둘 다 가독성·네이밍·함수 길이·중첩·복잡도 어느 기준에서도 결함이 없고 오히려 중복 제거로 유지보수성을 개선했다. 나머지 43개 파일은 `CHANGELOG.md`/`plan/**` 문서 갱신과 이전 리뷰 세션의 write-once 산출물(`review/code/**`, `review/consistency/**`)이라 전통적 코드 유지보수성 기준(함수 길이·중첩·매직넘버 등)이 적용되지 않는다 — `CHANGELOG.md` 의 장문 서사형 항목이 파일 길이를 계속 늘리는 점만 기존 컨벤션과 일관된 특성으로 기록해 둔다. CRITICAL/WARNING 급 발견사항은 없다.

## 위험도

NONE
