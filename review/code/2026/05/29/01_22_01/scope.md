# 변경 범위(Scope) 리뷰 결과

## 발견사항

- **[INFO]** `execution-engine.service.spec.ts` — error port routing 테스트 블록 신규 삽입
  - 위치: 기존 라인 1700 이후, `describe('WebSocket events')` 직전 삽입
  - 상세: Fix 1 검증용 3개 테스트(`marks FAILED + continues`, `stops with ERROR_PORT_FALLBACK`, `normal handler COMPLETED`)가 새 `describe('error port routing (§3.2)')` 블록으로 추가됨. helper `lastNodeExecSave`와 `errHandler` 팩토리가 해당 블록 내부 스코프로만 한정돼 기존 테스트에 영향 없음. 기존 테스트 코드 변경 없음.

- **[INFO]** `execution-engine.service.ts` — `ErrorPortFallbackError`, `isErrorPortRouted`, `hasConnectedErrorEdge` 추가 및 `outgoingEdgeMap` 5개 호출부 전달
  - 위치: 클래스 정의 영역(+15줄), `executeNode` 파라미터(+7줄), success-path 분기(+64줄), finally 이후 throw 블록(+11줄), private 메서드 2개(+42줄), 호출부 3곳(각 +1줄)
  - 상세: plan 항목 "5개 호출부에 `outgoingEdgeMap` 전달"과 diff의 실제 변경 지점이 정확히 일치. `savedExecution.error`에 `code` 필드를 조건부 spread 하는 두 곳(라인 1664, 2694)도 Fix 1의 ERROR_PORT_FALLBACK code 보존을 위한 필수 변경. 기존 로직 정리·리팩토링 없음.

- **[INFO]** `integrations.service.spec.ts` — nodemailer mock + SMTP tester 테스트 블록 신규 삽입
  - 위치: 파일 import 영역(+3줄), 라인 608 이후 `describe('testConnection — email(SMTP)')` 삽입(+90줄)
  - 상세: Fix 2 검증용 3개 테스트(`verify resolves → success`, `verify rejects → EMAIL_CONNECT_FAILED`, `구조 검증 우선 → createTransport 미호출`). `jest.mock('nodemailer', ...)` 가 파일 최상위에 추가됐으나 기존 테스트에서 nodemailer를 사용하지 않으므로 영향 없음. 기존 테스트 코드 변경 없음.

- **[INFO]** `integrations.service.ts` — `createTransport` import 추가, `testEmailTransport` 메서드 추가, `transportTesters` 에 `email` 등록
  - 위치: import(+1줄), constructor(+1줄), 라인 1256~1303(+44줄)
  - 상세: Fix 2 범위 내 최소 변경. 기존 `testMcpTransport`, `dispatchTest`, `testConnection` 등 다른 메서드는 일절 수정되지 않음. `clampMessage` 재사용으로 별도 유틸 추가 없음.

- **[INFO]** `plan/in-progress/fix-mail-send-status.md` — 신규 plan 파일 생성
  - 위치: 전체 파일 신규(72줄)
  - 상세: frontmatter(name/status/worktree/branch/spec_refs), 배경, 작업 항목, 문서화 점검, 후속 항목 포함. CLAUDE.md 정책의 plan 파일 요건(worktree 명시 등)을 충족함.

## 요약

변경된 5개 파일은 모두 plan `fix-mail-send-status`가 명시한 Fix 1(엔진 error-port 라우팅 → NodeExecution FAILED + ERROR_PORT_FALLBACK) 및 Fix 2(email SMTP verify transport tester) 범위를 벗어나지 않는다. 기존 코드 정리·리팩토링, 무관 파일 수정, 포맷팅 노이즈, 불필요한 임포트 변경, 의도하지 않은 설정 변경은 발견되지 않았다. 각 diff는 의도된 버그 수정에 필요한 최소 변경만 담고 있으며, 추가된 주석은 전부 변경된 동작의 근거(spec 참조, D4 결정 등)를 설명하는 적절한 내용이다.

## 위험도

NONE
