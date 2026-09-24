# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** e2e 테스트가 raw SQL 로 애플리케이션 불변식(워크스페이스당 owner 1명)을 깨뜨린 채 커밋하고, 그 잔여 상태가 파일 순서에 의존해 격리된다
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:206`~`286` (`it('제거 중 대상이 owner 로 승격되면 지우지 않고 403 이다', ...)`), 특히 `UPDATE workspace_member SET role = 'owner' WHERE id = $1` 실행부(라인 254 부근)와 `COMMIT`(라인 257 부근)
  - 상세: 이 테스트는 `transferOwnership()` 을 우회해 raw `UPDATE`로 대상 멤버를 `owner`로 승격시킨 뒤 `COMMIT`한다. 그 결과 해당 워크스페이스는 **owner 가 둘**인, 서비스 계층 코드로는 절대 도달할 수 없는 상태로 DB에 영구히 남는다(`finally`의 `ROLLBACK`은 정상 경로에서 이미 `COMMIT`된 뒤라 no-op). 작성자도 이를 인지해 "아래 블록은 파일의 마지막이어야 한다"는 주석을 남겼지만, 그 불변식은 **주석으로만 강제**되고 테스트 러너나 린트로 강제되지 않는다. 현재는 실제로 파일의 마지막 `it()`이라 안전하지만(확인함: 287줄 파일의 마지막 블록), 향후 이 describe 뒤에 새 테스트가 추가되면 그 테스트는 이미 owner 가 2명인 오염된 workspace 를 물려받아 원인 불명의 flaky 실패를 낼 수 있다.
  - 제안: 가능하면 이 테스트를 별도 `describe`/전용 workspace(자체 `beforeAll`로 새 workspace 생성)로 분리해 순서 의존을 코드로 없애거나, 최소한 파일 상단에 "이 describe 뒤에 새 `it`을 추가하지 말 것"이라는 가드 주석을 명시적으로 강조(예: eslint 커스텀 규칙까지는 아니어도 CI 문서화)하는 것을 고려.

- **[INFO]** `removeMember` 에 새 무락 DB 왕복이 추가됨(의도된 변경, 기능적 문제 아님)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()` 내 `if (affected === 0) { const still = await this.memberRepository.findOne(...) ... }` 블록
  - 상세: 종전에는 `affected === 0`이면 바로 `MEMBER_NOT_FOUND`를 던졌지만, 이제 그 분기에서 대상 행을 한 번 더 읽어 owner 승격 여부를 가른다. 이는 TOCTOU 수정의 의도된 부분이며 주석으로 잘 설명되어 있다. 다만 "부작용" 관점에서는 이 경로(동시 삭제·동시 owner 이양이 겹치는 드문 race)에서 요청 처리 시간에 추가 DB round-trip 이 생긴다는 점, 그리고 이 재조회가 잠그지 않는다는 점(문서화된 대로 의도적)을 기록해 둔다. 실질적 위험은 낮음.
  - 제안: 없음(설계상 의도된 트레이드오프로 판단됨).

- **[INFO]** 테스트 헬퍼 `wireFindOne` 시그니처 확장은 비공개·지역 스코프라 호출자 영향 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 의 `wireFindOne` 함수 정의부(신규 3번째 파라미터 `targetOnReread?`)
  - 상세: 이 헬퍼는 스펙 파일 내부에서만 선언·호출되는 지역 함수이고 새 파라미터가 optional 이라 기존 호출부(`targetOnReread` 미전달)는 이전과 동일하게 동작한다(첫 호출은 항상 `target`, `targetOnReread === undefined`면 재호출도 `target`). export 되지 않으므로 외부 인터페이스 변경에 해당하지 않는다.
  - 제안: 없음.

- **[INFO]** `throwCannotRemoveOwner()` 추출은 동작 보존 리팩터, 공개 인터페이스 영향 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:355` 부근 `private throwCannotRemoveOwner(): never`
  - 상세: 기존 인라인 `ForbiddenException({ code: 'CANNOT_REMOVE_OWNER', ... })` 두 자리를 private 헬퍼로 통합했다. `private`이라 클래스 외부 호출자에 영향 없고, 던지는 예외의 `code`/`message`/HTTP 상태(403)도 동일해 컨트롤러(`workspaces.controller.ts` `removeMember`)를 거치는 API 응답 계약도 변하지 않는다.
  - 제안: 없음.

- **[INFO]** DELETE 문에 `role: Not('owner')` 술어 추가는 이 호출 지점에 한정됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()` 내 `this.memberRepository.delete({ id: memberId, workspaceId, role: Not('owner') })`
  - 상세: `memberRepository.delete`는 다른 메서드(`leaveWorkspace`의 `memRepo.remove`, `transferOwnership` 등)와는 별개의 호출 지점이라 이 술어 추가가 공유 리포지토리의 다른 사용처에 영향을 주지 않는다. `import { Not } from 'typeorm'` 추가도 신규 전역 상태나 모듈 부작용 없음.
  - 제안: 없음.

## 요약

핵심 변경은 `removeMember()`의 owner 보호 가드를 DELETE 문 자체의 `role: Not('owner')` 술어로 원자화하고, 0-행일 때만 무락 재조회로 사유(삭제됨 vs owner 승격)를 가르는 것으로, 공개 시그니처·전역 상태·환경 변수·네트워크 호출·이벤트 발화 어느 것도 건드리지 않는 국소적이고 잘 격리된 변경이다. 실제 코드(`workspaces.service.ts`)의 부작용 리스크는 낮다. 유일하게 주목할 부작용은 신규 e2e 테스트가 `transferOwnership`을 우회한 raw SQL로 워크스페이스를 "owner 2명"이라는, 애플리케이션 코드로는 도달 불가능한 상태로 만들고 그 상태를 커밋한 채 남긴다는 점이다 — 현재는 파일의 마지막 테스트라 안전하지만, 그 안전성이 코드가 아닌 주석 하나에 의존하고 있어 향후 유지보수 시 조용히 깨질 수 있는 구조적 취약점이다.

## 위험도

LOW
