# Code Review 통합 보고서 (6R — 5R 조치 검증)

## 전체 위험도

**LOW** — **Critical 0** (4라운드 연속). 5R 의 W25(`markNodeCancelled` 추출)는 **해소 확인**됐고, side_effect 가 추출 전후 WS payload 의 **키 집합·키 순서·객체 참조 동일성**까지 필드 단위로 대조해 동작 보존을 확인했다. 7명 중 **3명이 위험도 NONE**. 잔여는 WARNING 2건이며 **둘 다 결함이 아니라 배치·커버리지 문제**다.

## 5R 항목 검증 결과 — 해소

| 항목 | 결과 | 근거 |
|---|---|---|
| **W25** 취소 종결 20여 줄 중복 | **해소** | `markNodeCancelled` 추출. maintainability 가 "재발 여지 없이 해소, W12 선례와 형태·책임 분리·네이밍 모두 적정" 판정. scope 가 1파일·2 hunk·신규 import 0 으로 동작 보존 리팩터에 국한됨 확인 |
| (추출의 계약 보존) | **확인** | requirement — `isAbortError` 경로의 §5.1 `output.error` 봉투 유지, 취소 경로의 §5.1 `cancelled` 분류 유지. side_effect — 필드 대입 순서·`await` 지점·`throw` 도달 시점·`finally` 의 `unregisterInFlight` 실행 시점 전부 불변 |
| (내부 message 비노출) | **확인** | security — 헬퍼 호출부가 코드베이스 전체에서 2곳뿐임을 grep 으로 확인, `errorEnvelope` 미전달 시 `nodeExecution.error` 미대입 + payload 조건부 spread 로 키 자체 미생성. **신규 결함 없음, 위험도 NONE** |
| (5번째 인용 재발 여부) | **없음** | documentation 이 헬퍼 JSDoc 의 세 주장("차이는 errorEnvelope 유무" / "throw 는 호출부 책임" / "W12 선례와 동일")을 코드로 각각 대조 — 전부 사실 확인 |

## Critical 발견사항

**없음.**

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 조치 |
|---|----------|----------|------|
| W26 | maintainability · requirement · documentation (**3명 수렴**) | **헬퍼 삽입 위치가 이웃 JSDoc 을 고아로 만들었다.** 신규 `markNodeCancelled`(JSDoc+본문)를 기존 `finalizeCancelledExecution` 의 JSDoc **과 그 함수 선언 사이**에 끼워 넣어, 두 `/** */` 블록이 빈 줄 없이 연속되고 `finalizeCancelledExecution` 은 자기 문서와 47줄 떨어졌다. IDE hover·TypeDoc 은 선언에 가장 가까운 리딩 코멘트를 채택하므로 W12 문서가 사실상 유실된다. 런타임 무영향 | **조치함** — `markNodeCancelled` 블록을 `finalizeCancelledExecution` JSDoc **앞**으로 이동해 두 JSDoc 이 각자 자기 함수와 다시 인접하게 했다 |
| W27 | testing | **헬퍼의 존재 이유인 불변식이 구조적으로 검증되지 않았다.** "`errorEnvelope` 부재 시 `error` 키/필드가 생기지 않는다"(W15/W19 의 executionId 유출 방지)를 겨냥한 단언이 없어, 실측 mutation 에서 DB 필드·WS payload 양쪽에 **임의의 leaked `error` 를 강제 주입해도 4개 회귀 테스트가 전부 GREEN** 이었다. 추출 후에는 이 단일 지점이 두 호출부의 유일한 방어선이라 결속이 더 중요해졌다 | **조치함** — `expect(ne?.error).toBeUndefined()` + `expect(cancelCall?.[3]).not.toHaveProperty('error')` 추가. mutation: leak 주입 시 `Received: {"code":"X","message":"leak"}` **RED** |

## 참고 (INFO)

- **harness diff-list 갭** — 6R 에서도 프롬프트 파일 목록에 실제 소스가 없었다(**6명 지적**, 5R 에 이어 반복). 오케스트레이터가 매 reviewer 에게 "소스를 직접 열어라" 고 지시해 실질 검증은 수행됐다. 이미 harness 백로그로 분리됨.
- `save()` 호출 자체의 생략을 기존 테스트가 감지 못한다 — mock `save` 가 인자를 **참조로** 기록하는데 `createNodeExecution` 이 만든 동일 객체가 제자리 변형되기 때문(pre-existing 테스트-더블 성질, 이번 diff 원인 아님).
- `finishedAt = startedAt`(durationMs=0) 뮤테이션은 GREEN — 값 미검증, 저위험.
- 회귀 테스트가 헬퍼 **이름에 결속돼 있지 않음**(spec 파일에 `markNodeCancelled` 0건, 전부 `service.execute()` 공개 API 경유) — 좋은 신호.
- `errorEnvelope` 익명 인라인 타입이 2곳 등장 — 3번째 사용처가 생기면 `NodeErrorEnvelope` 승격 검토.
- 헬퍼 파라미터 순서가 5R 제안 초안과 다름 — 초안은 구속력 없고 두 호출부가 일관되므로 조치 불요.
- W15/AbortError/retry 테스트가 `describe('error port routing (§3.2)')` 블록 안에 위치 — pre-existing 조직 문제.
- CHANGELOG·plan 미갱신은 결함 아님 — 동형 선례 W12(`finalizeCancelledExecution` 추출)도 순수 리팩터라 기록 대상이 아니었다(documentation 확인).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 |
|---|---|---|
| security | **NONE** | 호출부 2곳 전수 확인, 노출 차단 유지. 신규 결함 없음 |
| side_effect | **NONE** | payload 키 집합·순서·**객체 참조 동일성**까지 보존 확인. `throw` 호출부 잔류가 `unregisterInFlight` 시점에 무영향 |
| scope | **NONE** | 1파일·2 hunk·신규 import 0. 백로그 5개 항목이 여전히 코드 무변경임을 `git log` 로 재대조 |
| requirement | LOW | 계약 보존 확인. W26 수렴 |
| maintainability | LOW | W25 해소 판정. W26 제기 |
| documentation | LOW | 5번째 인용 재발 없음 확인. W26 수렴 |
| testing | LOW | 헬퍼 결속 mutation 4건 RED 확인. W27 제기 |

## 권장 조치사항

1. **W26** — JSDoc 고아 해소(블록 이동). **완료**.
2. **W27** — `error` 키 부재 불변식 단언 추가. **완료**(mutation RED 확인).
3. (백로그) harness diff-list 갭 — 6R 까지 반복 관측.

## 라우터 결정

- **실행 7명**: security, requirement, scope, side_effect, maintainability, testing, documentation (강제 7명 전원)
- **제외 7명**: architecture · performance · dependency · database · concurrency · api_contract · user_guide_sync — 동작 보존 추출이라 해당 표면 무변화
