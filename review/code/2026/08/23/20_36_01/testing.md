# 테스트(Testing) 리뷰

## 검증 수행 내역 (재현 확인)

- `re-run.dto.spec.ts` 단독 실행: 2건 PASS.
- 뮤테이션 재현: `re-run.dto.ts` 의 `type: 'object', additionalProperties: true` 를 원래
  축약형 `type: Object` 로 되돌린 뒤 재실행 → `[캐너리] inputOverride 를 열린 map 으로
  광고한다` 케이스만 정확히 RED (`additionalProperties` 단언 실패, `type` 단언은 여전히
  통과 — 두 형태 모두 `type: object` 로 해석된다는 plan 의 주장과 일치). 파일을 원상 복구한
  뒤 backend 전체 스위트 실행 → `432 suites / 8,952 passed`(1 skipped) GREEN, plan 이 적은
  수치(8,950→8,952)와 일치.
- 저장소 전체에서 `type: Object` 축약형 잔존 여부 grep → 코드 내 실사용 0건(주석 1건만
  잔존, 근거 설명용). "실측 후 저장소 전체 축약형 0건" 서술과 일치.

## 발견사항

- **[INFO]** OpenAPI 문서 생성 boilerplate(`Test.createTestingModule` → `createNestApplication`
  → `SwaggerModule.createDocument`)가 `execution-status-response.dto.spec.ts`,
  `interact-ack-response.dto.spec.ts` 와 함께 3번째로 중복된다.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts:39-51` (전체 파일
    컨텍스트 게이트 기준)
  - 상세: 저장소에 공유 헬퍼(`buildDocument(controllers)` 류)가 없어 매 DTO 스키마 캐너리마다
    동일한 5~6줄이 반복된다. 다만 이는 이번 PR 이 새로 만든 패턴이 아니라 기존 2개 파일이
    이미 확립한 컨벤션을 그대로 따른 것이라 이번 diff 의 결함은 아니다.
  - 제안: 지금 당장 blocking 은 아니고, 4번째 사례가 생기는 시점에 `test/swagger-probe.ts`
    류 공유 헬퍼로 추출을 고려할 만하다는 정도의 메모.

- **[INFO]** 캐너리가 `inputOverride` 의 `type`/`additionalProperties`/`description` 세 가지만
  검증하고, 같은 프로퍼티의 `required` 여부(생성 스키마에서 optional 로 남는지)는 확인하지
  않는다.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts:58-63`
  - 상세: 이번 diff 의 범위(축약형→다수 패턴 전환)에서 `@IsOptional()` 자체는 변경되지 않았고
    회귀 위험도 없어 스코프 밖으로 보는 것이 합리적이다. 다만 향후 `inputOverride` 근처를
    건드리는 PR 이 실수로 required 를 흘리는 경로는 이 캐너리로 못 잡는다는 점만 기록.
  - 제안: 필요 시 `expect(schema.ReRunRequestDto.required ?? []).not.toContain('inputOverride')`
    한 줄 추가로 저비용 보강 가능 — 지금 막을 이유는 없음.

- **[INFO]** 동일 DTO 의 `useOriginalInput`/`dryRun` 필드는 이 캐너리도, 다른 어떤 스펙도
  OpenAPI 산출 형태를 검증하지 않는다(둘 다 `@IsBoolean()` 이라 이번 결함 클래스와는 무관).
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:8-43`
  - 상세: 이번 diff 가 만든 갭이 아니라 선존 갭이며, boolean 프로퍼티는 축약형/명시형 차이가
    발생하는 지점(object 타입의 `additionalProperties`)과 무관해 같은 회귀 클래스에 노출되지
    않는다. 참고용 기록.

## 강점 (특기할 부분)

- **생성 문서 기반 검증**: 데코레이터 메타데이터만 비교했다면 두 형태가 `createDocument`
  단계에서 수렴하는 부분(`type: object`)과 갈리는 부분(`additionalProperties`)을 못 갈랐을
  것 — 실제로 plan 문서가 이 함정을 실측으로 짚고 옳은 검증 지점을 선택했다. 자매 파일
  (`execution-status-response.dto.spec.ts`)과 동일한 "실제 동작 기반" 철학을 공유한다.
  Mock 이 전혀 없고 `ProbeController` 는 생성자 의존성이 없어 DB/Redis 등 외부 의존 없이
  완전히 격리 실행된다 — mock 적절성·테스트 격리 두 관점 모두 우수.
- **비어있지 않은(non-vacuous) 회귀 가드**: 뮤테이션 실측으로 이 캐너리가 실제로 막는
  구체적 회귀(축약형 복귀 시 `additionalProperties` 소실)를 확인했다. `type` 단언은 두 형태
  모두 통과하므로 그 자체로는 판별력이 없고, 실제 판별은 `additionalProperties` 단언 한 줄이
  전담한다는 사실도 재현으로 확인됨 — 주석("이 한 칸이 축약형과 다수 패턴을 가르는 지점이다")과
  실측이 정확히 일치한다.
  - 마이너 관찰: `type` 단언(line 60, gate 기준)은 현재 테스트 내에서 두 형태를 가르는 데
    기여하지 않는 명제다(둘 다 `object`). 회귀를 막는 것은 `additionalProperties` 단언뿐이며
    이는 테스트 결함이 아니라 문서화된 사실(파일 상단 JSDoc 표)과 일치하는 의도된 이중 assert.
- **가독성**: `describe`/`it` 문구와 파일 상단 JSDoc 이 "왜 메타데이터가 아니라 생성 문서를
  보는가"를 표까지 곁들여 명확히 설명한다. 향후 유지보수자가 이 테스트를 삭제/단순화하려는
  유혹을 근거로 막는 형태.
- **테스트 용이성**: `ReRunRequestDto` 는 순수 데코레이터 클래스라 프로덕션 코드 수정 없이
  probe 컨트롤러로 감싸는 것만으로 스키마 산출을 검증할 수 있었다 — 의존성 주입 구조를
  바꿀 필요가 전혀 없었던 이상적인 케이스.
- **plan 문서의 검증 기준 자기 일치**: `plan/in-progress/rerun-dto-shorthand.md` 가 적은
  "뮤테이션 RED", "8,950→8,952", "저장소 전체 축약형 0건" 세 가지 정량 주장을 모두
  독립적으로 재현해 확인했으며 전부 일치했다.

## 요약

새로 추가된 `re-run.dto.spec.ts` 는 데코레이터 메타데이터가 아니라 실제 `SwaggerModule.createDocument`
산출물을 검증하는 방식으로, 축약형(`type: Object`)과 명시형(`type: 'object' + additionalProperties: true`)의
실제 차이(빈 인터페이스 생성 vs 열린 map 노출)를 정확히 겨냥한 회귀 캐너리다. 뮤테이션 재현
결과 축약형으로 되돌리면 의도한 단언만 정확히 RED 로 바뀌고, 원상 복구 후 backend 전체
스위트(8,952 passed)가 GREEN 임을 직접 확인했다. Mock 없이 순수 DI 구조로 완전히 격리
실행되며, 자매 DTO 스펙과 동일한 컨벤션을 따라 가독성도 높다. 지적한 항목은 전부 INFO 수준
(boilerplate 중복은 기존 컨벤션의 반복이지 신규 결함 아님, `required` 검증 부재는 이번
diff 스코프 밖)이며 blocking 사유가 없다.

## 위험도

NONE
