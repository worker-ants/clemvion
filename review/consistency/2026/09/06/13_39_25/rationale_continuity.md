# Rationale 연속성 검토 — `user-entity-column-defense` (spec/5-system, impl-done)

## 검토 방법

`spec/5-system/` 자체의 델타는 0(정상 — 이번 브랜치는 spec 을 바꾸지 않는 코드 전용 PR).
따라서 이번 검토는 (1) `git diff origin/main...HEAD -- codebase/`(15파일/1977줄,
프롬프트 예산 절단분을 워크트리에서 직접 재현) 가 `spec/5-system/1-auth.md`·
`2-api-convention.md`, 그리고 인접 SoT(`spec/1-data-model.md`, `spec/conventions/secret-store.md`,
`spec/conventions/swagger.md`)의 기존 `## Rationale`/원칙 서술과 충돌하는지, (2) 이 PR 이 같은
계열에서 스스로 벌린 아키텍처 서술 갭을 spec 에 반영했는지를 실측했다. 코드는 워킹트리
절대경로로 직접 열었고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
후속 체크리스트와 대조했다.

## 발견사항

- **[WARNING]** `2-api-convention.md §5.4`·`swagger.md §5-1` 의 "두 검증자" 서술이 이번 PR 의
  신규 가드로 인해 사실이 아니게 됐는데, spec 은 아직 갱신되지 않았다
  - target 위치: `spec/5-system/2-api-convention.md` `#### 검증 층 — 이 규칙을 무엇이
    강제하는가` (*"그 자리를 **두 검증자**가 나눠 맡는다"*), `spec/conventions/swagger.md`
    `### 5-1` 인용 문단 (*"**두 검증자**의 경계는 … 이 소유한다"*)
  - 과거 결정 출처: 두 문서 모두 §5.4/§5-1 에서 "선언↔선언(`swagger-dto-contract-guard.ts`)"과
    "값↔선언(`response-contract.ts`)" **둘**로 검증 축을 못박아 놓았다 — 직접 원문 대조로
    확인(현재도 두 파일만 표에 등재돼 있음).
  - 상세: 이번 diff 가 신설한 `user-entity-exposure-guard.ts`(관계 로드 **구조** 축)와
    `user-secret-absence.ts`(응답 값 **이름** 축)는 §5.4/§5-1 이 다루는 것과 같은 문제 —
    "엔티티를 그대로 노출하지 않는가" — 를 검증하는 **세 번째·네 번째 검증자**다. 그런데
    두 문서의 `code:` frontmatter 에는 여전히 `swagger-dto-contract-guard*.ts`·
    `response-contract*.ts`·`swagger-probe*.ts` 만 있고, 신규 두 파일은 어느 spec 의
    `code:` glob 에도 걸리지 않는다(워크트리에서 직접 확인). 이는 문서 표현의 낡음에
    그치지 않는다 — `spec-impl-evidence.md §4` 가드(`spec-code-paths.test.ts` 류)가
    `code:` 매치로 "이 spec 이 이 코드에 걸려 있다"를 판정하므로, **이 두 신규 가드는
    지금 어느 spec 재검토 트리거에도 안 걸린다**. 즉 나중에 누군가 이 가드를 약화·삭제해도
    `--impl-done` SPEC-CONSISTENCY 게이트가 잡지 못한다 — §5.4 서술이 스스로 세운
    "두 검증자로 나눠 맡는다"는 원칙(모든 축이 spec 에 등재돼야 재검토가 걸린다는 전제)을
    이번 확장이 우회한 것과 같은 결과다. 이 정확한 문제는 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(`- [ ] 신규 검출 3축을
    §5.4 「검증 층」과 code: 에 등재`, `review/consistency/2026/09/06/10_13_23` W1 —
    5개 checker 중 4개 독립 보고)로 등재돼 있어 **인지되지 않은 결함은 아니다.** 다만 이번
    라운드(13:39)까지도 spec 은 그대로이고 체크박스는 미완료 상태다.
  - 제안: 이번 PR 을 spec 반영 없이 그대로 머지한다면, 위 plan 체크리스트 항목을 다음
    planner 턴에서 반드시 소화하도록 명시적으로 승계할 것. 최소한 (a) `2-api-convention.md
    §5.4` 표에 구조·이름 두 행 추가, (b) 두 문서 `code:` 에
    `user-entity-exposure-guard*.ts`/`user-secret-absence*.ts` 등재, (c) "두 검증자" 같은
    개수 고정 표현을 표 나열형으로 교체(plan 이 이미 지적한 대로 — 축이 늘 때마다 숫자가
    또 낡는다).

