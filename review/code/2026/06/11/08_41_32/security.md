### 발견사항

이번 변경 전체(파일 1~10)를 보안 관점에서 분석했습니다.

**파일 1~3 (DTO doc-string 정정): 보안 관련 변경 없음**

- **[INFO]** `create-knowledge-base.dto.ts`, `rag-search.dto.ts`, `update-knowledge-base.dto.ts`
  - 위치: Swagger `@ApiPropertyOptional.description` 문자열 및 JSDoc 블록
  - 상세: 모든 변경이 API 문서 문자열 수정에 한정된다. 입력 검증 데코레이터(`@IsIn`, `@IsUUID`, `@IsOptional`, `@IsNumber`, `@Min`, `@Max`)는 그대로이고, `rag-search.dto.ts` 에서 `@IsNumber()` 가 `@IsInt()` 로 교체된 것은 보안적으로 더 엄격한(정수만 허용) 방향이다. 인젝션 경로·하드코딩 시크릿·인가 로직 변경 없음.
  - 제안: 없음.

**파일 5 (`byo-ui-headless.ts`): 공개 webhook 인증 흐름 확인**

- **[INFO]** 공개 webhook 인증 없음 + `profile` 페이로드 타입
  - 위치: `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` — `triggerWebhook` 호출부
  - 상세: 기존 `firstMessage` 가 `profile?: Record<string, unknown>` 으로 교체됐다. `profile` 은 비구조적 `unknown` 딕셔너리이므로 악의적 키/값이 그대로 서버로 전달된다. 그러나 이는 예제 코드이며, 실제 서버 측 webhook 핸들러가 `profile` 키를 어떻게 처리하는지(허용 필드 화이트리스트·타입 검증 존재 여부)가 보안의 핵심이다. 예제 자체의 `profile` 은 `?` 옵셔널 이고 서버 사이드 검증을 대체하지 않는다. 이번 변경이 새로운 취약점을 도입하지는 않는다 — 기존 `firstMessage: string` 도 동일하게 서버로 전달됐다.
  - 제안: 서버 측 webhook 핸들러에서 `profile` 필드에 대한 허용 키 화이트리스트·크기 제한·스키마 검증이 적용되어 있는지 별도 확인 권장 (본 diff 범위 밖).

- **[INFO]** 에러 메시지 노출
  - 위치: `byo-ui-headless.ts` L452 — `throw new Error("이 트리거는 interactive 세션을 시작하지 않습니다(토큰 미발급).")`
  - 상세: 에러 메시지가 한국어 자연어 설명이며 내부 스택 트레이스·토큰 값·서버 내부 경로를 포함하지 않는다. 외부 공개 예제 코드이므로 해당 에러가 UI에 그대로 렌더링될 경우 기능적 정보를 노출하나, 민감 데이터 노출(OWASP A05) 수준은 아니다. 이번 변경에서 추가된 내용 아님.
  - 제안: 호출자(BYO-UI 개발자)에게 에러 메시지를 UI에 그대로 노출하지 말고 일반화된 메시지를 사용하도록 안내하는 주석 추가 권장 — 현재 `webchat-eager-start.md` 백로그에도 동일 내용 등재됨.

**파일 4 (`README.md`), 6~10 (plan/review 문서): 보안 관련 없음**

- 문서·계획 추적 파일은 런타임 코드 경로와 무관하며 하드코딩 시크릿·인젝션 경로 없음.

---

### 요약

이번 변경은 DTO Swagger 문서 문자열 정정(V-16)과 웹챗 SDK 예제 코드의 폐기된 `firstMessage` 패턴 교체(V-17)로 구성된다. 전체 변경에서 인젝션 취약점, 하드코딩된 시크릿, 인증·인가 우회, 안전하지 않은 암호화, 민감 정보 에러 노출(OWASP Top 10 범주) 등 실질적인 보안 취약점은 발견되지 않는다. `profile?: Record<string, unknown>` 도입은 서버 사이드 스키마 검증 의존도를 높이나 이는 예제 코드이고 기존 `firstMessage` 대비 새로운 위험면 확대가 없다. `@IsNumber()` → `@IsInt()` 교체는 오히려 입력 검증을 강화한다. 보안 관점에서 이번 PR 머지를 차단할 사유 없음.

### 위험도

NONE
