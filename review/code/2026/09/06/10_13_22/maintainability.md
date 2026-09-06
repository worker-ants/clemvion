# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 새 e2e 케이스가 기존 테스트와 시나리오 라벨(`F.`)이 중복되고, 알파벳 순서도 어긋난다
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:287` (신규 `it('F. GET /:id/members …')`) vs `codebase/backend/test/workspace-rbac.e2e-spec.ts:382` (기존 `it('F. sole owner …')`)
  - 상세: 이 파일의 `it()` 제목은 `A.`~`I.` 시나리오 ID로 서로를 가리키는 관례를 쓴다(주석 "테스트 A 는 …" 등 상호 참조가 실제로 존재). 이번 diff 가 `E.`(transfer-ownership) **앞**에 새 케이스를 `F.` 로 끼워 넣어, 파일 안에 `F.` 가 두 개(신규 멤버-노출 테스트/기존 sole-owner 테스트) 존재하고 순서도 `D → F(신규) → E → F(기존) → G` 로 뒤섞였다. 이후 리뷰·문서·커밋 메시지에서 "테스트 F" 를 인용하면 어느 쪽인지 모호해지고, 알파벳 순서로 시나리오를 찾던 관례가 이 지점부터 깨진다.
  - 제안: 새 케이스 라벨을 다음 미사용 문자(`J.`)로 바꾸거나, `E.` 뒤(`F.` 기존 케이스 앞)에 삽입하며 그 뒤 라벨을 한 칸씩 미는 방식으로 유일성을 회복한다.

- **[INFO]** `UserRelationLoad.line` 이 계산만 되고 소비되지 않는다 — 형제 가드와의 관례 불일치
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:28`(필드 선언, 주석 "보고용")·`:108`(`line: sf.getLineAndCharacterOfPosition(...).line + 1`); 소비 지점 없음 — `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts` 전체에서 `.line` 참조 0건.
  - 상세: 같은 디렉터리의 형제 가드(`audit-action-binding-guard.ts`/`audit-action-binding.spec.ts`, `engine-error-code-anchor-guard.ts`/`engine-error-code-anchor.spec.ts`)는 동일한 패턴으로 `line` 을 계산해 실패 메시지 조립(`` `${s.file}:${s.line} ${s.method} — ...` ``)이나 `expect(x.line).toBeGreaterThan(0)` 단언에 실제로 사용한다. 이 파일만 "보고용" 이라는 의도를 주석에 남기고 실제로는 쓰지 않아, 베이스라인 불일치가 나면 사람이 보는 실패 메시지가 `file#method` 키 차집합뿐이고 어느 줄인지는 소스를 직접 열어야 알 수 있다. 기능 결함은 아니지만 형제 파일들과 나란히 두고 보면 관례에서 벗어난 미완성 조각으로 읽힌다.
  - 제안: 실패 시 사람이 읽는 assertion 메시지(예: `toEqual` 실패 시 diff 로는 부족한 경우 커스텀 매처나 `console` 힌트)에 `line` 을 노출하거나, 정말 쓰지 않을 것이면 필드 자체를 제거해 "계산은 하지만 아무도 안 본다" 는 상태를 없앤다.

## 요약

이번 변경은 `User` 엔티티 컬럼 노출을 잡는 검출용 가드 2종(구조 기반 `user-entity-exposure-guard`/`.spec`, 값 기반 `user-secret-absence`)과 그 소비 지점(e2e 2건, `WorkspaceMemberDto.joinedAt` 추가)으로 구성되며, 전반적으로 가독성이 높다 — 각 파일 상단 JSDoc이 "왜 이 방식인가"·"왜 다른 대안이 아닌가"를 실측 수치와 함께 명시하고, 네이밍(`findUserRelationLoads`/`findUserSecretLeaks`/`expectNoUserSecrets`)이 역할을 정확히 드러내며, 기존 형제 가드(`swagger-dto-contract-guard.ts`, `nullable-type-lie-cast-guard.ts`, `audit-action-binding-guard.ts`)와 "순수 스캔 로직 / 소비 spec 분리" 관례를 그대로 따른다. 함수 길이·중첩 깊이·매직 넘버 모두 AST 순회 코드로서 통상적인 수준이며 새로운 복잡도 증가는 없다. 실질적으로 지적할 것은 새 e2e 케이스가 만든 시나리오 라벨(`F.`) 중복·순서 역전 하나뿐이고, `line` 필드 미사용은 사소한 관례 이탈이다. 두 건 다 국소적이고 수정 비용이 낮다.

## 위험도

LOW
