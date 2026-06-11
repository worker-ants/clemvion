# 성능(Performance) 리뷰 결과

## 발견사항

### **[INFO]** `auth-configs.service.ts` — 감사 로그 기록이 주 트랜잭션 완료 후 직렬(await) 호출
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L139-148, L161-170, L193-202, L213-221
- 상세: `create`, `update`, `regenerate`, `remove` 각각에서 DB 저장/삭제 완료 후 `await this.auditLogsService.record(...)` 를 순차적으로 호출한다. `record()` 내부는 별도 `auditLogRepository.save()` 를 수행한다 — 즉 각 CRUD 작업당 DB 왕복이 2회(본 저장 + 감사 저장) 직렬로 발생한다.
  - 단, 감사 로그는 best-effort(실패 시 swallow) 이므로 `void this.auditLogsService.record(...)` 로 fire-and-forget 처리하면 응답 지연을 줄일 수 있다. `verifyWebhookRequest` 내 `last_used_at` 갱신이 이미 이 패턴을 사용하고 있다(L309-311).
- 제안: 감사 기록을 응답 크리티컬 패스에서 분리하려면 `void this.auditLogsService.record(...).catch(() => undefined)` 패턴으로 변경. 단, 이 결정은 "감사 기록 실패를 클라이언트에 노출하지 않는다" 는 현행 계약과 동일하므로 기능적 의미 변화는 없다. 현재 `await` 방식도 `record()` 자체가 오류를 삼키므로 크리티컬 버그는 아니나, 고빈도 CRUD 엔드포인트에서는 latency에 직접 영향을 준다.

---

### **[INFO]** `auth-configs.service.ts` — `getUsage` 내 분리된 2회 쿼리 (N개 트리거 목록 + COUNT + recentExecutions)
- 위치: L477-501
- 상세: 구현 흐름은 (1) `findById` → (2) `triggerRepository.find({ where: { authConfigId: id } })` → (3) `executionRepository.createQueryBuilder.getCount()` → (4) `executionRepository.createQueryBuilder.getMany()` 순서로 최소 4회 DB 왕복이 발생한다. triggerIds 가 0개이면 조기 반환하지만, 트리거가 1개 이상이면 COUNT와 getMany 를 별도 쿼리로 실행한다.
  - COUNT와 최근 20건 조회를 서브쿼리 또는 단일 쿼리로 통합하거나, 최소한 `Promise.all([countQuery, recentQuery])` 로 병렬화하면 왕복 수를 줄일 수 있다.
- 제안: `totalCalls` 와 `recentExecutions` 는 독립적이므로 `Promise.all` 병렬 실행 권장. 트리거 조회와의 직렬 의존은 불가피하나, 이후 두 쿼리는 병렬화 가능.

---

### **[INFO]** `auth-configs.service.ts` — `constantTimeEquals` 에서 매 호출마다 Buffer 할당
- 위치: L439-443
- 상세: `Buffer.from(a)` 와 `Buffer.from(b)` 가 호출마다 새 Buffer 를 할당한다. 웹훅 인증 요청이 고빈도로 들어오는 경우 GC 압력이 미미하게 증가할 수 있다. 그러나 이 함수가 보안상 타이밍 안전 비교를 위한 필수 구조이므로, 이 패턴 자체를 대체할 실용적 방법은 없다. 현재 구현은 올바르다.
- 제안: 문제 없음. 참고 사항으로만 기록.

---

### **[INFO]** `audit-action.const.ts` — 상수 객체 추가: 런타임 성능 영향 없음
- 위치: L45-48
- 상세: `as const` 객체에 4개 문자열 상수를 추가한 변경이다. 모듈 초기화 시점에 한 번 평가되며 이후 불변이다. 메모리/CPU 영향은 무시 가능하다.
- 제안: 문제 없음.

---

## 요약

이번 변경은 AuthConfig CRUD 4개 핸들러에 감사 로그 기록 기능을 추가한 작업이다. 성능 관점에서 가장 주목할 점은 주 DB 작업 완료 후 감사 로그 기록을 `await` 로 직렬화한 것으로, 응답 레이턴시에 추가 DB 왕복 비용이 더해진다. 이미 `record()` 가 실패를 내부에서 삼키도록 설계돼 있으므로 `void` fire-and-forget 패턴으로 전환해도 기능적 계약에 변화가 없으며 응답 지연을 줄일 수 있다. `getUsage` 에서 COUNT와 최근 20건 조회를 `Promise.all` 로 병렬화하면 추가 왕복 1회를 절약할 수 있다. 두 항목 모두 즉각적 기능 결함은 아니며 고빈도 트래픽 하에서 점진적으로 개선할 수 있는 수준이다.

## 위험도

LOW
