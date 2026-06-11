# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 발견사항 없음 — 부작용 관점 이상 없음

이 변경은 세 파일에 걸친 순수 의존성 선언 이동(C-1)·버전 범위 상향(C-2)이며, 아래 각 관점을 점검한 결과 부작용이 없다.

**1. 의도치 않은 상태 변경**
- `jsonwebtoken`을 devDependencies→dependencies로 이동한 것은 선언 위치 변경이며, 실제 설치 버전(9.0.3)은 동일하다.
- `codebase/backend/src/modules/external-interaction/interaction-token.service.ts`의 `sign`, `verify`, `JsonWebTokenError`, `TokenExpiredError` import는 변경 전후 동일한 버전의 동일한 모듈을 참조한다. 런타임 동작 무변화.

**2. 전역 변수**
- package.json·package-lock.json은 빌드 시스템 메타파일이며, 코드 내 전역 변수를 도입하거나 수정하지 않는다.

**3. 파일시스템 부작용**
- `npm install` 재생성으로 node_modules 내 hono가 4.12.19→4.12.25로 갱신된다. 이는 의도된 결과이며 예상치 못한 파일 생성·삭제는 없다.
- `chokidar`, `readdirp`의 `devOptional`→`dev` 플래그 변경은 lock 재생성 과정에서 npm이 자동 재분류한 것으로, 두 패키지 모두 실제로 dev 전용 경로(`@angular-devkit/core` 선택적 피어 의존)에만 속한다. 프로덕션 설치 결과에 영향 없음.

**4. 시그니처 변경**
- 소스 코드 변경 없음. 함수·클래스 시그니처 무변화.

**5. 인터페이스 변경**
- 공개 API 변경 없음.

**6. 환경 변수**
- 환경 변수 읽기/쓰기 변경 없음.

**7. 네트워크 호출**
- hono 버전 갱신(4.12.19→4.12.25)은 패치 릴리즈 범위 내 변경이다. 플랜 문서에 따르면 backend는 MCP client로만 hono를 전이 의존하며, hono 서버를 직접 기동하지 않는다. 외부 네트워크 호출 경로 변동 없음.

**8. 이벤트/콜백**
- 이벤트 발생·콜백 호출 변경 없음.

---

## 요약

이번 변경은 `jsonwebtoken 9.0.3`의 선언 위치를 devDependencies에서 dependencies로 이동하고(`interaction-token.service.ts`가 직접 import하는 패키지를 prod 번들에 명시적으로 포함), `hono` override 하한을 보안 패치된 `^4.12.21`로 올린 순수 의존성 정리다. 소스 코드·공개 API·환경 변수·이벤트/콜백·네트워크 호출 경로 중 어느 것도 변경되지 않았으며, lock 파일의 `devOptional`→`dev` 재분류는 npm 자동 리솔브 결과로 프로덕션 트리에 영향이 없다. 의도치 않은 부작용은 발견되지 않았다.

## 위험도

NONE