- **[WARNING]** `User` 민감 7컬럼 응답 노출 금지 결정의 근거가 spec `## Rationale` 이
  아니라 코드 주석/plan 에만 있다
  - target 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts`
    헤더 JSDoc(`## 왜 select: false 가 아닌가`), `codebase/backend/src/shared/testing/user-secret-absence.ts`
    (`USER_SECRET_KEYS` 배열 자체가 유일한 실행 가능 SoT)
  - 과거 결정 출처: `spec/conventions/secret-store.md §1.1`("비대상 필드도 응답 바디에는
    나가지 않는다")이 **같은 형태의 결정**(컬럼 단위 `select: false` 는 그 컬럼을 읽는
    내부 경로가 예외 없이 `undefined` 를 받아 "조용히 오작동"하므로 채택하지 않는다)을
    Trigger/AuthConfig 계열 비밀 필드에 대해 이미 spec 문장으로 박아 두었다.
  - 상세: 이번 diff 의 `user-entity-exposure.spec.ts` 는 정확히 같은 논리(19곳 공유 깔때기 →
    `comparePassword(x, undefined)` fail-silent)를 **User 엔티티**에 대해 독자적으로
    재도출하면서도, 그 결론을 `secret-store.md §1.1` 로 역참조하지 않고 `1-data-model.md
    §2.1`(User)에도 대응 절을 남기지 않는다 — 즉 같은 논리가 두 곳(비밀-저장소 필드 / User
    엔티티 필드)에 **따로** 존재하게 됐고, 한쪽만 있는 spec 독자는 이 결정이 이미 저장소
    안에 선례가 있다는 것을 알 수 없다. 이 자체는 "기각된 대안의 재도입"이 아니라(오히려
    일관된 결론에 도달했다) **결정의 배경·근거가 spec 문서 Rationale 에 있어야 한다는
    프로젝트 규약**(CLAUDE.md "정보 저장 위치") 미준수에 가깝다. 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(`- [ ] User 민감 7컬럼의
    응답 노출 금지를 규약 문장으로`, `10_13_23` W2)로 등재돼 향후 처리가 예정돼 있다.
  - 제안: 후속 planner 턴에서 `1-data-model.md §2.1` 또는 `secret-store.md §1.1` 에 7컬럼
    노출 금지 규범 + `## Rationale` 에 "왜 select:false 를 안 쓰는가"(전수 열거 수치·기각한
    대안·secret-store.md 선례와의 관계)를 옮겨 적을 것. 지금 코드 주석은 훌륭하지만 코드는
    spec 이 아니다.

## 정합성 확인 (위반 없음으로 판정한 항목)

- **기각된 대안의 재도입 없음**: `select: false`·전역 `ClassSerializerInterceptor`·`@Exclude()`
  세 대안 모두 이번 diff 안에서 실측(19곳 공유 깔때기·46개 호출부·직렬화 0건 사용)과 함께
  기각됐고, 이 기각 논리는 `secret-store.md §1.1` 이 이미 세운 "컬럼 단위 스트립은 내부
  소비 경로를 조용히 깬다"는 원칙과 **같은 방향**이라 원칙 위반이 아니라 오히려 확장이다.
