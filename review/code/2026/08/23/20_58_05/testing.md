# 테스트(Testing) 리뷰

## 검증 수행 내역 (재현 확인)

- `re-run.dto.spec.ts` 단독 실행(`npx jest src/modules/executions/dto/re-run.dto.spec.ts`):
  `1 suite / 2 tests passed`.
- 뮤테이션 독립 재현: `re-run.dto.ts` 의 `type: 'object', additionalProperties: true,` 를
  `type: Object,` (직전 축약형)로 되돌린 뒤 재실행 →
  `[캐너리] inputOverride 를 열린 map 으로 광고한다` 케이스만 정확히 RED
  (`expect(inputOverride.additionalProperties).toBe(true)` → `Received: undefined`,
  바로 위 `expect(inputOverride.type).toBe('object')` 단언은 여전히 통과). `tsc --noEmit`
  에서 이 뮤턴트로 인한 신규 타입 에러 없음(유효한 뮤턴트, 컴파일 차단으로 인한 거짓 RED
  아님). `cp` 백업으로 원상 복구 후 재실행 → 2/2 GREEN 재확인.
- `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts` 의 자매 스펙 패턴
  (`execution-status-response.dto.spec.ts`)을 직접 열어 대조 — `SchemaObject` 타입 파생
  (`ApiResponseSchemaHost['schema']`), `try/finally` 로 `app.close()` 보장 패턴이 동일하게
  적용돼 있음을 확인. 이전 라운드(`20_36_01`)의 WARNING #1·#2(maintainability, 자매 관례
  미준수)는 현재 diff 에서 이미 반영된 상태다.
- `MASKED_VALUE_RESUBMITTED` 텍스트가 `trigger-parameter.types.ts` 의 실제 에러 코드로
  존재함을 grep 으로 확인 — `[가드]` 테스트가 고정하는 description 문구가 허구가 아니라
  실제 런타임 거부 코드를 반영한다.

## 발견사항

- **[INFO]** `[가드]` 테스트(파일 1 게이트 74~79행)가 자유 텍스트 `description` 의 부분
  문자열(`MASKED_VALUE_RESUBMITTED`)을 단언한다. 향후 이 캐비엇 문구를 스타일만 다듬어도
  (동의어 교체 등, 마커 거부 동작 자체는 불변) 테스트가 깨질 수 있다.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts` — `it('[가드] 마커 거부 캐비엇을...')` 블록 (게이트 74~79행)
  - 상세: 이 결합은 의도적이다 — EIA §R17 에 따라 마커 거부 캐비엇이 클라이언트에 노출되는
    OpenAPI 계약(문서 텍스트)이어야 한다는 요구를 "고정"하는 것이 테스트의 목적 자체다.
    다만 유지보수자가 이 테스트를 "브리틀하다"고 오판해 삭제하지 않도록, 실패 시 assertion
    메시지나 근처 주석에 "문구가 아니라 캐비엇의 존재를 고정한다"는 의도를 한 줄 더 명시하면
    다음 사람의 판단 비용이 준다.
  - 제안: blocking 아님 — 현재도 파일 상단 주석(`// 이 diff 가 바꾼 문구는 아니다...`)이
    의도를 충분히 설명하고 있어 조치 불요.

- **[INFO]** (이전 라운드 잔존, 재확인) 캐너리가 `inputOverride` 의 `required` 여부는
  검증하지 않는다. 이번 diff 스코프(`type: Object` → `type: 'object' + additionalProperties`)와
  무관하고 `@IsOptional()` 자체는 불변이라 회귀 위험은 낮다.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts` — `describe('ReRunRequestDto — OpenAPI 노출', ...)` 블록
  - 상세: 자매 파일(`execution-status-response.dto.spec.ts`)은 `required` 도 별도로 검증하는
    케이스가 있어(예: variant 필수 필드 블록) 대조상 갭으로 보이나, `inputOverride` 는 이번
    diff 의 변경 축이 아니다.
  - 제안: 필요 시 `expect(schema.required ?? []).not.toContain('inputOverride')` 한 줄 저비용
    보강 가능하나 지금 차단 사유는 아니다.

## 강점 (특기할 부분)

- **비어있지 않은(non-vacuous) 회귀 가드 — 독립 재현으로 재확인**: 직접 뮤테이션을 넣어
  `additionalProperties` 단언 한 줄만 정확히 실패하고 `type` 단언은 두 형태 모두 통과함을
  확인했다 — 파일 상단 JSDoc 의 표("실제 차이는 그 아래 한 칸")·인라인 주석("이 한 칸이
  축약형과 다수 패턴을 가르는 지점이다")과 실측이 정확히 일치한다.
- **생성 문서(`SwaggerModule.createDocument`) 기반 검증**: 데코레이터 메타데이터만
  비교했다면 두 형태가 수렴하는 지점(`type: object`)과 갈리는 지점(`additionalProperties`)을
  가르지 못했을 것이다. 실제 산출물을 검증 대상으로 삼아 캐너리의 판별력을 정확히 필요한
  곳에 배치했다.
- **테스트 격리·Mock 적절성**: `ProbeController`/`ProbeModule` 은 생성자 의존성이 없는
  순수 데코레이터 프로브라 DB/Redis 등 외부 의존 없이 완전히 격리 실행된다. Mock 이 전혀
  없고 실제 NestJS/Swagger 파이프라인을 그대로 태운다 — "실제 동작과의 괴리"가 구조적으로
  없다.
- **테스트 용이성**: `ReRunRequestDto` 는 프로덕션 코드 수정 없이 별도 `probe` 컨트롤러로
  감싸는 것만으로 스키마 산출 검증이 가능했다 — 의존성 주입 구조를 바꿀 필요가 없는
  이상적인 케이스.
- **관례 정합**: 자매 스펙 3개(`workflows-execute-body.spec.ts`,
  `interact-ack-response.dto.spec.ts`, `execution-status-response.dto.spec.ts`)와 동일한
  `SchemaObject` 파생·`try/finally` 정리 패턴을 따른다 — 직접 대조로 확인.

## 요약

새로 추가된 `re-run.dto.spec.ts` 는 데코레이터 메타데이터가 아니라 실제
`SwaggerModule.createDocument` 산출물을 검증하는 회귀 캐너리로, 축약형(`type: Object`)과
명시형(`type: 'object' + additionalProperties: true`)의 실질적 차이(닫힌 모델처럼 보여
빈 인터페이스가 생성되는지 vs 열린 map 으로 노출되는지)를 정확히 겨냥한다. 직접 뮤테이션을
넣어 재현한 결과 캐너리는 의도한 단언(`additionalProperties`)에서만 정확히 RED 로 전환되고
원상 복구 시 GREEN 이며, `tsc` 상 유효한 뮤턴트임도 확인했다 — 거짓 GREEN/거짓 RED 가능성이
낮다. Mock 없이 순수 DI 프로브로 완전히 격리 실행되고, 자매 DTO 스펙 3개와 동일한 컨벤션
(`SchemaObject` 타입 파생, `try/finally` 앱 정리)을 따른다 — 이전 리뷰 라운드(`20_36_01`)에서
지적된 관례 미준수 WARNING 2건은 이미 반영된 상태임을 직접 코드 대조로 확인했다. 남은 지적은
전부 INFO(자유 텍스트 description 결합의 의도된 브리틀함, `required` 미검증 — 둘 다 이번
diff 스코프 밖이거나 의도된 설계)로 blocking 사유가 없다.

## 위험도

NONE
