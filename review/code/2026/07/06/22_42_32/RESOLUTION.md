# RESOLUTION — 엔진 버그수정 재리뷰 (22_42_32)

commit 656fc7cce (execution_failed 미발사 2건 수정) 재리뷰. Critical 0, WARNING 5(+security 재실행 WARNING 1).

## 조치 항목

| # | 카테고리 | 내용 | 조치 | commit |
| --- | --- | --- | --- | --- |
| 1 | testing | `getNotificationsService()` 4분기(주입/지연해석/throw/캐시) unit 미커버 | `execution-engine.service.spec.ts` 에 `describe('getNotificationsService — ModuleRef 지연 해석')` 4 케이스 추가 | (본 커밋) |
| 2 | testing | `finalizeResumedExecutionOutcome` 신규 dispatch 가 unit 통짜 mock 으로 미실행 | **e2e 가 회귀 가드** — `execution-failed-notification.e2e-spec.ts` test1 이 재개 세그먼트 발사를 blackbox 검증(dispatch 라인 삭제 시 test1 실패). unit 은 메서드 자체를 스텁하므로 wiring 은 e2e 계층이 담당(적정 분담). RESOLUTION 에 명시 | — |
| 3 | testing | `select:false` REST 미노출 e2e 미검증 | `background-monitoring.e2e-spec.ts` 에 `GET /notifications` 응답의 `background_failed` 알림이 `backgroundRunId` 미보유 + `resourceId=workflowId` 단언 추가 | (본 커밋) |
| 4 | architecture | DI 순환 인스턴스화 순서 부채(신규 @Optional 동일 함정) | `notif-hardening-followups.md` §후속 에 아키텍처 부채로 기록 | (본 커밋) |
| 5 | maintainability | 초기/재개 세그먼트 FAILED 종결 중복(버그 A 재발 패턴) | 동 §후속 에 `finalizeFailedExecution` 헬퍼 추출 리팩터링 followup 등록 | (본 커밋) |
| security WARNING | security | `execution_failed` 알림 메시지가 원본 예외 메시지를 새니타이징 없이 인앱+이메일(외부 SMTP) 노출 — 버그 수정으로 경로가 새로 살아나며 실질 위험화 | `sanitizeErrorMessage` 를 `execution-engine/sanitize-error-message.ts` 공용 util 로 추출(스택트레이스/연결문자열 redact·500자 캡). processor(기존 로컬 함수 대체) + `dispatchExecutionFailedNotification` 양 경로가 공유 적용 | (본 커밋) |

## INFO (조치 불요, 확인)
- requirement NONE / concurrency NONE(단일스레드 캐시·상호배타 종결경로 → 이중발사 없음) / side_effect LOW.
- 재실행 reviewer 6종: security LOW(위 WARNING) / performance NONE / scope NONE / documentation LOW / api_contract 0 / user_guide_sync 0. 14 reviewer 전원 Critical 0.

## TEST 결과
- lint / unit / build: 통과 (신규 getNotificationsService unit 4건 + sanitizer refactor 포함).
- e2e: 통과 — 전체 재수행. `execution-failed-notification` 2/2, `background-monitoring`(select:false 단언 포함) pass.

## 보류·후속
- §후속 아키텍처 부채(DI 순환) · FAILED 종결 헬퍼 추출은 별도 리팩터링 트랙(기능 무해).
- spec 반영: SPEC-DRIFT reverse-flow 로 이번 PR 에서 spec 동기화 완료(§2.1/§1.1/§2.19/Rationale/12-background §8.2), `/consistency-check --spec`·`--impl-done` 재검증.
