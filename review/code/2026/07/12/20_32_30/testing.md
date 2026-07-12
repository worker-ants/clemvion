# 테스트(Testing) Review

## 대상 요약

3라운드째 리뷰. 실제 코드 변경(1~6번 파일)은 이전 두 라운드(19_49_01, 20_08_27)에서 나온
Testing WARNING 4건(SoT 값 미검증 2건 + drift 가드 tautology 1건 + `InteractAckDto` 스키마
테스트 부재 1건)이 이미 전부 반영된 최종 상태다. 7번 파일(plan)과 8~29번 파일(이전 리뷰
라운드의 SUMMARY/RESOLUTION/개별 reviewer 산출물, `_retry_state.json`, `meta.json`)은
과거 리뷰 세션의 기록이 그대로 커밋된 것으로 테스트 관점 검토 대상이 아니다(코드 아님).

검증을 위해 직접 실행 확인:
- `execution-status-response.dto.spec.ts` / `execution-status.literal.spec.ts` /
  `interact-ack-response.dto.spec.ts` 3개 파일 `npx jest` 실행 → **21/21 pass**.
- `interaction.service.spec.ts` / `interaction.controller.spec.ts`(소비자) → **56/56 pass**,
  DTO 타입 치환으로 인한 회귀 없음.
- `execution.entity.ts::ExecutionStatus` 실제 선언 순서
  (`pending,running,completed,failed,cancelled,waiting_for_input`)를 직접 대조 —
  wire SoT 순서(`pending,running,waiting_for_input,completed,failed,cancelled`)와 다르다는
  JSDoc/커밋 주장이 정확함을 확인.

## 발견사항

- **[INFO]** `execution-status.literal.spec.ts` 의 순서-pin 이 실제로 견고한 설계다
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status.literal.spec.ts:131-140`
  - 상세: 2R WARNING(W1, "drift 가드가 SoT 순서 회귀를 무음 통과")의 근본 원인은 DTO spec 의
    `expect(status.enum).toEqual([...EIA_EXECUTION_STATUS_VALUES])` 가 **같은 심볼을 양변에
    사용하는 파생 비교**라 SoT 자체가 재정렬돼도 항상 통과한다는 것이었다. 3R 코드는 이를
    `execution-status.literal.spec.ts` 에서 **하드코딩 리터럴 배열과 대조**하는 별도 pin 테스트로
    분리했다(`expect([...EIA_EXECUTION_STATUS_VALUES]).toEqual(['pending','running',...])`).
    이 설계는 SoT 재정렬 시 반드시 실패하도록 구조적으로 보장된다(우변이 심볼을 참조하지
    않으므로 tautology 가 성립할 수 없음) — 실제 mutate-and-run 없이도 코드 구조만으로 검증
    가능한 견고한 수정이다. DTO 레벨 테스트는 "이 DTO 가 SoT 를 올바르게 참조하는가"만
    검증하도록 스코프를 좁혀 책임 분리가 명확하다(전 라운드 I3 "중복 drift 로직" 해소와 일치).
  - 제안: 없음 — 현재 구조 유지.

- **[INFO]** 잔존 `as` 캐스트가 신규 엔티티↔SoT 동등성 테스트로 간접 방어된다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:379`
    (`status: execution.status as ExecutionStatusDto['status']`)
  - 상세: 1R testing.md 가 지적했던 "엔티티→DTO 경계의 `as` 캐스트가 컴파일타임 체크를
    우회해 SoT 오탈자를 못 잡는다"는 잔존 리스크는 이번 diff 로도 해소되지 않았다(pre-existing,
    이번 스코프 밖). 다만 신규 `execution-status.literal.spec.ts` 의 엔티티 집합 동등성 테스트
    (`[...EIA_EXECUTION_STATUS_VALUES].sort()` vs `Object.values(ExecutionStatus).sort()`)가
    이 캐스트가 은폐하던 위험의 상당 부분(엔티티에 상태 추가/제거 시 wire SoT 누락)을 간접적으로
    커버하게 됐다 — 다만 "엔티티 값이 SoT 집합 밖의 문자열로 넓혀지는" 극단 케이스(예: 엔티티
    컬럼이 `string` 으로 타입 완화되는 경우)까지는 여전히 무방비다. 이번 diff 의 책임 범위는
    아니므로 차단 사유는 아니다.
  - 제안: 조치 불요(비차단). 후속 관찰 사항으로만 기록.

