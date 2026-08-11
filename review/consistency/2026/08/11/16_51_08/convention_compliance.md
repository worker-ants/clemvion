# 정식 규약 준수 검토 — External Interaction API §5.5 refresh 에러 4종 + auth-session 캐비엇 제거

대상: `spec/5-system/14-external-interaction-api.md`(§5.5 예시 + §5.1 에러 표), `spec/7-channel-web-chat/3-auth-session.md`
비교 규약: `spec/conventions/swagger.md` §5, `spec/5-system/2-api-convention.md` §5.3/§6, `spec/5-system/3-error-handling.md` §1.6

## 발견사항

- **[WARNING] `3-error-handling.md §1.6` EIA 카탈로그에 refresh 전용 3코드 미등재**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.1 에러 표(신규 행 `TOKEN_REFRESH_NOT_IN_WINDOW`/`TOKEN_REFRESH_FAILED`/`TOKEN_REFRESH_FORBIDDEN`) + §5.5 예시 블록
  - 위반 규약: `spec/5-system/3-error-handling.md` §1.6 "EIA REST 외부 표면 에러 코드" — 전문이 스스로 "본 §1.6 은 공용 카탈로그 가시성을 위한 등재"라고 규정하며, `INVALID_COMMAND`·`MESSAGE_TOO_LONG`·`STATE_MISMATCH`·`IDEMPOTENCY_KEY_CONFLICT`·`EXECUTION_TERMINATED`·`TOKEN_REVOKED`/`TOKEN_SCOPE_MISMATCH`/`TOKEN_AUDIENCE_MISMATCH`·`TOO_MANY_CONNECTIONS` 등 EIA §5.1 의 override 코드는 전부 이 표에 등재돼 있다(선례).
  - 상세: 이번 diff 로 EIA §5.1 표·§5.5 예시에 `TOKEN_REFRESH_NOT_IN_WINDOW`(400)·`TOKEN_REFRESH_FAILED`(400)·`TOKEN_REFRESH_FORBIDDEN`(403) 3개의 신규 override 코드가 추가됐고, §5.1 표 하단 "코드 네임스페이스 주석"에도 이 3종이 "규약 기본값을 의도적으로 override" 한다고 명시했다(§2 요건은 충족). 그런데 `3-error-handling.md §1.6` 의 동일 카탈로그 표에는 이 3종이 하나도 반영되지 않았다 — `TOKEN_REVOKED`/`TOKEN_SCOPE_MISMATCH`/`TOKEN_AUDIENCE_MISMATCH`(401 계열)는 있지만 이번에 새로 생긴 400×2·403 은 빠져 있다(`grep TOKEN_REFRESH` 결과 0건). 같은 diff 를 만든 plan 문서(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)도 이 사실을 스스로 인지하고 있다 — "refresh 전용 코드 3종이 §3.3(→ 실제로는 §5.1) 에러 코드 표에 하나도 없었다" 고 적어, 등재 누락이 실수가 아니라 아직 처리되지 않은 항목임을 시사한다.
  - 제안: `3-error-handling.md §1.6` 표에 3행 추가 — `TOKEN_REFRESH_NOT_IN_WINDOW`(400)·`TOKEN_REFRESH_FAILED`(400)·`TOKEN_REFRESH_FORBIDDEN`(403), 설명·SoT 링크는 EIA §5.1/§5.5 참조로. 기존 `EXECUTION_TERMINATED` 행도 "§5.5 에서는 미존재 execution 도 포함" 캐비엇을 한 줄 보강하면 카탈로그와 SoT 표가 다시 정합된다(아래 두 번째 항목과 함께 처리 가능).

- **[WARNING] 신규 콜아웃 2곳이 잘못된 절 번호(§3.3)를 인용 — 실제 에러 표는 §5.1**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.5 코드 블록 주석(`// TOKEN_* ... (Guard 선차단, §3.3 표)`, 522행)과 바로 아래 산문 콜아웃("`404 EXECUTION_NOT_FOUND` 는 다른 엔드포인트 기준", 535행)
  - 위반 규약: 직접적으로 `spec/conventions/*` 조항 하나를 위반하는 것은 아니나, `swagger.md §5-5`(에러 응답 참조 규약)·본 문서 전반이 의존하는 "정확한 절 참조로 SoT 를 가리킨다"는 관행과 어긋난다. 이 문서는 `§5.5 는 예외`·`§R14`처럼 절 번호를 근거로 SoT 를 지목하는 패턴을 전면적으로 쓰고 있어, 번호가 틀리면 그 패턴 전체의 신뢰도가 떨어진다.
  - 상세: `TOKEN_INVALID`/`TOKEN_EXPIRED`/`TOKEN_REVOKED`/`TOKEN_SCOPE_MISMATCH`/`TOKEN_AUDIENCE_MISMATCH`·`EXECUTION_NOT_FOUND`가 실제로 나열된 표는 `### 3.3 인증`(EIA-AU-* 요구사항 표)가 아니라 `### 5.1 인터랙션 명령 제출` 아래 "에러 응답" 표다. `§3.3` 은 요구사항(EIA-AU-01~08) 표이지 에러 코드 표가 아니다(`grep §3.3` 결과 기존 용례는 전부 "EIA-AU-06, §3.3"처럼 요구사항 조항 인용이었고, 이번 diff 의 두 곳만 에러 표를 가리키는 데 §3.3 을 오용했다). 같은 실수가 plan 문서(`spec-sync-external-interaction-api-gaps.md`)의 "실측하니 티켓보다 넓었다" 절에도 "§3.3 에러 코드 표"로 반복돼, 작성자가 절 번호를 착각한 채로 굳어진 것으로 보인다.
  - 제안: 두 인용을 `§3.3` → `§5.1`로 정정한다(`(Guard 선차단, §5.1 표)`, `§5.1 표의 404 EXECUTION_NOT_FOUND 는...`). plan 문서의 동일 문구도 같은 세션에서 함께 정정하면 두 문서가 다시 일치한다.

