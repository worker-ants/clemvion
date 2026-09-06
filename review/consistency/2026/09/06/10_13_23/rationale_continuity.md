# Rationale 연속성 검토 — user-entity-column-defense

## 검토 범위 메모

`spec/5-system/` scope 델타는 0개 파일(코드 전용 PR). 판정은 구현 diff(8파일/681줄:
`user-entity-exposure-guard.ts`·`user-entity-exposure.spec.ts`·`user-secret-absence.ts`(+spec)·
`workspace-response.dto.ts`·`audit-logs.e2e-spec.ts`·`workspace-rbac.e2e-spec.ts`·`CHANGELOG.md`·
`plan/in-progress/spec-draft-nullable-notation-followups.md`)가 기존 spec 의 `## Rationale`
및 그에 준하는 명시적 설계 원칙 서술과 충돌하는지를 대상으로 했다. 실제 diff 는
`git -C <worktree> diff origin/main...HEAD` 로 직접 열어 확인했다(프롬프트 예산상 diff 섹션 자체가
절단되어 있었음).

## 발견사항

- **[WARNING]** "정확히 두 검증자" 로 명시된 §5.4/swagger §5-1 경계 서술과, 새로 추가된 세 번째 검출축(`user-secret-absence.ts`)이 스펙에 반영되지 않음
  - target 위치: `codebase/backend/src/shared/testing/user-secret-absence.ts` (신규) + `codebase/backend/test/audit-logs.e2e-spec.ts`/`workspace-rbac.e2e-spec.ts` 배선. 이 결정의 서술은 `CHANGELOG.md` "Unreleased — `User` 엔티티에 마지막 방어선을 세운다" 및 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "완료 (2026-09-06)" 블록에만 있음
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.4 "검증 층 — 이 규칙을 무엇이 강제하는가" (본문, 표) 및 `spec/conventions/swagger.md` §5-1 하단 블록쿼트. 두 문서는 방금(이 PR 직전 커밋 `21182db02 docs(spec): §5.4 검증자를 양쪽 규약에 등재하고 두 검증자의 경계를 적는다`) 명시적으로 정합화됐고, 서로를 인용하며 "두 검증자의 경계는 [API 규약 §5.4 검증 층]이 소유한다" 고 못박는다. swagger.md §5-1 은 이 두 검증자를 설명하며 **바로 이 PR 이 다루는 것과 동일한 실사례**를 인용한다 — *"`GET /api/audit-logs` 가 3필드를 광고하면서 `User` 엔티티 26키(`passwordHash`·2FA 복구 코드·계정 탈취 토큰 포함)를 내보내고 있었다"*
  - 상세: 두 문서는 "`User` 비밀값이 응답에 노출되지 않는가" 를 강제하는 메커니즘을 `swagger-dto-contract-guard.ts`(선언↔선언, 정적)와 `response-contract.ts`(값↔선언, 런타임) **두 개로 한정**해 서술한다. 이번 PR 은 바로 그 문제(동일 사고 사례)에 대해 **세 번째 축**(`user-secret-absence.ts` — 이름 기반, 선언과 무관하게 응답 바디를 깊이 스캔)을 신설했다. 이 신설 자체는 근거가 탄탄하다(코드 JSDoc 이 "`assertMatchesContract` 는 배선된 엔드포인트에만 적용된다" 는 기존 문서의 "못 보는 것" 칸의 한계를 정확히 짚어 보완하는 것으로 스스로 설명). 문제는 **spec 쪽이 갱신되지 않았다는 것** — §5.4 표와 swagger §5-1 블록쿼트 둘 다 여전히 "두 검증자" 만 서술하므로, 다음에 그 표를 읽는 사람은 `user-secret-absence.ts` 의 존재와 그 존재 이유(선언 기반 검증의 커버리지 갭)를 알 길이 없다. 두 문서가 "이름이 인접하니 어느 쪽인지 먼저 가려야 한다" 고 이미 헷갈림을 우려했던 그 자리에, 문서에 없는 세 번째 이름이 하나 더 생겼다.
  - 제안: `spec/5-system/2-api-convention.md` §5.4 검증 층 표에 `user-secret-absence.ts` 행을 추가(대조축: **이름 ↔ 값**, "선언과 무관 · 배선 여부와 독립" 열)하거나, 최소한 표 아래에 "세 번째 검출축(이름 기반 부재 단언)은 §5.4/swagger §5-1 의 커버리지 갭(미배선 엔드포인트)을 메우는 보완책" 이라는 한 문단을 추가. `spec/conventions/swagger.md` §5-1 블록쿼트에도 동일 취지 상호 참조를 남겨 "두 검증자" 문구를 "세 개의 축(그 중 하나는 test-only 보조)" 로 정정.