- **§5.4 부재 표현 규칙 준수**: `WorkspaceMemberDto.joinedAt` 신규 필드는 §5.4 의 기본형
  (`null`, 상시 존재)을 따르고, 실측 근거(`workspace_member` 행 생성 4자리 전수 확인)를
  주석에 남겼다 — 규칙이 요구하는 "필드별 근거 명시"를 충족한다. `@ApiProperty({ nullable:
  true })` + `T | null` 조합도 §5.4 DTO 선언 형태 규칙과 일치.
  - 다만 그 근거를 JSDoc(`/** */`)이 아니라 `//` 로 옮긴 것은 `review-citations.md §3`(DTO
    JSDoc 은 리뷰 인용 대상이 아니다)을 그대로 따른 것이고, 이 규약 자체가 최근(2026-09-06)
    실제 시행 가드(`dto-jsdoc-citation-guard.ts`)를 얻으면서 취소선+정정 블록으로 자기
    Rationale 을 갱신했다 — 정정 대상 문장을 developer 가 직접 쓴 것으로 `git blame` 상
    확인 가능한 계열(선행 라운드에서 이미 검증됨)이라 CLAUDE.md 자기-반증형 소정정 절차
    위반도 없다.
  - `workspace-rbac.e2e-spec.ts` 의 문서 pointer 정정("§1.3" → "§3(인가)")도 §1.3(셀프
    호스팅 LDAP/SAML, 미구현)이 RBAC 과 무관함을 원문 대조로 확인했다 — 스테일 인용을
    바로잡은 것이지 새 결정이 아니다.
- **암묵적 invariant 우회 없음(엔티티 노출 축 자체는)**: `WorkflowVersionsService.findOne`
  이 `creator` 를 `CREATOR_PROJECTION`(id/name/email)으로 투영하도록 고친 것은 `swagger.md
  §5-1`("엔티티를 그대로 노출하지 말 것")을 위반에서 준수로 되돌린 수정이며, 반환 타입도
  `ProjectedCreator`(`Pick<User, 'id'|'name'|'email'>`)로 좁혀 타입-런타임 간극까지 없앴다 —
  Rationale 이 요구하는 "선언과 실제가 같아야 한다"는 §5.4 대원칙에 부합한다.
- **결정 번복에 새 근거 동반**: `spec/conventions/review-citations.md`/`spec-impl-evidence.md`
  의 "이 규약에는 시행 코드가 없다" 정정은 취소선 보존 + 날짜 + 축 단위 표(DTO 는 강제,
  컨트롤러는 미강제)로 이뤄졌고, 선행 라운드(`13:06:22`)가 지적한 "DTO·컨트롤러 뭉뚱그림"
  CRITICAL 이 현재 원문에서는 이미 축 단위로 분리돼 있음을 직접 대조로 확인했다 — 재발
  아님.

## 요약

이번 PR 은 `User` 엔티티 컬럼 노출이라는 실제 보안 결함(감사 로그 26키·워크플로 버전
`creator` 전 컬럼)을 구조 축·이름 축 두 가드로 닫았고, 그 설계(특히 `select: false` 기각)는
`secret-store.md §1.1` 이 이미 세운 원칙과 **같은 방향으로 일관**되며 §5.4 부재 표현·swagger
§5-1 엔티티 패스스루 금지 원칙도 위반하지 않는다 — 기각된 대안을 근거 없이 되살리거나
합의된 invariant 를 정면으로 우회하는 지점은 찾지 못했다. 다만 이 확장이 스스로 만든 두
문서 갭(①`2-api-convention.md §5.4`/`swagger.md §5-1` 의 "두 검증자" 서술이 신규 두 가드로
인해 사실과 어긋남 — spec-linked 게이트가 그 가드들의 약화를 못 잡는 실질적 커버리지 구멍,
②`User` 노출 금지 결정의 근거가 spec `## Rationale` 대신 코드 주석/plan 에만 존재)은 아직
spec 에 반영되지 않았다. 두 갭 모두 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 구체적 체크리스트로 등재돼 있어 "발견되지 않은 결함"은 아니지만, 이번 라운드까지
미해소 상태이므로 WARNING 으로 유지한다.

## 위험도

MEDIUM
