# Rationale 연속성 검토 — `spec-draft-schedule-trigger-ref-nav.md`

## 발견사항

- **[INFO]** §5.4 기준 (b) 의 "진짜 근거"로 제시한 사실이 코드화된 기준 문언보다 좁고 더 깨지기 쉽다
  - target 위치: `plan/in-progress/spec-draft-schedule-trigger-ref-nav.md` "사유 (b) 의 근거가 DTO 주석보다 강하다" 절, D-1/D-2 표의 `trigger.workflow` 행
  - 과거 결정 출처: `spec/5-system/2-api-convention.md §5.4` 정의(`### 5.4 부재 표현`, 기준 (b) = "선택적 부가 컨텍스트라 소비자가 부재를 정상 경로로 다룰 때") + `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:40-49` JSDoc(기준 (b) 를 `?? ""` 폴백으로 근거)
  - 상세: target 은 "그 응답은 프런트엔드가 읽지 않는다"(`schedulesApi.create` 가 바디를 버리고 `queryKey` 무효화로 재조회)는 사실을 §5.4 기준 (b) 보다 "더 강한 근거"로 승격시킨다. 실측했다 — `codebase/frontend/src/lib/api/schedules.ts:66` 의 `create` 는 `Promise<void>` 이고, 호출부 `.../schedules/page.tsx:571,580` 은 실제로 응답을 버리고 `invalidateQueries({queryKey:["schedules"]})` 로 재조회한다. `mapSchedule` 의 `?? ""` 폴백(`:514`)은 list/detail/update 응답에서는 필드가 항상 채워져 있어 (target 의 표 자체가 "목록·상세·수정 응답에는 채워진다" 고 적는다) 현재 코드 경로에서는 사실상 트리거되지 않는다. 즉 target 이 "더 강한 사실"이라 부르는 것은 **§5.4 (b)의 대체 근거가 아니라, (b)가 요구하는 "소비자가 정상 경로로 다룬다"는 안전판이 지금 사실상 미사용(dead fallback)이라는 관찰**이다. 이 자체는 거짓이 아니고 D-1/D-2 표도 "(b)" 인용을 그대로 유지하므로 §5.4 를 재정의하거나 위반하지는 않지만, 문서에 박히는 "진짜 근거"가 **create() 응답을 프런트엔드가 앞으로도 계속 안 읽는다**는, DTO 선언 밖에서 성립하는 우발적 사실에 의존한다. `conversationThread` Rationale(같은 문서 §5.4)도 특정 소비자 구현(`threadToMessages`)에 근거를 대는 선례가 있어 이 패턴 자체는 이 저장소 관행과 합치하지만, 그 선례는 "소비 측 안전성은 별도로 확인됐다"는 문장으로 **위 근거가 (b)의 보강 증거이지 대체물이 아님**을 분명히 한다. target 문구("진짜 근거는 …다. spec 에는 후자를 적는다")는 그 위계를 흐리게 읽힐 소지가 있다.
  - 제안: D-1/D-2 문구에서 "그리고 그 응답은 프런트엔드가 읽지 않는다"를 (b) 판정의 **보조 근거**로 격을 낮추는 한 마디("그래서 (b) 의 폴백이 지금 트리거되지 않는다"류)를 덧붙이면, 나중에 `schedulesApi.create`/`triggersApi.create` 가 응답 바디를 실제로 소비하도록 바뀌었을 때(예: optimistic update 도입) 이 문서가 스스로 재검토 신호를 갖게 된다. 현재 문구로도 §5.4 위반은 아니므로 필수 수정은 아니다.

## 점검 관점별 확인 결과

1. **§5.4 absence-notation 규약과의 정합** — `spec/5-system/2-api-convention.md §5.4`(기준 (a)/(b), "소급 적용 대상 아님" 조항 포함)와 `plan/in-progress/spec-draft-nullable-notation-followups.md` ③ 항목(2026-09-04 등재, DTO 선언 삼분화 변경안)을 대조했다. target 이 인용하는 "`trigger` 는 상시 존재라 기본형" · "`workflow` 는 기준 (b)" 판정은 이미 코드에 반영돼 있다(`schedule-response.dto.ts:115` `@ApiProperty` 비-optional, `:54` `@ApiPropertyOptional`). target 은 이 기존 판정을 **재도입/재결정하는 것이 아니라 그대로 승계**해 nav-spec 으로 옮기는 작업이며, 후속 백로그 항목(`21_40_38` W1 / `22_25_00` W2, "옮기는 것" 으로 명시)이 요구한 작업 범위와 일치한다. §5.4 의 "이미 문서화된 키 생략 필드는 사유 문구를 소급 요구하지 않는다"는 예외 조항은 이 필드들이 **아직 spec 에 문서화되지 않았으므로** 적용 대상이 아니고, target 이 그 예외를 오용하지도 않는다. 위반 없음.

