# 보안(Security) 리뷰

## 발견사항

### [INFO] CORS `exposedHeaders` 추가 — 헤더 정보 노출 수준 적절
- 위치: `codebase/backend/src/main.ts` L116~123, `codebase/backend/src/common/cors/web-chat-cors.ts` L61~66
- 상세: `exposedHeaders: ['X-Deleted-Count']`를 CORS 설정에 추가했다. 이 헤더는 scope 삭제 건수(정수)만 노출하며, 사용자 식별자·메모리 내용·세션 토큰 등 민감 정보를 포함하지 않는다. 와일드카드(`*`) 대신 단일 헤더명을 명시적으로 열거한 최소 권한 원칙에 부합하는 설정이다.
- 제안: 현재 설정 적절. 추후 커스텀 헤더를 추가할 때 `exposedHeaders` 배열을 확장하되, 인증 토큰이나 세션 정보를 담는 헤더는 절대 포함하지 않는다.

### [INFO] 동적 SQL 파라미터 슬롯 패턴 — 유지보수 위험, 신규 도입 아님
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory-admin.service.ts` (기존 코드, 이번 커밋 이월)
- 상세: `listScopes` / `listMemories`에서 조건 분기에 따라 파라미터 슬롯 번호(`$2`/`$3`/`$4`/`$5`)를 문자열 리터럴로 직접 조정하는 패턴이 존재한다. 이 패턴이 PostgreSQL 바인딩 파라미터 배열(`params`)과 함께 사용되는 한 SQL 인젝션 자체는 방어되나, 슬롯 번호와 params 배열 순서가 어긋날 경우 잘못된 파라미터 바인딩이 발생하고 컴파일 타임에 감지되지 않는다. 이번 변경이 새로 도입한 패턴이 아니며 이월 처리됐다.
- 제안: 향후 별도 cleanup 시 파라미터를 배열에 push 하면서 `$${params.length}` 슬롯을 동적으로 생성하는 빌더 헬퍼를 도입한다. SQL 값이 파라미터 바인딩을 통해 처리되는지 리뷰 시 반드시 확인한다.

### [INFO] `X-Deleted-Count` 헤더 값 정수 검증 부재
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts` (clearScope 엔드포인트, 이번 커밋 검토 대상이나 diff 미포함)
- 상세: `deletedRowCount` 함수가 반환하는 값을 `String(deleted)` 형식으로 헤더에 설정한다. 프론트엔드는 `Number(raw)` 변환 후 `isNaN` 방어를 수행하므로 프론트엔드 측 안전성은 확보됐다. 그러나 헤더에 셋팅 전 백엔드에서 non-negative integer 범위를 명시적으로 검증하지 않는다.
- 제안: `res.setHeader('X-Deleted-Count', String(Math.max(0, Math.floor(deleted))))` 형태로 음수/부동소수 가능성을 원천 차단하면 더 방어적이다.

### [INFO] 테스트 파일 내 실제 식별자와 유사한 고정 픽스처
- 위치: `codebase/frontend/src/app/(main)/agent-memory/components/__tests__/memory-list-panel.test.tsx` L308, `scope-list-panel.test.tsx` L455
- 상세: 테스트 픽스처에 `scopeKey: "cust-1"`, `id: "m1"` 같은 값이 사용된다. 프로덕션 데이터와 유사하지 않은 명백한 테스트용 값으로, 실제 고객 데이터나 시크릿이 포함된 것은 아니다.
- 제안: 현재 수준 적절. 시크릿·API 키·실제 사용자 ID 등이 테스트 픽스처에 하드코딩되지 않도록 PR 리뷰 관행을 유지한다.

## 요약

이번 변경은 보안 관점에서 위험도가 낮다. 핵심 변경인 CORS `exposedHeaders: ['X-Deleted-Count']` 추가는 최소 권한 원칙에 부합하며 민감 정보를 노출하지 않는다. 하드코딩된 시크릿, 인젝션 취약점, 인증/인가 우회 경로는 발견되지 않았다. 동적 SQL 슬롯 패턴은 기존 코드의 유지보수 위험으로 보안 위험은 아니나 추후 정리가 권장된다. 로거 제거(W6)는 불필요한 로그 출력 가능성을 줄여 오히려 정보 노출 면에서 소폭 개선이다. 전반적으로 이 변경은 보안 표면을 축소하거나 중립적으로 유지한다.

## 위험도
NONE
