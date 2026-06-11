### 발견사항

**[INFO] `doc.embeddingErrorMessage` 툴팁에 서버 오류 메시지 직접 노출**
- 위치: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` 라인 965-970
- 상세: `doc.embeddingErrorMessage` 를 툴팁 텍스트로 그대로 렌더링한다. 이 필드가 백엔드의 내부 스택 트레이스, DB 오류 메시지, 내부 서비스 URL, 경로 정보 등을 포함할 경우 인증된 사용자(viewer 포함)에게 민감한 인프라 정보가 노출될 수 있다.
- 제안: 백엔드에서 사용자용 오류 메시지와 내부 진단 로그를 분리하여, `embeddingErrorMessage` 는 사용자 친화적인 요약 메시지만 담도록 API 계약을 정의하거나, 프론트엔드에서 최대 길이 제한(예: 200자) 및 허용 문자 필터링을 적용할 것. `role >= editor` 인 경우에만 상세 오류를 노출하는 방안도 고려.

**[INFO] `id` URL 파라미터 검증 없이 API 호출에 직접 사용**
- 위치: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` 라인 159, 189, 199, 269 등
- 상세: `const { id } = use(params)` 로 추출한 URL 파라미터 `id` 를 형식 검증(UUID 패턴 등) 없이 모든 API 호출에 그대로 전달한다. 프론트엔드 클라이언트에서 임의 문자열을 `id` 로 전달하면 백엔드 입력 처리 경로에 비표준 입력이 도달한다.
- 제안: 프론트엔드에서 UUID 형식 정규식으로 사전 검증(예: `/^[0-9a-f]{8}-[0-9a-f]{4}-/i`)하여 명백히 잘못된 `id` 는 조기 반환/에러 처리하도록 할 것. 단 최종 검증 책임은 백엔드가 지어야 한다.

**[INFO] `RoleGate` 클라이언트 사이드 접근 제어 — CTA 가시성 제한만, 뮤테이션 자체는 제한 없음**
- 위치: `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` 라인 1448, 및 `page.tsx` 의 `RoleGate` 래퍼들
- 상세: `RoleGate(minRole="editor")` 는 UI 버튼을 숨기는 역할만 하며, JavaScript 콘솔에서 직접 뮤테이션 함수를 호출하거나 네트워크 요청을 직접 보내면 역할 검사를 우회할 수 있다. 이는 프론트엔드 설계 패턴상 정상이나, **백엔드 API 계층에서 반드시 역할 검증이 이루어져야** 한다는 전제가 코드베이스 외부에 있다.
- 제안: 이 컴포넌트 자체의 취약점이 아니며, 대응 백엔드 엔드포인트(`POST /re-embed`, `DELETE /documents/:id` 등)에 역할 인가 미들웨어가 적용되어 있는지 별도 확인 권고. 현재 변경 범위에서는 백엔드 확인이 불가능하므로 INFO 등급으로 분류.

**[INFO] `STATE_CONFIG` 외부 주입 불가 설계 — XSS 위험 없음 확인**
- 위치: `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` 라인 1381-1410
- 상세: `STATE_CONFIG` 의 모든 값(`container`, `titleKey`, `descKey` 등)은 소스 코드에 하드코딩된 상수이며, 서버 응답이나 사용자 입력이 직접 주입되지 않는다. `reembedStatus` 는 TypeScript 유니온 타입(`"idle" | "in_progress"`)으로 강제되어 있으며, 실행 시점의 인덱스 접근 `STATE_CONFIG[reembedStatus]` 도 허용된 키로만 제한된다. React 의 JSX 텍스트 노드 자동 이스케이프로 인해 XSS 위험은 없다.
- 제안: 해당 없음.

### 요약

이번 변경(KB 배너 리팩터링)은 보안 관점에서 전반적으로 양호하다. 주요 변경 내용인 `STATE_CONFIG` 상수 테이블 도입과 `UnsearchableBanner` 리팩터링은 사용자 입력이나 외부 데이터가 XSS-가능한 경로로 흘러가는 지점을 만들지 않는다. `RoleGate` 에 의한 CTA 접근 제어는 클라이언트 사이드 방어선으로 의도에 맞게 사용되고 있으며, 백엔드 인가 의존 전제가 별도로 유지되어야 한다. 실질적인 보안 관심사는 기존 코드에 이미 존재하던 `embeddingErrorMessage` 의 원문 노출 패턴으로, 백엔드가 내부 진단 정보를 이 필드에 포함시킬 경우 인증된 사용자에게 인프라 세부 정보가 노출될 수 있다.

### 위험도

LOW
