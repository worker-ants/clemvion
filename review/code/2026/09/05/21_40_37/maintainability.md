# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 같은 사실을 설명하는 주석 블록이 한 테스트 안에서 거의 그대로 두 번 반복된다 (편집 잔여물로 보인다).
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:177-187` (`it('C-3. ...')` 본문 시작 부분).
  - 상세: 177~179행 `"종전 create()/update() 는 saved.trigger 대입이 if (isActive) 안에 있어, 비활성 경로에서만 트리거 행은 존재하는데 응답에서 키가 사라졌다 (review/code/2026/09/05/20_45_37 W1·W2). 두 자리를 각각 고정한다."` 와, 6줄 뒤 185~187행 `"종전 create() 는 saved.trigger 대입이 if (isActive) 안에 있어, 비활성으로 만들면 트리거 행은 생겼는데 응답에서만 키가 사라졌다. update() 도 같은 형태였다 (review/code/2026/09/05/20_45_37 W1·W2). 두 자리를 각각 고정한다."` 는 표현만 다를 뿐 정확히 같은 사실(같은 review 포인터까지 동일)을 서술한다. 그 사이 181~182행에 `"별도 it() 인 이유"` 설명이 끼어 있어, 앞뒤로 같은 내용이 반복 서술되는 모양이 됐다 — 아마 comment 를 다시 쓰면서 원본을 지우지 않은 편집 잔여물로 보인다. 기능에는 영향이 없지만, 이후 이 테스트를 손보는 사람이 두 블록 중 하나만 갱신하면 서로 어긋난 설명이 남는다.
  - 제안: 177-179행과 185-187행 중 하나를 지운다. "별도 it() 인 이유" 설명(181-182행)은 남기고, 배경 설명은 한 번만 서술하도록 정리.

- **[WARNING]** JSDoc 블록이 그 사이에 새로 삽입된 대형 코드 블록 때문에 원래 대상 선언에서 100줄 넘게 멀어졌다 — 이 PR 이 이미 두 차례(`triggers.service.ts`, `response-contract.ts`) 겪고 고친 것과 **같은 패턴**이 세 번째로 다른 파일에서 새로 발생했다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:346-354`(`numeric` 컬럼을 설명하는 JSDoc) 및 `:355-369`(§5.4 금지 조합 래칫을 설명하는 JSDoc), 그 사이에 낀 `:370`(`양성 대조군 fixture` 한 줄 주석) — 원래 346-354행 JSDoc 의 대상이었던 `describe('numeric 컬럼을 number 로 문서화한 응답 DTO', ...)` 는 `:517` 에 있다.
  - 상세: diff 를 보면 원래 `346-354`의 JSDoc(`numeric`/`decimal` 컬럼을 `number` 로 잘못 문서화하는 자리를 설명)은 바로 아래 `describe('numeric 컬럼을...')` 블록 위에 붙어 있었다. 이번 변경이 그 사이에 §5.4 금지 조합 래칫을 설명하는 새 JSDoc(355-369, 15줄) + 한 줄 주석(370) + `RATCHET_FIXTURE` 상수 + `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열(78건) + `describe(...)` 테스트 블록(약 90줄, `:460-513`)을 통째로 끼워 넣으면서, 원래 JSDoc 을 그 대상과 함께 옮기지 않았다. 그 결과 (1) `numeric` 컬럼 JSDoc(346-354)은 지금 자신과 무관한 §5.4 래칫 JSDoc 바로 앞에 위치해 실제 대상(517행)과 163줄 떨어졌고, (2) §5.4 래칫을 설명하는 JSDoc(355-369) 자신도 바로 다음 줄(370)에 끼어든 별개의 한 줄 주석 때문에, TSDoc/TypeDoc 관례상 `RATCHET_FIXTURE` 상수(371행, 래칫 전체를 설명하는 내용과 맞지 않는 대상)에 귀속되고 정작 그 설명이 진짜 어울리는 `describe('§5.4 금지 조합 래칫...', ...)' (460행) 에는 닿지 않는다. 이 정확히 같은 형태의 결함이 이번 스윕 도중 `triggers.service.ts`(TRIGGER_RESPONSE_STRIP_COLUMNS JSDoc 분리)와 `response-contract.ts`(contractForDto JSDoc 분리)에서 각각 지적되어 고쳐졌고, `review/code/2026/09/05/20_45_37/documentation.md` 는 "같은 패턴이 다음 라운드에도 재발할 여지가 있다"고 명시적으로 예견했는데, 그 예견대로 이 파일에서 반복됐다.
  - 제안: 346-354행 JSDoc 을 517행 `describe('numeric 컬럼을...')` 바로 위로 옮긴다. 355-369행 JSDoc 은 370행 한 줄 주석과 순서를 바꾸거나(짧은 주석을 먼저, 큰 JSDoc 을 `describe` 블록 바로 위로) `describe('§5.4 금지 조합 래칫...', ...)' (460행) 바로 위로 옮긴다.

- **[INFO]** (이월, 3라운드 연속 미조치) `SchedulesController.toResponse()` 의 지역 변수명이 파일의 다른 코드와 비교해 유독 축약돼 있다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:68` (`const t = schedule.trigger;`), 사용처 `:71-77`.
  - 상세: 이전 세 라운드(`18_23_02`, `19_08_18`, `20_45_37`)에서 동일하게 지적되고 매번 "조치 불요(이월)"로 유예된 항목이다. 이 메서드는 PR 의 핵심 보안 목적(조인된 Trigger 엔티티 전체가 새 나가던 것을 참조 4필드로 좁힘)을 담당하는데, 바로 위 JSDoc 은 상세히 배경을 설명하지만 본문 핵심 변수는 여전히 `t` 다.
  - 제안: `t` → `trigger` (같은 스코프의 타입 `Trigger` 와 값/타입 네임스페이스가 달라 충돌 없음). 사소하므로 병합을 막을 사안은 아니다.

