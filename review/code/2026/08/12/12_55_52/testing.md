# 테스트(Testing) Review — 누적 델타 `origin/main...HEAD` (backend lint `no-unsafe-*` 처분, 5라운드째)

## 검증 방법

이 델타는 이미 4라운드(`11_06_12`, `12_05_39`, `12_24_14`, `12_40_58`)의 `/ai-review` testing 검토를
거쳐 WARNING 4건이 순차 발견·조치된 상태다. 직전 라운드 주장을 그대로 믿지 않고 현재 소스를
직접 열어 재확인했다:

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 전문을 Read —
  9개 테스트(W-4 provider 경로 4건 + 캐시 히트·응답 형태 방어 7건 중 신규 3건은 이전 라운드 기록과
  달리 실제로는 `it` 7개: 히트 재생·409 conflict·400 제외·409 캐너리·손상 JSON·statusCode 없음·히트
  재생 시 status 없음) 전부 실측.
  - "손상된 캐시 JSON" 테스트가 직전 라운드(`12_40_58`) testing INFO 로 지적된 대로 이번 코드에서는
    **이미 조치됨**을 확인 — `stored.bodyHash`/`stored.statusCode`/`JSON.parse(stored.responseJson)`
    까지 값 단언(`:281-283`)이 들어가 있다. 재지적하지 않음.
- `grep -n "logFn\|snapshotCache" **/*.spec.ts` 로 캐리오버 갭 2건 재확인 — 여전히 커버리지 없음.
  `plan/in-progress/backend-lint-gate-broken-on-main.md:474-482` 에 이미 정확히 등재돼 있고, 이번
  델타는 두 자리에서 **타입 단언만** 추가했을 뿐 조건·로직은 건드리지 않았다(side_effect 리뷰의
  emit md5 동일 실증과 일치) — 새 WARNING 사유 아님, 재확인만.
- `execution-engine.service.spec.ts` 의 admission-control 관련 mock(`.mockResolvedValueOnce([{ id:
  'eSQL' }])` 등, `:4493-4506` 부근)을 확인 — `m.query<{ id: string }[]>` 로 명시한 shape 과 정확히
  일치하는 형태로 mock 되어 있어 회귀 자체는 잘 잡힌다. 다만 `Array.isArray(rows)` 런타임 가드
  부재는 security 가 이미 지적했고 plan `:507-517` 에 등재된 유예 항목 — 재지적하지 않음.
- `ai-agent.schema.spec.ts` / `render-tool-provider.spec.ts` 를 확인 — 타입만 좁힌
  `presentationTools[i]`(중복 타입 검출 케이스 포함) · `fields.map`/`options.map` 루프 바디 모두
  기존 테스트가 여러 케이스로 실행 경로를 지나간다. 타입 주석 추가로 인한 신규 커버리지 공백 없음.
- `migrate-node-output-refs.spec.ts` — Pass 2 신규 테스트(`:59-66`)를 포함해 6개 정규식 pass 전부
  (`output.output`, `output.meta`, `output.config`, 단일 레벨 `output.<f>`, `meta.<f>` 레거시,
  `status ===` 리터럴, `output.error.<f>`) 개별 테스트 케이스가 존재함을 재확인.

## 발견사항

