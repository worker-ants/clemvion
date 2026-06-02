# 보안(Security) 리뷰 결과

## 발견사항

### [INFO] 인가(Authorization) — admin role 가드 미적용, 설계적 의도이나 접근 통제 단일 계층
- 위치: `codebase/backend/src/modules/system-status/system-status.controller.ts` (전체)
- 상세: `SystemStatusController.getOverview()`는 `@ApiBearerAuth`만 적용돼 JWT 인증 통과 시 모든 로그인 사용자가 시스템 전역 큐 집계를 조회할 수 있다. spec 의 설계 결정(개별 job·payload 미노출 → 워크스페이스 식별 불가 → 전원 노출 안전)에 근거한 의도적 선택이고 RBAC 매트릭스에 등재된 사항이다. 단, "집계 카운트만" 이라는 불변식이 구현 전반(서비스·DTO)에서 유지될 경우에만 안전하다. 현재 구현은 이 불변식을 올바르게 지키고 있다.
- 제안: 현재 수준 유지. 향후 큐 상태 API를 확장해 개별 job 정보가 추가될 경우에는 즉시 role 가드 도입 필요.

### [INFO] 에러 처리 — catch 블록 내 서버 측 로깅 부재 (무음 실패)
- 위치: `codebase/backend/src/modules/system-status/system-status.service.ts` — `inspect()` catch 블록 (라인 653)
- 상세: `inspect()` 의 catch 블록은 예외를 삼키고 `health: 'down'` + 0 카운트 응답으로 대체한다. 민감 정보를 API 응답에 노출하지 않는 점은 올바르다. 그러나 catch 내부에 서버 측 logger 호출이 없어 Redis 장애 시 예외가 완전히 소멸한다. 운영 환경에서 여러 큐가 동시에 down 상태로 집계될 때 원인 추적이 불가능하다.
- 제안: `catch (err)` 로 변경하고 `this.logger.error(...)` 또는 동등한 NestJS Logger 로 예외를 기록할 것.

### [INFO] 입력 검증 — GET 엔드포인트에 외부 입력 없음, 안전
- 위치: `codebase/backend/src/modules/system-status/system-status.controller.ts` — `getOverview()`
- 상세: 쿼리 파라미터·경로 파라미터·요청 바디가 전혀 없는 순수 읽기 엔드포인트이므로 인젝션·입력 검증 취약점 표면적이 없다.
- 제안: 해당 없음.

### [INFO] 프론트엔드 XSS — 서버 응답값의 직접 렌더링, 위험 없음
- 위치: `codebase/frontend/src/app/(main)/system-status/page.tsx` — `QueueCard`, `OverallHeader`, `CountCell`
- 상세: 응답에서 렌더링되는 값은 `queue.name`(문자열), `queue.counts.*`(숫자), `queue.health`(enum 문자열), `totalFailed`(숫자)로 한정된다. `dangerouslySetInnerHTML`이 사용되지 않으며 React의 기본 이스케이핑이 적용된다. `queue.name`은 서버 측 `MONITORED_QUEUES` 상수에서 유래한 고정 문자열이어서 공격자가 임의 값을 주입할 수 없다.
- 제안: 해당 없음.

### [INFO] 하드코딩된 시크릿 — 없음
- 상세: 전체 변경 파일에 API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 없다.

### [INFO] 의존성 보안 — 신규 외부 의존성 없음
- 상세: 이번 변경에서 `package.json`에 신규 외부 의존성이 추가되지 않았다. BullMQ(`Queue.getJobCounts`, `Queue.isPaused`)와 NestJS는 기존 프로젝트에서 이미 사용 중인 라이브러리이다.

---

## 요약

이번 변경은 BullMQ 큐의 집계 카운트·파생 health만을 반환하는 읽기 전용 시스템 상태 API와 프론트엔드 페이지를 추가한다. 외부 입력이 없는 GET 엔드포인트이므로 인젝션 취약점 표면적이 없고, catch 블록에서 내부 예외를 삼켜 Redis 오류가 응답에 노출되지 않으며, 프론트엔드에서 `dangerouslySetInnerHTML`을 사용하지 않아 XSS 위험이 없다. 하드코딩된 시크릿도 없다. admin role 가드 미적용은 spec에서 명시적으로 결정된 설계(집계만 노출 → 워크스페이스 식별 불가)이며 현재 구현이 개별 job·payload를 노출하지 않는 불변식을 올바르게 유지하고 있어 수용 가능하다. 개선이 필요한 유일한 항목은 `inspect()` catch 블록 내 서버 측 로깅 부재로, 운영 환경에서 Redis 장애를 무음 실패로 처리하는 구조이나 보안 위협은 아니다.

---

## 위험도

LOW

STATUS: SUCCESS