- **[INFO]** (이월, 3라운드 연속 유지) "이미 응답에 실려 나가고 있었다 …" 로 시작하는 동일한 배경 설명 주석 블록이 4개 DTO 파일에 거의 그대로 반복된다.
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:55-61`, `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:118-124`, `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:93-99`, `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:69-75`.
  - 상세: 코드 중복이 아니라 설명 주석의 중복이라 위험도는 낮다. 이전 라운드들에서 "각 DTO 가 자기완결적으로 맥락을 담아야 한다"는 판단으로 조치 불요 처리됐고 이번에도 그 상태가 그대로다.
  - 제안: 즉시 조치 불필요. 이 서사를 정정할 일이 생기면 4곳을 함께 grep 해 동기화할 것.

- **[INFO]** (이월) `TriggersService.sanitizeForResponse()` 안에 구조가 거의 동일한 "허용목록 밖 키를 걸러 새 객체로 복사" 루프가 두 번 반복된다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:592-603`(`chatChannel` 축, `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`) 와 `:605-622`(`notification.signing` 축, `NOTIFICATION_SIGNING_STRIP_KEYS`).
  - 상세: `chatChannel` 쪽은 루프 뒤에 `hasBotToken` 파생 필드를 추가로 주입해 완전히 동일한 함수는 아니다. 이전 라운드(`19_08_18` INFO#8)에서 "두 축의 후처리가 다르다"는 근거로 "세 번째 strip 대상이 생기는 시점에 공용 헬퍼 추출을 고려"하는 조건부 유예가 이미 내려져 있고, 이번 라운드에도 필터링 대상은 여전히 둘(chatChannel·notification.signing)뿐이라 그 조건은 아직 충족되지 않았다.
  - 제안: 조치 불요(추적 중). 세 번째 strip 대상이 생기면 `stripKeys(obj, denylist)` 형태의 공용 헬퍼 추출을 고려할 것.

## 요약

이번 diff 는 §5.4 응답-계약 검증자 배선 확대(4→18 DTO) + 트리거 회전 secret 유출 수정 + 5개 DTO 23필드 선언 보정으로 구성된, 이미 3라운드의 코드 리뷰·컨시스턴시 검토를 거치며 상당수 유지보수성 이슈가 실제로 해소된 성숙한 diff 다. 죽은 코드였던 이중 strip 루프(undefined 대입 후 delete)는 제거됐고, `contractForDto` 의 JSDoc-대상 분리 문제도 바로잡혀 있다. 다만 새로 두 가지를 확인했다 — (1) `schedule-trigger.e2e-spec.ts` 의 신설 테스트 `C-3` 안에 같은 배경 설명이 거의 그대로 두 번 반복되는 편집 잔여물이 있고, (2) `swagger-dto-contract.spec.ts` 에 §5.4 금지 조합 래칫(78건 배열 + describe 블록, 약 160줄)을 끼워 넣으면서 기존 JSDoc 을 대상 선언과 함께 옮기지 않아, 이 PR 이 이미 두 번 겪고 고친 "JSDoc-대상 분리" 패턴이 세 번째로 재발했다. 둘 다 동작에는 영향 없는 가독성 문제이고, 나머지는 이전 세 라운드에서 이미 여러 번 검토되고 명시적으로 유예 처리된 이월 항목들(변수명 `t`, DTO 배경 주석 4중 반복, strip 루프 2중 반복)이다. Critical 급 유지보수성 결함은 없다.

## 위험도

LOW
