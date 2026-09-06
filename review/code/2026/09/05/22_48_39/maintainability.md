# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 같은 세션에서 4차례 지적된 "JSDoc 이 새 선언 삽입으로 대상에서 분리됨" 패턴이 **최신 커밋(`66a2510fd`)에서 다시 2건** 발생했다. 직전 라운드(`review/code/2026/09/05/22_24_58`)가 "다음엔 위에 붙은 주석이 누구 것인지 먼저 본다"는 습관으로 이월했는데, 바로 그 다음(마지막) 커밋에서 재발했다.
  - 위치 A: `codebase/backend/src/modules/triggers/triggers.service.ts` — `TRIGGER_RESPONSE_STRIP_COLUMNS` 선언(111~114행, `dfb2664af9`)을 설명하는 JSDoc(79~92행, "응답에서 제거할 **엔티티 컬럼**…")이 있는데, 그 사이에 `INTERACTION_RESPONSE_STRIP_KEYS` 의 JSDoc+선언(93~109행, 최신 커밋 `66a2510fd`)이 끼어들었다. 결과적으로 `TRIGGER_RESPONSE_STRIP_COLUMNS`(111행)는 바로 위에 아무 JSDoc도 없이 서 있고, 79~92행 JSDoc 은 자신이 설명하지 않는 `INTERACTION_RESPONSE_STRIP_KEYS`(93~108행 JSDoc·109행 선언) 바로 위에 놓여 있다. `git blame` 으로 확인: 79~92행은 `a6f582680`(19:37), 93~109행은 `66a2510fd`(22:48, 최신), 111~114행은 `dfb2664af9`(18:22)로 각각 다른 커밋.
  - 위치 B: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — 191~197행 JSDoc("응답 정화 회귀 — e2e 만이 이 결함을 물던 상태였다… fixture 에 비밀을 채워 그 사각지대를 없앤다")은 231행의 `응답에서 회전 secret 컬럼과 notification.signing 비밀이 제거된다` 테스트(비밀 필드를 채운 fixture)를 설명하는 내용인데, 그 사이(198~207행, 최신 커밋)에 별개 테스트(208행 `PATCH 에서 생략된 필드는 로드된 값을 유지한다`)의 JSDoc 과 `it(...)` 블록이 끼어들어, 191~197행 JSDoc 이 엉뚱한 테스트(208행) 바로 위에 놓이게 됐다. `git blame`: 191~197행은 `cb17f08709`(19:06), 198~229행은 `66a2510fd`(22:48, 최신).
  - 상세: 두 사례 모두 "기존 JSDoc 블록과 그 대상 선언/테스트 사이에 새 선언(+새 JSDoc)을 끼워 넣고, 기존 블록을 함께 옮기지 않음" 이라는 동일한 편집 습관에서 비롯됐다. `review/code/2026/09/05/22_24_58/RESOLUTION.md` 의 W3("같은 실수를 네 번 했다")가 이미 이 패턴을 4회로 집계했는데, 그 직후 커밋에서 정확히 같은 방식으로 2건이 더 생겼다 — 습관 교정이 실효를 못 낸 것으로 보인다. 동작에는 영향이 없지만, 다음 사람이 소스 순서대로 읽으면 "이 주석이 왜 이 자리에 있지"라는 혼동을 겪고, TypeDoc 류 도구는 가장 가까운 선언에 주석을 잘못 귀속시킨다.
  - 제안: A — 79~92행 JSDoc 블록을 `TRIGGER_RESPONSE_STRIP_COLUMNS` 선언(111행) 바로 위로 옮긴다. B — 191~197행 JSDoc 을 231행 테스트 바로 위로 옮기거나, 두 JSDoc 을 하나로 합쳐 "이 fixture 확장의 배경"을 첫 테스트 앞에 한 번만 적는다. 재발 방지책으로, 이 PR 처럼 선언/테스트를 기존 블록 사이에 삽입할 때는 `git diff` 로 "삽입 직전 줄이 원래 무엇을 설명하던 주석인지"를 매번 확인하는 절차를 명시적으로 두는 편이 낫다 — 지금까지 "습관으로 옮긴다"는 서술만으로는 3라운드 연속 재발을 막지 못했다.