2. **wire vs DB 경계 판단(§2.9.1 미수정)** — "1-data-model.md §2.8 storage-form" 선례(같은 문서 §2.8 `notification_secret_v2` 행, "저장 형태는 secret:// ref 가 아니라 컬럼에 담긴 평문" — 이 세션 2026-09-10 배치 C-2 로 추가)와 "query-scoped-projection" 선례(`1-data-model.md` Rationale "`User` 민감 컬럼 방어" 항의 "쿼리 범위 select 투영" 구분)를 직접 열람해 대조했다. 두 선례 모두 **`1-data-model.md` 는 DB/저장 계층 서술을 소유하고, 노출·응답-형태 규범은 다른 문서(`secret-store.md §1.1`, `2-api-convention.md §5.4`)로 명시적으로 위임**하는 패턴을 보인다 — 특히 §2.8 의 `hasBotToken` 행("응답 DTO 전용 derived 필드 … DB 컬럼 아님, SoT [Chat Channel §5.4.2]")은 "DB 컬럼이 아닌 응답 전용 개념은 데이터 모델 문서가 소유하지 않는다"는 정확히 같은 구분을 이미 쓰고 있다. target 이 "키 생략은 wire 표현, §2.9.1 은 DB 관계"라며 §2.9.1 을 건드리지 않고 NOT NULL 근거로만 인용하는 방식은 이 기존 경계와 **합치**한다. 위반 없음.

3. **참조 형태 비대칭(`name` only vs `id`+`name`)의 "의도적" 주장 근거** — 지어낸 근거가 아니라 실제 이력이다. `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:12-19`(`ScheduleTriggerWorkflowRefDto` JSDoc)와 `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:14-21`(`TriggerWorkflowRefDto` JSDoc) 양쪽 모두 "각 참조는 그 응답의 소비처가 실제로 읽는 필드만 담는다"는 동일 문구와 `review/consistency/2026/09/06/00_48_52` 인용을 갖고 있다. 그 리뷰 산출물을 직접 열람해 확인했다 — `naming_collision.md` WARNING 이 정확히 이 비대칭을 지적하며 "diff 주석은 각자의 실제 프런트엔드 소비처(`triggers/page.tsx`는 `id`+`name`, `schedules/page.tsx`는 `name`만)를 근거로 든다 — 설계 자체는 정당하다"고 판정했고, 제안한 "자매 타입과 필드가 다름(의도적)이라는 상호 참조 한 줄"이 현재 코드 JSDoc 에 그대로 반영돼 있다(git blame 상 이 세션 커밋들). target 의 D-1/D-2 문구는 이 JSDoc 을 거의 그대로 옮긴 것이고, `git log --all --oneline`으로 조회한 `origin/main` HEAD(`8a2ad2f20`, #1303)와도 정합한다. 소급 부여(retro-fit)가 아니라 실제 이력을 정확히 인용하고 있다. 위반 없음.

4. **`#1303` §9.1 선례의 실재 여부 및 내용 일치** — `git log`으로 `8a2ad2f20`(`docs(spec): 좁은 인벤토리 주장을 고치다 넓은 SoT 주장을 만들 뻔했다 — §9.1 경계 명시 (#1303)`)를 확인했고, 이는 target 이 인용한 `origin/main` 착수 전 재판정 표의 값과도 일치한다. 실제 spec 본문(`spec/2-navigation/4-integration.md §9.1`, `:795`)과 그 Rationale 항목("§9.1 의 `IntegrationDto` 인벤토리 주장 경계", `2-navigation/4-integration.md` Rationale)을 열람해 대조한 결과, target 의 주장 — "인벤토리를 spec 에 복제하면 drift 소스가 하나 늘 뿐" — 은 그 Rationale 이 실제로 세운 규율("§2.10 을 복제하지 않는다 … 옮기면 두 자리가 갈리는 drift 소스가 하나 늘 뿐이다")과 문언까지 정확히 일치한다. 선례를 왜곡 없이 인용했다. 위반 없음.

## 요약

target(`spec-draft-schedule-trigger-ref-nav.md`)이 다루는 네 축 — §5.4 (b) 판정 승계, wire/DB 경계, 참조 형태 비대칭의 "의도적" 주장, `#1303` §9.1 인벤토리-비복제 선례 — 을 모두 실제 spec 본문·코드(JSDoc)·git 이력·과거 review 산출물과 직접 대조했다. 네 축 모두 target 의 서술이 실제 이력·정본 텍스트와 정확히 일치했고, 기각된 대안을 재도입하거나 §5.4/데이터모델의 합의된 경계를 무시하는 지점은 발견되지 않았다. 유일한 관찰은 §5.4 기준 (b) 의 "더 강한 근거"로 제시한 "create 응답을 프런트엔드가 안 읽는다"는 사실이 (b) 자체의 대체가 아니라 보조 근거임을 더 명확히 구분해 두면 향후 프런트엔드 소비 방식이 바뀔 때 이 문서가 스스로 재검토 신호를 갖게 된다는 점이며, 이는 INFO 수준으로 필수 수정 사항은 아니다.

## 위험도

LOW
