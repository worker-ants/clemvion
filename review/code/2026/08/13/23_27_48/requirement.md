# 요구사항(Requirement) 리뷰 결과

## 검토 방법

`updateReturningRows` 헬퍼(신규) 자체와, 그 헬퍼로 교체된 8개 소비 지점
(`auth-oauth.service.ts` 1곳, `execution-engine.service.ts` 2곳,
`knowledge-base.service.ts` 5곳)을 실제 소스에서 직접 열어 대조했다. 프롬프트가 잘라낸
파일(6/8/9번)도 `Read`/`Grep` 으로 전문을 확인했다. 정적 대조에 그치지 않고:

- 대상 spec 테스트(`update-returning-rows.spec.ts`, `assert-row-array.spec.ts`,
  `auth-oauth.service.spec.ts`, `execution-engine.service.spec.ts`,
  `knowledge-base.service.spec.ts`)를 **직접 실행** — 전부 GREEN (35/448/57 등).
- `scripts/check-backend-typecheck-ratchet.py` 실행 — `OK: 199건/38파일, baseline 과 일치`
  (plan/RESOLUTION 이 주장하는 수치와 실측이 일치).
- `eslint --max-warnings 0` (대상 7개 파일) — 경고 0.
- `assert-row-array.spec.ts`/`update-returning-rows.spec.ts` 의 구조적 가드가 고정한
  개수(`queries:3/guards:1`, helper 호출 `[2,5,1]`, 소비 지점 `[3,10,0]`)를 각각
  `grep -oP` 로 재현해 실제 소스와 일치함을 확인.

## 발견사항

없음 — CRITICAL/WARNING 급 요구사항 결함을 찾지 못했다. 근거:

- **기능 완전성**: plan(`update-returning-tuple-shape.md`)이 규정한 8개 소비 지점
  (execution-engine 2 + knowledge-base 5 + auth-oauth 1) 전부 `updateReturningRows()` 로
  교체돼 있고, 각 지점의 판정 로직(`admitted`, `persisted`, CAS 락 거절, 빈 KB idle 복귀,
  재큐 documentId 언랩)을 코드에서 직접 확인했다 — 튜플 오인으로 죽어 있던 분기가 전부
  살아난다.
- **엣지 케이스**: `updateReturningRows` 는 (a) 배열 아님 → throw, (b) 튜플(`result[0]`
  이 배열) → `result[0]`, (c) 빈 튜플(`[[],0]`) → `[]`, (d) 행 배열 직접(빈 배열 포함) →
  그대로, 네 갈래를 전부 테스트가 고정한다. Postgres RETURNING 행은 항상 평범한 객체라
  "행 자체가 배열"인 오판 경로는 없다 — 이 전제는 이전 라운드(`22_45_24/concurrency.md`)
  가 이미 검증했고 이번 라운드에도 반증되지 않았다.
- **TODO/FIXME**: 대상 신규/수정 파일 전수에서 TODO/FIXME/HACK/XXX 없음.
- **의도와 구현 간 괴리**: `execution-engine.service.ts` 안에 남아 있던 옛 모순 주석
  ("`RETURNING id` 이므로 실제 shape 은 행 배열이다")은 `20_36_35` CRITICAL 2 로 지적된
  뒤 삭제·통합돼 현재 파일에는 없다(2916~2919행 주석만 남아 있고 실제로 그렇게
  기술돼 있음을 확인).
- **에러 시나리오**: admission UPDATE 는 shape 이 어긋나면 트랜잭션을 롤백하도록
  throw 를 유지(부분 적용 방지), `updateExecutionStatus` 는 앱 트랜잭션 밖이라 롤백은
  못 하지만 "관측 불가능한 유실"을 예외로 표면화한다 — 두 갈래의 실패 처리 전략 차이가
  주석에 근거와 함께 명시돼 있고 실제 코드와 일치한다.
- **데이터 유효성**: `detail` 파라미터가 선택(`?`)이 아니라 필수로 승격돼 있고
  (`update-returning-rows.ts:44`), 실제 8개 호출부 전부 문맥 문자열을 채운다 — 이전
  라운드(`22_45_24`)가 지적한 "KB 5곳 detail 누락"은 이번 diff 시점 소스에서는 이미
  해소돼 있다.
- **비즈니스 로직**: KB CAS 락(재추출/재임베딩)·admission cap·종결 이벤트 emit
  가드·빈 KB idle 복귀 — 5개 규칙 모두 spec 문서(아래 참조)가 이미 규정한 대로 코드가
  동작하게 된다. `knowledge-base.service.spec.ts` 는 개수뿐 아니라 큐에 실리는
  `documentId` 값까지 단언해 "언랩이 깨지면 `undefined` 가 실린다"는 실제 회귀 형태를
  판별할 수 있다.