- **[INFO]** `TriggersService.sanitizeForResponse()`(`codebase/backend/src/modules/triggers/triggers.service.ts:608-691`) 안에서 "허용 목록에 없는 키만 복사"하는 동일한 루프가 3번 반복된다.
  - 위치: `chatChannel` 축(626~630행), `interaction` 축(640~644행), `notification.signing` 축(654~660행) — 셋 다 `for (const [key, value] of Object.entries(obj)) { if (STRIP_SET.has(key)) continue; out[key] = value; }` 형태다.
  - 상세: 이 메서드는 이번 PR 여러 라운드에 걸쳐 책임이 1개 축(chatChannel)에서 4개 축(chatChannel·interaction·notification.signing·엔티티 컬럼)으로 확장됐고, 그 과정에서 같은 패턴의 루프가 그대로 복제됐다. 함수 자체는 84줄로 아직 관리 가능한 범위지만, 다음에 다섯 번째 비밀 축이 추가되면(메서드 JSDoc 이 스스로 "다음엔 목록을 늘리지 말고 선언적 SoT로 옮길 것"이라고 경고한 바로 그 시나리오) 네 번째 복제 루프가 생길 가능성이 높다.
  - 제안: `stripKeys(obj: Record<string, unknown>, keys: ReadonlySet<string>): Record<string, unknown>` 같은 지역 헬퍼로 3개 루프를 추출한다. 각 축의 파생 필드 주입(`hasBotToken`)은 헬퍼 호출 이후 별도로 얹으면 되므로 추출을 막지 않는다.

- **[INFO]** `SchedulesController.toResponse()` 의 지역 변수명 `t` 가 여전히 축약형이다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:68` (`const t = schedule.trigger;`)
  - 상세: 이 PR 의 이전 라운드(`review/code/2026/09/05/18_23_02` INFO)에서 이미 지적되고 "이월(조치 불요)"로 명시적으로 처분된 항목이다. 새로운 문제는 아니며, 이번 라운드에서 코드가 추가로 손대지도 않았다. 참고용으로만 남긴다.
  - 제안: 즉시 조치 불요 (기존 처분 유지). 이 메서드를 다시 손대는 김에 `t` → `trigger` 로 바꾸는 정도면 충분하다.

## 요약

이번 diff 는 §5.4 응답-계약 검증자(`assertMatchesContract`/`contractForDto`)를 4개에서 18개 DTO 로 넓히는 배선(대부분 e2e spec 의 3~4줄 import+호출 추가)과, 그 과정에서 실측으로 드러난 트리거 회전 secret 2차 유출(스케줄 조인 경유) 및 `secret-store.md §1.1` 누락 필드(`triggerToken`) 수정으로 구성된다. 새로 추가된 DTO 필드·가드 로직(`isResponseDtoFile`/`findOptionalNullableResponseFields`)은 네이밍이 명확하고 AST 기반으로 정밀하게 구현돼 있으며, 각 결정의 배경이 인접 주석에 잘 남아 여러 라운드를 거치며 품질이 계속 개선된 흔적이 뚜렷하다. 다만 이 세션 전체에 걸쳐 이미 4회 지적된 "JSDoc 삽입 시 기존 블록을 대상에서 떼어냄" 결함이 **가장 최근 커밋에서 다시 2건** 재발했다 — 습관 교정이 아직 정착하지 않았다는 신호이므로 이번 라운드에서 명시적으로 바로잡을 필요가 있다. 그 외에는 `sanitizeForResponse` 의 3중 반복 루프(경미한 DRY 개선 여지)와 기존에 이미 이월 처리된 변수명 하나뿐이며, 함수 길이·중첩 깊이·매직 넘버 등 다른 관점에서는 심각한 문제가 관측되지 않았다.

## 위험도

LOW
