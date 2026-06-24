# 보안(Security) 리뷰 결과

## 발견사항

### 인젝션 취약점

- **[INFO]** `interaction.service.ts` getStatus — TypeORM `findOne` 사용, 파라미터 바인딩이 ORM 레이어에서 처리됨. SQL 인젝션 위협 없음.
  - 위치: `interaction.service.ts` L1160–1167 (nodeExecutionRepository.findOne, where 절)
  - 상세: `ctx.executionId` 는 `InteractionGuard` 가 이미 검증한 JWT claim 에서 추출된 값이며, TypeORM 의 prepared statement 로 바인딩됨.
  - 제안: 현행 유지.

### 하드코딩된 시크릿

- **[INFO]** 테스트 파일(`use-widget-eager-start.test.ts`)에 `"iext_x"`, `"iext_y"` 등 토큰 리터럴이 포함되어 있으나, 테스트 전용 더미 값으로 실 시크릿이 아님.
  - 위치: `use-widget-eager-start.test.ts` L1383, L1501 등
  - 상세: test stub 이므로 노출 위험 없음.
  - 제안: 현행 유지.

### 인증/인가

- **[INFO]** `getStatus` 신규 코드 경로는 기존 `InteractionGuard` 보호 아래에서만 호출됨. NodeExecution 조회 시 `executionId: ctx.executionId` 조건을 명시적으로 걸어 타 execution 데이터 접근 차단.
  - 위치: `interaction.service.ts` L1160–1167
  - 상세: `where: { executionId: ctx.executionId, status: NodeExecutionStatus.WAITING_FOR_INPUT }` 로 스코프가 현재 실행 컨텍스트로 한정됨. IDOR(Insecure Direct Object Reference) 위험 없음.
  - 제안: 현행 유지.

- **[INFO]** `use-widget.ts` `seedWaitingFromStatus` 는 `session.token` 을 사용해 `client.getStatus` 를 호출하며, 실패 시 `console.warn` 후 진행(soft fail). 인증 토큰이 필요한 엔드포인트이므로 미인가 접근 불가.
  - 위치: `use-widget.ts` seedWaitingFromStatus 콜백 (L1839–1863)
  - 상세: soft fail 정책은 가용성 우선 설계로, 보안상 허용 범위(인증 실패 시 데이터 미노출, 기능만 저하).
  - 제안: 현행 유지.

### 입력 검증

- **[INFO]** `getStatus` 에서 `NodeExecution.outputData` 를 읽어 클라이언트에 동봉하는 로직에서 `interactionType` 값을 화이트리스트(`'form' | 'buttons' | 'ai_conversation'`)로 필터링함. 예상 외 값은 `null` 처리되어 외부 노출 안 됨.
  - 위치: `interaction.service.ts` L1172–1175
  - 상세: `it === 'form' || it === 'buttons' || it === 'ai_conversation' ? it : null` — 허용 외 값은 `interactionType: null` 이 되어 context 블록이 생성되지 않으므로 임의 데이터 유출이 없음.
  - 제안: 현행 유지.

- **[WARNING]** `getStatus` context 응답에 `nodeOutput: out` 을 형변환 없이 그대로 동봉함. `out = nodeExec.outputData ?? {}` 는 DB 에 저장된 JSON 객체 전체이며, 필드 화이트리스트 필터링 없이 클라이언트로 전달됨.
  - 위치: `interaction.service.ts` L1192–1201
    ```ts
    buttonConfig: { buttons: bc.buttons, nodeOutput: out },
    // ...
    context = { interactionType, waitingNodeId: nodeExec.nodeId, nodeOutput: out };
    ```
  - 상세: `outputData` 에 향후 내부 시스템 메타데이터(예: 실행 엔진 내부 오류 스택, 통합 서비스 인증 정보 중간 결과 등)가 기록될 경우 클라이언트(위젯)에 전체 노출됨. 현재는 `withInteractionMeta` 가 기록한 프레젠테이션 데이터만 있다고 가정하나, spec 이 아닌 실행 코드 관례에 의존하는 암묵적 보안 가정임.
  - 제안: `nodeOutput` 으로 동봉할 필드를 명시적으로 선택(pick)하거나, `outputData` 스키마를 `interactionMeta 전용 서브키`(`outputData.interactionMeta`)로 분리해 해당 서브키만 전달하도록 리팩터링 권장. 단기 대안: JSDoc/주석으로 "outputData 에 민감 필드 기록 금지" 제약을 명기.

