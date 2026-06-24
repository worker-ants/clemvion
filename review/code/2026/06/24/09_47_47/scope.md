# 변경 범위(Scope) 리뷰

## 발견사항

해당 커밋의 목적: 라이브 미리보기 iframe(`/_widget/web-chat/v1/app/`)이 /login redirect 또는 404로 떠 위젯이 로드되지 않던 버그 수정.

변경 파일: `proxy.ts`, `next.config.ts`, `proxy.test.ts`(신규), `spec/7-channel-web-chat/0-architecture.md`

### 발견사항

- **[INFO]** `proxy.ts` 기존 주석 `// Allow static assets and API routes` → `// Allow static assets and API routes.` 마침표 추가
  - 위치: `codebase/frontend/src/proxy.ts` diff @@ -18 라인
  - 상세: 단순 마침표 추가로 실질 로직과 무관한 포맷팅 변경이 실질 변경과 혼재. 의미상 차이는 없으며 매우 미미한 수준.
  - 제안: 허용 가능 수준이나, 순수 포맷팅 변경은 별도 커밋이 더 깔끔하다.

- **[INFO]** spec 파일(`0-architecture.md`) 수정이 포함됨
  - 위치: `spec/7-channel-web-chat/0-architecture.md` §4.1
  - 상세: 개발자 역할은 `spec/` 에 대해 read-only 권한이 원칙(CLAUDE.md). 단, 커밋 메시지에 `spec 0-architecture §4.1: 동봉 서빙 frontend 라우팅 전제 명시`가 명시되어 있고, 변경 내용이 이번 버그픽스의 기술적 전제조건(인증 미들웨어 예외 + rewrite 규칙)을 문서화한 것으로 직접 관련된 spec 갱신이다. spec 변경이 구현 수정의 직접적인 근거를 기록하는 성격이므로 scope 이탈보다는 사후 동기화에 해당한다고 볼 수 있음. 그러나 CLAUDE.md 역할 규약(개발자는 spec/ 쓰기 금지)과는 형식상 충돌한다.
  - 제안: spec 수정은 project-planner 역할로 별도 위임하거나, 이번처럼 버그픽스에 직접 연동된 minimal spec 동기화는 팀 내 예외 인정 여부를 명확히 규약화하는 것이 바람직하다.

- **[INFO]** `proxy.test.ts` 신규 파일 추가
  - 위치: `codebase/frontend/src/__tests__/proxy.test.ts` (신규)
  - 상세: 이번 버그픽스(/_widget 인증 예외)에 대한 회귀 가드 테스트로, 변경 의도와 직접 연관된 테스트 추가다. 불필요한 범위 확장이 아니라 버그픽스의 증거 및 회귀 방지 목적이므로 적절하다. 보호 경로 동작 검증도 포함하여 기존 기능의 회귀 가드를 겸하고 있어 범위 내로 판단.
  - 제안: 이상 없음.

## 요약

이번 변경은 `/_widget/**` 경로가 인증 미들웨어에 걸려 /login으로 튕기던 문제와 Next public/ 디렉토리 index.html 폴백 미지원으로 인한 404를 수정하는 단일 버그픽스다. `proxy.ts`, `next.config.ts`, `proxy.test.ts` 세 파일은 모두 수정 의도에 직접 부합하며 불필요한 리팩토링·기능 확장·무관한 파일 수정이 없다. spec 파일 수정은 CLAUDE.md 개발자 역할의 spec/ read-only 원칙과 형식상 충돌하나, 내용이 이번 버그픽스의 기술적 전제를 문서화한 것으로 실질적 범위 이탈은 아니다. 마침표 하나 추가라는 미미한 포맷팅 변경이 실질 변경과 혼재하나 영향은 무시할 수준이다. 전반적으로 변경 범위가 잘 통제되어 있다.

## 위험도

LOW
