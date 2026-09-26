# Rationale 연속성 검토 — post-status-openapi

대상: `plan/in-progress/post-status-openapi.md` (POST 액션 14곳 `@HttpCode(HttpStatus.OK)` 로 201→200 정합, `workspaces revokeInvitation` 광고 204→200 정정, 신규 정적 가드 `http-status-advertised-guard`). `spec_impact: none` 선언.

## 발견사항

- **[WARNING]** 신규 정적 가드가 시행하는 spec 절의 `code:` frontmatter 미등록
  - target 위치: `plan/in-progress/post-status-openapi.md` §요구 1 (`src/repo-guards/__tests__/http-status-advertised{-guard.ts,.spec.ts}` 신설)
  - 과거 결정 출처: `spec/conventions/swagger.md` frontmatter `code:` 블록의 관행 — 예:
    ```
    # §5-4 의 `@ApiParam({format:'uuid'})` 축(과 런타임 `ParseUUIDPipe` 축)을 세는 가드와 그 대조군.
    - codebase/backend/src/repo-guards/__tests__/param-uuid-pipe*.ts
    ```
    같은 패턴이 `swagger-dto-contract*.ts`·`response-contract*.ts`·`user-entity-exposure*.ts` 등 이 문서가 시행하는 **모든** 규칙 축에 반복된다. `spec/5-system/2-api-convention.md` §5.4 "검증 층" 절도 같은 사상 — 규칙을 강제하는 가드는 그 규칙을 소유한 절 옆에 명시적으로 등재한다.
  - 상세: 이번 plan 이 신설하는 `http-status-advertised-guard.ts` 는 `swagger.md §2-4`(상태 코드 응답 규칙)와 `spec/5-system/2-api-convention.md §6`(HTTP 상태 코드)이 소유한 규칙("광고 ⊇ 실제")을 정적으로 강제한다. 그런데 두 문서의 기존 `code:` 글롭(`swagger-dto-contract*.ts`, `param-uuid-pipe*.ts` 등 파일명 단위로 좁게 지정됨 — 넓은 `repo-guards/__tests__/*` 와일드카드 없음)은 새 가드 파일 경로를 매칭하지 않는다. `spec-code-paths.test.ts` 가드 자체는 기존 글롭이 여전히 매치하므로 빌드는 통과하지만, "이 규칙은 이 코드가 시행한다" 는 문서-코드 대응 관행이 이번 신설 가드에는 적용되지 않은 채로 남는다.
  - 제안: (a) `spec_impact` 를 두 파일의 frontmatter `code:` 추가로 한정해 `project-planner` 턴을 짧게 거치거나, (b) 이번 PR 은 `spec_impact: none` 을 유지하되 plan 에 "새 가드를 `swagger.md`/`2-api-convention.md` 의 `code:` 에 등재하는 후속 문서 정리"를 명시적 후속 항목으로 남긴다. developer 는 spec 쓰기 권한이 없으므로(§자기-반증형 소정정 대상 아님 — 이 문장은 developer 가 쓴 예고가 아니라 기존 관행 문서) 어느 쪽이든 이번 PR 단독으로 조용히 넘기지 않는 편이 안전하다.

- **[INFO]** `revokeInvitation` 광고 정정이 아직 열려있는 트래커 결정과 인접
  - target 위치: `plan/in-progress/post-status-openapi.md` "방향" §`revokeInvitation`, §요구 3
  - 과거 결정 출처: `plan/in-progress/spec-draft-nullable-notation-followups.md:4861` `[ ] workspaces.controller.ts 만 삭제 성공에 204 대신 200 {ok:true} 를 쓴다` (아직 미해결, planner 소유) — `spec/5-system/2-api-convention.md §6` 은 "204 = 삭제 성공" 을 원칙으로 적는다.
  - 상세: 이번 plan 은 `revokeInvitation` 의 **광고**만 204→200 으로 고쳐 기존(이미 배포된) 200 런타임과 맞춘다. 이는 §6 의 일반 원칙(204=삭제)과는 계속 어긋난 채로 남지만, 그 어긋남 자체는 이번 PR 이 만든 것이 아니라 이미 존재하던 것이고, 관련 트래커 항목이 "런타임을 204 로 바꿀지 / §6 에 예외 각주를 둘지" 를 아직 결정하지 않은 상태다. plan 은 "이 PR 이 선점하지 않는다"·"그 결정이 204 로 나면 런타임과 광고를 함께 바꾸면 되고 가드가 짝을 강제한다" 고 명시해, 트래커의 미래 결정 폭을 좁히지 않도록 스스로 경계를 그었다.
  - 제안: 현재 처리는 타당하다. 커밋/CHANGELOG 문구에도 "204 채택 여부는 별도 트래커 항목 미결" 한 줄을 남겨 다음 사람이 이번 광고 정정을 "204 vs 200 논쟁이 끝났다" 는 신호로 오독하지 않게 한다.

