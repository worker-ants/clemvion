# 정식 규약 준수 검토 — convention_compliance

검토 대상: `spec/5-system/` (impl-done, diff-base `origin/main`). 이 스코프의 spec 파일 델타는
0개이며, 실제 변경은 `codebase/backend/` 의 신규 가드·테스트 15개 파일(1713줄)이다 — `User`
엔티티 전 컬럼이 `GET /api/workflows/:wfId/versions/:versionId`·`GET
/api/workspaces/:id/members`·`GET /api/audit-logs` 등에서 유출되던 결함을 막는 방어선을
새로 깐 PR 이다. spec 델타가 0인 것 자체는 문제가 아니다(코드 전용 PR). 아래는 그 신규
코드가 **spec/conventions/** 및 그 자매 문서인 `spec/5-system/2-api-convention.md §5.4` 가
확립한 "검증자 등재" 관행과 정합적인가를 검토한 결과다.

## 발견사항

- **[CRITICAL]** 신규 시행 코드 `dto-jsdoc-citation-guard.ts`가 `review-citations.md`의 `code:`에 미등재 — Rationale 문장을 직접 반증
  - target 위치: 구현 diff `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` · `dto-jsdoc-citation.spec.ts` (신규, `git diff origin/main...HEAD` 확인)
  - 위반 규약: `spec/conventions/review-citations.md`의 Rationale "`code:` 가 '구현 경로' 가 아니라 '준수 예시' 를 가리키는 이유" 및 `spec/conventions/spec-impl-evidence.md §2.1` `code` 필드 정의("예외 — 시행 코드가 없는 순수 문서형 convention... 선례: `review-citations.md`")
  - 상세: `review-citations.md`의 Rationale은 명시적으로 "이 규약에는 **시행하는 코드가 없다** — 주석 형태를 강제하는 가드가 없기 때문이다"라고 쓰고, 그래서 `code:`에 "이 규약이 처방하는 형태를 실제로 쓰는 예시 파일"(`roles.guard.spec.ts`, `sanitize-loader-error.ts`)만 적어 두었다고 설명한다. `spec-impl-evidence.md §2.1`도 이 문서를 "시행하는 가드가 없는" 선례로 이름까지 박아 인용한다.
    이번 PR이 추가한 `dto-jsdoc-citation-guard.ts`/`dto-jsdoc-citation.spec.ts`는 정확히 이 규약(§3 "DTO·컨트롤러의 JSDoc은 대상 아님 — 리뷰 인용은 바로 위 `//` 주석에 적는다")과 `swagger.md §3`("JSDoc은 공개 OpenAPI로 나간다 — 내부 서사를 담지 않는다")를 **시행하는 ratchet 테스트**다(`dto/responses/**`의 클래스·필드 JSDoc에서 리뷰 인용 3형태를 찾아 알려진 베이스라인 2건과 정확히 일치할 것을 단언하고, 새 위반이 생기면 실패한다). 이 테스트 파일 자신의 JSDoc이 "같은 위반이 세 번 났다... 자동 회귀 가드가 없다(`review/code/2026/09/06/12_28_02` W2)"고 적어, 스스로 "이 규약에는 시행 코드가 없다"는 이전 문장을 반증하는 근거를 담고 있다.
    즉 병합 시점에 `review-citations.md`의 Rationale은 **거짓 문장**이 되며, `code:`가 "예시 파일" 목록으로 남아 실제 enforcement 경로를 가리키지 않는다. `spec/5-system/2-api-convention.md §5.4 "검증 층"`이 바로 이 저장소의 확립된 관행을 서술한다 — "두 축이 서로 다른 규칙을 시행한다... 그 검증자는 **양쪽 문서의 `code:`에 모두 등재**돼 있다 — 한쪽만 등재하면 다른 축의 변경이 재검토 트리거를 못 건드린다." 직전 커밋(`21182db02`, "§5.4 검증자를 양쪽 규약에 등재하고 두 검증자의 경계를 적는다")이 바로 이 원칙을 다른 검증자 쌍(`swagger-dto-contract-guard`/`response-contract`)에 적용해 등재했다. 이번 PR은 같은 저장소에서 같은 유형의 신규 검증자를 추가하면서 그 직전에 스스로 세운 관행을 따르지 않았다.
    부수 효과: `dto-jsdoc-citation-guard.ts`의 경로(`repo-guards/__tests__/dto-jsdoc-citation*.ts`)는 `swagger.md`의 `code:` 글롭(`swagger-dto-contract*.ts`, `response-contract*.ts`, `swagger-probe*.ts`)에도 걸리지 않는다 — 어느 conventions 문서에도 이 파일이 등재돼 있지 않다(`grep -rn "dto-jsdoc-citation" spec/` 0건 확인).
  - 제안: `spec/conventions/review-citations.md`의 `code:`에 `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation*.ts`를 추가하고, Rationale의 "이 규약에는 시행하는 코드가 없다" 문장을 취소선 처리 후 정정(신규 ratchet 가드가 §3 위반 신규 발생만 잡고 기존 2건은 동결한다는 점, 그리고 이 규약이 이제 "예시 파일" 방식이 아니라 실제 enforcement 경로를 갖는다는 점을 명시). `swagger.md §3`/`code:`에도 같은 경로를 교차 등재하고 `spec/5-system/2-api-convention.md §5.4`와 같은 형태로 두 문서 간 경계 서술을 추가한다. 이 정정은 spec 변경이므로 CLAUDE.md 규약상 `project-planner` 턴(또는 developer의 자기반증형 소정정 5조건 충족 시 직접 정정)이 필요하다.

- **[WARNING]** 신규 검증자 쌍(`user-entity-exposure-guard.ts` + `user-secret-absence.ts`)이 어느 `spec/conventions/**` 문서에도 등재·교차참조되지 않음
  - target 위치: 구현 diff `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`·`user-entity-exposure.spec.ts`(구조·정적 축), `codebase/backend/src/shared/testing/user-secret-absence.ts`·`.spec.ts`(값·런타임 축) — 전부 신규
  - 위반 규약: `spec/5-system/2-api-convention.md §5.4 "검증 층 — 이 규칙을 무엇이 강제하는가"`가 확립한 "정적/런타임 두 축, 선언/값 두 축을 나눈 검증자 쌍은 관련 conventions 문서에 등재하고 경계를 서술한다"는 패턴 (target 스코프 `spec/5-system/` 내부 문서)
  - 상세: 이번 PR은 정확히 `swagger-dto-contract-guard`(정적·선언 대 선언)/`response-contract`(런타임·값 대 선언) 쌍과 같은 구조의 새 쌍을 만들었다 — `user-entity-exposure-guard.ts`는 TypeORM 쿼리 구성(정적 AST)에서 `User` 관계를 투영 없이 통째로 싣는 자리를 잡고, `user-secret-absence.ts`는 실제 HTTP 응답 바디(런타임)를 훑어 `USER_SECRET_KEYS`(passwordHash·twoFactorSecret·totpRecoveryCodes·webauthnRecoveryCodes·emailVerifyToken·passwordResetToken·emailChangeToken — `spec/1-data-model.md §2.1 User`의 7개 민감 컬럼과 정확히 대응)가 어디에도 없음을 단언한다. `user-secret-absence.ts` 자신의 JSDoc도 "형제 가드 `user-entity-exposure-guard.ts`는 *구조*를 보고 이쪽은 *값이 나간 결과*를 본다"고 명시해 이 두 축 관계를 스스로 인지하고 있다.
    그런데 이 쌍은 `spec/conventions/**` 어디에도 등재돼 있지 않다(`egress-masking.md`는 "값-패턴·키-이름으로 치환"하는 마스킹 메커니즘만 다루며 `AuthConfig.config`는 물론 이 User 비밀 컬럼도 대상이 아니라고 명시), `secret-store.md`는 외부 provider 자격증명(`secret://` URI scheme)만 다뤄 User 엔티티 컬럼과 도메인이 다르다, `spec/1-data-model.md`는 frontmatter 의무 대상에서 제외돼(`spec-impl-evidence.md` EXCLUDE_BASENAMES) `code:` 등재가 애초에 불가능하다. `spec/5-system/1-auth.md`(target 문서 자체) 역시 §1.1/§1.4.1에서 이 7개 컬럼의 저장 형태(SHA-256 해시 등)는 상세히 서술하면서, "이 컬럼들이 응답에 새면 이 가드가 잡는다"는 방어 계층에 대한 언급이 전혀 없다.
  - 제안: (a) `spec/5-system/1-auth.md`(또는 `spec/1-data-model.md §2.1`)에 `swagger.md §5-1`의 "무엇이 이 규칙을 강제하나" 콜아웃과 같은 형태로 이 두 검증자를 짧게 교차참조하거나, (b) `secret-store.md`/`egress-masking.md`와 병렬로 새 convention 문서(예: `user-entity-column-defense.md`)를 신설해 `code:`에 두 파일을 등재하고 §5.4와 같은 "정적/런타임 경계" 표를 둔다. 어느 쪽이든 spec 변경이므로 `project-planner` 턴이 필요하다(단 developer가 이 세션에서 직접 작성한 JSDoc 문구를 spec에 옮기는 수준이라면 자기반증형 소정정 5조건 검토 여지가 있다 — 다만 이는 "제품 정의·API 계약"이 아니라 "구현 경로 등재"이므로 조건 2(예고·트리거 한정)에 부합하는지 확인 필요).

- **[INFO]** 신규 fixture 파일이 저장소의 기존 `repo-guards/__tests__/` fixture 배치 관행과 다른 디렉터리 구조를 씀
  - target 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/user-eager-relation.fixture.ts`, `fixtures/user-relation-load.fixture.ts`, `fixtures/dto/responses/jsdoc-citation.fixture.ts` (신규)
  - 위반 규약: 명문화된 spec/conventions 규칙은 없음(관례 수준) — `spec/conventions/*.md`를 grep해도 "fixture 배치 위치"를 다루는 문서가 없다
  - 상세: 기존 형제 가드들(`audit-action-binding-fixture.ts`, `engine-error-code-anchor-fixture.ts`, `eslint-unicorn-peer-fixture.ts`)은 전부 `__tests__/` 바로 아래 `<name>-fixture.ts` flat 파일명을 쓴다. 이번 PR은 `fixtures/` 서브디렉터리 + `.fixture.ts` 접미(`user-eager-relation.fixture.ts` 등)라는 다른 명명·배치를 도입했다. 성문화된 규약 위반은 아니므로 INFO다.
  - 제안: 이후 어느 한쪽으로 수렴시키려면 그때 `spec/conventions/` 어딘가(또는 신규 문서)에 관례를 성문화하는 편이 다음 재발견을 막는다. 지금 당장 고칠 의무는 없다.

## 요약

이번 PR의 코드 자체는 `spec/5-system/1-auth.md`·`spec/1-data-model.md`·`spec/conventions/swagger.md §5-1/§3`이 요구하는 "엔티티를 그대로 노출하지 말 것", "JSDoc과 내부 서사(리뷰 인용)를 분리할 것", "§5.4 null vs 키 생략" 규칙을 정확히 준수하며 실제 유출 결함(3곳)을 잘 방어한다. 다만 이 저장소가 바로 직전 커밋에서 "새 검증자는 관련 conventions 문서 양쪽에 `code:` 등재 + 경계 서술"이라는 관행을 §5.4에 명문화하고 실천했음에도, 이번 PR이 추가한 두 검증자 쌍(`dto-jsdoc-citation-*` 및 `user-entity-exposure-guard`/`user-secret-absence`)은 그 관행을 따르지 않았다 — 특히 `dto-jsdoc-citation-*`는 `review-citations.md`의 기존 Rationale 문장("시행 코드 없음")을 직접 반증하므로 CRITICAL로 판단했다. 두 건 모두 코드 결함이 아니라 spec/conventions 등재 누락이며, `project-planner` 턴으로 `code:` 프런트매터 갱신과 경계 서술 추가가 필요하다.

## 위험도
HIGH
