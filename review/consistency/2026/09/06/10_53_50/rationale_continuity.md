# Rationale 연속성 검토 — `spec/5-system/` (impl-done)

## 검토 전제

- 이번 브랜치(`bfa124920..HEAD`, 커밋 `96d3856a9`·`4d49aa575`)는 **`spec/5-system/` 델타 0** — 정상이다(코드 전용 변경). 따라서 본 검토는 "target 문서가 직접 무엇을 고쳤는가"가 아니라 "구현이 `spec/5-system/`·인접 `spec/conventions/**` 의 기존 Rationale·원칙과 계속 정합하는가"를 본다.
- 구현 diff 핵심: `WorkflowVersionsService.findOne` 이 `relations: ['creator']` 를 투영 없이 로드해 `GET /api/workflows/:wfId/versions/:versionId` 가 `User` 전 컬럼(`passwordHash`·2FA 비밀·복구 코드·계정 탈취 토큰)을 유출하고 있던 것을 투영 추가로 닫고, 재발 방지를 위해 신규 검출기 2축을 추가했다:
  - `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` + `.spec.ts` — **구조 축**(AST, `User` 관계를 투영 없이 통째로 싣는 자리 스캔)
  - `codebase/backend/src/shared/testing/user-secret-absence.ts` + `.spec.ts` — **이름 축**(응답 본문 전체를 깊이 훑어 `User` 민감 7컬럼 이름의 부재를 단언, 선언 여부와 무관)
- 이 변경은 이미 한 차례(`review/consistency/2026/09/06/10_13_23`) rationale_continuity 를 포함한 검토를 받았고, 그 라운드가 지적한 WARNING 을 developer 가 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 **planner 턴 대기 항목으로 등재**했다(디렉티브를 실행하지 않고 추적만 함 — `spec/` 쓰기 권한이 없는 developer 로서는 정확한 처신). 아래는 그 상태가 현재도 유효한지에 대한 독립 재확인이다.

## 발견사항

- **[WARNING] 신규 검출 2축이 §5.4 "검증 층"·`secret-store.md §1.1` 의 닫힌 서술을 갱신하지 않았다**
  - target 위치: (target 자체는 무변경) — 충돌 대상은 `spec/5-system/2-api-convention.md#검증-층--이-규칙을-무엇이-강제하는가` 및 `spec/conventions/swagger.md §5-1`, `spec/conventions/secret-store.md §1.1`
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.4 검증 층: *"그 자리를 **두 검증자**가 나눠 맡는다"* (`swagger-dto-contract-guard.ts` = 선언↔선언, `response-contract.ts` = 값↔선언). `spec/conventions/secret-store.md` §1.1(2026-09-05 신설): *"시행 축은 **두 개**다"*(같은 두 검증자 지칭). 이 "두 검증자로 닫혀 있다"는 서술 자체가, **바로 직전 커밋 `21182db02`**("§5.4 검증자를 양쪽 규약에 등재하고 두 검증자의 경계를 적는다")이 확정한 성문 관례다 — 그 커밋의 결론은 "검증자는 관련된 두 문서의 `code:` frontmatter **양쪽 모두**에 등재해야 재검토 트리거가 살아있다"는 것이었다.
  - 상세: 이번 diff 가 추가한 `user-entity-exposure-guard*.ts`(구조 축)·`user-secret-absence*.ts`(이름 축)는 **정확히 같은 실질 규칙**(`User`/엔티티 패스스루 금지, 비밀 컬럼 응답 유출 금지)을 집행하는 **제3·제4의 검증자**다. 그런데 이 4개 신규 파일은 `spec/5-system/2-api-convention.md`·`spec/conventions/swagger.md`·`spec/conventions/secret-store.md` 중 **어느 문서의 `code:` glob 에도 걸리지 않는다**(전수 grep 확인: `spec/` 어디에도 두 파일명이 등장하지 않음). 그 결과 (1) §5.4 표·secret-store.md §1.1 의 "두 검증자/두 개 축"이라는 문장이 이제 사실과 다르고(실제로는 네 개), (2) 이 신규 가드가 나중에 약화·삭제돼도 spec 재검토 게이트가 걸리지 않는 사각지대가 생긴다 — 이는 `21182db02` 가 명시적으로 막으려 했던 바로 그 실패 모드다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재된 대로(`신규 검출 2축을 §5.4 「검증 층」과 code: 에 등재`) project-planner 턴에서 (a) `2-api-convention.md` §5.4 표에 구조 축/이름 축 두 행 추가 + frontmatter `code:` 에 `user-entity-exposure*.ts`/`user-secret-absence*.ts` 패턴 등재, (b) `swagger.md` §5-1·`secret-store.md` §1.1 의 "두 검증자/두 개 축" 서술을 "네 개"로 갱신 또는 축 분류를 재정의. **이번 라운드도 해당 항목이 아직 미집행임을 재확인** — 새로운 회귀는 아니고 이미 정확히 추적된 known-gap.

