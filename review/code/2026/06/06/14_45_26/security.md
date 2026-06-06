# 보안(Security) 리뷰 결과

## 발견사항

### 파일 3: codebase/backend/test/execution-park-resume.e2e-spec.ts

- **[INFO]** 테스트 전용 JWT 시크릿 하드코딩 — 포맷팅 변경만, 로직 불변
  - 위치: `JWT_SECRET` 삼항 연산자 fallback (`'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7'`)
  - 상세: 이번 diff 는 해당 라인의 줄바꿈 포맷팅 변경만이며 시크릿 값 자체는 기존 main 에 존재하던 것이다. `process.env.JWT_SECRET` 우선 취득 + fallback 패턴이고, 코드 주석에 "테스트 전용 시크릿, repo 에 공개됨"이 명시되어 있다. 현재 diff 가 이 리스크를 새롭게 도입한 것은 아니다.
  - 제안: 운영 compose(`docker-compose.yml`)의 `JWT_SECRET` 이 이 e2e fallback 값과 동일하지 않은지 정기 확인을 권고한다. CI 파이프라인에서 `JWT_SECRET` env를 주입하면 fallback 경로 자체가 실행되지 않는다.

---

### 파일 2: codebase/backend/src/modules/executions/executions.service.ts

- **[INFO]** `reconcilePreParkWaitingStatus` — `outputData` JSONB 봉투 status 비교
  - 위치: `reconcilePreParkWaitingStatus` 함수 내 `(ne.outputData as { status?: unknown } | null)?.status === NodeExecutionStatus.WAITING_FOR_INPUT`
  - 상세: `outputData` 는 DB에서 역직렬화된 JSONB 필드이다. 비교는 `===` strict equality + enum 상수값(문자열 리터럴)으로만 수행하며, 그 결과를 `ne.status` 교체에만 사용한다. DB write가 없는 read-side normalization이므로 인젝션, 권한 우회, 데이터 오염의 위험이 없다. `unknown` 타입 캐스트 후 strict equality 비교이므로 type confusion도 발생하지 않는다.
  - 제안: 해당 없음. 현재 패턴이 안전하다.

- **[INFO]** IDOR 방지 패턴 — `verifyOwnership` / `verifyWorkflowOwnership`
  - 위치: 이번 diff 에서 변경되지 않은 기존 메서드
  - 상세: `findById` 경로에 `verifyOwnership` 가드가 존재하며 NotFound 로 통일해 ID enumeration 을 방지하는 패턴이 올바르게 구현되어 있다. 이번 변경이 이 가드를 우회하거나 약화하지 않는다.

---

### 파일 6: codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts

- **[INFO]** `isNodeWaitingForInput` — 서버 응답 JSONB 신호 신뢰
  - 위치: `isNodeWaitingForInput` 함수 내 `(ne.outputData as { status?: unknown } | null)?.status === "waiting_for_input"`
  - 상세: 클라이언트 측 코드에서 신뢰된 백엔드 API 응답의 `outputData.status` 를 literal 비교로만 검사하여 UI 상태 전환에 사용한다. XSS 등 인젝션 위험이 없으며, 결과값이 boolean 이라 추가 악용 경로가 없다. terminal 상태(`completed`/`failed`/`skipped`/`cancelled`) row 는 명시적으로 제외해 stale 봉투 값에 의한 의도치 않은 상태 전환을 방지한다.
  - 제안: 해당 없음.

---

### 파일 4: codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts

- **[INFO]** 테스트 픽스처 토큰 — `token: "iext_x"`, `token: "iext_y"`
  - 상세: 실제 암호화 소재가 아닌 테스트 픽스처 문자열이다. 위험 없음.

---

## 요약

이번 변경은 Carousel/blocking 노드의 pre-park window intra-row inconsistency(`status='running'` + `outputData.status='waiting_for_input'`)를 read-side에서만 정규화하는 버그 수정이다. 신규 취약점은 발견되지 않았다. 백엔드 `reconcilePreParkWaitingStatus` 는 DB write 없는 순수 read-side 정규화이며, 프론트엔드 `isNodeWaitingForInput` 는 서버 응답 JSONB 필드를 enum 상수와 strict equality로만 비교한다. 인증/인가 검증(`verifyOwnership`, RBAC guard, IDOR NotFound 통일)은 이번 변경에서 건드리지 않았고 기존 구조가 올바르게 유지된다. e2e 테스트의 fallback JWT 시크릿(`clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7`)은 코드 주석에 테스트 전용임이 명시되어 있고 `process.env.JWT_SECRET` 우선 취득 패턴으로 보호되나, 이번 diff가 새롭게 도입한 위험이 아닌 기존 값의 포맷팅 변경임을 유의한다. CI에서 `JWT_SECRET` env 주입 여부와 운영 compose와의 값 분리를 주기적으로 확인할 것을 권고한다.

## 위험도

NONE

STATUS: SUCCESS
