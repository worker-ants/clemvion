# ai-review SUMMARY — DB 노드 in-flight cancel (node-cancellation-inflight-followups §1)

- 대상: `database-query.handler.ts`(+spec) · `node-handler.interface.ts` · spec `node-cancellation.md`·`2-database-query.md` · plan.
- 방식: 직접 Agent fan-out. Round1 = concurrency/database/requirement 3인. Round2 = concurrency fresh re-review(fixes 검증).

## Round 1 (초기 구현) — 위험도 CRITICAL

| # | reviewer | sev | 요지 |
|---|---|---|---|
| C1 | concurrency | CRITICAL | 취소가 쿼리와 **동일 capped pool(max5)** 공유 → 포화 시 순환 대기 데드락 |
| C2 | concurrency | CRITICAL | fire-and-forget 취소가 release 전 join 안 됨 → 지연 취소가 재사용 연결의 **무관 쿼리 오살(cross-kill)** |
| W3 | concurrency | WARNING | connect 대기 중 abort → no-op 취소 후 쿼리 무방비 완주 |
| W4 | requirement | WARNING | catch 의 abort 재분류가 광의(`abortSignal.aborted`) — 무관 실패도 cancelled 오분류 |
| W5 | requirement | WARNING | `§4` 인용 오류(실제 §2.1) 7곳 |
| I | database/req | INFO | KILL QUERY injection-safe 확인·code glob 누락·취소실패 무로그 |

## Round 2 (fix 검증) — 위험도 LOW

- **C1 RESOLVED** · **C2 RESOLVED** · **W3 RESOLVED** (구조적 CRITICAL 전부 해소 확인).
- 잔여 → 추가 fix: 취소-쿼리 timeout 부재(release 무한 block 가능), inner catch 광의 재분류.

## 최종 결과
BLOCK: NO. 구조적 CRITICAL 0. 검증: lint·build·unit(91, 신규 5)·e2e(243)·doc guards(253파일).
