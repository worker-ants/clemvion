# 문서화(Documentation) 리뷰

## 검토 방법 메모

프롬프트 파일(`_prompts/documentation.md`)의 상당수 항목이 "프롬프트 크기 제한으로 diff
생략"으로 표시돼 있어, 해당 파일은 `git diff origin/main...HEAD -- <path>` 로 직접 재조회해
전문을 확인했다. 리뷰 대상은 총 26개 코드/설정/plan 파일이며 (`review/**` 하위의 과거 라운드
산출물 다수는 이미 커밋된 이력 아티팩트로, 이번 문서화 관점 평가 대상에서 제외했다), 아래는
그 전수 검토 결과다.

## 발견사항

- **[INFO]** `spec/conventions/error-codes.md §4.2`가 정의한 `error.details[].code` 는
  **배열** 구조(트리거 파라미터 검증 사유 다건을 담는 형태)인데, 새로 추가된
  `triggers.service.ts`의 인용은 이를 "이미 `code` 를 쓰는 선례"로만 언급하고 실제 채택한
  구조(`details: { field, code }` — **단수 객체**)와의 형태 차이는 명시하지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rethrowEndpointPathConflict` 메서드 내부 주석(`// 두 번 좁혔다. 처음엔 봉투 top-level 에 subCode 를...` 로 시작하는 블록)
  - 상세: 주석은 "도메인 세부 사유는 이미 `error-codes.md §4.2` 와 `trigger-parameter.types.ts` 가 **`code`** 로 쓴다"고 근거를 대는데, §4.2 표 헤더는 `error.details[].code`로 **여러 검증 사유를 배열에 담는** 형태를 다룬다. 이번 PR 이 실제로 쓴 것은 `details`가 배열이 아니라 `{ field, code }` 단수 객체다. 인용 자체(“`code`라는 키 이름을 쓴 선례가 있다”)는 사실이라 틀린 근거는 아니지만, 다음에 이 주석만 보고 “그러니 `details`도 배열이어야 하는구나”로 오독할 여지가 있다. `spec/2-navigation/2-trigger-list.md §3`는 애초에 단수 객체(`details.field='endpoint_path'`)로 계약했으므로 구현은 spec과 정확히 일치하고, 실질적 결함은 없다.
  - 제안: 조치 불요에 가까움. 여유가 있다면 주석에 "`details` 의 컨테이너 형태(배열 vs 단수 객체)는 §4.2 와 다르다 — 여기는 spec `2-trigger-list.md §3` 이 단수 객체로 계약했기 때문" 한 줄만 덧붙이면 다음 사람의 오독 가능성을 닫을 수 있다.

- **[INFO]** 이전 리뷰 라운드(`review/code/2026/09/06/11_55_36`)가 지적한 "JSDoc 블록이 `findEagerUserRelations` 위에 남아 있고 실제로는 `collectUserRelationNames` 를 설명한다"는 결함은 최종 상태에서 이미 해소돼 있다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — `findEagerUserRelations`(“## 왜 별도 축인가” JSDoc)와 `collectUserRelationNames`(“## 왜 이름을 손으로 적지 않는가” JSDoc) 각각 직전
  - 상세: 두 함수 모두 자신을 정확히 설명하는 JSDoc 을 직전에 갖고 있음을 직접 파일을 읽어 확인했다. 새로 지적할 결함이 아니라, 후속 라운드에서 올바르게 수정됐음을 확인차 기록한다(회귀 없음).
  - 제안: 조치 불요.

## 요약

이번 diff(`User` 엔티티 컬럼 노출 검출 2축 신설 + `WorkflowVersionsService.findOne` 실유출 수정 + 트리거 `endpointPath` 충돌 409 계약 이행 + `review_guard.py` YAML 프런트매터 파서 보강)의 문서화 수준은 이 저장소 기준으로도 예외적으로 높다. 모든 신규 함수·클래스·상수(`CREATOR_PROJECTION`, `ProjectedCreator`, `USER_SECRET_KEYS`, `findUserRelationLoads`, `findEagerUserRelations`, `collectUserRelationNames`, `isEndpointPathUniqueViolation`, `_strip_comment` 등)가 "왜 이 방식을 택했는가"·"왜 더 좁은/넓은 대안을 기각했는가"를 실측 수치(19곳/46곳/731 대 731/23컬럼 등)와 함께 서술하고, 그 수치를 저장소에서 직접 대조해 본 결과 실제 값과 일치했다(`grep -c '@Column' user.entity.ts` = 23, 카나리아 단언과 일치). `CHANGELOG.md`는 이번 변경의 배경·기각한 대안·잔여 후속 항목을 상세히 기록했고, `spec/conventions/review-citations.md`와 `spec-impl-evidence.md`의 자기-반증형 소정정은 `CLAUDE.md`가 요구하는 취소선 보존 + `git log -S` 근거(정정 문장은 planner 턴 `90c1751e8`가 썼음을 확인) 규약을 정확히 따랐다. 직전 라운드가 지적한 JSDoc 오배치 결함도 최종 상태에서는 해소되어 있고, 새 e2e 시나리오 라벨 중복(`F.` 두 개)도 `J.`로 재명명되어 남아 있지 않다. 실질적으로 새로 지적할 것은 트리거 충돌 details 구조에 대한 선례 인용 정밀도(§4.2 배열 vs 실제 단수 객체) INFO 하나뿐이며, spec 계약과 구현은 정확히 일치한다. README·API 문서 갱신이 필요한 신규 공개 표면(엔드포인트 동작 변경)은 `triggers.controller.ts`의 `@ApiConflictResponse` 추가로 이미 반영되었고, 별도 누락은 발견하지 못했다.

## 위험도

NONE
