# Rationale 연속성 검토 — `spec/5-system/` (impl-done, 4차 재확인)

## 검토 전제

- `scope(spec/5-system)` 델타는 **0개 파일** — 정상이다(코드 전용 PR). 본 검토는 "target 문서가
  직접 무엇을 고쳤는가"가 아니라 "구현이 `spec/5-system/`·인접 `spec/conventions/**` 의 기존
  Rationale·원칙과 계속 정합하는가"를 본다.
- 이 diff(11개 파일 / 1453줄, `git diff origin/main`)는 이미 **세 차례** rationale_continuity
  검토(`review/consistency/2026/09/06/10_13_23`, `.../10_53_50`, `.../11_27_54`)를 받았다. 그
  사이 새로 추가된 커밋은 `01b078379`("가드가 '겉은 투영, 실은 전체 노출' 을 통과시켰다")
  하나뿐이며, 커밋 메시지 자체가 명시한다 — *"`11_27_54` consistency WARNING 2 는 3차
  재확인된 planner 항목이라 코드 변경 없음"*. 즉 이 커밋은 코드 리뷰(`11_27_53`) WARNING
  4건(가드의 `hasProjectionFor` 불리언 오판정·eager 관계 사각지대 등)을 처분했을 뿐 spec
  관련 상태는 건드리지 않았다. 본 라운드는 이 사실을 독립적으로 재확인한다.