- **[INFO]** `User` 엔티티 컬럼 방어 방식(구조 검출 + 값 검출, `select:false`/전역 `ClassSerializerInterceptor` 명시적 기각)의 근거가 spec `## Rationale` 에 없고 `CHANGELOG.md`/`plan/in-progress/**` 에만 있음
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` "완료 (2026-09-06) — 전수 열거 후 셋째 길을 택했다" 블록, `CHANGELOG.md` "Unreleased — `User` 엔티티에 마지막 방어선을 세운다" 절
  - 과거 결정 출처: 없음 — 이것은 기존 Rationale 위반이 아니라 신규 결정이며, 논리 자체(19곳 공유 깔때기·46개 호출부·fail-silent 위험)는 `spec/conventions/secret-store.md` §1.1 이 이미 같은 논거("컬럼 수준 select:false 는 내부 경로가 예외 없이 undefined 를 받아 조용히 오작동하므로 쓰지 않는다")로 세워둔 원칙과 **정합**한다(재도입·번복 아님, 오히려 같은 원칙의 재확인).
  - 상세: CLAUDE.md 의 정보 저장 규약상 "결정의 배경·근거" 는 해당 spec 문서 끝의 `## Rationale` 이 SoT 다. 이번 결정은 `User` 엔티티(데이터 모델)와 응답 계약(§5.4/swagger) 양쪽에 걸친, 향후 재론될 가능성이 있는 보안 아키텍처 결정인데 지금은 plan 문서(완료되면 `complete/` 로 이동하거나 archive 될 수 있는 위치)와 CHANGELOG 에만 있다. 다음에 누군가 "왜 `User` 는 select:false 를 안 쓰는가" 를 spec 에서 찾으면 못 찾는다.
  - 제안: `spec/1-data-model.md` §2.1 User 절 하단 또는 `spec/conventions/swagger.md`/`secret-store.md` 의 `## Rationale` 에 짧게 이 결정(전수 열거 수치 + 기각한 두 대안 + 채택한 2축 검출)을 옮겨 적어, plan 항목이 `complete/` 로 이동해도 근거가 유실되지 않게 한다.

## 요약

이번 PR 은 감사 로그 유출(#1288) 이후 열려 있던 "User 컬럼 수준 방어" 결정을 전수 열거로 매듭짓고, 이미 spec(`secret-store.md`)에 박혀 있던 "select:false 는 fail-silent 라 쓰지 않는다" 원칙과 정합하는 방향으로 마무리했다 — 기각된 대안의 무단 재도입이나 invariant 직접 위반은 발견되지 않았다. 다만 같은 문제(User 비밀값의 응답 노출)를 다루기 위해 방금 정합화된 "정확히 두 검증자" 경계 서술(§5.4/swagger §5-1)에 세 번째 검출축을 얹으면서 그 두 문서를 갱신하지 않았고, 결정의 근거 자체도 spec `## Rationale` 이 아니라 plan/CHANGELOG 에만 남겨 SoT 배치 규약과 다소 어긋난다. 둘 다 기능적 결함이 아니라 문서 동기화 갭이라 WARNING/INFO 수준으로 판단한다.

## 위험도

LOW
