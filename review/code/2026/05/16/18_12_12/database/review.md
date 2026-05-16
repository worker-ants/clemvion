### 발견사항

- **[INFO]** 트랜잭션 미적용 설계의 명시적 문서화
  - 위치: `backend/src/modules/integrations/integrations.service.ts` L529–540
  - 상세: `create()` 메서드에서 `integrationRepository.save()`와 `auditLogsService.record()` 호출을 트랜잭션으로 묶지 않은 이유가 코드 주석으로 충분히 서술되어 있다. (1) `save()` 단일 INSERT는 자체 atomic, (2) audit은 best-effort 정책, (3) preview_token은 사전 원자 소비 완료. 이 설계는 타당하며 현재 요구사항(audit 누락은 허용, row 생성 실패 시 audit 미기록)에 부합한다.
  - 제안: 향후 audit log 외의 부작용(예: 외부 webhook 발송, 포인트 차감 등)이 추가되면 트랜잭션 재검토가 필요하다는 주석이 이미 포함되어 있어 적절하다. 현 상태 유지.

- **[INFO]** audit 실패 시 이중 방어선 구조
  - 위치: `backend/src/modules/integrations/integrations.service.ts` L548–146
  - 상세: `auditLogsService.record()` 호출을 별도 `try/catch`로 감싸 audit 실패가 HTTP 500으로 노출되지 않도록 처리했다. `AuditLogsService.record` 내부에도 swallow 로직이 있다는 언급과 함께, 향후 내부 구현이 변경되어도 회귀를 방지하는 방어적 코딩이다. 이는 best-effort audit 정책의 올바른 구현이다.
  - 제안: 현재 구조 유지. `logger.warn`으로 audit 실패를 기록하고 있어 운영 모니터링도 가능하다.

- **[INFO]** 회귀 안전망 테스트 추가
  - 위치: `backend/src/modules/integrations/integrations.service.spec.ts` L53–84
  - 상세: audit log 실패 시 integration row가 정상 반환되어야 함을 검증하는 테스트가 추가되었다. `auditLogsService.record`를 `mockRejectedValueOnce`로 실패시킨 뒤 결과가 `Error` 인스턴스가 아니고 `.name` 필드가 올바른지 확인한다. 향후 audit 구현이 변경될 때 DB 정합성 회귀를 조기에 감지할 수 있다.
  - 제안: 현재 테스트 설계 적절. DB 트랜잭션 롤백 없이 row가 commit된 상태임을 가정하는 테스트이므로, mock의 `save()` 동작도 성공으로 설정되어 있어 시나리오가 명확하다.

### 요약

이번 변경은 `integrations.service.ts`의 `create()` 메서드에서 audit log 기록 실패가 HTTP 500으로 노출되는 문제를 방지하기 위해 별도 `try/catch` 방어선을 추가하고, 이에 대한 회귀 테스트를 추가한 것이다. 데이터베이스 관점에서 핵심 쟁점인 트랜잭션 미적용 설계는 (1) 단일 INSERT의 자체 원자성, (2) best-effort audit 정책, (3) preview_token의 사전 원자 소비라는 세 근거로 정당화되어 있으며 현재 요구사항에 부합한다. 프론트엔드 테스트 파일(`cafe24-precheck.test.tsx`)은 순수 UI/타이밍 관련 변경으로 데이터베이스와 무관하다. 발견된 이슈는 모두 설계 의도를 이해한 상태에서의 참고 사항(INFO) 수준이며, CRITICAL 또는 WARNING 등급의 데이터베이스 문제는 없다.

### 위험도

NONE