- **[INFO]** 14곳의 "액션 → 200" 분류는 기존 spec 원칙·선례와 정합 — 기각된 대안의 재도입 아님
  - target 위치: `plan/in-progress/post-status-openapi.md` "방향" 전체
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §2.2 "자원 액션" 행(예시로 `transfer-ownership` 을 직접 명시), `codebase/backend/src/modules/workflows/workflows.controller.ts` 의 `restoreVersion`(이미 `@HttpCode(HttpStatus.OK)` + `@ApiOkWrappedResponse`), `spec/2-navigation/4-integration.md` Rationale "연결 테스트 endpoint 의 `pending_install` 가드 — 응답 형식"(2026-09-19, `:id/test` 를 200 봉투로 통일한 근거).
  - 상세: prompt 가 직접 판단을 요청한 두 자리를 확인했다 — `invitations/accept`(멤버십 행 생성)과 `regenerate`(신규 비밀값 발급) 모두 (1) URL 이 `§2.2` 의 "자원 액션"(동사 접미) 형태이지 리소스 컬렉션 POST 가 아니고, (2) 두 라우트 모두 이 PR 이전부터 이미 `@ApiOkWrappedResponse`(200) 로 광고돼 있었다 — 즉 "200 이 맞다" 는 분류 결정 자체는 이번 PR 이 새로 내리는 것이 아니라 기존 데코레이터가 이미 내려둔 것이고, 이번 PR 은 그 광고에 런타임(`@HttpCode`)을 맞추는 버그 수정이다. `saveCanvas` 도 동일 — 형제 엔드포인트 `restoreVersion`(§8.1: "복원 동작도 새로운 버전으로 기록됩니다", 즉 동일하게 `workflow_version` row 를 생성)이 이미 200 으로 확정돼 있어, `saveCanvas` 를 같은 값으로 맞추는 것은 새 원칙 도입이 아니라 기존 자매 라우트와의 정합이다. `testConnection`(`:id/test`) 의 성공 경로를 200 으로 맞추는 것도 같은 endpoint 의 `pending_install` 가드 분기가 이미 "200 + `IntegrationTestResult` shape 일관성" 을 Rationale 로 확정해 둔 것을 완성하는 방향이라 번복이 아니다. spec 본문 어디에도 이 14곳 중 하나를 201 로 못박은 문장은 없다(전수 grep 확인).
  - 제안: 없음 — 현 방향 유지. 굳이 보강한다면 CHANGELOG 나 plan 본문에 위 세 선례(§2.2 transfer-ownership 예시·`restoreVersion` 전례·`:id/test` pending_install Rationale)를 한 줄씩 인용해, 이 정합화가 "임의 판단" 이 아니라 "기존 결정의 연장" 임을 다음 검토자가 바로 확인하게 하면 좋다.

## 요약

이번 plan 은 성공 응답 코드(런타임)를 이미 확정돼 있던 OpenAPI 광고(주로 사전에 `@ApiOkWrappedResponse` 로 선언된 200)에 맞추는 버그 수정이며, 검토 대상 spec 들의 `## Rationale` 어디에도 이 14곳을 201 로 지정한 과거 결정이나 이번 방향을 명시적으로 기각한 대안이 없었다 — 오히려 `2-api-convention.md §2.2` 의 "자원 액션" 분류·형제 엔드포인트 `restoreVersion` 의 기 구현·`integration.md` 의 `:id/test` 200-봉투 Rationale 세 갈래가 모두 이번 방향을 뒷받침한다. 유일하게 열려 있는 결이 두 가지다 — (1) `revokeInvitation` 의 광고 정정이 아직 미결인 "204 전환" 트래커 항목의 공간을 조금 스치지만 plan 이 스스로 비선점을 명시해 위험은 낮고, (2) 새로 신설되는 정적 가드가 그 가드가 시행하는 두 spec 문서의 `code:` frontmatter 등록 관행을 아직 따르지 않아 문서-코드 대응 갭이 하나 새로 생긴다. 둘 다 구현을 막을 사유는 아니며 CRITICAL 급 위반은 없다.

## 위험도
LOW
