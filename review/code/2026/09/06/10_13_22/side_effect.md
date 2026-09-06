# 부작용(Side Effect) 리뷰

## 검증 방법 메모

저장소를 뮤테이션하지 않고 읽기 전용으로 확인했다:
- `codebase/backend/tsconfig.build.json` 을 열어 신규 파일들(`src/repo-guards/**`, `src/shared/testing/**`)이 프로덕션 빌드에서 이미 제외되는 기존 관례에 속하는지 확인.
- `npx jest --config jest.config.ts user-entity-exposure user-secret-absence` — 신규 spec 2벌, 16개 테스트 전부 통과(부작용 없이 실행 확인).
- `npx jest --config jest.config.ts swagger-dto-contract` — 자매 정적 계약 가드(39개)가 `WorkspaceMemberDto` 필드 추가로 깨지지 않음을 확인.
- `git status --short` — 실행 전후 변화 없음(테스트 실행이 트리를 건드리지 않았다).
- `WorkspacesService.listMembers`(diff 밖 기존 코드) 를 직접 열어 `joinedAt` 이 **이미 런타임에 실리고 있음**을 확인 — DTO 추가는 문서 추가일 뿐 동작 변경이 아님.
- `codebase/frontend/src/lib/api/workspaces.ts` 를 확인 — 프런트엔드가 이미 독립적으로 `joinedAt: string | null` 을 소비 중임을 확인, DTO 추가가 기존 소비자와 어긋나지 않음.

## 발견사항

- **[INFO]** `expectNoUserSecrets` 가 `expect` 를 import 하지 않고 Jest 전역 주입에 암묵적으로 의존한다
  - 위치: `codebase/backend/src/shared/testing/user-secret-absence.ts` — `expectNoUserSecrets` 함수 (파일 전체에 `import` 문이 하나도 없다)
  - 상세: 같은 디렉터리의 자매 헬퍼 `response-contract.ts` 의 `assertMatchesContract` 는 정확히 같은 역할(검증 실패 시 던지기)을 하면서도 **Jest 전역에 기대지 않고 `throw new Error(...)` 를 직접 던진다.** 반면 이번에 추가된 `expectNoUserSecrets` 는 `expect(findUserSecretLeaks(body)).toEqual([])` 를 그대로 쓰는데, `expect` 를 어디서도 import 하지 않아 Jest 러너가 전역으로 주입하는 `expect` 에 암묵적으로 의존한다. 현재 `jest.config.ts` 에 `injectGlobals: false` 설정이 없고 `@types/jest`/`jest` 가 설치돼 있어 **지금은 정상 동작**(직접 실행해 16/16 통과 확인)하지만, 이 모듈은 `src/shared/testing/**` 소속이라 이름상 "테스트 유틸리티" 임에도 자기 자신은 테스트 파일(`*.spec.ts`)이 아니라서 이 관례가 다른 소비자에게 드러나지 않는다. 향후 `injectGlobals: false` 로 바뀌거나, 이 헬퍼가 실수로 비-Jest 컨텍스트에서 import 되면 `ReferenceError: expect is not defined` 로 조용히 깨진다 — 그것도 이 파일을 고친 사람이 아니라 **호출부**에서 터진다.
  - 제안: 자매 헬퍼와 동일하게 `findUserSecretLeaks(body).length > 0` 이면 `throw new Error(...)` 하는 형태로 바꾸거나, 최소한 `import { expect } from '@jest/globals';` 를 명시해 암묵적 전역 의존을 드러낸다.

- **[INFO]** `WorkspaceMemberDto` 에 `joinedAt` 필드 추가 — 공개 API(OpenAPI 문서) 변경이지만 런타임 동작 변경은 아님
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (`WorkspaceMemberDto`)
  - 상세: `GET /api/workspaces/:id/members` 의 OpenAPI 계약에 새 필드가 추가된다. 다만 `WorkspacesService.listMembers`(이 diff 밖의 기존 코드, `src/modules/workspaces/workspaces.service.ts`)는 이미 항상 `joinedAt: m.joinedAt` 을 실어 왔고, 프런트엔드도 이미 독립적으로 `joinedAt: string | null` 을 소비하고 있었다(`codebase/frontend/src/lib/api/workspaces.ts`). 즉 **wire 형태는 바뀌지 않았고 문서가 실제를 뒤늦게 따라잡은 것**이다 — 추가적(additive)이라 OpenAPI 클라이언트 생성기 관점에서도 하위호환 파괴는 없다. 부작용 관점에서 위험은 낮지만, "인터페이스 변경" 점검 항목에 해당하므로 기록해 둔다.
  - 제안: 조치 불요 — 기록용.

- **[INFO]** 신규 정적 가드 2파일(`user-entity-exposure-guard.ts`, fixture)은 기존 예외 목록과 같은 이유로 프로덕션 빌드에서 제외돼 있어야 하는데, 실측으로 이미 그렇게 돼 있음을 확인
  - 위치: `codebase/backend/tsconfig.build.json` (`exclude` 배열의 `src/repo-guards/**` 항목)
  - 상세: `src/repo-guards/__tests__/user-entity-exposure-guard.ts` 는 `typescript` 컴파일러를 `import` 하는데(devDependency), 이 디렉터리가 이미 `tsconfig.build.json` 에서 제외돼 있어 dist 로 새어 나가지 않는다. 새 파일이 기존 제외 패턴의 하위 경로에 들어갔을 뿐이라 별도 조치가 필요 없다 — 다만 이 확인 자체가 "파일시스템/빌드 부작용" 점검 항목에 해당해 근거로 남긴다.
  - 제안: 조치 불요.

## 요약

`User` 엔티티 컬럼 방어 PR 은 순수-함수 정적 가드(AST 스캔) + 순수 재귀 워커(응답 본문 훑기) + e2e 단언 추가로 구성돼 있고, 상태를 변경하는 코드가 없다 — 파일시스템은 읽기 전용(`fs.readFileSync`), 전역 변수는 불변 상수(`USER_SECRET_KEYS`, `EXPECTED_USER_RELATION_LOADS`, `FORBIDDEN`)뿐이며 함수 간 공유되는 가변 상태가 없다(각 호출마다 `out`/`seen` 을 새로 만든다). 유일한 프로덕션 코드 변경인 `WorkspaceMemberDto.joinedAt` 추가는 실측 결과 이미 런타임에 나가고 있던 값을 문서화한 것뿐이라 wire 동작을 바꾸지 않는다. 신규 가드/유틸 파일은 기존 `tsconfig.build.json` 제외 패턴을 그대로 따라 프로덕션 dist 오염 위험이 없다. 유일하게 짚을 점은 `expectNoUserSecrets` 가 `expect` 를 import 하지 않고 Jest 전역 주입에 암묵적으로 의존한다는 것으로, 같은 디렉터리의 자매 헬퍼(`assertMatchesContract`)가 명시적으로 피해 온 패턴과 다르다 — 지금은 실행 확인상 문제없이 동작하지만 향후 테스트 러너 설정이 바뀌면 조용히 깨질 수 있는 잠재적 결합이다. 이 PR 은 스스로를 "방어가 아니라 검출"이라고 명시하므로 런타임 경로에 새 부작용을 만들지 않는다는 설계 목표와 실제 코드가 일치한다.

## 위험도
NONE