- **[INFO]** `InteractAckDto` 스키마 테스트는 `currentStatus` 만 검증 — `executionId`/`accepted` 는 스코프 밖
  - 위치: `interact-ack-response.dto.spec.ts`
  - 상세: 신규 스펙은 이번 diff 가 실제로 바꾼 필드(`currentStatus`)에 집중해 등재 여부·enum
    값·optional 여부 3가지를 검증한다. `executionId`(uuid format)·`accepted`(boolean) 필드의
    스키마 표현은 검증하지 않지만, 이 필드들은 이번 diff 로 손대지 않았고 SoT 통합과 무관해
    갭이 아니라 의도된 스코핑이다.
  - 제안: 없음 — 필요 시 별도 후속에서 다룰 사안.

## 점검 관점별 확인

1. **테스트 존재 여부**: 변경된 3개 실질 파일(`execution-status.literal.ts` 신규,
   두 DTO 의 `status`/`currentStatus` 필드) 모두 대응 테스트 보유. 커버리지 충분.
2. **커버리지 갭**: 실질 갭 없음. SoT 값·순서·엔티티 동등성·양 DTO 의 SoT 참조가 모두 검증됨.
3. **엣지 케이스**: 순서 회귀(하드코딩 pin)·엔티티 추가/제거(집합 동등성)·optional 여부
   (`currentStatus` not required) 모두 커버. null 처리는 해당 없음(enum 필드, null 미허용).
4. **Mock 적절성**: 두 스키마 스펙 모두 실제 `SwaggerModule.createDocument()` 로 OpenAPI 문서를
   생성해 검증 — 데코레이터 메타데이터만 읽는 얕은 검증이 아니라 실제 산출물 대조. mock 남용 없음.
5. **테스트 격리**: 각 스펙이 독립된 `Test.createTestingModule` + `beforeAll`/`finally app.close()`
   로 완결. 전역 상태·실행 순서 의존 없음.
6. **가독성**: 테스트명이 "무엇을·왜"(예: "SoT 순서 회귀 pin", "엔티티↔wire drift 가드")를
   명시해 의도가 분명함.
7. **회귀 테스트**: 기존 15건 + 신규 6건 = 21건 전부 green 실행 확인. 소비자
   (`interaction.service.spec.ts`/`interaction.controller.spec.ts`) 56건도 무회귀 확인.
8. **테스트 용이성**: SoT 를 별도 파일로 분리한 구조 자체가 테스트 용이성을 높임(Swagger 문서
   생성 없이도 배열 자체를 독립적으로 단위 테스트 가능해짐).

## 요약

세 라운드에 걸쳐 지적된 Testing WARNING(SoT 값 미검증, drift 가드 tautology, `InteractAckDto`
스키마 테스트 부재)이 모두 구조적으로 견고하게 해소됐다. 특히 2R 에서 지적된 "파생 심볼
비교라 순서 회귀를 못 잡는다"는 문제는 하드코딩 리터럴과 대조하는 별도 pin 테스트로 옮겨
tautology 가 성립할 수 없는 구조로 고쳐졌고, 실행 확인 결과 21/21 신규·기존 테스트와
소비자 측 56개 테스트 모두 green 이다. 남은 사항은 전부 이번 diff 스코프 밖의 pre-existing
잔여 리스크(엔티티→DTO 경계의 `as` 캐스트)이거나 의도된 스코핑(`InteractAckDto` 의 미변경
필드 미검증)으로, 차단 사유가 되는 발견은 없다.

## 위험도

NONE
