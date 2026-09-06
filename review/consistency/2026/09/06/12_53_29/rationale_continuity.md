# Rationale 연속성 검토 — `spec/5-system/` (impl-done, 6차 재확인)

## 검토 전제

- `scope(spec/5-system)` 델타는 이번에도 **0개 파일**. 코드 전용 PR 이라 정상이며, 본 검토는
  구현(`git diff origin/main...HEAD -- codebase`, 15파일)이 `spec/5-system/`·인접
  `spec/conventions/**`·`spec/1-data-model.md` 의 기존 `## Rationale`·확립된 설계 원칙과
  계속 정합하는가를 본다.
- 이 diff 는 이미 5차례 rationale_continuity 검토(`10_13_23`·`10_53_50`·`11_27_54`·
  `11_55_37`·`12_28_03`)를 받았다. 직전 라운드(`12_28_03`) 이후 추가된 커밋은 `4529812c6`
  (JSDoc 리뷰-인용 유출 가드 신설 + `unwrap` 관측 불가 분기 정리 + 문서 3곳 축-서술 정정)
  **하나뿐**이며, `plan/in-progress/spec-draft-nullable-notation-followups.md` 를 갱신해
  planner 대기 항목을 명시적으로 추가했다.
- 본 라운드는 그 신규 커밋이 과거 Rationale·확립 원칙과 정합하는지를 중점적으로 재검증하고,
  기존 4개 발견사항(정합 확인 2건·WARNING 2건)의 현재 상태를 독립 재확인했다.

## 발견사항