- **[INFO] `3-error-handling.md §1.6` 의 `EXECUTION_TERMINATED` 행이 §5.5 확장 의미를 반영하지 않음**
  - target 위치: `spec/5-system/3-error-handling.md` §1.6 표의 `EXECUTION_TERMINATED` 행
  - 위반 규약: 위 첫 항목과 동일한 §1.6 "카탈로그 가시성" 취지
  - 상세: EIA §5.1 표는 이번 diff 로 `EXECUTION_TERMINATED` 행에 "§5.5 에서도 같은 코드를 내며 거기선 미존재 execution 도 포함한다"는 캐비엇을 추가했다. 코드 자체는 이미 §1.6 에 등재돼 있어 CRITICAL/WARNING 급 누락은 아니지만, §1.6 만 읽는 소비자는 refresh-token 엔드포인트에서 이 코드가 404 미존재까지 흡수한다는 사실을 알 수 없다.
  - 제안: 위 3행 추가와 함께 `EXECUTION_TERMINATED` 행 설명에 짧게 보강("§5.5(refresh-token)에서는 미존재 execution 도 포함") — 필수는 아니고 낮은 비용의 완성도 개선.

- **[INFO] (참고, 범위 밖) 코드의 Swagger 데코레이터가 스펙이 명시한 403/400×2 를 전부 반영하지 않음**
  - target 위치: 코드 참고용 — `codebase/backend/src/modules/external-interaction/interaction.controller.ts` `refreshToken()`
  - 위반 규약: `spec/conventions/swagger.md` §2-4 (상태 코드 응답 규칙 — 403 → `@ApiForbiddenResponse`) 참고
  - 상세: 이번 작업은 "코드 변경 0줄"이라 스코프 밖이지만, 참고로 남긴다 — 현재 `refreshToken()` 컨트롤러 메서드는 `@ApiBadRequestResponse({ description: 'TOKEN_REFRESH_NOT_IN_WINDOW' })`·`@ApiUnauthorizedResponse`·`@ApiGoneResponse` 만 달려 있고, `TOKEN_REFRESH_FAILED`(같은 400, 별도 사유)와 `TOKEN_REFRESH_FORBIDDEN`(403, `@ApiForbiddenResponse` 자체가 없음)는 Swagger 문서화가 안 돼 있다. 스펙 §5.1/§5.5 가 이제 이 3종을 문서화했으므로, 코드 쪽 Swagger 데코레이터 보강은 후속 developer 작업으로 남겨둘 만하다(spec 변경 자체의 결함은 아님).
  - 제안: 별도 후속 항목으로만 기록 — 이 검토의 BLOCK 판정에는 영향 없음.

## 검증 결과 요약 (요청 항목별)

1. **swagger.md §5** — §5-1 literal 패턴은 신규 코드가 형제 DTO 간 공유 enum 이 아니라 개별 조건별 문자열이라 해당 없음(위반 없음). §5-5 "에러 응답 참조"는 `ErrorResponseDto.code` 가 여전히 `string`(오픈)이라 스키마 자체는 문제 없으나, 문서 내부 참조 번호 오류(위 WARNING 2번째)가 그 참조 신뢰성을 깎는다.
2. **`2-api-convention.md §5.3`** — 신규 코드가 규약 기본값을 override 한다는 사실은 §5.1 표 하단 "코드 네임스페이스 주석"에 `TOKEN_REFRESH_NOT_IN_WINDOW`/`TOKEN_REFRESH_FAILED`/`TOKEN_REFRESH_FORBIDDEN`(뒤 3종은 §5.5 전용)으로 명시돼 있다 — 요건 충족.
3. **`3-error-handling.md` 등재 여부** — `STATE_MISMATCH`·`TOO_MANY_CONNECTIONS` 등 기존 EIA override 코드는 전부 §1.6 에 등재된 선례가 있음에도, 이번에 추가된 3종은 등재되지 않았다 — 위 첫 WARNING 항목.
4. **표 행 형식/문체** — §5.1 표 신규 행은 `**§5.5 전용**:` 볼드 프리픽스로 기존 `**구현됨**:` 패턴과 동형이고, status 오름차순 정렬(400,400,400,401×4,403,404,409,409,410,429)도 유지된다 — 형식 일관성 문제 없음.

## 요약

새로 추가된 refresh-token 전용 에러 코드 3종(`TOKEN_REFRESH_NOT_IN_WINDOW`/`TOKEN_REFRESH_FAILED`/`TOKEN_REFRESH_FORBIDDEN`)은 명명(`UPPER_SNAKE_CASE`, 의미 기반)·`2-api-convention.md §5.3` override 명시·표 형식/문체 면에서는 정식 규약을 잘 따른다. 다만 `3-error-handling.md §1.6` 이 스스로 규정한 "EIA override 코드는 카탈로그에도 등재한다"는 선례(기존 6개 코드가 전부 등재됨)를 이번 3종만 건너뛰었고, 신규로 추가된 두 콜아웃이 실제 에러 표가 있는 §5.1 대신 §3.3(인증 요구사항 표)을 잘못 인용해 문서 내 SoT 참조 무결성이 두 군데에서 깨졌다 — 이 오기재는 병행 수정된 plan 문서에도 그대로 옮겨져 있어 단순 오타가 아니라 작성자의 절 번호 착각이 굳어진 것으로 보인다. 두 사항 모두 코드/외부 계약을 깨지는 않는 문서 완성도·내비게이션 문제라 CRITICAL 은 아니다.

## 위험도

MEDIUM
