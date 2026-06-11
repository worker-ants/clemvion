### 발견사항

- **[INFO]** SSRF 에러 메시지에 차단 대상 호스트/IP 노출 가능성 (미해결 follow-up)
  - 위치: http-safety.ts (이번 변경에 직접 포함되지 않음), plan/in-progress/http-ssrf-all-auth-followups.md 의 미완료 항목
  - 상세: http-safety.ts 의 SSRF_BLOCKED: hostname "..." 메시지가 차단된 호스트명/IP 를 output.error.message 에 그대로 포함시킬 수 있다. 공격자가 내부망 topology 정찰에 활용 가능한 정보 노출이다. 이번 PR 범위 밖으로 이미 분리되어 follow-up 목록에 등재되어 있다.
  - 제안: 클라이언트 대면 메시지를 "Request blocked by SSRF policy" 등 일반화된 문구로 교체하고, 세부 hostname/IP 는 서버 측 구조화 로그(CCH-ERR-04 와 동일 패턴)에만 기록한다. http-safety.ts 는 HTTP/DB/Email 3노드 공용이므로 변경 시 3노드 전체 영향 audit 필요.

- **[INFO]** output.error.details.legacyCode 내부 코드 문자열 클라이언트 노출
  - 위치: codebase/backend/src/nodes/data/code/code.handler.ts, failure() 메서드 내 outputDetails.legacyCode
  - 상세: LEGACY_TO_NORMALIZED 기본값을 ?? ErrorCode.CODE_EXECUTION_FAILED 로 교체한 것은 긍정적인 방어-심층 조치다. 그러나 outputDetails.legacyCode = errorCode 로 내부 분류 코드(EXECUTION_TIMEOUT, EXECUTION_MEMORY_EXCEEDED, CODE_RUNTIME_ERROR)가 output.error.details.legacyCode 에 포함되어 클라이언트까지 전달된다. 내부 구현 세부 사항이 공개 API 로 노출될 수 있다.
  - 제안: legacyCode 는 서버 측 로그 전용으로 처리하거나, 노출 범위를 process.env.NODE_ENV !== "production" 조건으로 stack 과 동일하게 제한하는 것을 검토한다.

- **[INFO]** statusCode: 0 및 음수 HTTP 상태 코드가 placeholders.statusCode 에 포함됨
  - 위치: execution-failure-classifier.ts extractStatusCode(), 테스트 파일 L293-320
  - 상세: Number.isInteger(0) 및 Number.isInteger(-200) 이 모두 true 이므로, 의미 없는 값이 i18n 플레이스홀더로 사용자에게 노출될 수 있다. 테스트 코드가 이를 "현재 구현 동작 문서화" 로 명시하고 있어 의도된 한계임을 인식하고 있다.
  - 제안: HTTP 유효 범위 검사(v >= 100 && v <= 599)를 extractStatusCode 에 추가하거나, DTO 레이어에서 범위를 강제한다.

- **[INFO]** SSRF 가드 redirect 재검증이 authentication === "integration" 조건에만 적용됨
  - 위치: http-request.handler.ts redirect while loop
  - 상세: redirect 루프(while (authentication === "integration" && ...))가 integration 인증 모드에서만 활성화된다. none 또는 custom 인증에서 3xx 응답을 받으면 재검증 없이 종료된다. redirect: "manual" 설정으로 실제 자동 리다이렉트는 막혀 있어 즉각적인 SSRF 우회 위험은 제한적이나, 동작이 인증 방식에 따라 비대칭적으로 분기된다는 점에서 향후 리팩터 시 혼동 가능성이 있다.
  - 제안: 인증 방식과 무관하게 redirect 재검증을 적용하거나, none/custom 에서 3xx 를 따라가지 않는 동작을 주석으로 명시한다.

### 요약

이번 변경은 보안 관점에서 전반적으로 긍정적이다. LEGACY_TO_NORMALIZED 기본값을 ErrorCode.CODE_EXECUTION_FAILED 로 고정하여 미등록 내부 코드의 공개 API 노출을 방어하고, Object.freeze 로 런타임 변조를 차단하며, HTTP_BLOCKED 리터럴을 ErrorCode enum 참조로 교체해 오타 노출 위험을 제거했다. classifyCodeNodeError 의 isDisposed 플래그 우선순위(P1>P2>P3) 설계로 사용자 코드가 error 메시지를 위장해 메모리 OOM 이벤트를 spoofing 하는 공격을 방어한다. 테스트 파일(CCH-ERR-02 화이트리스트 섹션)에서 error.message, nodeId, executionId, API 키 쿼리 파라미터가 반환값에 포함되지 않음을 명시적으로 검증한다. 잔여 항목은 SSRF 에러 메시지 일반화(http-safety.ts)와 legacyCode 내부 문자열 노출 정도로, 두 항목 모두 follow-up 목록에 이미 등재되어 있다. 하드코딩된 시크릿, SQL/커맨드 인젝션, 인증 우회, 취약한 암호화 알고리즘은 발견되지 않았다.

### 위험도

LOW
