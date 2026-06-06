# 보안(Security) 리뷰 결과

## 발견사항

### 파일 3: codebase/backend/test/execution-park-resume.e2e-spec.ts

- **[INFO]** 테스트 전용 JWT 시크릿 하드코딩
  - 위치: line 1609 / line 1907-1909
  - 상세: `'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7'` 가 fallback 값으로 e2e 테스트 파일에 직접 포함되어 있다. 코드 주석에 "repo 에 공개됨", "테스트 전용 시크릿"임이 명시되어 있고 `process.env.JWT_SECRET` 우선 취득 + fallback 패턴이며 운영 환경에 쓰이지 않는다. 이번 diff 는 코드 포매팅(줄 바꿈) 변경만으로 로직 변경 없음.
  - 제안: 테스트 파일에서 하드코딩 fallback 시크릿을 사용하는 패턴 자체는 e2e 환경에서 관례적으로 허용된다. 그러나 이 값이 실수로 운영 compose 파일에 그대로 복사되는 리스크를 차단하기 위해 `docker-compose.e2e.yml` 의 `JWT_SECRET` 값이 운영 시크릿과 분리되어 있는지 별도 확인을 권고한다.

---

### 파일 2: codebase/backend/src/modules/executions/executions.service.ts

- **[INFO]** `outputData` 봉투 status 신뢰 범위
  - 위치: `reconcilePreParkWaitingStatus` 함수 (추가된 코드 블록)
  - 상세: `(ne.outputData as { status?: unknown } | null)?.status === 'waiting_for_input'` 비교에서 `status` 값을 string literal 로 비교하기 전 타입 좁힘(narrowing)이 없다. 현재 코드에서는 string literal `'waiting_for_input'` 과 `=== `(strict equality) 로 비교하므로 injection이나 type confusion 위험은 없다. `outputData` 는 DB에서 역직렬화된 JSONB 필드로, 악의적인 값이 이 경로에 도달하더라도 literal 비교만 수행하고 추가 조작이 없으므로 실질적 위험은 없다.
  - 제안: 추가 방어 로직이 필요하다면 `typeof ... === 'string' &&` 체크를 앞에 붙일 수 있으나 보안상 현재 패턴으로도 안전하다.

- **[INFO]** `verifyOwnership` 및 `verifyWorkflowOwnership` 의 IDOR 방지 패턴
  - 위치: `verifyOwnership` / `verifyWorkflowOwnership` 메서드
  - 상세: 이번 diff 에서 변경되지 않았으나 서비스 컨텍스트 검토 중 확인. NotFound 로 통일해 ID enumeration 을 방지하는 패턴이 올바르게 구현되어 있다. 코드 주석에도 의도가 명확히 기술됨.

- **[INFO]** `stop()` 의 TOCTOU 방어
  - 위치: `stop()` 메서드
  - 상세: 이번 diff 에서 변경되지 않았으나 확인. `UPDATE ... WHERE status IN (...)` 원자 패턴으로 경쟁 조건을 올바르게 처리하고 있다.

---

### 파일 6: codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts

- **[INFO]** `isNodeWaitingForInput` 의 `outputData` 신뢰
  - 위치: `isNodeWaitingForInput` 함수 (신규 추가)
  - 상세: 클라이언트 측 코드에서 서버 응답의 `outputData.status` 를 신뢰해 UI 상태를 전환한다. frontend 의 경우 이 데이터는 신뢰된 백엔드 API 응답이므로 injection 위협이 없다. `status === 'waiting_for_input'` literal 비교만 수행하고 평가 결과는 UI state 전환에만 쓰이므로 보안상 무해하다.

---

### 파일 4: codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts

- **[INFO]** 테스트 토큰/시크릿
  - 위치: `installFetch` mock 내 `token: "iext_x"`, `token: "iext_y"` 등
  - 상세: 테스트 픽스처 내 하드코딩된 mock 토큰 값이지만 실제 암호화 소재가 아닌 단순 픽스처 문자열이다. 위험 없음.

---

## 요약

이번 변경은 Carousel/blocking 노드의 intra-row 상태 불일치(pre-park window 에서 `status='running'` + `outputData.status='waiting_for_input'`)를 read-side 에서만 정규화하는 버그 수정이다. 보안 관점에서 신규 취약점은 발견되지 않았다. 백엔드의 `reconcilePreParkWaitingStatus` 는 DB 기록을 변경하지 않는 순수 read-side 정규화이며, 프론트엔드의 `isNodeWaitingForInput` 는 서버 응답의 JSONB 필드를 literal 비교로만 검사한다. 인증/인가 검증(verifyOwnership, RBAC guard, IDOR NotFound 통일)은 이번 변경에서 건드리지 않았고 기존 구조가 올바르다. e2e 테스트의 fallback JWT 시크릿은 코드 주석에 테스트 전용임이 명시되어 있고 운영 경로와 분리되어 있으나, CI/compose 설정에서 이 값이 운영 환경에 유입되지 않도록 주기적으로 확인하는 것을 권고한다.

## 위험도

NONE