- **[정합 확인 — 위반 아님] `select:false`/전역 `ClassSerializerInterceptor` 기각은 확립된
  원칙의 신규 적용이지 이유 없는 번복이 아니다 (재확인)**
  - target 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts`
    헤더, `plan/in-progress/spec-draft-nullable-notation-followups.md` "완료(2026-09-06)" 절
  - 과거 결정 출처: `spec/conventions/secret-store.md §1.1`(2026-09-05 등재, 이 브랜치가
    만든 것이 아님) — *"엔티티를 그대로 반환하는 경로에서는 응답 경계에서 지운다. 컬럼 수준
    (`select: false`)은 그 컬럼을 읽는 내부 경로가 예외 없이 `undefined` 를 받아 조용히
    오작동하므로 쓰지 않는다."*
  - 상세: `User` 인증 비밀 7컬럼에 `secret-store.md §1.1` 이 `Trigger`/`AuthConfig` 축에
    이미 세운 "select:false 기각 → 응답 경계(호출부 투영)에서 지운다" 원칙을 동형으로
    재적용했다. `git log -S"select: false" -- codebase/backend/src/modules/users` 로
    되돌린 이력 없음을 재확인. `WorkflowVersionsService` 의 실제 수정(`CREATOR_PROJECTION`)도
    같은 패턴.
  - 제안: 없음 (정합).

- **[정합 확인 — 위반 아님] 신규 `dto-jsdoc-citation-guard.ts` 는 `review-citations.md §3`·
  `swagger.md §3` 이 이미 처방한 규칙(JSDoc 은 리뷰 인용 대상 아님, `//` 로 회피)을 그대로
  코드화한 것 — 규칙 재해석이나 번복이 아니다**
  - target 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`,
    `dto-jsdoc-citation.spec.ts`
  - 과거 결정 출처: `spec/conventions/review-citations.md §2`(인용 3형태: 전체 경로·날짜+시각·
    bare 시각) · §3(*"DTO·컨트롤러의 `/** */` JSDoc 은 대상 아님 … `//` 주석에 적는다"*) ·
    `spec/conventions/swagger.md §3`(*"JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지
    않는다"*).
  - 상세: 가드는 §2 의 세 형태(bare 시각 포함 — 커밋 메시지가 스스로 *"금지된 형태일수록
    JSDoc 에 남을 확률이 높다"* 고 정확히 짚는다)를 그대로 옮겨 `dto/responses/**` 의
    클래스·프로퍼티 JSDoc 만 스캔하고 `//` 는 보지 않는다. 기존 2건(`#1291` 이 넣은
    `ScheduleTriggerWorkflowRefDto`/`TriggerWorkflowRefDto` 클래스 JSDoc 인용)은
    `review-citations.md §4`(*"기존 인용은 소급 정리 대상 아님 … 다음에 건드릴 때 함께
    맞춘다"*)에 따라 동결(allowlist)했고, 두 파일 다 이 브랜치 diff 밖이라 손대지 않은
    판단도 §4 취지에 맞는다.
  - 제안: 없음 (정합). 다만 아래 새 항목이 이 가드의 부수 효과를 하나 더 짚는다.

- **[WARNING] §5.4 「검증 층」·`swagger.md §5-1` 의 "두 검증자" 서술이 이번 라운드로 3축째
  반영을 못한 채 그대로다 (6차 연속 재확인 — 알려진 gap, planner 대기 중, 방치 아님)**
  - target 위치: (spec 자체 무변경) 대상은
    `spec/5-system/2-api-convention.md#검증-층--이-규칙을-무엇이-강제하는가`
    (*"그 자리를 **두 검증자**가 나눠 맡는다"*), `spec/conventions/swagger.md §5-1`
    (*"**두 검증자**의 경계는 … 이 소유한다"*) — 두 문구 모두 여전히 동일.
  - 과거 결정 출처: 커밋 `21182db02`(*"§5.4 검증자를 양쪽 규약에 등재하고 두 검증자의 경계를
    적는다"*)가 확정한 관례 — 새 검증자는 관련 문서 양쪽 frontmatter `code:` 에 등재하고
    개수 서술을 정확히 유지한다.
  - 상세: 직전 라운드까지는 신규 검출기가 2개(`user-entity-exposure-guard.ts` 구조 축·
    `user-secret-absence.ts` 이름 축)였으나, 이번 커밋이 `dto-jsdoc-citation-guard.ts`
    (JSDoc 인용 축)를 더해 **3개**가 됐다. 세 파일 모두 `2-api-convention.md`·`swagger.md`
    의 `code:` glob 어디에도 걸리지 않는다(재확인: `swagger-dto-contract*.ts`·
    `response-contract*.ts`·`swagger-probe*.ts` 세 패턴뿐). developer 는 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "신규 검출 2축을 §5.4
    「검증 층」과 `code:` 에 등재" planner 항목을 두었으나, 그 항목 본문도 아직 "2축"
    프레이밍이라(`dto-jsdoc-citation-guard.ts` 는 같은 등재 절 안에 "함께" 로만 언급되고
    별도 축으로 세어지지 않음) planner 가 착수 시 3축(구조/이름/JSDoc 인용) 전부를
    반영해야 정확하다.
  - 제안: (변경 없음, 재확인 + 세부 보정) project-planner 턴에서 §5.4 표에 **세 행**(구조
    축/이름 축/JSDoc 인용 축)을 추가하고 세 문서(`2-api-convention.md`·`swagger.md`) 의
    `code:` 에 `user-entity-exposure*.ts`·`user-secret-absence*.ts`·
    `dto-jsdoc-citation*.ts` 를 등재한다. "두 검증자" 처럼 개수를 못 박은 문장은 나열형으로
    바꿔 축이 늘 때마다 숫자가 낡는 실패(이미 2회)를 반복하지 않는다.

- **[WARNING] `User` 민감 7컬럼 응답 노출 금지가 여전히 spec `## Rationale` 문장으로
  승격되지 않았다 (6차 연속 재확인 — 알려진 gap)**
  - target 위치: (해당 없음 — spec 미변경). 관련 문서: `spec/1-data-model.md §2.1 User`,
    `spec/conventions/secret-store.md §1.1`.
  - 과거 결정 출처: `secret-store.md §1.1`(2026-09-05)이 `Trigger`/`AuthConfig` 축에 이미
    세운 원칙(첫 항목 참조)과 CLAUDE.md 정보 저장 규약(*"결정의 배경·근거 → 해당 spec 문서
    끝의 `## Rationale`"*).
  - 상세: 변화 없음 — 결정 근거(전수 열거 수치 19곳/46곳·기각한 두 대안·채택 이유)는
    `plan/in-progress/spec-draft-nullable-notation-followups.md`·`CHANGELOG.md`에만 있고
    spec `## Rationale` 에는 없다. developer 권한 밖(spec 쓰기)이라 그대로 planner 대기
    상태이며 은폐·방치가 아니다.
  - 제안: (변경 없음, 재확인) project-planner 턴에서 `1-data-model.md §2.1` 또는
    `secret-store.md §1.1` 에 `User` 7컬럼 노출 금지 규범 문장 + `## Rationale` 로 결정
    근거를 승격한다.

- **[WARNING — 신규] `review-citations.md` 의 "이 규약에는 시행하는 코드가 없다" Rationale
  전제가 이번 커밋으로 반증됐는데, 그 문서(및 이를 선례로 인용하는
  `spec-impl-evidence.md §2.1`)는 아직 그 사실을 반영하지 않는다**
  - target 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`
    (신규, 커밋 `4529812c6`) · `dto-jsdoc-citation.spec.ts`
  - 과거 결정 출처: `spec/conventions/review-citations.md` `## Rationale` §
    "`code:` 가 '구현 경로' 가 아니라 '준수 예시' 를 가리키는 이유" — *"이 규약에는 **시행하는
    코드가 없다** — 주석 형태를 강제하는 가드가 없기 때문이다. 그래서 `code:` 에 이 규약이
    처방하는 형태를 실제로 쓰는 파일을 적었다."* 같은 취지가
    `spec/conventions/spec-impl-evidence.md` §2.1 `code` 필드 설명 안에도
    "선례: `review-citations.md` — 주석 형태를 강제하는 가드가 없다" 로 복제돼 있다.
  - 상세: 이 전제는 등재 시점(2026-09-05)에는 참이었고, 그래서 `review-citations.md` 의
    `code:` 가 (enforcement 파일이 아니라) `roles.guard.spec.ts`·
    `sanitize-loader-error.ts` 같은 "준수 예시" 를 가리키도록 설계됐다. 그런데 이번
    커밋(`4529812c6`)이 추가한 `dto-jsdoc-citation-guard.ts` 는 정확히 §3 이 처방하는 규칙
    (DTO/컨트롤러 JSDoc 에 리뷰 인용을 쓰지 않는다 — `//` 로 회피)을 **AST 로 스캔해 위반
    수를 세고 알려진 2건만 허용목록으로 동결**한다 — 이것은 "주석 형태를 강제하는 가드"
    그 자체다. 즉 review-citations.md 가 스스로 세운 "왜 `code:` 가 구현 경로가 아니라
    준수 예시를 가리키는가" 의 **전제 사실이 이번 diff 로 무너졌다**. `spec/5-system` 스코프
    밖(`spec/conventions/**`)이라 이번 검토 스코프의 직접 대상은 아니지만, "과거 Rationale
    의 근거가 실측으로 반증된 채 방치" 라는 이 checker 의 관심사에 정확히 해당하고, 위
    두 WARNING 과 같은 `code:` 미등재 패턴(신규 가드가 어떤 spec/convention 의 `code:`
    에도 안 걸림)이 세 번째로 반복된 것이기도 하다.
  - 이것이 "결함" 은 아니다 — `dto-jsdoc-citation-guard.ts` 자체는 §3 규칙을 정확히
    구현했고 기존 인용은 §4 대로 올바르게 동결했다. 문제는 그 사실이 만든 문서 쪽 전제
    (review-citations.md 의 "시행 코드 없음")가 갱신되지 않았다는 것 뿐이다. 다만 이 가드가
    review-citations.md §2 의 **일반** 규칙(전 코드베이스의 bare-시각 금지) 전체를 시행하는
    것은 아니고 §3 의 **DTO/컨트롤러 JSDoc 카브아웃**만 시행하므로, "시행 코드가 없다" 는
    문장을 전면 삭제하기보다 "DTO JSDoc 카브아웃만 `dto-jsdoc-citation-guard.ts` 가
    시행하고, §2 의 일반 형식 규칙은 여전히 비강제" 로 좁혀 정정하는 편이 정확하다.
  - 제안: project-planner 턴에서 (a) `review-citations.md` 의 위 Rationale 문단을
    "§3 DTO/컨트롤러 JSDoc 카브아웃은 `dto-jsdoc-citation-guard.ts` 가 강제하고, `code:`
    에 그 파일을 등재한다 — §2 일반 규칙(코드베이스 전반 bare-시각 금지)은 여전히 강제
    코드가 없다" 로 정정, (b) `spec-impl-evidence.md §2.1` 의 review-citations.md 인용도
    "부분 시행 상태로 전환됨"을 반영하거나, 그 문단이 예시로 드는 선례를 재검토, (c) 위
    §5.4 3축 등재 작업과 함께 진행하면 중복 조사 비용이 없다 (같은 파일이 두 등재 작업
    모두의 대상).

- **[정합 확인 — 위반 아님] §5.4 "부재 표현" 규칙 준수 — `WorkspaceMemberDto.joinedAt`
  (재확인, 변경 없음)**
  - target 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
  - 과거 결정 출처: `spec/5-system/2-api-convention.md §5.4`(*"기본은 `null`"*) ·
    `spec/1-data-model.md`(`joined_at | Timestamp?`) · `swagger.md §3`(JSDoc 내부 서사
    분리).
  - 상세: 이전 라운드에서 확인한 상태 그대로 — 상시 존재 필드에 `@ApiProperty({ nullable:
    true })` + `field: string | null`, 내부 근거는 `//` 로 분리. 이번 커밋은 이 파일을
    건드리지 않았다.
  - 제안: 없음 (정합).

## 요약

6차 재확인 결과로도 이 브랜치는 과거 Rationale 에서 명시적으로 기각된 대안(예: `User` 에
`select:false`)을 이유 없이 재도입하거나, 합의된 설계 원칙·시스템 invariant 를 우회하지
않는다. 이번 라운드에 유일하게 추가된 커밋(`4529812c6`)은 §3 리뷰-인용 카브아웃 규칙을
정확히 코드화했고, 관측 불가능했던 파서 분기를 정직하게 제거했으며, 잘못된 spec 인용
(`§1.3`→`§3`)을 스스로 바로잡았다 — 모두 기존 원칙과 정합한다. 다만 이 신규 가드가 부수적으로
`review-citations.md` 의 "이 규약에는 시행하는 코드가 없다" 는 Rationale 전제를 반증하는데
그 문서가 아직 갱신되지 않은 **새로운 WARNING** 을 하나 만들었고, 이는 기존 3건의 WARNING
(§5.4 "두 검증자" 서술 미반영·`User` 7컬럼 노출 금지 미승격)과 같은 근본 패턴 — **신규
검증 코드가 그 검증 대상인 spec/convention 문서의 `code:` 등재·서술과 함께 움직이지
않음** — 의 세 번째 사례다. 넷 모두 developer 권한 밖(spec/convention 쓰기)이며 그중 3건은
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 대기 항목으로
정확히 등재돼 있어 은폐·방치 상태가 아니다(신규 1건은 이번 검토로 처음 식별됨). CRITICAL 은
0건이다.

## 위험도
LOW
