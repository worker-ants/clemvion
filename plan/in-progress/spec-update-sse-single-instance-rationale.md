---
worktree: trigger-schedule-sync-f88604
started: 2026-06-10
owner: resolution-applier
---
# Spec Update Draft — SSE single-instance 제약 Rationale 명시

## 분류
SPEC-DRIFT (코드 현행 동작을 spec Rationale 에 명시)

## 원본 발견사항
SUMMARY Warning #6: `spec/data-flow/15-external-interaction.md §1.3` 의 Rationale 에 SSE `SseAdapter.buffers` 가 in-memory single-instance 한정인 이유와 분산 전환 계획이 없음. 다중 인스턴스 배포 시 타 인스턴스 이벤트 미수신 — 운영자 인지 필요.

## 제안 변경
`spec/data-flow/15-external-interaction.md` Rationale 섹션에 다음 내용 추가:

```markdown
### SSE 버퍼 single-instance 한정 이유와 이관 방향

`SseAdapter.buffers` 는 v1 에서 단일 프로세스 in-memory ring buffer 다. 이유:

- **지연 vs 신뢰성 트레이드오프**: execution 이벤트는 웹소켓/SSE 스트림의 실시간성이 중요하고,
  Redis Pub/Sub 경유 시 직렬화·네트워크 홉이 추가된다.
- **단일 엔트리포인트 가정**: v1 배포는 단일 인스턴스 또는 sticky-session 로드밸런서를 전제로
  설계되어, 특정 인스턴스 연결 SSE 클라이언트는 그 인스턴스가 발사한 이벤트만 수신하면 충분하다.

**다중 인스턴스 환경에서의 잔여 위험**: 로드밸런서가 sticky-session 을 보장하지 않으면
클라이언트가 연결된 인스턴스와 execution 이벤트를 발사하는 인스턴스가 달라 이벤트 미수신이 발생한다.

**이관 방향**: 수평 확장 시 `SseAdapter` 를 Redis Pub/Sub 기반 fan-out 으로 교체한다 —
`sse-adapter.service.ts` 주석에 TODO 로 기록. 해당 단계에서 `plan/in-progress/` 에 별도 plan 등록.
```
