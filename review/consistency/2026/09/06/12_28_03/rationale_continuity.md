# Rationale 연속성 검토 — `spec/5-system/` (impl-done, 5차 재확인)

## 검토 전제

- `scope(spec/5-system)` 델타는 **0개 파일** — 코드 전용 PR 이므로 정상이다. 본 검토는
  "구현(`git diff origin/main...HEAD -- codebase`, 12파일/1562줄)이 `spec/5-system/`·
  인접 `spec/conventions/**`·`spec/1-data-model.md` 의 기존 `## Rationale`·확립된 설계
  원칙과 계속 정합하는가"를 본다.
- 이 diff 는 이미 4차례 rationale_continuity 검토(`10_13_23`·`10_53_50`·`11_27_54`·
  `11_55_37`)를 받았다. 직전 라운드(`11_55_37`) 이후 추가된 커밋은 `72c0bcc13`
  (eager 축 검출력 0건 수정, 코드 리뷰/consistency WARNING 처분) 하나뿐이며 spec 관련
  상태·plan 트래커 항목을 변경하지 않았다. 본 라운드는 그 사실을 독립적으로 재확인하고
  전체를 처음부터 재검증했다.
- 구현 핵심: 감사 로그 유출(#1288, `User` 26키) 수정 이후 관계를 **타입**(`User`) 기준
  전수 열거하자 `WorkflowVersionsService.findOne` 이 `relations: ['creator']` 를 투영
  없이 로드해 `GET /api/workflows/:wfId/versions/:versionId` 가 버전 작성자의
  `passwordHash`·2FA 시크릿·복구 코드·계정 탈취 토큰을 그대로 내보내던 **살아있는 유출**을
  발견·수정(`CREATOR_PROJECTION`, 자매 메서드 `findByWorkflow` 가 이미 쓰던 투영 패턴 재사용).
  재발 방지로 구조 축(`user-entity-exposure-guard.ts`)·이름 축(`user-secret-absence.ts`)
  2종 검출기를 신설. 곁가지로 `WorkspaceMemberDto.joinedAt` 을 §5.4 기본형(`null`)으로
  등재.

## 발견사항

- **[정합 확인 — 위반 아님] `select:false`/전역 `ClassSerializerInterceptor` 기각은 기존
  원칙의 이유 없는 번복이 아니라 확립된 원칙의 신규 적용**
  - target 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts`
    (파일 헤더 "왜 `select: false` 가 아닌가")
  - 과거 결정 출처: `spec/conventions/secret-store.md §1.1`("비대상 필드도 응답 바디에는
    나가지 않는다", 2026-09-05 등재, `origin/main` 에 이미 존재 — 이 브랜치가 만든 것이
    아님) — *"엔티티를 그대로 반환하는 경로에서는 응답 경계에서 지운다. 컬럼 수준
    (`select: false`)은 그 컬럼을 읽는 내부 경로가 예외 없이 `undefined` 를 받아 조용히
    오작동하므로 쓰지 않는다."*
  - 상세: `git log -S"select: false" -- codebase/backend/src/modules/users` 로 확인 —
    `User` 에 `select:false` 를 채택했다가 되돌린 이력은 없다. `secret-store.md §1.1` 이
    다른 도메인(Trigger/AuthConfig 비밀)에 세운 "select:false 기각 → 응답 경계(per-callsite
    projection)에서 지운다" 원칙을 `User` 인증 비밀 7컬럼에 **동형으로 재적용**한 것이며,
    `WorkflowVersionsService` 의 실제 수정(`relations` + `select: CREATOR_PROJECTION`)도
    바로 그 "응답 경계 투영" 패턴이다. `1-data-model.md §2.1` 의 민감 컬럼 목록(7개)과
    신규 `USER_SECRET_KEYS` 배열도 정확히 일치— drift 없음.
  - 제안: (문제 없음. 아래 두 번째 발견사항이 이 정합을 spec 문서에 반영하라는 후속.)

- **[WARNING] §5.4 「검증 층」·`swagger.md §5-1` 의 "두 검증자" 서술이 신규 검출 2축을
  반영하지 않은 채 그대로다 (4차 연속 재확인 — 알려진 gap, 방치 아님)**
  - target 위치: (target 자체 무변경) — 대상은
    `spec/5-system/2-api-convention.md#검증-층--이-규칙을-무엇이-강제하는가`
    (*"그 자리를 **두 검증자**가 나눠 맡는다"*) 및 `spec/conventions/swagger.md` §5-1
    (*"**두 검증자**의 경계는 … 이 소유한다"*) — 두 문구 모두 현재도 동일.
  - 과거 결정 출처: 직전 커밋 `21182db02`(*"§5.4 검증자를 양쪽 규약에 등재하고 두 검증자의
    경계를 적는다"*)가 확정한 관례 — 새 검증자는 관련 문서 양쪽 frontmatter `code:` 에
    등재하고 개수 서술을 정확히 유지한다.
  - 상세: 이 브랜치가 추가한 `user-entity-exposure-guard.ts`(구조 축)·
    `user-secret-absence.ts`(이름 축)는 두 문서가 "두 검증자로 닫혀 있다"고 서술하는
    바로 그 영역(엔티티 패스스루·응답 비밀 노출 검증)에 제3·제4 검증자를 얹었다. 두
    frontmatter `code:` 어디에도 신규 파일 glob 이 없고, `review_guard._spec_linked_changes()`
    가 신규 4파일 중 0건을 spec-linked 로 판정한다(developer 가 게이트에 직접 물어 확인 —
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목). 즉 이 가드들을
    약화·삭제해도 `--impl-done` SPEC-CONSISTENCY 게이트가 물지 않는다.
  - 제안: (변경 없음, 재확인) developer 는 `spec/` 쓰기 권한이 없으므로 정확히 처신했다
    (spec 미변경 + plan 트래커에 planner 대기 항목으로 명시 등재). project-planner 턴에서
    (a) `2-api-convention.md` §5.4 표에 구조 축/이름 축 행 추가 + 두 문서 `code:` 에
    `user-entity-exposure*.ts`·`user-secret-absence*.ts` 등재, (b) "두 검증자" 문구를
    개수 서술 대신 나열형으로 교체(축이 늘 때마다 숫자가 낡는 실패를 이미 2회 겪음).

- **[WARNING] `User` 민감 7컬럼 응답 노출 금지가 여전히 spec `## Rationale` 문장으로
  승격되지 않았다 (4차 연속 재확인 — 알려진 gap)**
  - target 위치: (해당 없음 — spec 미변경). 관련 문서: `spec/1-data-model.md §2.1 User`,
    `spec/conventions/secret-store.md §1.1`.
  - 과거 결정 출처: `secret-store.md §1.1`(2026-09-05)이 `Trigger`/`AuthConfig` 축에
    대해 이미 세운 원칙(위 첫 항목 참조)과, CLAUDE.md 의 정보 저장 규약(*"결정의 배경·
    근거 → 해당 spec 문서 끝의 `## Rationale`"*).
  - 상세: 위 첫 항목에서 확인했듯 `select:false`/전역 인터셉터 기각 논리는
    `secret-store.md §1.1` 과 완전히 정합(번복 아님)하지만, 그 결정의 근거(전수 열거
    수치 19곳/46곳·기각한 두 대안·채택 이유)는 `plan/in-progress/
    spec-draft-nullable-notation-followups.md`·`CHANGELOG.md`·코드 주석에만 있고
    spec `## Rationale` 에는 없다. `secret-store.md §1.1` 은 `Trigger`/`AuthConfig` 비대상
    필드에 대해서만 "응답 바디에도 나가지 않는다" 규범 문장을 갖고 있고, `User` 7컬럼에는
    대응 규범 문장이 없다 — 이 브랜치가 새로 만든 gap 이 아니라 이미 있던 gap 이며, 이
    브랜치는 그 gap 을 메우는 코드(검출기 2축)만 놓고 spec 승격은 (권한상) 하지 않았다.
  - 제안: (변경 없음, 재확인) project-planner 턴에서 `1-data-model.md §2.1` 또는
    `secret-store.md §1.1` 에 `User` 7컬럼 노출 금지 규범 문장 + `## Rationale` 에 결정
    근거(전수 열거 수치·기각한 두 대안·채택 이유)를 옮기고 `secret-store.md §1.1` 을
    상호 링크한다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미
    정확히 이 내용으로 등재돼 있어 planner 가 그대로 집행하면 된다.

- **[정합 확인 — 위반 아님] §5.4 "부재 표현" 규칙 준수 — `WorkspaceMemberDto.joinedAt`**
  - target 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
  - 과거 결정 출처: `spec/5-system/2-api-convention.md §5.4`(*"기본은 `null`"*, 상시
    존재 필드는 `@ApiProperty({ nullable: true })` + `field: T | null`) 및
    `spec/1-data-model.md` (`joined_at | Timestamp?`).
  - 상세: `WorkspacesService.listMembers` 가 `joinedAt: m.joinedAt` 으로 무조건 실어
    키가 상시 존재하므로 §5.4 기본형(`null`, 키 생략 아님)이 맞는 선택이고 실제로 그렇게
    구현했다. 또한 `swagger.md §3`(2026-09-05 신설 — *"JSDoc 은 공개 OpenAPI 로 나간다,
    내부 서사를 담지 않는다"*)에 맞춰 필드 JSDoc(`/** */`)은 소비자용 한 줄만 남기고
    내부 근거(리뷰 세션 참조 등)는 `//` 로 분리했다 — 이 브랜치가 같은 위반을 두 차례
    저지른 뒤(코드 주석이 스스로 인용하는 `review/consistency/.../11_55_37 W3`) 이번
    diff 상태에서는 올바르게 분리돼 있음을 라인 단위로 확인했다.
  - 제안: 없음 (정합).

## 요약

5차 재확인 결과로도 이 브랜치는 과거 Rationale 에서 명시적으로 기각된 대안을 이유 없이
재도입하거나, 합의된 설계 원칙·시스템 invariant 를 우회하지 않는다. 오히려 핵심 결정
(`User` 에 `select:false`/전역 `ClassSerializerInterceptor` 를 쓰지 않고 구조+이름 2축
검출기로 대체)은 `secret-store.md §1.1` 이 이미 세운 "select:false 기각 → 응답 경계에서
투영" 원칙을 다른 엔티티(`User`)에 동형으로 재적용한 것이고, 실제 유출 수정
(`CREATOR_PROJECTION`)도 자매 메서드가 이미 쓰던 패턴을 재사용했다. §5.4 부재 표현
규칙(`joinedAt`)·swagger.md §3 JSDoc 분리 규칙도 준수한다. 다만 두 건의 알려진 gap —
(1) §5.4·swagger.md §5-1 의 "두 검증자" 개수 서술이 신규 2축을 반영하지 못함, (2) `User`
7컬럼 노출 금지가 아직 spec `## Rationale` 문장으로 승격되지 않음 — 이 4회 연속 재확인
됐다. 둘 다 developer 권한 밖(spec 쓰기)이라 `plan/in-progress/
spec-draft-nullable-notation-followups.md` 에 planner 대기 항목으로 정확히 등재돼 있어
은폐·방치 상태가 아니며, 다음 planner 턴에서 해소 가능하다.

## 위험도
LOW
