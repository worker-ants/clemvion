# 아키텍처 리뷰 — trigger-uuid-and-guide-codes

## 발견사항

- **[INFO]** 레이어 책임이 올바르게 복원됨 — 입력 검증이 데이터 레이어에서 프레젠테이션 경계로 이동
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string,`)
  - 상세: 수정 전에는 `:id` 검증이 사실상 Postgres(데이터 레이어)에 위임되어 있었다 — 비-UUID 값이 그대로 `TriggersService.findById` 까지 흘러 SQLSTATE 22P02 로 거부된 뒤 `GlobalExceptionFilter` 의 3-분기 어디에도 안 걸려 500 으로 마스킹됐다. `ParseUUIDPipe` 추가로 같은 컨트롤러의 형제 6개 핸들러와 동일하게 컨트롤러 경계(NestJS 파이프)에서 검증이 끝나도록 레이어 책임이 정상화됐다. 같은 컨트롤러 내 핸들러 간 계약 불일치(암묵적 LSP 위반에 가까운 상태 — 형제 메서드들과 다른 입력 계약)도 함께 해소됨.
  - 제안: 없음 — 구조적으로 올바른 수정.

- **[WARNING]** SQLSTATE 22P02 분류가 여전히 `GlobalExceptionFilter` 라는 공유 seam 이 아니라 호출부별 파이프 배치로 반복 방어되는 구조
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (분기: `HttpException` · http-error-like · `isPostgresUniqueViolation`(23505) 세 갈래뿐, 22P02 분기 없음) / 대응 트래커: `plan/in-progress/spec-draft-nullable-notation-followups.md:3168`
  - 상세: 이번 변경은 `@Param('id')` 경로만 가드(`param-uuid-pipe`)로 전수 고정했다. 그러나 cross-cutting 관심사(파싱 불가 UUID → 400 분류)의 정본 처리 지점은 여전히 없다 — `@Query()`·body 필드를 거쳐 같은 조회 로직에 도달하는 경로는 이 가드의 스캔 대상(`@Param` 데코레이터)이 아니라 여전히 500 마스킹에 노출된다. 즉 방어가 원인(파싱 불가 UUID)이 아니라 특정 진입 형태(`@Param`)에 결합되어 있다.
  - 제안: 이미 plan 에 후속 항목으로 등재되어 있음(필터에 `invalid_text_representation`(22P02) → 400 분기 추가, 단 전 엔드포인트 영향 전수 선행 필요). 새로운 지적이 아니라 이번 diff 가 그 갭을 닫지 않은 채로 남긴다는 점만 확인차 기록.

- **[INFO]** 가드의 `ParseUUIDPipe` 존재 판정이 심볼 해석이 아닌 텍스트 부분일치
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:149` (`if (!pipes.includes('ParseUUIDPipe')) missing.push('ParseUUIDPipe');`)
  - 상세: `pipes.includes('ParseUUIDPipe')` 는 별칭 import(`ParseUUIDPipe as UuidPipe`)를 놓치거나(미탐), 이름에 같은 문자열을 포함한 다른 심볼을 오탐할 수 있다. 문서화된 트레이드오프(현재 별칭 0건 실측, 타입 체커 없이는 확장 불가)이고 정적 스캐너의 범위 안에서 합리적 선택이라 낮은 우선순위.
  - 제안: 현행 유지, 별칭 import 가 생기면 재평가.

- **[INFO]** 전달-안됨 에러 코드 매핑(dead layer) — 이번 PR 범위 밖이지만 아키텍처적으로 유의미
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts:605` 부근 (`ERROR_KO` 매핑) / 트래커: `plan/in-progress/spec-draft-nullable-notation-followups.md:3223` (`ERROR_KO` 항목)
  - 상세: 이번 diff 는 `TRIGGER_NOT_FOUND` 주석 귀속만 정정했는데, 조사 과정에서 `ERROR_KO`(chat-channel 코드 7종)를 소비하는 유일한 함수 `translateBackendError` 의 프로덕션 호출부가 0건이고, 실제 화면(`chat-channel-card.tsx`)은 에러를 버리고 고정 문자열을 띄운다는 사실이 드러났다. 데이터 레이어(에러 코드 → 한국어 매핑)가 프레젠테이션 레이어와 배선되지 않은 채 존재하는 dead code 이며, 문서(`triggers.mdx` 등)는 "화면에 한국어로 뜬다"고 서술해 문서-구현 간극이 있었다. 이번 PR 은 이 배선 문제를 고치지 않고 문서 문구만 사실에 맞게 좁혔다(정확한 처사) — plan 에 별도 항목으로 등재되어 있어 회귀가 아님.
  - 제안: 이미 별건으로 등재됨. 배선할지/UI 노출할지는 별도 설계 결정 필요.

- **[INFO]** 정적 가드의 SRP/응집도 설계가 양호함
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` (`scanUuidParams` / `collectMethodViolations` / `apiParamUuidFlags` / `isIdShaped` / `isExcludedFromOpenApi` 분리)
  - 상세: 순회(`scanUuidParams`)와 메서드 단위 판정(`collectMethodViolations`)을 분리해 이전 라운드에서 지적된 5단 중첩을 해소했고, vacuity floor 가 보는 `scanned` 카운트와 `violations` 를 **같은 루프**에서 함께 반환해 두 값이 서로 다른 순회 조건으로 갈릴 여지를 구조적으로 차단했다. 예외 처리도 이름 허용목록이 아니라 `@ApiExcludeEndpoint()` 존재라는 구조적 술어로 판정해 개방-폐쇄 원칙에 부합한다(새 제외 대상이 생겨도 가드 코드 수정 불필요). 별도 코멘트/개선 불필요 — 긍정적 관찰.

## 요약

핵심 변경은 `rotateBotToken` 엔드포인트의 `:id` 파라미터에 형제 핸들러들과 동일한 `ParseUUIDPipe` + `@ApiParam(format:'uuid')` 를 부착해, 검증 책임이 데이터 레이어(Postgres 예외)에서 프레젠테이션 경계(NestJS 파이프)로 정상 회귀하는 구조적으로 올바른 수정이다. 이를 회귀 방지 가드(순수 AST 스캔 함수 + 소비 spec + 격리된 fixture)로 전수 고정한 설계는 응집도·개방-폐쇄 원칙·측정 일관성(같은 루프에서 카운트) 면에서 양호하며 이 저장소의 기존 가드 관례와 정합적이다. 다만 근본 원인인 SQLSTATE 22P02 분류는 여전히 `GlobalExceptionFilter` 라는 공유 seam 이 아니라 개별 진입점(파이프)에 반복 배치되는 구조로 남아 있어, `@Param` 이외의 경로로 파싱 불가 UUID 가 유입되면 같은 500 마스킹이 재현될 수 있다 — 다만 이는 이번 PR 이 만든 결함이 아니라 이미 후속 항목으로 등재된 기존 갭이다. 문서/i18n 파일 변경은 순수 텍스트 정정이며, 조사 과정에서 드러난 `ERROR_KO`/`translateBackendError` dead-wiring 문제도 별도 트래커에 정확히 등재되어 있어 이번 diff 의 책임 범위를 벗어난다. 전반적으로 아키텍처 관점에서 새로운 심각한 문제를 도입하지 않았고, 기존 레이어 위반 하나를 정확히 교정했다.

## 위험도
LOW
