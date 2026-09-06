# Rationale 연속성 검토 — `spec/5-system/` (impl-done, 3차 재확인)

## 검토 전제

- 이번 diff(`21182db02..HEAD`, scope 는 `spec/5-system/` 델타 0 — 코드 전용)는 이미 **두 차례**
  rationale_continuity 검토(`review/consistency/2026/09/06/10_13_23`, `.../10_53_50`)를 받았다.
  본 라운드는 그 사이 새로 추가된 커밋 `9a186fa31`("내가 강조한 '출처를 바꿔라' 를 정작 보안
  경계 리터럴에 안 썼다")이 (a) 기존에 지적된 두 WARNING 을 실질적으로 해소했는지, (b) 새로운
  Rationale 충돌을 만들지 않았는지를 독립적으로 재확인한다.
- `9a186fa31` 의 핵심 변경: `CREATOR_PROJECTION` 상수 통합 + DTO OpenAPI 스키마 대조 테스트,
  `user-entity-exposure-guard.ts` 의 중첩 객체/`as`·`satisfies`/중간 변수 케이스 보강,
  e2e 라벨 재배치, 그리고 **`plan/in-progress/spec-draft-nullable-notation-followups.md` 갱신**
  (spec 은 건드리지 않음 — developer 는 `spec/` 쓰기 권한이 없으므로 옳은 처신).

## 발견사항

- **[WARNING] §5.4 「검증 층」·`swagger.md §5-1` 의 "두 검증자" 개수 서술이 여전히 실제와 다르다 (3차 재확인 — 미해소, 그러나 방치 아님)**
  - target 위치: (target 자체 무변경) — 충돌 대상은 `spec/5-system/2-api-convention.md#검증-층--이-규칙을-무엇이-강제하는가`("그 자리를 **두 검증자**가 나눠 맡는다", 현재도 동일 문구 확인) 및 `spec/conventions/swagger.md` §5-1("**두 검증자**의 경계는 … 이 소유한다", 현재도 동일 문구 확인)
  - 과거 결정 출처: 직전 커밋 `21182db02`("§5.4 검증자를 양쪽 규약에 등재하고 두 검증자의 경계를 적는다")가 확정한 "새 검증자는 관련 문서 양쪽의 `code:` 에 등재하고, 개수 서술을 정확히 유지한다"는 관례.
  - 상세: 이번 브랜치가 추가한 `user-entity-exposure-guard.ts`(구조 축)·`user-secret-absence.ts`(이름 축)는 실질적으로 두 문서가 "두 검증자로 닫혀 있다"고 서술한 그 영역(엔티티 패스스루/응답 노출 검증)에 **제3·제4의 검증자**를 얹었다. 두 문서 어디에도 이 신규 파일이 `code:` glob 으로 등재되지 않았고, "두 검증자" 문구도 그대로다. 이 gap 자체는 1차 검토(`10_13_23`)에서 처음 지적됐고 2차(`10_53_50`)가 재확인했다.
  - **3차 변경점**: 이번 커밋에서 developer 가 spec 을 직접 고치는 대신(권한 밖) `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 항목을 정밀화했다 — 대상 문장 둘을 표로 명시하고, "새 개수를 적어 넣지 말고 나열하라"는 지시로 바꿨다(개수 기반 서술이 축이 늘 때마다 또 낡는 실패를 이미 두 번 겪었다는 근거 포함). 이는 **spec 자체의 정합화가 아니라 향후 planner 턴이 정확히 무엇을 고쳐야 하는지에 대한 지시의 개선**이다. spec 문서(§5.4 표·swagger.md §5-1)의 실제 문구는 여전히 미갱신 — 즉 이 WARNING 은 **아직 해소되지 않았다.**
  - 제안: (변경 없음, 재확인) project-planner 턴에서 (a) `2-api-convention.md` §5.4 표에 구조 축(`user-entity-exposure-guard.ts`)·이름 축(`user-secret-absence.ts`) 두 행 추가 + frontmatter `code:` 등재, (b) `swagger.md` §5-1 의 "두 검증자" 문구를 개수 서술 대신 표/나열 형태로 교체(plan 이 이미 이 방향을 못박아 두었으므로 그대로 따르면 됨).

- **[WARNING] `User` 민감 7컬럼 응답 노출 금지가 여전히 spec 규범 문장으로 없다 (3차 재확인 — 미해소)**
  - target 위치: (해당 없음 — spec 미변경). 관련 문서: `spec/1-data-model.md §2.1 User`, `spec/conventions/secret-store.md §1.1`
  - 과거 결정 출처: `secret-store.md §1.1`(2026-09-05)이 `Trigger`/`AuthConfig` 축에 대해 이미 세운 원칙 — *"컬럼 수준(`select: false`)은 그 컬럼을 읽는 내부 경로가 예외 없이 `undefined` 를 받아 조용히 오작동하므로 쓰지 않는다"*.
  - 상세: 이번 라운드까지 포함해 `User` 에 대해서도 동일 논리(select:false 기각, 전역 인터셉터 기각, 구조+이름 2축 채택)가 `CHANGELOG.md`·`plan/`·코드 주석에 **독자적으로 재도출**돼 있고, 결론은 `secret-store.md §1.1` 과 완전히 정합(번복 아님)하지만, 그 근거는 여전히 spec `## Rationale` 이 아니라 plan/CHANGELOG 에만 있다. `9a186fa31` 은 이 항목을 변경하지 않았다(plan 상 해당 체크박스는 그대로 미해결 상태).
  - 제안: (변경 없음, 재확인) `1-data-model.md §2.1` 또는 `secret-store.md §1.1` 에 `User` 7컬럼 노출 금지 규범 문장 + `## Rationale` 에 결정 근거(전수 열거 수치·기각한 두 대안)를 옮기고 상호 링크.

- **[정합 확인 — 위반 아님] `CREATOR_PROJECTION` 통합 방식은 기존 원칙과 배치되지 않는다**
  - `9a186fa31` 은 자신이 직접 세운 code-comment 수준 원칙("관계 이름 목록을 넓히지 말고 출처를 바꾼다" — `collectUserRelationNames` 의 JSDoc, `4d49aa575`)을 `CREATOR_PROJECTION` 투영 리터럴에는 처음에 적용하지 못했다고 스스로 진단하고, 이를 단일 상수 + DTO OpenAPI 스키마 대조 테스트로 보완했다. 이 원칙은 spec `## Rationale` 이 아니라 코드 JSDoc 수준의 자체 관례이므로 spec 대비 "번복"이 아니며, 새로 만든 테스트(`buildSwaggerDocument`/`schemasOf`)도 기존 `response-contract.ts`/`swagger-dto-contract-guard.ts` 가 이미 쓰는 공유 프로브 인프라를 재사용한 것이라 §5.4 "두 검증자" 아키텍처와 별도의 경쟁 메커니즘을 만들지 않았다 — 특정 서비스 하나에 국한된 단위 테스트로, §5.4 표가 다루는 앱 전역 검증자 목록에 다섯 번째 항목으로 등재될 성격은 아니다.
  - `select:false`/전역 `ClassSerializerInterceptor` 기각 논리 자체에 대해 `git log -S"select: false"` 로 `codebase/backend/src/modules/users/` 이력을 재확인 — 과거에 채택했다가 되돌린 이력 없음. 기각된 대안의 재도입 패턴이 아니다.

## 요약

3차 재확인 결과, `9a186fa31` 은 앞선 두 라운드가 지적한 두 WARNING(§5.4/swagger.md 의 "두 검증자" 개수 서술 미갱신, `User` 노출 금지 규범의 spec `## Rationale` 부재)을 **spec 수정으로 해소하지 않았다** — 다만 developer 권한 밖의 일을 정확히 인지하고 plan 항목의 지시 정밀도만 높였다(개수 재기입 대신 나열 방식으로, 같은 실패의 재발 방지). 새로 추가된 코드(`CREATOR_PROJECTION` 통합, 가드의 중첩/캐스트 케이스 보강)는 기존에 확립된 원칙(`secret-store.md §1.1` 의 select:false 기각, §5.4 검증 층 아키텍처)과 정합하며 기각된 대안의 무단 재도입이나 invariant 우회는 발견되지 않았다. 두 WARNING 은 새로운 은폐가 아니라 **planner 턴을 기다리는 상태가 유지**되고 있는 known-gap이다.

## 위험도
LOW
