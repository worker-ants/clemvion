# 테스트(Testing) 리뷰

## 검증 절차 (독립 재현)

- `npx jest src/modules/workflows/workflows-execute-body.spec.ts` 실행 — **10 passed / 10 total**, GREEN.
- plan(`swagger-decisions.md`)이 주장한 뮤테이션("`deprecated: true` 제거 → 신규 단언만 RED")을
  직접 재현: `execute-workflow.dto.ts:66` 의 `deprecated: true,` 줄을 `sed` 로 제거하고 재실행 →
  `[결정] \`input\` 만 deprecated 로 표시된다` **단 1건만 FAIL**, 나머지 9건 GREEN — 주장과 정확히
  일치. 삭제 전 `tsc --noEmit` 로 이 파일·spec 관련 신규 타입 오류가 없음을 확인(기존 baseline
  오류만 존재, 대상 파일과 무관). `cp` 백업본으로 원복 후 `git status`/`cmp` 로 바이트 동일 확인.
- 이번 라운드의 실질 코드 diff(`execute-workflow.dto.ts`, `workflows-execute-body.spec.ts`)는 직전
  라운드(`review/code/2026/08/23/12_22_08`)에서 이미 리뷰된 것과 동일하다 — `RESOLUTION.md` 가 그
  라운드의 Warning 3건을 전부 처리했는데, 셋 다 `spec/conventions/swagger.md` ·
  `plan/in-progress/swagger-decisions.md` 문서 정합성 문제였고 테스트 코드나 DTO 코드에는 손을 대지
  않았다(INFO#7 "안내 문구 substring 미검증"은 명시적으로 **"안 한다"** 로 처분됨). 따라서 테스트
  관점에서 이번 라운드는 직전 라운드 대비 신규 코드 변화가 없다.

## 발견사항

- **[INFO]** 직전 라운드에서 이미 식별·처분된 사항의 재확인: `input` description 에 추가된 안내
  문구("신규 통합은 `parameterValues` 를 쓴다.")는 여전히 `[가드] 마커 거부 규칙이 두 필드
  description 에 모두 드러난다` 테스트의 `'마커'` substring 단언으로만 간접 커버되고, 문구 자체는
  직접 단언되지 않는다.
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:63`(description 값),
    `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts:174-179`(가드 테스트)
  - 상세: `RESOLUTION.md`(`review/code/2026/08/23/12_22_08/RESOLUTION.md`) INFO#7 에서 "순수 안내
    텍스트라 삭제돼도 계약은 안 깨진다. 가드는 결정(`deprecated` 플래그)에 걸어 뒀다"는 사유로 조치
    불요 처분됨 — 재지적하지 않는다. 결정된 범위를 존중한다.
  - 제안: 없음(기 처분 존중).

- **[INFO]** 신규 `[결정]` 테스트는 `beforeAll` 로 1회 생성된 `schema` 를 읽기 전용으로만 사용해
  테스트 간 상태 의존성이 없다 — 실행 순서를 바꿔도 결과가 동일함을 코드 구조로 확인.
  - 위치: `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts:118-141`(`beforeAll`),
    `:163-168`(신규 단언)
  - 상세: 결함이 아니라 격리 검증 결과 기록.

## 평가 요약 (관점별)

1. **테스트 존재 여부**: 이번 diff 의 유일한 관찰 가능 효과(`deprecated: true` 플래그)에 정확히
   대응하는 단위 테스트가 존재한다(`workflows-execute-body.spec.ts:163-168`).
2. **커버리지 갭**: 위 INFO 1건(안내 문구 전문 미검증, 기 처분됨) 외 갭 없음. DTO 자체가 데코레이터
   선언뿐이라 표면이 작다.
3. **엣지 케이스**: `parameterValues`(preferred)가 실수로 `deprecated: true` 로 함께 바뀌는 실패
   모드를 막는 **대조군**(`preferred.deprecated).toBeFalsy()`)이 같은 테스트에 포함돼 있고, 뮤테이션
   재현으로 그 대조군이 실제로 판별력을 갖는지(플래그 제거 시 이 단언만 단독 RED) 실측 확인했다.
4. **Mock 적절성**: mock 없이 실제 `SwaggerModule.createDocument` + 실제 Nest 모듈 컴파일로 OpenAPI
   문서를 렌더링해 검증 — "데코레이터만 맞고 실제 렌더링은 다르다"는 괴리 위험이 구조적으로 없다.
   `CustomValidationPipe` 캐너리도 실제 파이프 인스턴스 사용.
5. **테스트 격리**: `beforeAll` 공유 fixture 는 읽기 전용, `it.each` 대조군은 매회 새
   `CustomValidationPipe` 인스턴스 생성 — 순서 의존성 없음.
6. **테스트 가독성**: `[캐너리]`/`[가드]`/`[결정]` 접두사 컨벤션 일관 유지, JSDoc 에 "왜 대조군이
   필요한가"까지 명시돼 의도가 명확하다.
7. **회귀 테스트**: 기존 캐너리(`@Body()` 미타입, 여분 키 통과, DTO 타입 시 거부) 및 기존 스키마
   렌더링 테스트(`additionalProperties: true`, 마커 substring)가 이번에도 GREEN — 실측 재확인 완료.
8. **테스트 용이성**: 데코레이터만 가진 순수 선언 클래스라 DI 없이 리플렉션 메타데이터로 직접 검증
   가능한 구조를 유지.

## 요약

이번 라운드의 실질 코드(`execute-workflow.dto.ts`, `workflows-execute-body.spec.ts`)는 직전 리뷰
라운드(`12_22_08`)와 동일하며, 그 라운드의 Warning 3건은 모두 문서(`swagger.md`,
`swagger-decisions.md`) 정합성 문제로 테스트/코드에는 영향이 없었고 전부 반영·처분됐다. 본 라운드에서
`npx jest`(10/10 GREEN)와 뮤테이션(`deprecated: true` 제거 → 신규 단언 단독 RED)을 독립적으로 재실행해
plan 의 주장을 재확인했다. 유일한 잔존 사항은 안내 문구 전문 미검증(INFO, 이미 "안 한다"로 처분됨)
뿐이며 이는 테스트 관점에서 실질적 위험이 아니다. 테스트 격리·가독성·mock 미사용(실동작 검증) 모두
양호하다.

## 위험도

NONE