### OWASP Top 10

- **[INFO]** A05:2021 Security Misconfiguration — k8s/README 의 `WEB_CHAT_WIDGET_ORIGINS` CORS 설정 가이드가 추가됨. 미설정 시 `/api/external/*` 차단(secure-by-default)이 명확히 문서화됨. 양호.
  - 위치: `k8s/README.md` 추가 블록, `spec/7-channel-web-chat/4-security.md` §2
  - 상세: CORS 미구성 위험성과 설정 방법을 운영자에게 명시. 코드 동작 자체는 `WEB_CHAT_WIDGET_ORIGINS` 미설정 시 차단이므로 안전한 기본값 유지.
  - 제안: 현행 유지.

- **[INFO]** A01:2021 Broken Access Control — `relations: ['node']` 로 연관 `node` 엔티티를 JOIN 하는 경우, TypeORM 의 기본 동작으로 해당 node 의 전체 컬럼이 로드됨. `nodeExec.node.type` 만 사용하지만 나머지 node 컬럼이 메모리에 적재됨. 클라이언트로는 `.type` 만 노출되므로 직접 노출 위험은 없으나, DB 트래픽 효율 측면의 주의사항.
  - 위치: `interaction.service.ts` L1165 (`relations: ['node']`)
  - 상세: 보안 위협은 아님. `select` 절로 `node.type` 만 로드하면 방어 깊이 향상.
  - 제안: 필요 시 `select: { node: { type: true } }` 추가 고려(성능·최소 권한 원칙).

### 암호화

- **[INFO]** 이번 변경에서 암호화/해시 관련 코드 변경 없음. 기존 토큰 인증(Bearer JWT) 구조 유지.

### 에러 처리

- **[INFO]** `use-widget.ts` `seedWaitingFromStatus` 의 catch 절은 `err instanceof Error ? err.message : String(err)` 로 콘솔에 기록. 클라이언트(호스트 웹페이지)에서 콘솔을 열면 내부 에러 메시지가 노출될 수 있으나, 이 메시지는 네트워크 오류 수준의 정보로 민감 데이터가 아님.
  - 위치: `use-widget.ts` L1856–1860
  - 상세: 프로덕션 위젯이 호스트 사이트에 임베드되므로 호스트 개발자가 콘솔을 볼 수 있음. API 에러 응답의 구체적 내용(예: EXECUTION_NOT_FOUND 코드)이 노출될 수 있으나 민감도 낮음.
  - 제안: 프로덕션 빌드에서 `console.warn` 을 환경 조건부로 억제하거나, 에러 코드만 요약해 로깅하는 방안 검토.

- **[INFO]** 백엔드 `getStatus` — execution 미존재 시 `EXECUTION_NOT_FOUND` 코드+메시지만 반환, 내부 스택 미노출. `getStatus` 중 `nodeExecutionRepository.findOne` 실패 시 예외가 전파되어 NestJS 기본 에러 핸들러가 처리됨(500 반환, 스택은 서버 로그에만 기록). 클라이언트 노출 없음.

### 의존성 보안

- **[INFO]** 이번 변경에서 신규 외부 의존성(패키지) 추가 없음. TypeORM 엔티티 등록 확장만 있음.

---

## 요약

이번 변경(SSE replay + getStatus 표면 복구 + CORS 문서화)의 핵심 보안 위험은 **getStatus 응답에 `NodeExecution.outputData` 전체를 `nodeOutput` 으로 클라이언트에 동봉하는 부분**이다. 현재는 `withInteractionMeta` 가 기록하는 프레젠테이션 데이터만 `outputData` 에 있다는 암묵적 가정에 의존하고 있어, 향후 실행 엔진이 민감 중간 결과를 같은 컬럼에 기록하게 되면 정보 노출로 이어질 수 있다. 나머지 항목(TypeORM 파라미터 바인딩, Guard 스코프 한정, interactionType 화이트리스트, CORS 기본 차단값)은 모두 양호하며 OWASP Top 10 기준으로 즉각적인 임계 취약점은 없다.

## 위험도

LOW
