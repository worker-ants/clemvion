# 보안(Security) 코드 리뷰

## 리뷰 대상
- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` (vitest 테스트, TS AST 기반 가드)
- `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` (값 목록 + 컴파일타임 단언 소스 모듈)

## 컨텍스트
두 파일 모두 런타임 프로덕션 요청 경로에 있지 않다. 테스트 파일은 vitest(dev/CI 전용)로만 실행되고, 레지스트리 파일은 문자열 상수 배열과 TS 타입 레벨 단언(`Exclude<...>`)만 정의하며 외부 입력을 받지 않는다. 따라서 OWASP Top 10 관점의 공격 표면(네트워크 입력, DB 질의, 인증/인가, 세션)이 이 diff 안에 존재하지 않는다.

## 발견사항

- **[INFO]** 테스트 내 파일 경로 조합이 신뢰 가능한 상수로만 구성됨 (정보성, 조치 불요)
  - 위치: `interaction-type-exhaustiveness.test.ts` — `readRepoFile()` (L79-82), `REGISTRY_SITES` (L66-70), `SOURCE_REGISTRY_SITES` (L390-392)
  - 상세: `readFileSync(join(__dirname, "../../../../../", relPath))` 는 경로 순회(path traversal) 패턴처럼 보일 수 있으나, `relPath` 는 사용자 입력이 아니라 파일 내 하드코딩된 리터럴 배열(`REGISTRY_SITES`, `SOURCE_REGISTRY_SITES`)에서만 나온다. 외부에서 제어 가능한 값이 이 함수로 흘러들어오는 경로가 없다. 실행 환경도 CI/로컬 개발자 vitest 프로세스로, 신뢰 경계를 넘는 입력이 아니다.
  - 제안: 없음. 향후 이 함수에 동적/외부 입력을 넘기는 방향으로 확장한다면 그때 경로 검증이 필요하다.

- **[INFO]** `ts.createSourceFile` 로 임의 소스 텍스트를 파싱하지만 신뢰된 저장소 파일/테스트 픽스처만 대상
  - 위치: `parseGuardSource()` (L109-117), `collectCodeStringLiterals` 호출부 전반
  - 상세: TypeScript 컴파일러 파서는 순수 구문 분석기로 코드를 실행(eval)하지 않으므로, 설령 악성 문자열이 들어오더라도 임의 코드 실행으로 이어지지 않는다. 입력 소스는 (a) 레포 내 하드코딩된 경로의 파일 또는 (b) 테스트 내 인라인 문자열 픽스처뿐이다. 외부 신뢰되지 않은 입력을 파싱하는 시나리오가 아니다.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 두 파일 전체
  - 상세: API 키, 토큰, 비밀번호, 인증서 등 민감 정보 패턴이 존재하지 않는다. 문자열 리터럴은 모두 `WaitingInteractionType` / `ConversationTurnSource` enum 값(`"form"`, `"buttons"`, `"ai_conversation"` 등)이다.
  - 제안: 없음.

- **[INFO]** 에러 메시지에 민감 정보 노출 없음
  - 위치: `interaction-type-exhaustiveness.test.ts` L368-376, L407-414 (`throw new Error(...)`)
  - 상세: 실패 시 던지는 에러 메시지는 누락된 레지스트리 사이트/값 이름과 spec 문서 경로만 포함한다. 이는 테스트 실행자(개발자/CI 로그)에게만 노출되는 진단 정보이며, 시스템 내부 경로, 스택 트레이스, 자격 증명 등 민감 정보를 담지 않는다.
  - 제안: 없음.

## 요약
두 파일 모두 프로덕션 런타임 코드가 아니라 (1) enum exhaustiveness 를 강제하는 컴파일타임 타입 단언 소스 모듈과 (2) 이를 검증하는 개발/CI 전용 vitest AST 가드 테스트다. 사용자 입력 처리, 네트워크 I/O, DB 접근, 인증/인가, 암호화, 외부 의존성 신규 도입이 전혀 없으며, 파일 경로·파싱 대상 소스는 모두 레포 내 하드코딩된 상수 또는 인라인 테스트 픽스처로 신뢰 경계를 넘지 않는다. OWASP Top 10 관점에서 이 변경이 도입하는 공격 표면은 없다.

## 위험도
NONE
