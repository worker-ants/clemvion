# 보안(Security) 리뷰

## 발견사항

- **[INFO]** 에러 메시지가 DB 저장 및 WebSocket 이벤트로 노출됨 (기존 패턴 재사용)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `failFirstSegmentSetup` (기존 메서드, 이번 diff 는 호출부만 확장) — `row.error = { message: errMessage }` 저장 후 `emitExecution(... EXECUTION_FAILED, { error: errMessage })`
  - 상세: `error instanceof Error ? error.message : String(error)` 로 원본 예외 메시지를 그대로 DB 컬럼과 WS 클라이언트에 전달한다. 스택 트레이스는 포함하지 않으나, 내부 예외 메시지(DB 제약조건 위반 문구, 파일 경로, 내부 서비스명 등)가 클라이언트로 노출될 가능성이 있다. 다만 이는 이번 diff 가 신규로 만든 회귀가 아니라 기존 계약(W2 도입 시점부터 존재)이며, 이번 변경은 동일 헬퍼를 `executeAsync`(sub-workflow 비동기 경로)에 대칭적으로 연결한 것뿐이다.
  - 제안: 조치 불요(범위 밖). 향후 별도 감사에서 에러 메시지 새니타이징 정책(화이트리스트 에러 코드만 클라이언트 노출, 원문은 서버 로그 한정) 검토 권장.

- **[INFO]** `failFirstSegmentSetup` 의 read-then-write 는 비원자적(TOCTOU)
  - 위치: `failFirstSegmentSetup` — `findOneBy` → 상태 체크 → `save`
  - 상세: 동시에 다른 경로(예: DB 원자 claim, C-2)가 같은 execution row 를 갱신 중이면 레이스 가능성이 이론상 존재하나, best-effort 마감 성격상(실패 정보 기록 목적) 심각한 보안 영향은 없고 기존 패턴을 재사용한 것으로 이번 diff 의 신규 이슈가 아니다.
  - 제안: 조치 불요. 동시성 관점 검토는 별도 트랙(06-concurrency C-2 계열)에서 이미 다루는 영역.

- **[INFO]** 테스트 파일에서 `as unknown as` 타입 캐스트로 private 메서드 접근
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` `M4AsyncFailSubject` 타입 정의 및 `service as unknown as M4AsyncFailSubject`
  - 상세: 테스트 목적의 private 멤버 스파이 접근으로, 보안 취약점 아님. 프로덕션 코드 경로에 영향 없음.
  - 제안: 조치 불요.

인젝션·하드코딩 시크릿·인증/인가 우회·입력 검증 누락·안전하지 않은 암호화 알고리즘·의존성 취약점 등 새로운 이슈는 발견되지 않았다. `failFirstSegmentSetupBestEffort` 헬퍼는 2차 실패를 항상 흡수해(re-throw 없음) unhandled rejection 이나 BullMQ 이중 재시도를 방지하도록 올바르게 격리되어 있으며, 외부 입력을 직접 다루지 않고(`executionId`, `error` 는 내부 파이프라인에서 전달) 새로운 신뢰 경계를 넘지 않는다.

## 요약

이번 변경은 `execution-engine.service.ts` 내 기존 큐 경로(`runExecutionFromQueue`)의 검증된 best-effort 실패 마감 패턴(W7)을 `executeAsync`(sub-workflow fire-and-forget) 경로로 대칭 확장하고, 중복 코드를 `failFirstSegmentSetupBestEffort` private 헬퍼로 추출한 작은 리팩토링이다. 신규 인젝션·인증/인가·하드코딩 시크릿·암호화 이슈는 없으며, 발견된 에러 메시지 노출·비원자 read-then-write 는 모두 기존에 존재하던 계약을 재사용한 것으로 이번 diff 의 신규 회귀가 아니다(RESOLUTION.md 에도 동일하게 기록·확인됨). plan/README 문서 변경은 순수 문서 갱신으로 보안 영향 없음.

## 위험도
NONE
