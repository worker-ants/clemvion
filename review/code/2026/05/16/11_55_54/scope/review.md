# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 파일 3 (`migrations.spec.ts`) — 테스트 인수 포맷팅 변경
  - 위치: diff hunk 전체 (lines 317-345)
  - 상세: 배열 인수를 단일 줄 형태에서 Prettier 스타일 멀티라인으로 재포맷팅. 기능 변경 없음. 이번 PR 의 핵심 의도(Flyway conf 주석 추가, DTO 분리, 메시지 i18n SoT 전환)와 직접 관련 없는 순수 포맷팅 변경.
  - 제안: 별도 "chore: format" 커밋으로 분리하거나, 실질 변경과 혼재를 피하기 위해 이번 PR 범위에서 제외 검토.

- **[INFO]** 파일 7 (`integration-oauth.service.ts`) — `formUrlEncode` 함수 포맷팅 변경
  - 위치: lines 1602-1748 diff hunk
  - 상세: `return encodeURIComponent(value).replace(...).replace(...)` 체인을 괄호로 감싸 멀티라인으로 재포맷팅. 로직·동작 변화 없음. 이번 PR 의 수정 의도(urlToken 미사용 분리 + 메시지 SoT 주석)와 관련 없는 포맷팅 정리.
  - 제안: 실질 변경(urlToken 제거 주석, `const { query } = params`)과 분리하여 포맷팅을 별도로 제출하거나 최소한 커밋 단위로 구분.

- **[INFO]** 파일 9 (`third-party-oauth.controller.ts`) — 순수 줄바꿈 포맷팅 변경
  - 위치: lines 197-857 diff hunk
  - 상세: `description:` 문자열 값을 단일 줄에서 두 줄로 분리. 동작·의미 변화 없는 whitespace 변경. 이번 PR 의 핵심 변경과 무관.
  - 제안: 포맷터 자동 적용 결과로 보이므로, 실질 변경이 없는 파일은 diff 에서 제외하거나 별도 chore 커밋으로 처리.

- **[INFO]** 파일 24 (`if-else.schema.ts`) — 문자열 인용 방식 변경 (escape → double quote)
  - 위치: line 2089
  - 상세: `'First condition\'s field must be entered.'` 를 `"First condition's field must be entered."` 로 변경. 의미·런타임 동작 동일. 이번 PR 의 DTO 분리·메시지 SoT 작업과 무관한 코드 스타일 정리.
  - 제안: 동일 변경이 파일 34 (`variable-declaration.schema.ts`)에도 존재. 두 변경 모두 기능과 무관하므로 별도 chore 커밋으로 분리 권장.

- **[INFO]** 파일 17 (`cafe24-token-refresh.processor.spec.ts`) — 테스트 케이스 삭제
  - 위치: diff lines 1292-1307
  - 상세: `TEST-C2` 레이블의 `propagates refreshAccessToken failure` 테스트가 diff 에서 삭제됨. 그러나 전체 파일 컨텍스트를 보면 동일 테스트가 파일 하단(lines 1418-1432)에 존재. 즉 중복 테스트를 제거한 것으로 보임. 이는 이번 PR 의 핵심 의도(Cafe24 follow-up)와 연관성이 있으나, 삭제가 리팩토링 성격의 정리인지 의도적 스펙 변경인지 불분명.
  - 제안: 삭제 이유를 커밋 메시지 또는 PR description 에 명시. 중복 제거라면 INFO 수준이지만, 테스트 목적 변경이면 별도 커밋으로 분리.

- **[INFO]** 파일 29 (`parallel.schema.spec.ts`) — 기대값 포맷팅 변경
  - 위치: lines 2629-2632
  - 상세: `expect(errors).toContain(...)` 의 문자열 인수를 멀티라인에서 단일 줄로 재포맷팅. 기능 변화 없음.
  - 제안: 파일 3, 7, 9 와 동일한 순수 포맷팅 변경으로 실질 변경과 혼재. 별도 처리 권장.

- **[INFO]** 파일 20 (`send-email.schema.spec.ts`) — 기대값 포맷팅 변경
  - 위치: lines 1740-1743
  - 상세: `expect(errors).toContain('Recipient (To)...')` 를 멀티라인으로 재포맷팅. 기능 변화 없음.
  - 제안: 동일하게 별도 처리 권장.

- **[INFO]** 파일 32 (`switch.schema.spec.ts`) — 기대값 포맷팅 변경
  - 위치: lines 2907-2910
  - 상세: `expect(errors).toContain(...)` 멀티라인 → 단일 줄 재포맷팅. 기능 변화 없음.
  - 제안: 동일.

## 범위 내 변경 확인 (이상 없음)

다음 변경들은 이번 PR 의 명시된 의도(Cafe24 OAuth DTO 분리, Swagger oneOf 문서화, Flyway conf 주석, 메시지 Language SoT 전환)에 정확히 부합하여 범위 이탈 없음.

- **파일 1** (`V050__...conf`): `executeInTransaction=false` 설정의 배경 주석 추가. conf 파일 자체 변경과 직결.
- **파일 2** (`api-wrapped.ts`): `wrapOneOfDataSchema` / `ApiOkWrappedOneOfResponse` 신규 추가. DTO 분리에 필요한 Swagger 헬퍼.
- **파일 4** (`integration-response.dto.ts`): `OAuthBeginResultDto` → `OAuthBeginPopupResultDto` + `OAuthBeginCafe24PendingResultDto` 분리. 핵심 변경.
- **파일 5** (`integration-expiry-scanner.service.spec.ts`): `pending_install` 제외 쿼리 단언 추가. REQ-C1 회귀 방지.
- **파일 6** (`integration-oauth.service.cafe24.spec.ts`): DTO 분리 후 분기 불변식 단언 강화. 파일 4 변경에 직결.
- **파일 7의 실질 변경** (`urlToken` 분리 주석, `const { query } = params`): SEC H-2 범위.
- **파일 8** (`integrations.controller.ts`): `ApiOkWrappedOneOfResponse` 로 교체. 파일 2 신규 헬퍼 활용.
- **파일 10~16, 18~19, 21~28, 31, 33, 35** (각종 `.schema.spec.ts`, `node-component.interface.ts`, `parallel.handler.ts`, `parallel.schema.ts`): 테스트 이름 "Korean" 제거 및 주석 "Korean messages" → "warning messages" 수정. 메시지 Language SoT 전환 작업의 일환으로 범위 내.

## 요약

전체 35개 파일 중 핵심 기능 변경(Cafe24 OAuth DTO 분기 분리, Swagger oneOf 문서화, Flyway conf 주석, 메시지 i18n SoT 전환, SEC/REQ 회귀 방지 테스트)은 명확한 의도 범위 안에 있다. 다만 파일 3·7·9·20·29·32에서 Prettier 자동 포맷팅으로 보이는 순수 포맷팅 변경(배열 인수 줄바꿈, 문자열 체인 괄호 감싸기, description 줄 분리)이 실질 변경과 혼재되어 있고, 파일 24·34의 문자열 인용 방식 변경(escape → double quote)도 기능과 무관한 스타일 정리다. 파일 17의 중복 테스트 삭제는 의도가 명확히 문서화되어 있지 않아 확인이 필요하다. 이 포맷팅 변경들은 기능 회귀 위험은 없지만 diff 노이즈를 증가시키고 코드 리뷰 집중도를 낮추는 부작용이 있다.

## 위험도

LOW