- **[INFO]** 캐리오버 커버리지 갭 2건 — 새 결함 아님, 재확인만 기록
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`(`logFn` 삼항식,
    `isSubFilterNull` 분기 — 함수명은 event 처리 private 메서드 내부, 게이트 붙은 diff 라인
    197-201 부근), `codebase/backend/src/modules/executions/executions.service.ts`
    (`snapshotCache` evict, `SNAPSHOT_CACHE_MAX_ENTRIES` 도달 분기)
  - 상세: 두 자리 모두 `.spec.ts` 에 해당 분기를 실행하는 테스트가 없다(dispatcher 는
    `execution.node.completed` 의 standalone 함수 테스트만 존재하고 `logFn` 삼항식이 실제 실행되는
    경로 없음, executions 는 `snapshotCache`/`SNAPSHOT_CACHE_MAX_ENTRIES` 문자열 매치가 spec 파일에
    0건). 이번 델타는 두 자리에서 삼항식/`.next().value` 반환값에 **타입 단언만** 추가했고 조건·
    evict 로직 자체는 손대지 않았다(side_effect 리뷰가 emit md5 동일로 실증) — 즉 이 갭은 이 델타가
    만든 것이 아니라 선재 갭이다. `plan/in-progress/backend-lint-gate-broken-on-main.md:474-482` 에
    이미 정확한 위치·제안(경계값 256회 삽입으로 evict 1건 고정)과 함께 등재돼 있다.
  - 제안: 조치 불요(이 델타 책임 범위 밖, 이미 추적 중). 향후 이 두 자리의 **로직**을 만질 때
    함께 테스트를 추가할 것.

- **[INFO]** `readKey`/`hashBody` (idempotency.interceptor.ts 하단 헬퍼)의 경계값 — `MAX_KEY_LENGTH`
  초과·공백뿐인 키 케이스가 spec 에 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 의
    `readKey`/`hashBody` 함수(이번 diff 가 손대지 않은 자리)
  - 상세: 이번 diff 범위 밖이며(두 함수는 hunk 에 나타나지 않음) 신규 결함도 아니다. 참고용으로만
    남긴다 — 강제 사유 아님.

- CRITICAL/WARNING 급 테스트 결함 없음. 4라운드에 걸쳐 처분된 WARNING 4건(`HttpResponseLike`
  미검증, README 오독, 잘못된 spec 인용 테스트명, 손상 JSON 값 미단언)이 현재 코드에 전부 정확히
  반영돼 있음을 직접 소스 대조로 재확인했다.

## Mock 적절성 · 테스트 격리 · 가독성 (참고)

- `idempotency.interceptor.spec.ts` 신규 테스트들은 `beforeEach` 공유 상태 없이 매 테스트가
  `makeRedis()`/`makeInterceptor()` 로 새 인스턴스를 만든다 — 순서 무관 독립 실행.
- `RedisStub`(`get`/`set` 만 노출)과 `responseOverride: {}` 로 "필드 없는 응답"까지 실제로 흘려
  `typeof` 방어의 실동작을 검증 — mock 이 실제 인터페이스 최소 형태와 부합, 과도한 mock 없음.
- `409 도 캐시되지 않는다` 테스트는 실패 방향을 fail-closed 로 잘못 읽지 않도록 주석에 "선재 결함·
  올바른 조건은 `=== 400` 이 아님" 을 명시해 다음 사람이 성급하게 고치는 것을 막는다 — 캐너리
  테스트의 의도를 코드만으로 오독하지 않게 하는 좋은 관행.
- `migrate-node-output-refs.spec.ts` 는 6개 pass 콜백이 동일 시그니처로 반복되는데(maintainability
  리뷰가 이미 지적), 테스트 자체는 pass 별로 분리돼 있어 어떤 pass 가 깨졌는지 실패 메시지로 바로
  식별 가능 — 가독성 문제 없음.

## 회귀 테스트 유효성

- 4라운드 전체에 걸쳐 추가된 뮤테이션 검증(캐너리 무력화 → RED, Pass 2 치환 무력화 → RED, `>= 400`
  → `=== 400` 뮤턴트 → 정확히 409 캐너리만 RED)이 실패한 테스트 이름까지 일치했다는 점(직전 라운드
  독립 재현 포함)이 판별력의 근거로 충분히 기록돼 있다. 새로 반증할 근거를 찾지 못했다.

## 요약

이 델타는 4라운드의 `/ai-review` testing 검토를 거치며 CRITICAL/WARNING 이 전부 해소된 상태이고,
이번 5라운드에서 직접 소스를 다시 열어 재확인한 결과 새로 발견할 결함이 없다.
`idempotency.interceptor.spec.ts` 는 캐시 히트·미스·conflict·손상 JSON·응답 형태 방어(있음/없음)
까지 엣지 케이스를 촘촘히 덮고 mock 격리도 양호하며, 뮤테이션으로 판별력까지 실측돼 있다.
`migrate-node-output-refs.spec.ts` 도 6개 pass 전부 개별 테스트를 갖췄다(Pass 2 갭은 이전 라운드에
메워짐). 남은 것은 이 델타가 만들지 않은 선재 커버리지 갭 2건(dispatcher `logFn`, executions
`snapshotCache` evict)뿐이며, 둘 다 plan 문서에 정확한 위치·재현 방법과 함께 이미 추적되고
있어 이번 라운드에서 새로 반복 지적할 사유가 아니다(반복 재지적은 이 저장소가 이미 겪은
"fix→리뷰 stale 루프" 패턴이므로 지양). 코드 자체(순수 타입 주석/제네릭/단언)에 대한 테스트
용이성·모듈 경계도 이번 diff 로 악화되지 않았다.

## 위험도

NONE
