# 보안(Security) 코드 리뷰

## 리뷰 대상
- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`
- `codebase/frontend/src/lib/conversation/interaction-type-registry.ts`

## 분석 개요

두 파일 모두 **런타임 사용자 입력을 처리하지 않는** 개발 시점 정적 가드다.

- 파일 1은 vitest 테스트로, TypeScript 컴파일러 API(`ts.createSourceFile`)를 이용해
  리포지토리 내 하드코딩된 소스 파일 목록(`REGISTRY_SITES`, `SOURCE_REGISTRY_SITES`)을
  읽어 특정 문자열 리터럴이 코드에 존재하는지 검사하는 AST 가드다. `readFileSync` 에
  전달되는 경로는 전부 파일 내 상수 배열(`REGISTRY_SITES` 등)에서 오며, 사용자·네트워크
  입력이 개입할 여지가 없다 — 경로 탐색(path traversal) 벡터가 성립하지 않는다.
- 파일 2는 `WaitingInteractionType` / `ConversationTurnSource` 열거값 목록과 컴파일 타임
  `Exclude` 단언만 담은 순수 타입/상수 모듈이다. 네트워크 호출, DOM 조작, 동적 코드 실행,
  직렬화/역직렬화 로직이 없다.

## 발견사항

- **[INFO]** 없음 — 인젝션, 시크릿 하드코딩, 인증/인가, 입력 검증, 암호화, 에러 처리
  민감정보 노출, 의존성 취약점 등 점검 항목에 해당하는 실질적 이슈를 발견하지 못했다.
  - 위치: 전체 파일
  - 상세:
    - 인젝션: `readFileSync`/`join` 경로가 전부 상수이며 외부 입력을 조합하지 않음.
      `ts.createSourceFile` 은 신뢰된(리포지토리 자체) 소스만 파싱하며, 파싱 결과는 문자열
      리터럴 텍스트 비교(Set 멤버십)에만 쓰인다 — `eval`/`Function`/동적 require 등 코드
      실행 경로 없음.
    - 하드코딩된 시크릿: 두 파일의 문자열 리터럴("form", "buttons", "ai_conversation" 등)은
      전부 도메인 enum 값이며 자격증명·키·토큰류가 아님.
    - 인증/인가: 해당 없음(런타임 요청 처리 코드가 아님).
    - 입력 검증: 사용자 입력이 아예 존재하지 않는 정적 분석 유틸리티.
    - 에러 처리: 테스트 실패 시 `throw new Error(...)` 로 누락된 site/value 목록을 출력하나,
      이는 리포지토리 소스 내부 정보(파일 경로·enum 값)로 이미 공개된 코드베이스 구조이며
      테스트 실행 환경(CI/로컬)에서만 노출되어 사용자 대면 에러 채널로 전파되지 않음.
    - 의존성 보안: `typescript` 패키지(공식 컴파일러 API)만 사용하며 알려진 취약 API
      호출 패턴(임의 코드 실행을 유발하는 옵션 등) 없음.
  - 제안: 해당 없음. 프로덕션 런타임 코드 경로에 영향이 없는 dev/test 전용 가드이므로
    추가 조치 불요.

## 요약
두 파일은 프로덕션 런타임에 노출되지 않는(또는 노출되더라도 순수 상수/타입뿐인) 개발 시점
정적 검증 도구다. 파일 경로·파싱 대상이 전부 하드코딩된 신뢰 소스이고 사용자 입력이나
네트워크 데이터를 처리하지 않으므로 인젝션·인증/인가·암호화·의존성 등 OWASP Top 10 관련
공격 표면이 존재하지 않는다. 코드 자체의 보안 리스크는 확인되지 않았다.

## 위험도
NONE
