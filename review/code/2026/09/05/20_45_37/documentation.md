# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** CHANGELOG 가 `appUrl` 의 실제 선언 형태를 반대로 서술한다 — 코드 자신의 인접 주석이 이미 그 정정 이력을 적어 두었는데 CHANGELOG 는 정정 전 상태를 그대로 남겼다.
  - 위치: `CHANGELOG.md:50-52` ("`appUrl` 만 예외다 — Cafe24 Private 흐름에서만 동봉되는 부가 컨텍스트라 **키 생략형**(`@ApiPropertyOptional()`, `| null` 없음)이다.") vs `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:126-135` (실제 선언 `@ApiProperty({ nullable: true, type: String, example: null }) appUrl: string | null;`)
  - 상세: CHANGELOG 본문은 "23필드는 전부 §5.4 기본형(`@ApiProperty` + `nullable: true`)으로 적었고, `appUrl` 만 예외로 키 생략형(`@ApiPropertyOptional()`, `| null` 없음)"이라고 명시한다. 그러나 실제 코드는 `appUrl` 도 `@ApiProperty({ nullable: true, ... })` + `string | null` — 즉 기본형으로 선언돼 있다. 심지어 그 필드 바로 위 인라인 주석이 이 불일치의 경위를 스스로 설명한다: `"appUrl 은 엔티티 컬럼이 아니지만 상시 존재한다 … 그래서 키 생략형이 아니라 §5.4 기본형이다. (첫 판은 키 생략형으로 적었다가 e2e 계약 대조가 'appUrl [null] 키 생략형인데 null 이 왔다' 로 잡았다 — 검증자가 제 선언을 반증한 자리다.)"` 즉 개발 도중 `appUrl` 을 키 생략형으로 적었다가 e2e 로 반증되어 기본형으로 정정했는데, CHANGELOG 서술은 그 정정 이전(첫 판) 상태를 그대로 남긴 채 갱신되지 않았다. 이 PR 자신이 "§5.4 금지 조합이 조용히 넓어지는 것"을 막으려고 세 번째 검증 축과 래칫까지 새로 만든 맥락(`CHANGELOG.md:65-76` "같은 조합이 조용히 넓어지지 못하게 래칫을 세웠다")을 고려하면, CHANGELOG 가 정확히 그 헷갈리는 두 형태(기본형 vs 키 생략형)의 경계를 이 필드 하나에서 반대로 적어 둔 것은 다음에 이 이력을 근거로 유사 필드를 선언할 사람을 오도할 위험이 있다.
  - 제안: `CHANGELOG.md:50-52` 를 "전부 §5.4 기본형으로 적었다 (`appUrl` 포함 — 첫 판엔 키 생략형으로 적었으나 e2e 계약 대조가 반증해 기본형으로 정정)" 형태로 갱신하거나, 최소한 "appUrl 만 예외" 문장을 삭제한다.

- **[WARNING]** `contractForDto` 의 JSDoc 블록이 이번 diff 로 함수 선언과 분리돼, 실제로는 그 앞에 새로 삽입된 (export 되지 않는) `contractCache` 상수에 붙어 버렸다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:385-406`(JSDoc 블록 전체) 직후 `:407`(`const contractCache = new Map<Type<unknown>, Promise<DtoContract>>();`), 그리고 빈 줄 하나를 사이에 두고 `:409`(`export function contractForDto(...)`)
  - 상세: 이 JSDoc 은 "결과는 DTO 클래스별로 메모이즈된다", "그래서 호출부는 한 줄이면 된다 `assertMatchesContract(payload, await contractForDto(XxxDto))`", "진행 중인 promise 를 캐시한다" 등 `contractForDto` 의 동작·용법을 설명하는 내용이다. 그런데 diff 는 이 블록 바로 다음 줄에 `const contractCache = ...` 선언을 새로 끼워 넣었고, 그 뒤 빈 줄을 하나 두고서야 `export function contractForDto` 가 나온다. JSDoc/TSDoc 관례상 주석 블록은 **바로 다음에 오는 선언**에 귀속되므로, 이 문서는 이제 (export 되지 않는 내부 구현 세부인) `contractCache` 에 붙는다 — IDE 호버·TypeDoc 등 문서 생성기가 `contractForDto` 를 참조할 때는 이 설명을 보여주지 못하고, 대신 아무도 직접 참조하지 않는 `contractCache` 변수에 이 풍부한 사용법 설명이 달린다. `contractForDto` 는 이번 diff 로 14개 e2e 스펙에서 신규 호출되는 자주 쓰이는 공개 헬퍼라, 다음 작성자가 이 함수에 마우스를 올렸을 때 문서가 안 뜨는 것은 실질적 비용이다.
  - 제안: JSDoc 블록을 `export function contractForDto` 선언 바로 위로 옮기고, `const contractCache = ...` 는 그 앞(또는 블록과 분리된 별도 위치)으로 이동한다.

## 요약

이번 변경은 §5.4 응답-계약 검증자 배선 확대(4→18 DTO) + 트리거 회전 secret 유출 수정 + 5개 DTO 23필드 선언 보정으로 구성된 교정 PR 로, 새/변경된 코드 대부분(`triggers.service.ts` 의 `sanitizeForResponse`, `swagger-dto-contract-guard.ts` 의 신규 래칫 술어, `response-contract.ts` 의 `allowMissing` 옵션)에 배경·근거·기존 검증자와의 경계를 설명하는 JSDoc/인라인 주석이 상세히 달려 있고, 앞선 두 리뷰 라운드(`18_23_02`, `19_08_18`)가 지적한 오래된 주석(`sanitizeChatChannelForResponse` 잔존 인용)·CHANGELOG 수치 오차(24→23)·enum 미선언 3건은 이미 이번 diff 에 반영되어 해소됐다. 다만 CHANGELOG 가 `appUrl` 의 최종 선언 형태를 코드와 반대로 서술하는 stale 문장을 남겼고(코드 자신의 주석이 그 정정 경위를 적어 두었음에도 CHANGELOG 쪽만 갱신되지 않았다), `contractForDto` 의 사용법 JSDoc 이 함수 선언과 물리적으로 분리되어 문서 생성기·IDE 호버가 엉뚱한 내부 변수에 그 문서를 귀속시키는 배치 결함이 새로 생겼다. 둘 다 동작에는 영향이 없는 순수 문서 정합성 문제이므로 병합을 막을 사안은 아니나, 특히 전자는 이 PR 자체가 막으려는 "§5.4 두 형태 혼동"을 CHANGELOG 가 스스로 재현하는 모양이라 우선 정정을 권한다.

## 위험도

LOW
