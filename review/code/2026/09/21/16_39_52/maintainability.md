# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `remove()` 의 주석 밀도(설명 20줄 vs 실행 코드 15줄)가 높다
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:401-421`
  - 상세: `findEntity` → `delete(criteria)` → `affected` 판정으로 바뀐 이유, `remove` 대비 등가성 실측(cascade/훅/FK), `affected === 0` 명시 비교 이유, 404 코드가 형제들과 다른 이유까지 한 함수 안에 이력·근거 주석이 몰려 있어 실행 로직(4문장)보다 주석이 훨씬 길다.
  - 다만 `workspaces.service.ts:removeMember`(`#1373`) 등 형제 PR(#1369~#1374) 전부가 이미 동일한 밀도의 "왜 이렇게 짜는가" 주석 컨벤션을 쓰고 있음을 직접 대조로 확인했다 — 이 PR 이 새로 도입한 스타일이 아니라 기존 코드베이스 컨벤션을 그대로 따른 것이므로 감점 요인이라기보다 **일관성 측면에서는 오히려 준수**다. 다음에 이 계열(9번째, WebAuthn) 을 처리할 때 주석을 함수 위 블록 doc-comment 로 한 번 더 압축할 여지는 있지만, 이번 PR 범위에서 고칠 필요는 없다.
  - 제안: 조치 불요(정보성). 9번째 자리 처리 시 공통 패턴을 `spec/conventions/`에 문서화하기로 이미 plan(`INFO#1`, consistency SUMMARY)에 예정돼 있으므로, 그때 서비스 코드 주석도 "왜"는 convention 문서로 옮기고 함수 내 주석은 그 문서를 가리키는 한 줄로 줄이는 방안을 함께 검토할 만하다.

- **[WARNING]** 신규 e2e 동시성 테스트가 8번째 형제 파일과 거의 전문 중복이다
  - 위치: `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` (전체, 1-124줄) — `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts` 와 `diff` 대조
  - 상세: 두 파일을 직접 `diff` 했다. 리소스명(`auth_config`→`model_config`)·라우트(`/api/auth-configs`→`/api/model-configs`)·404 코드(`RESOURCE_NOT_FOUND`→`MODEL_CONFIG_NOT_FOUND`)·request body 필드 몇 개를 빼면 구조·주석 배치·변수명·락 기법·공허성 가드·정리(finally) 로직이 **완전히 동일**하다. 현재 이 패턴의 파일이 9개(`workflow-`/`workspace-`/`trigger-`/`schedule-`/`integration-`/`auth-config-`/`member-remove-`/`model-config-delete-concurrency`)이며 신규 헬퍼 추출 없이 매번 복사-치환되고 있다.
  - 다만 이는 **알려지고 이미 유예된 결정**이다: 이 PR 의 `plan/in-progress/modelconfig-dup-delete.md` §"이 PR 이 하지 않는 것"에 "동시성 e2e 공용 헬퍼 추출 — 리뷰가 두 라운드 연속 「8·9번째 시점에 재검토」로 권고했다. 이 PR 이 여덟 번째이므로 아홉 번째와 함께 판단한다"고 명시돼 있다. 즉 이번이 그 "8번째 시점"이고, plan 은 유예를 9번째(WebAuthn)까지로 한정했다.
  - 제안: 이번 PR 자체를 막을 사유는 아니다(문서화된 유예 결정이고 트리거 조건이 구체적이다). 다만 9번째(WebAuthn credential 삭제) 착수 시점에 실제로 공용 헬퍼(예: `raceDeleteRequests(url, headers)` + `assertSingleAudit(...)`)를 추출하지 않고 또 한 번 유예하면 그 시점부터는 근거 없는 반복이 된다 — 다음 세션이 이 경고를 "9번째에서 재검토" 항목의 실행 체크리스트로 이어받도록 plan 에 남겨 둘 것을 권한다.

- **[INFO]** 404 판정 코드가 형제 그룹과 다른데(`MODEL_CONFIG_NOT_FOUND` vs `RESOURCE_NOT_FOUND`) 근거가 코드·plan·consistency 리포트 세 군데에 일관되게 기록돼 있다
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:415-416`, `423-424`
  - 상세: 기존 `findEntity` 실패 경로가 이미 `this.notFound()`(`MODEL_CONFIG_NOT_FOUND`)를 쓰고 있어 동시 삭제 진 쪽도 같은 헬퍼·같은 코드를 재사용한 것으로, 새 식별자를 만들지 않고 기존 헬퍼를 그대로 재사용했다는 점에서 오히려 좋은 예다. 이름 불일치처럼 보이지만 "형제와 다르게 갈 이유"가 주석·plan·consistency INFO#2 에 모두 동일하게 설명돼 있어 다음 리더가 헷갈릴 여지가 적다.
  - 제안: 조치 불요.

- **[INFO]** 단위 테스트의 리팩터링이 vacuous 단언 제거를 겸했다
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.spec.ts:360-369`(구 `mockRepo.remove` 단언 → `mockRepo.delete` 단언), `:1064-1090`(구 "삭제 **전에** 읽은 kind" 흉내 제거)
  - 상세: `remove(entity)` → `delete(criteria)` 전환 이후 더 이상 호출되지 않는 `mockRepo.remove`를 겨냥하던 두 단언을 `mockRepo.delete`로 옮기고, TypeORM 의 엔티티 파괴를 흉내 내던 `mockRepo.remove.mockImplementation(...)` 블록(더 이상 참이 아닌 전제에 기반한 코드)을 삭제한 뒤 주석으로 그 근거를 남겼다. 이는 기존 테스트가 "통과하지만 아무것도 검증하지 않게 되는" 상태를 그대로 방치하지 않고 능동적으로 고친 것으로, 가독성·정확성 양쪽에 도움이 된다.
  - 제안: 조치 불요. 모범 사례로 인정.

- **[INFO]** 신규 `describe('remove — 동시 삭제', ...)` 블록의 `entity()` 팩토리·`it.each` 사용은 중복을 잘 억제했다
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.spec.ts:1098-1146`
  - 상세: 두 테스트가 공유하는 엔티티 픽스처를 함수로 뽑았고(`entity()`), `undefined`/`null` 두 케이스를 `it.each`로 묶어 판별자(`affected === 0` 명시 비교) 대조군을 반복 없이 표현했다. 명명(`affected 가 %p(드라이버 미보고)면 정상 삭제로 취급한다`)도 목적이 분명하다.
  - 제안: 조치 불요.

## 요약

이번 변경은 형제 PR 7건(#1369~#1374)과 동일한 "무락 조회 + 원자적 DELETE의 affected 판정" 패턴을 여덟 번째로 반복 적용한 것으로, 네이밍·주석 스타일·에러 코드 재사용·테스트 구조 모두 기존 코드베이스 컨벤션과 정확히 일치한다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 측면에서 새로 도입된 문제는 없고, 오히려 전환으로 인해 vacuous 해진 기존 단위 테스트 단언들을 능동적으로 정리한 점이 눈에 띈다. 유일하게 실질적인 유지보수성 부담은 신규 e2e 동시성 테스트 파일이 형제 8개와 사실상 전문 중복이라는 점인데, 이는 이 PR 이 처음 만든 문제가 아니라 plan 문서에 "9번째 시점에 헬퍼 추출을 재검토한다"고 명시적으로 유예된 기존 결정이므로 이번 PR을 막을 사유는 아니며, 다음(9번째) 착수 시점에 실제로 추출 여부를 결정하는 것으로 충분하다.

## 위험도

LOW
