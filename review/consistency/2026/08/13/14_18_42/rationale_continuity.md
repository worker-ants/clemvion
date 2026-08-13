# Rationale 연속성 검토

## 대상 diff 요약 (origin/main..HEAD, 2 commits)

- `49ffd54a2` test(backend): snapshotCache 상한/방향, dispatcher log-level 분기, admission `Array.isArray` 가드에 대한 선재 테스트 공백 3건 보강
- `599212bd0` fix(engine): 위 커밋에서 도입한 `Array.isArray` 가드를 `return false`(defer)에서 `throw`(트랜잭션 롤백)로 정정 + dispatcher 테스트 하네스 통합

`spec/` 하위 파일은 이번 diff 에 **한 건도 포함되지 않았다** (`git diff origin/main --stat -- spec/` 결과 없음). 변경은 전부 `codebase/backend/src/modules/{execution-engine,executions,chat-channel}/**` 의 구현·테스트 코드이며, `review/code/2026/08/13/14_01_46/**` 코드 리뷰 산출물(이미 RESOLUTION 완료)이 동봉되어 있다.

## 발견사항

### [INFO] admission 가드의 throw 전환은 §Rationale "동시성 cap admission gate" 를 위반하지 않고 오히려 강화한다

- target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `admitExecutionOrDefer` 내부 `pg_advisory_xact_lock` 트랜잭션 블록 (line ~2919-2932)
- 관련 spec 근거: `spec/5-system/4-execution-engine.md` `## Rationale` → "동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b, 2026-07-04)" 의 "**TOCTOU 원자화**" 항목 — "카운트→비교→전이" 가 advisory lock 트랜잭션 안에서 원자적이어야 한다고 명시.
- 상세: `49ffd54a2` 는 `EntityManager.query` 가 배열이 아닌 값을 반환하는 방어 갭을 메우며 `return false`(=defer, 트랜잭션은 그대로 커밋)로 처리했다. 이는 트랜잭션 내부에서 UPDATE 가 실제로 적용됐는지 모르는 채로 커밋을 허용해, "카운트→비교→전이 원자성" Rationale 이 요구하는 반환값-DB상태 일치를 깰 수 있었다(코드 자체의 롤백 불변식 위반이지 spec 문서 Rationale 텍스트를 직접 편집한 것은 아니다). `599212bd0` 가 같은 PR 체인 안에서 `throw` 로 정정해 트랜잭션을 롤백시키므로, 최종 HEAD 상태는 spec 이 요구하는 원자성과 완전히 정합한다. 두 커밋 모두 아직 머지되지 않은 로컬 이력이라 "과거 결정을 번복"이라기보다 **같은 작업 내 자기 교정**이며, 커밋 메시지에 이유가 상세히 남아 있어 Rationale 연속성 관점에서 문제 삼을 결정 번복이 아니다.
- 제안: 조치 불요. 다만 이 `Array.isArray` 방어와 "실패 시 throw→트랜잭션 롤백" 규칙이 admission gate 의 원자성 불변식의 일부로 반복 재발할 소지가 있다면(§8 관련 리뷰가 이미 2회 이 지점을 건드림), spec Rationale "TOCTOU 원자화" 문단에 "드라이버 반환 shape 이상 시에도 트랜잭션은 반드시 롤백되어야 한다" 한 줄을 보강하는 것도 고려 가능 — 필수는 아님(구현 세부 수준의 방어 코드이지 설계 결정은 아님).

### [INFO] `SNAPSHOT_CACHE_MAX_ENTRIES` 는 spec 미문서화 상수 — 테스트 추가는 기존 동작을 그대로 고정

- target 위치: `codebase/backend/src/modules/executions/executions.service.ts` (line 60 부근, `export` 추가만)
- 관련 spec 근거: 없음 — `grep -rn "snapshotCache|SNAPSHOT_CACHE" spec/` 0건. 인접 코드 주석("인스턴스 수직 캐시이므로 멀티 인스턴스 hit ratio 는 sticky session WS 배포에서 자연스럽게 보장…")은 코드 주석 SoT 이지 spec Rationale 로 승격된 적이 없다.
- 상세: 이번 diff 는 상수 값(256)·LRU 방향·evict 정책을 전혀 바꾸지 않고 `export` 가시성만 추가해 테스트 가능하게 만들었다. `spec/5-system/4-execution-engine.md` 의 "Pre-park read-window 정규화" Rationale(`reconcilePreParkWaitingStatus`/`isNodeWaitingForInput` 양측 동기화 요구)은 이 스냅샷 캐시의 **정규화 로직**과는 다른 관심사(캐시 크기/LRU vs read-side status normalization)라 충돌하지 않는다.
- 제안: 조치 불요. Rationale 연속성 위반 없음.

### [INFO] chat-channel dispatcher 테스트는 순수 테스트 전용 diff — 대상 프로덕션 코드 미변경

- target 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts`
- 관련 spec 근거: 해당 없음 (프로덕션 로직 `isSubFilterNull` 분기는 diff 이전부터 `chat-channel.dispatcher.ts` 에 존재 — `git diff origin/main --stat -- codebase/.../chat-channel.dispatcher.ts` 결과 없음, 즉 프로덕션 파일은 이번 diff 에 포함되지 않았다).
- 상세: 새 테스트는 기존 `debug`/`warn` 로그 레벨 분기(`execution.node.completed` → debug, 그 외 → warn)를 양방향으로 고정하고, 두 describe 블록의 중복 배선을 `makeDispatcherHarness` 로 통합했을 뿐이다. 설계 결정 자체를 바꾸지 않으므로 Rationale 대상 아님.
- 제안: 조치 불요.

## 요약

이번 diff(`origin/main..HEAD`, `49ffd54a2` + `599212bd0`)는 `spec/` 문서를 전혀 건드리지 않는 테스트-보강 + 자기 교정 성격의 구현 변경으로, `spec/5-system/4-execution-engine.md` 의 "동시성 cap admission gate — TOCTOU 원자화" Rationale 이 요구하는 원자성 불변식을 위반하지 않고(오히려 defer→throw 정정으로 그 불변식을 실제로 지키게 만들었다), 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·암묵적 invariant 우회 어느 관점에서도 CRITICAL/WARNING 급 충돌을 발견하지 못했다. 유일하게 언급할 만한 지점(admission 가드의 `Array.isArray` 방어)도 같은 PR 체인 내에서 이미 정정되어 최종 상태가 spec Rationale 과 정합한다.

## 위험도

NONE
