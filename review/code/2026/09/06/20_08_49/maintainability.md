# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `@ApiConflictResponse` 설명 문자열이 두 데코레이터에 문자 그대로 중복되고, 그 문자열이 계약 값(리터럴 코드)을 담고 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `create()` 데코레이터 (`@ApiConflictResponse` 블록, `description:` 줄), `update()` 데코레이터 (동일 `@ApiConflictResponse` 블록)
  - 상세: 두 자리에 `'동일 워크스페이스에 같은 \`endpointPath\` 를 쓰는 트리거가 이미 존재. \`code=RESOURCE_CONFLICT\`, \`details.field="endpoint_path"\`, \`details.code="TRIGGER_ENDPOINT_PATH_CONFLICT"\`.'` 가 문자 단위로 동일하게 복제돼 있다. 같은 파일이 이미 짧은 설명 문자열(`'인증 실패 또는 토큰 만료'`·`'editor 이상 권한 필요'` 등)을 여러 데코레이터에 반복하는 관례를 갖고 있어 이 자체가 스타일 이탈은 아니다. 다만 이 문자열은 다른 것들과 달리 `triggers.service.ts`(`rethrowEndpointPathConflict`)가 실제로 던지는 `code`/`details.field`/`details.code` **리터럴 값**을 그대로 옮겨 적은 것이라, 서비스 쪽 값이 바뀌면 두 데코레이터 모두 손으로 따라가야 하고 하나만 놓치면 문서와 실제 응답이 갈린다.
  - 제안: 조치 불요에 가깝다(기존 파일 관례와 일치, Swagger 문서 텍스트일 뿐 런타임 영향 없음). 다만 값을 두 번 손으로 옮겨 적는 대신, 같은 상수(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 옆)로 `code`/`details.code` 키를 빼서 설명 문자열에 템플릿 리터럴로 삽입하거나, 최소한 한 줄 주석으로 "이 문자열은 `rethrowEndpointPathConflict` 의 payload 와 동기화되어야 한다" 를 남기면 다음 편집자가 드리프트를 놓칠 확률이 줄어든다.

- **[INFO]** `_parse_frontmatter_code` 의 block-list 분기가 지역 헬퍼 2개 + 중첩 while/if 로 다소 두꺼워졌다
  - 위치: `.claude/hooks/_lib/review_guard.py` — 함수 `_parse_frontmatter_code` 내부 `_strip_comment`/`_clean` 지역 함수 정의부와, 뒤이은 `while i < n` → `else:` 블록의 `while j < n` 중첩 루프
  - 상세: 이번 변경으로 YAML 주석·빈 줄 skip, 인용부호 분기까지 한 함수 안에 들어가면서 (지역 함수 정의 2개 + 바깥 while + 안쪽 while + 그 안의 if/elif/else) 함수 하나의 순환 복잡도와 중첩 깊이가 늘었다. 각 분기에 근거가 되는 회귀 이력이 주석으로 충실히 달려 있어 읽고 이해하는 데는 무리가 없지만, 함수 하나가 "인라인 리스트 파싱 + 블록 리스트 파싱 + 주석/인용 처리" 세 책임을 겸하는 형태다.
  - 제안: 급한 문제는 아니다. 다음에 이 함수를 또 건드릴 일이 생기면, block-list 스캔 루프(`j` 를 증가시키며 빈 줄/주석/다음 키를 가르는 부분)를 `_parse_block_list(fm, start) -> list[str]` 같은 이름의 별도 함수로 뽑아 두면 그 부분만 독립적으로 단위 테스트·재사용하기 쉬워진다.

## 요약

이번 변경은 `User` 엔티티 민감 컬럼 노출을 잡는 두 검출 축(`user-entity-exposure-guard.ts` 구조 기반, `user-secret-absence.ts` 값 기반)과 그 소비 지점(e2e·unit 다수), 트리거 `endpoint_path` UNIQUE 충돌을 문서화된 형태로 재던지는 로직, `WorkflowVersionsService` 의 `creator` 컬럼 투영 정정, `pg-error.ts`/`pg-error-fixtures.ts` SoT 통합, `review_guard.py` frontmatter 파서의 YAML 주석·빈 줄 처리 보강 등 다수 파일에 걸쳐 있다. 전반적으로 가독성이 매우 높다 — 거의 모든 새 함수·상수·타입에 "왜 이 형태인가"·"이전에 무엇이 틀렸는가"를 실측 수치와 회귀 이력(리뷰 라운드 인용)까지 곁들인 JSDoc/docstring이 붙어 있고, 네이밍(`findUserRelationLoads`/`collectUserRelationNames`/`findEagerUserRelations`/`CREATOR_PROJECTION`/`isEndpointPathUniqueViolation`)이 역할을 정확히 드러내며, 기존 형제 가드(`swagger-dto-contract-guard.ts`, `nullable-type-lie-cast-guard.ts`)와 "순수 스캔 로직 파일 / 소비 spec 파일 분리" 관례를 그대로 따른다. 함수 길이는 개별 함수 단위로는 대체로 적정하고(`user-entity-exposure-guard.ts` 가 417줄로 길지만 다수의 짧고 단일 책임인 순수 함수로 쪼개져 있다), 매직 넘버는 대부분 실측 근거 주석이 붙어 있어("23" 컬럼 수 카나리아 등) 의미 불명 상수가 아니다. `WorkflowVersionListItem`/`WorkflowVersionDetail` 타입 재설계로 `creator` 투영 리터럴이 `CREATOR_PROJECTION` 상수 하나로 합쳐져 오히려 기존 중복(같은 리터럴이 두 곳에 손으로 복제돼 있던 것)을 없앴고, `triggers.service.ts` 의 UNIQUE 위반 판정도 `common/db/pg-error.ts` SoT 를 통해 이전 라운드에 지적된 "4번째 사본" 문제를 해소했다. 실질적으로 지적할 것은 두 건 모두 INFO 수준이다 — `triggers.controller.ts` 의 계약 리터럴을 담은 설명 문자열 중복(기존 파일 관례와는 부합하지만 드리프트 위험이 조금 더 크다)과, `review_guard.py` 파서 함수의 커진 중첩/책임(다음 편집 시 분리를 고려할 만함). 둘 다 국소적이고 즉시 수정을 요구할 정도는 아니다.

## 위험도

LOW
