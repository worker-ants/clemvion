# 유지보수성(Maintainability) 리뷰 — rotate lost-update, RESOLUTION 이후 상태

## 스코프 메모

이번 라운드(18_09_24)는 직전 라운드(17_35_12)의 SUMMARY 를 조치한 결과물이다. `plan/**`·`review/**` 산출물(문서·검토 기록)은 직전 라운드 자체 리뷰(`review/code/2026/09/20/17_35_12/maintainability.md`)가 이미 정한 스코프 규칙대로 함수·클래스·중첩 같은 코드 유지보수성 기준이 적용되지 않아 제외했다. 실제 코드 변경 3파일(`integrations.service.ts`, `integrations.service.spec.ts`, `integration-rotate-concurrency.e2e-spec.ts`)에 집중했고, 직전 라운드가 지적한 WARNING 3·4·5(중복·함수 길이)의 조치(`af6cc0d2c`)를 실제로 `git diff origin/main...HEAD`·`Read` 로 열어 확인했다.

## 발견사항

- **[INFO]** 직전 라운드 WARNING(권한 재검사·머지+구조검증 중복)은 `private` 헬퍼 두 개로 잘 해소됨 — 재확인 완료
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1082`(`assertCanRotate`), `:1100`(`mergeAndValidateCredentials`)
  - 상세: `af6cc0d2c` 가 락 전/후 두 지점에 복붙돼 있던 조직-스코프 권한 검사와 "머지+`validateCredentials`+에러 처리" 시퀀스를 각각 `private assertCanRotate(row: Pick<Integration, 'scope'>, userRole)`, `private mergeAndValidateCredentials(row: Pick<Integration, 'credentials' | 'serviceType' | 'authType'>, patch)` 로 추출했다. 두 헬퍼 모두 `Pick<Integration, ...>` 최소 인터페이스를 받아 `entity`(락 전 스냅샷)와 `fresh`(락 안 재읽은 행) 양쪽에 그대로 재사용되며, JSDoc 이 "락 전/후 두 지점에서 호출되고 base 가 다르므로 결과 변수명도 다르다" 는 이유까지 남겨 다음 사람이 왜 헬퍼가 이 모양인지 재구성할 필요가 없다. 정확히 직전 리뷰가 우려한 "보안 직결 코드가 두 곳에 있어 drift 위험" 이 코드 구조로 제거됐다.
  - 제안: 없음 — 조치 확인.

- **[INFO]** `rotate()` 는 144줄 → 104줄(1121~1224)로 줄었지만, 트랜잭션 커밋 로직은 여전히 인라인 클로저로 남아 있다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1121`(`async rotate(`) ~ `:1224`, 특히 `:1166`(`this.dataSource.transaction(async (manager) => {`) ~ `:1212` 의 약 47줄짜리 콜백
  - 상세: 직전 리뷰의 WARNING 은 "중복 제거"와 "트랜잭션 콜백을 `commitRotation` 같은 별도 메서드로 추출" 두 갈래를 함께 제안했는데(SUMMARY#5), 조치는 전자만 반영했다(`RESOLUTION.md` 도 "위 두 헬퍼 추출만으로 144→105줄" 이라고 스스로 명시). 남은 104줄 중 상당 부분은 설계 근거를 설명하는 주석 블록(1152~1165행, 14줄)이라 실제 로직 밀도는 더 낮지만, `rotate()` 하나의 메서드 안에 "사전 검증 → 외부 연결 테스트 → 트랜잭션 오케스트레이션(재읽기·권한재검사·재머지·UPDATE·재조회) → 감사로그 → 브로드캐스트" 다섯 책임이 여전히 한 함수에 있다는 구조적 지적 자체는 완전히 해소되지는 않았다. 다만 중복(이 지적의 핵심 비용)은 사라졌으므로 심각도는 WARNING 에서 낮춘다.
  - 제안: 필수는 아님. 여력이 있으면 `this.dataSource.transaction(...)` 콜백 전체를 `private commitRotation(entity: Integration, workspaceId: string, userRole: string | null, body: RotateCredentialsDto): Promise<Integration>` 로 추출해 `rotate()` 본문을 5단계 오케스트레이션으로 남긴다.

- **[INFO]** 락 전/후 같은 개념의 머지 결과 변수명이 `merged`/`committed` 로 여전히 다르다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1138`(`const merged = this.mergeAndValidateCredentials(entity, body.credentials);`)와 `:1182`(`const committed = this.mergeAndValidateCredentials(fresh, body.credentials);`)
  - 상세: 직전 리뷰가 INFO 로만 남기고 "제안: 선택 사항" 이라 밝힌 항목이라 회귀는 아니다. 헬퍼 추출 후에도 호출부 지역 변수명은 통일되지 않았는데, `mergeAndValidateCredentials` 자체의 JSDoc(`:1096-1098`)이 "base 가 다르므로 결과도 호출부마다 별도 변수로 받는다" 고 그 이유를 명시해, 이름이 다른 것이 실수가 아니라 의도임을 이제는 코드가 스스로 설명한다. 그래서 직전 리뷰가 우려했던 "왜 이름이 다른지 알기 어렵다" 는 문제는 사실상 주석으로 해소됐다.
  - 제안: 없음 — 조치 불요.

- **[INFO]** 신규 unit 테스트(`동시 rotate (lost update)` describe)는 헬퍼 추출 이후에도 가독성을 유지한다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:1337`(`describe('동시 rotate (lost update)'`)~`:1461`
  - 상세: `stale()`/`committedByOther()` 팩토리, `dataSource.transaction` mock(:168-178)에 붙은 "왜 이렇게 mock 하는지" 주석 모두 유지되고, `af6cc0d2c` 이후 추가된 두 신규 단언(`freshErrors` 재검증 테스트, `workspaceId` 스코핑 단언)도 기존 스타일(주석으로 판별력 근거를 남기는 방식)과 일관되게 작성됐다. 새로운 중복이나 이름 충돌은 발견되지 않았다.
  - 제안: 없음.

- **[INFO]** e2e 의 `try/finally` 리팩터(`154e17d31`)가 가독성을 해치지 않고 의도를 코드 옆 주석으로 남김
  - 위치: `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` (`BEGIN` ~ `try { ... } finally { ROLLBACK; pending?.catch(...) }` 블록)
  - 상세: `finally` 절 바로 위 주석이 "정상 경로에서는 이미 COMMIT 됐으므로 no-op(경고만)" 이라고 왜 실패 시에만 실질적 동작을 하는지 밝혀, 다음 사람이 "왜 성공 경로에서도 ROLLBACK 을 부르나" 를 오해하지 않게 한다. 직전 라운드 side_effect.md WARNING 이 지적한 위험(미종결 트랜잭션·미대기 `pending`)이 구조적으로 닫혔다.
  - 제안: 없음.

## 요약

직전 라운드(17_35_12) 유지보수성 WARNING 의 핵심(권한 재검사·머지+구조검증 로직이 락 전/후로 글자 그대로 복제)은 `assertCanRotate`/`mergeAndValidateCredentials` 두 private 헬퍼로 정확히 해소됐고, 두 헬퍼 모두 `Pick<Integration, ...>` 최소 인터페이스와 "왜 두 지점에서 쓰이는가" 를 설명하는 JSDoc 을 갖춰 코드 구조 자체가 "정책은 한 곳" 이라는 불변식을 강제한다. `rotate()` 의 함수 길이(144→104줄)와 변수명(`merged`/`committed`) 지적은 완전히 해소되진 않았지만 애초의 비용(중복으로 인한 drift 위험)이 사라졌으므로 잔여는 INFO 수준의 스타일 개선 여지로만 남는다. 테스트 파일·e2e 파일의 후속 수정(mutation gap 메우기, try/finally) 도 기존 코드베이스의 주석 관례를 그대로 따라 가독성을 유지했다. 새로 도입된 Critical/Warning 급 유지보수성 결함은 발견하지 못했다.

## 위험도

NONE