- **반환값**: `updateReturningRows`(3갈래 전부 반환/throw), `handleCallback`,
  `admitExecutionOrDefer`(트랜잭션 콜백), `updateExecutionStatus`, KB 5개 함수 — 모든
  경로에서 값을 반환하거나 명시적으로 throw 하며, 값 없이 falls-through 하는 경로 없음.
- **spec fidelity**: 대상 코드 영역은 `spec/5-system/4-execution-engine.md`(§8 admission
  gate·§7.5 케이스 분리), `spec/5-system/8-embedding-pipeline.md`(§7.3 CAS 락, 빈 KB idle
  복귀), `spec/5-system/10-graph-rag.md`(재추출 CAS 락), `spec/data-flow/2-auth.md`(OAuth
  state 소비)가 규정한다. 이번 diff 는 spec 문서를 전혀 바꾸지 않으며, 코드 변경이 새
  계약을 만드는 것이 아니라 **이미 문서화된 계약을 어기고 있던 코드를 계약대로
  되돌리는 방향**이다(consistency `20_36_36/cross_spec.md` 가 4개 문서·행 단위로 이미
  대조했고, 이번 재확인에서도 반례를 찾지 못했다). `spec_impact: none` 은 타당하다.

## 참고 (비-결함, 회색지대 INFO)

- **[INFO]** `plan/in-progress/retry-turn-terminal-guard.md` 에 이번 diff 로 추가된
  "소급 재검증" 체크리스트 항목(`persisted=false` 분기를 mock 경계 밖에서 재검증)이
  아직 미완료(`- [ ]`)로 남아 있다.
  - 위치: `plan/in-progress/retry-turn-terminal-guard.md` (`## 소급 재검증 (2026-08-13
    등재)` 섹션)
  - 상세: 이는 이번 diff 의 코드 결함이 아니라, 이번 diff 가 고친 `persisted` 값에
    의존해 온 **다른 plan**(`retry-turn-terminal-guard.md`)의 과거 라운드 검증이
    mock-경계 안쪽에 갇혀 있었다는 사실을 투명하게 자기-등재한 것이다. 문서 자체가
    "`plan/complete/` 이동 전 필수"라고 명시해 은폐 위험이 없다. `developer` 권한 범위
    (`plan/**` 쓰기) 안의 정상적인 소급 정정이다.
  - 제안: 조치 불요(이번 PR 스코프 아님) — 다음 세션에서 `retry-turn.service.spec.ts:101`
    의 boundary mock 을 `false` 로도 세워 양방향 검증을 이어가면 된다.
- **[INFO]** `spec/conventions/node-cancellation.md:198` §2.4 행의 "mutation 13/13 검증"
  서술이 이번 결함의 mock-경계 함의를 아직 반영하지 않는다.
  - 위치: `spec/conventions/node-cancellation.md:198`
  - 상세: 이 diff 의 대상 파일(files 1-9)에는 포함되지 않는 spec 문서이지만,
    `retry-turn-terminal-guard.md` 소급 배너가 이 각주를 직접 지목한다. `developer` 는
    `spec/` 쓰기 권한이 없어 이번 PR 로 정정할 수 없고, plan 문서에 "각주 갱신은 planner
    위임 항목에 등재돼 있다"고 이미 기록돼 있다 — 방치가 아니라 권한 밖 위임이다.
  - 제안: `project-planner` 가 위 소급 재검증 완료 후 이 각주를 갱신. 본 reviewer 는
    spec 직접 수정 대상이 아니므로 처분 요구 아님.

## 요약

`updateReturningRows()` 헬퍼와 8개 소비 지점 교체는 plan 이 규정한 범위와 정확히
일치하며, 실제 실행(35/448/57 스펙 GREEN)·typecheck ratchet(199/38 baseline 일치)·
lint(0 warning)·구조적 회귀 가드 개수(grep 재현 일치)를 직접 재현해 문서상 주장과
실측이 어긋나지 않음을 확인했다. 네 갈래 shape(비배열/튜플/빈 튜플/행 배열 직접) 모두
테스트가 값 단위로 고정하고, 8개 호출부 모두 필수 `detail` 컨텍스트를 채운다. 코드
변경은 이미 4개 spec 문서(`4-execution-engine.md` §8/§7.5, `8-embedding-pipeline.md`
§7.3+빈 KB idle 복귀, `10-graph-rag.md`, `data-flow/2-auth.md`)가 규정한 계약을 어기고
있던 것을 계약대로 되돌리는 방향이라 spec fidelity 위반이 없다. 유일한 잔여 사항은
이번 diff 범위 밖의 다른 plan(`retry-turn-terminal-guard.md`)이 스스로 등재한, 이미
투명하게 문서화된 후속 검증 항목뿐이며 은폐되거나 누락된 요구사항은 없다.

## 위험도

NONE