- 구현 핵심(재확인): 감사 로그 유출(#1288, `User` 26키)을 좁혀 고친 뒤, 전수 열거를 관계
  **타입**(`User`) 기준으로 다시 하자 `WorkflowVersionsService.findOne` 이 `relations:
  ['creator']` 를 투영 없이 로드해 `GET /api/workflows/:wfId/versions/:versionId` 가 버전
  작성자의 `passwordHash`·2FA 시크릿·복구 코드·계정 탈취 토큰을 그대로 내보내고 있던 **살아있는
  유출**을 발견·수정했다(`CREATOR_PROJECTION` 도입). 재발 방지로 구조 축
  (`user-entity-exposure-guard.ts`)·이름 축(`user-secret-absence.ts`) 2종 검출기를 신설했다.

## 발견사항

- **[WARNING] §5.4 「검증 층」·`swagger.md §5-1` 의 "두 검증자" 개수 서술이 여전히 실제와 다르다 (4차 재확인 — 미해소, 그러나 방치 아님)**
  - target 위치: (target 자체 무변경) — 충돌 대상은
    `spec/5-system/2-api-convention.md#검증-층--이-규칙을-무엇이-강제하는가`("그 자리를
    **두 검증자**가 나눠 맡는다", 현재도 동일 문구) 및 `spec/conventions/swagger.md` §5-1
    ("**두 검증자**의 경계는 … 이 소유한다", 현재도 동일 문구)
  - 과거 결정 출처: 직전 커밋 `21182db02`("§5.4 검증자를 양쪽 규약에 등재하고 두 검증자의
    경계를 적는다")가 확정한 관례 — "새 검증자는 관련 문서 양쪽의 `code:` frontmatter에
    등재하고, 개수 서술을 정확히 유지한다."
  - 상세: 이번 브랜치가 추가한 `user-entity-exposure-guard.ts`(구조 축)·
    `user-secret-absence.ts`(이름 축)는 두 문서가 "두 검증자로 닫혀 있다"고 서술하는 바로 그
    영역(엔티티 패스스루·응답 비밀 노출 검증)에 **제3·제4의 검증자**를 얹었다. 두 문서
    어디에도 이 신규 파일이 `code:` glob 으로 등재돼 있지 않고, "두 검증자" 문구도 그대로다.
    이 gap 은 1차(`10_13_23`)에서 처음 지적, 2차(`10_53_50`)·3차(`11_27_54`)가 각각 재확인했고,
    본 4차 시점(`01b078379` 포함)에도 spec 문구는 **바뀌지 않았다**(developer 는
    `spec/` 쓰기 권한이 없으므로 정확한 처신).
  - 제안: (변경 없음, 재확인) project-planner 턴에서 (a) `2-api-convention.md` §5.4 표에
    구조 축/이름 축 두 행 추가 + frontmatter `code:` 에 `user-entity-exposure*.ts`·
    `user-secret-absence*.ts` 패턴 등재, (b) `swagger.md` §5-1 의 "두 검증자" 문구를 개수
    서술 대신 표/나열 형태로 교체 — `plan/in-progress/spec-draft-nullable-notation-followups.md`
    가 이미 이 방향(숫자 재기입 금지, 나열로 대체)을 못박아 두었으므로 그대로 집행하면 된다.

- **[WARNING] `User` 민감 7컬럼 응답 노출 금지가 여전히 spec 규범 문장으로 없다 (4차 재확인 — 미해소)**
  - target 위치: (해당 없음 — spec 미변경). 관련 문서: `spec/1-data-model.md §2.1 User`,
    `spec/conventions/secret-store.md §1.1`
  - 과거 결정 출처: `secret-store.md §1.1`(2026-09-05)이 `Trigger`/`AuthConfig` 축에 대해
    이미 세운 원칙 — *"컬럼 수준(`select: false`)은 그 컬럼을 읽는 내부 경로가 예외 없이
    `undefined` 를 받아 조용히 오작동하므로 쓰지 않는다"*.
  - 상세: `User` 에 대해서도 동일 논리(select:false 기각 — 19곳 공유 깔때기·`comparePassword`
    silent 실패, 전역 `ClassSerializerInterceptor` 기각 — 298 e2e 표면 전체 변경, 구조+이름
    2축 검출 채택)가 `CHANGELOG.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md`·
    코드 주석에 **독자적으로 재도출**돼 있다. 결론은 `secret-store.md §1.1` 과 완전히
    정합(번복 아님)하지만, 근거(전수 열거 수치·기각한 두 대안)는 여전히 spec `## Rationale`
    이 아니라 plan/CHANGELOG 에만 있다 — CLAUDE.md 의 정보 저장 규약("결정의 배경·근거 →
    해당 spec 문서 끝의 `## Rationale`")과 어긋난 상태가 지속된다. `01b078379` 는 이 항목을
    바꾸지 않았다(plan 상 해당 체크박스는 미해결 유지).
  - 제안: (변경 없음, 재확인) `1-data-model.md §2.1` 또는 `secret-store.md §1.1` 에 `User`
    7컬럼 노출 금지 규범 문장 + `## Rationale` 에 결정 근거(전수 열거 수치·기각한 두 대안·
    채택 이유)를 옮기고 `secret-store.md §1.1` 을 상호 링크한다.

- **[정합 확인 — 위반 아님] `select:false`/전역 인터셉터 기각은 기존 원칙의 재도입이 아니다**
  - `git log -S"select: false"` 로 `codebase/backend/src/modules/users/` 이력을 재확인 —
    `User` 에 `select:false` 를 채택했다가 되돌린 이력이 없다. "과거에 기각된 대안을
    이유 없이 재도입"하는 패턴이 아니라 `secret-store.md §1.1` 이 이미 확립한 원칙과 **일관된
    신규 적용**이다.

- **[정합 확인 — 위반 아님] `01b078379` 의 가드 술어 반전(`isObjectLiteralExpression` →
  "불리언이 아닌가")은 spec Rationale 과 무충돌**
  - 이 변경은 `user-entity-exposure-guard.ts` 내부 판정 로직(코드 리뷰 WARNING 처분)이며,
    §5.4 "검증 층" 표가 다루는 앱 전역 아키텍처 결정이 아니라 신규 검출기 내부의 정밀도
    보정이다. 위 두 WARNING 의 상태(미등재)에 영향을 주지 않는다.

## 요약

4차 재확인 결과, 이 브랜치는 **과거에 기각된 대안을 이유 없이 재도입하거나 시스템 invariant를
우회하지 않는다** — `User` 엔티티에 대한 `select:false`/전역 `ClassSerializerInterceptor` 기각
논리는 `secret-store.md §1.1` 이 세운 기존 원칙과 완전히 정합하며, 실제 살아있던 유출
(`WorkflowVersionsService.findOne`)은 기존 자매 메서드가 이미 쓰던 투영 패턴(`CREATOR_PROJECTION`)
으로 닫혔다. 다만 신규 검출 2축(`user-entity-exposure-guard.ts`·`user-secret-absence.ts`)이
`spec/5-system/2-api-convention.md` §5.4 및 `spec/conventions/swagger.md` §5-1 의 "검증자/축은
두 개"라는 닫힌 서술을 여전히 갱신하지 않았고, `User` 7컬럼 노출 금지의 근거도 여전히 spec
`## Rationale` 이 아닌 `plan/`·`CHANGELOG.md` 에만 있다. 두 WARNING 은 세 차례 연속 재확인된
동일한 known-gap 이며, developer 가 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 project-planner 턴 대기 항목으로 정확히 등재해 두었으므로 새로운 은폐나 방치가 아니다 —
다음 planner 턴에서 §5.4 표·두 문서 `code:`·`secret-store.md §1.1`/`1-data-model.md §2.1` 을
함께 갱신하면 해소된다.

## 위험도
LOW
