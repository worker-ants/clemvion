# 신규 식별자 충돌 검토 — naming_collision

## 검토 대상 요약

- 검토 모드: `--impl-prep` (scope=`spec/5-system`)
- 실제 착수 대상 plan: [`plan/in-progress/e2e-race-helper.md`](../../../../../plan/in-progress/e2e-race-helper.md) — `spec_impact: none` 인 **테스트 전용 리팩터**. `codebase/backend/test/helpers/concurrency.ts` 에 `raceUnderHeldLock<T>()` 공용 헬퍼를 신설해, 아홉 e2e 파일(11 블록)에 손으로 복제된 "락 → 동시 발사 → 공허성 가드 → COMMIT" 오케스트레이션을 대체한다.
- `spec/5-system` 은 이 plan 이 spec 을 새로 쓰지 않으므로(스코프상 `1-auth.md`/`2-api-convention.md`/`3-error-handling.md` 전문 + 나머지 15개 파일은 예산 초과로 절단) target 문서 자체가 새 요구사항 ID·엔티티·endpoint·이벤트·env var·spec 파일 경로를 도입하지 않는다. 신규 식별자는 오직 plan 이 도입하려는 **테스트 헬퍼 함수/타입/파일**뿐이다.

## 점검 관점별 확인

1. **요구사항 ID 충돌** — 해당 없음. plan 이 신규 요구사항 ID를 부여하지 않는다.
2. **엔티티/타입명 충돌** — plan 이 도입하는 식별자는 `raceUnderHeldLock`(함수), 파라미터 `locker: Client` · `lock: { sql, params? }` · `fires: Array<() => Promise<T>>` 뿐이다. `grep -rn "raceUnderHeldLock" .` 결과 코드베이스에는 아직 정의가 없고(plan·review 문서에만 등장), `codebase/backend/test/helpers/*.ts` 의 기존 export(`createDbClient`/`uniqueEmail`/`uniqueName`/`RegisteredUser`/`WorkspaceRole` 등)와도 이름이 겹치지 않는다. `locker` 는 이미 아홉 e2e 파일 전부가 지역 변수명으로 써 온 이름과 **일치**하므로 오히려 통합에 유리하다(충돌 아님). `fires`/`fireDelete` 도 코드베이스 전역에 다른 의미로 쓰인 사례가 없다(`fires` 는 주석 안 자연어 "fires" 뿐).
3. **API endpoint 충돌** — 해당 없음. 이 plan 은 REST endpoint 를 추가하지 않는다.
4. **이벤트/메시지명 충돌** — 해당 없음. webhook·queue·SSE 이벤트를 도입하지 않는다.
5. **환경변수·설정키 충돌** — 해당 없음. 신규 ENV/config key 없음.
6. **파일 경로 충돌** — 신규 파일 `codebase/backend/test/helpers/concurrency.ts` 는 아직 존재하지 않으며(`find codebase/backend -iname "concurrency*"` 0건), 기존 `test/helpers/` 명명 컨벤션(접두어 없는 `auth.ts`/`db.ts`/`webauthn.ts` 과 접두어 있는 `e2e-client-ip.ts`/`e2e-chat-channel-fixture.ts` 이 혼재)과 비교하면 접두어 없는 쪽 다수 패턴을 따른다 — 컨벤션을 깨지 않는다. `spec/5-system/*.md` 파일 경로 자체는 이 plan 으로 신설·변경되지 않는다.

## 선행 리뷰와의 정합성

같은 저장소의 이전 세션 산출물 `review/consistency/2026/09/21/17_39_06/naming_collision.md` 은 `raceUnderHeldLock()` 을 "결정 1 — 별도 PR 에서 추출, 코드베이스 전체 grep 0건(미도입 확정)" 으로 기록하고 "별도 PR 착수 시 재검토 필요(그 PR 의 naming-collision 몫)" 이라 명시했다. 이번 검토가 바로 그 후속 PR 이며, 재실측한 grep 결과도 동일하게 0건(미도입) — 이번 착수로 새로 충돌이 생기지 않음을 재확인했다.

## 발견사항

없음 — CRITICAL/WARNING/INFO 모두 해당 사항 없음.

## 요약

이번 target(`spec/5-system` 스코프)에서 실제로 구현 대상인 plan(`e2e-race-helper.md`)은 `spec_impact: none` 의 순수 테스트 전용 리팩터이며, 도입하는 유일한 신규 식별자는 `codebase/backend/test/helpers/concurrency.ts` 의 `raceUnderHeldLock<T>()` 함수와 그 파라미터(`locker`/`lock`/`fires`)다. 코드베이스 전수 grep 결과 이 이름들은 현재 미정의 상태이고 기존 `test/helpers/*.ts` export·아홉 e2e 파일의 지역 변수명과도 의미가 일치하거나 충돌하지 않는다. spec 차원(요구사항 ID·엔티티·API endpoint·이벤트·ENV·spec 파일 경로)의 신규 식별자는 이 plan 이 전혀 도입하지 않으므로 여섯 관점 모두 충돌 소지가 없다.

## 위험도

NONE
