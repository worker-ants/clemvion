# API 계약(API Contract) 리뷰 결과

## 대상 변경 요약
이번 변경(PR #865 후속 "슬러그 라우팅 하드닝 B")은 프런트엔드 전용 리팩터다:
- `buildExecutionHref` 헬퍼로 실행 상세/목록 경로 리터럴 통합 (클라이언트 라우팅)
- `safe-path.ts` 공용 정규화 함수로 open-redirect 방어 로직 통합 (클라이언트 사이드 redirect 검증)
- `WorkspaceSummary`/`WorkspaceRole` 타입을 `lib/workspace/types.ts` 로 이동 (컴파일 타임 타입, 런타임 순환 제거 목적)
- 관련 unit 테스트 3건 신설/보강
- plan 문서(`plan/in-progress/slug-routing-hardening.md`) 신설

백엔드 컨트롤러/DTO/엔드포인트/에러 응답 스키마/페이지네이션/인증-인가 미들웨어 등 실제 API 계약을 구성하는 코드는 이번 diff 에 전혀 포함되어 있지 않다. 언급되는 `executionsApi.reRun`, `triggersApi.getHistory`, `executionsApi.getByWorkflow` 등은 기존 API 클라이언트 호출부를 그대로 사용할 뿐 요청/응답 형태·URL·페이지네이션 파라미터를 변경하지 않았다. 백엔드 에러 포맷(`{ error: { code, message, requestId } }`)에 대한 언급도 기존 동작을 설명하는 주석일 뿐 변경 대상이 아니다.

메모리 기록에 따르면 이번 작업 계열의 설계 원칙 자체가 "URL slug 는 FE 라우팅 SoT 이며 backend 인가 SoT 가 아니다"(header-first 인가 무변경, `X-Workspace-Id` 유지)이므로, 이 리팩터가 API 인가 경계를 건드릴 개연성도 낮다.

## 발견사항
없음 (API 계약 관점에서 검토할 변경 없음).

## 요약
이번 diff 는 프런트엔드 URL 조립 헬퍼 통합·open-redirect 방어 정규화 공유·타입 파일 이동만을 포함하는 순수 클라이언트 리팩터로, 백엔드 API 엔드포인트·요청/응답 스키마·에러 포맷·페이지네이션·인증/인가 로직에 어떠한 변경도 가하지 않는다. API 계약 관점에서는 해당 없음.

## 위험도
NONE