- **[INFO] `select:false`/전역 `ClassSerializerInterceptor` 기각 근거가 spec `## Rationale` 대신 `plan/`·`CHANGELOG.md` 에만 있음**
  - target 위치: (해당 없음 — spec 미변경). 관련 문서: `spec/1-data-model.md §2.1 User`, `spec/conventions/secret-store.md §1.1`
  - 과거 결정 출처: `secret-store.md §1.1`(2026-09-05)이 이미 *"컬럼 수준(`select: false`)은 그 컬럼을 읽는 내부 경로가 예외 없이 `undefined` 를 받아 조용히 오작동하므로 쓰지 않는다"* 는 동일 계열 원칙을 `Trigger`/`AuthConfig` 축에 대해 세워 두었다.
  - 상세: 이번 diff 의 코드 주석(`user-entity-exposure.spec.ts`)·`CHANGELOG.md`·plan 파일은 `User` 엔티티에 대해 **독자적으로 같은 결론**(select:false 기각, 전역 인터셉터 기각, 구조+이름 검출 채택)을 재도출했다. 결론은 기존 `secret-store.md §1.1` 원칙과 **완전히 정합**하며 번복이 아니다. 다만 (1) 이 결정의 근거(전수 열거 수치·기각한 두 대안)가 spec 배치 규약(`CLAUDE.md`: "결정의 배경·근거 → 해당 spec 문서의 `## Rationale`")과 달리 `plan/`·`CHANGELOG.md` 에만 있고, (2) 코드 주석이 `secret-store.md §1.1` 을 인용하지 않아 같은 결론이 두 곳에서 독립적으로 재도출된 형태다 — `User` 자체에는 `secret-store.md §1.1` 같은 대응 절이 없다.
  - 제안: 이미 plan 에 등재된 두 번째 planner 후속 항목(`User 민감 7컬럼의 응답 노출 금지를 규약 문장으로`)대로, `1-data-model.md §2.1` 또는 `secret-store.md §1.1` 에 `User` 7컬럼 노출 금지 규범 문장 + `## Rationale` 에 결정 근거를 옮기고, 그 절에서 `secret-store.md §1.1` 을 상호 링크한다.

- **[정합 확인 — 위반 아님] `select:false`/전역 인터셉터 기각은 기존 원칙의 재도입이 아니다**
  - `git log -S"select: false"` 로 `codebase/backend/src/modules/users/` 이력을 확인한 결과 이 저장소에서 `User` 에 `select:false` 를 시도했다가 되돌린 이력은 없다 — "과거에 채택했다가 기각된 대안을 이유 없이 재도입"하는 패턴이 아니라, `secret-store.md §1.1` 이 이미 확립한 원칙과 **일관된 신규 적용**이다.

## 요약

Rationale 연속성 관점에서 이번 구현(감사 로그 유출 봉합 이후 `WorkflowVersionsService.findOne` 의 `creator` 관계 미투영 유출 수정 + 구조/이름 2축 검출기 신설)은 **과거에 기각된 대안을 재도입하거나 시스템 invariant 를 우회하지 않는다** — `select:false`/전역 `ClassSerializerInterceptor` 기각 논리는 `secret-store.md §1.1` 이 세운 기존 원칙과 완전히 정합한다. 다만 신규 검출기 2축이 `spec/5-system/2-api-convention.md` §5.4 "검증 층"과 `secret-store.md §1.1` 이 명시한 "검증자/축은 두 개"라는 닫힌 서술을 갱신하지 않아, 바로 직전 커밋이 확정한 "새 검증자는 관련 문서 양쪽의 `code:` 에 등재한다"는 관례를 아직 따르지 않은 상태다. 이 gap 은 developer 가 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 project-planner 턴 대기 항목으로 정확히 등재해 두었으므로 **새로운 은폐나 방치가 아니라 알려진 미집행 상태**이며, 다음 planner 턴에서 §5.4 표·두 문서 `code:`·`secret-store.md §1.1`/`1-data-model.md §2.1` 을 함께 갱신하면 해소된다.

## 위험도
LOW
