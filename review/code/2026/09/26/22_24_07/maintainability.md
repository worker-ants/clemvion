# 유지보수성(Maintainability) 리뷰 — canvas-save-typed (머지 후 재검토)

## 검토 범위 및 방법

프롬프트에 실린 26개 파일 중 실제 애플리케이션/테스트 코드는 4개(`CHANGELOG.md`, `workflow-response.dto.spec.ts`,
`workflow-response.dto.ts`, `workflow-crud.e2e-spec.ts`)이고, 나머지 22개는 이 작업 자신의 `plan/**` 문서 및
직전 `/ai-review` 1R(`review/code/2026/09/26/22_05_52/**`)·`consistency-check`(`review/consistency/2026/09/26/21_38_44/**`)
산출 보고서다. 후자는 생성된 리뷰 리포트/메타데이터이지 함수·클래스로 구성된 애플리케이션 코드가 아니므로 가독성·
함수 길이·중첩·순환 복잡도 같은 점검 관점이 적용되지 않는다 — 해당 파일들은 이 리뷰의 대상에서 제외하고, 실제
소스 4개 파일을 게이트 숫자 대조 없이 `Read` 로 직접 열어 정확한 줄 번호로 확인했다.

직전 1R 라운드의 maintainability 리뷰(`review/code/2026/09/26/22_05_52/maintainability.md`)가 이미 이 diff의
핵심 변경(`workflow-response.dto.ts`, e2e C/I)에 대해 INFO 2건을 냈고, `RESOLUTION.md`에서 그중 코드 관련 항목은
"조치 불요(swagger 규약 §3 준수)"로 처분됐다. 아래 발견사항은 그 처분을 재확인한 것이며 새 결함이 아니다.

## 발견사항

- **[INFO]** 신규 인라인 주석이 형제 JSDoc과 스타일이 다르다 (재확인, 처분 완료)
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:76-77`
  - 상세: `CanvasSaveResultDto`의 다른 모든 프로퍼티는 `/** ... */` JSDoc으로 문서화되는데, `nodes`/`edges` 선언
    직전에 추가된 "왜 타입 없는 객체로 두면 안 되는가" 설명은 `//` 라인 주석 2줄이다. 직전 리뷰 라운드에서 같은
    항목이 지적됐고, `RESOLUTION.md`가 "swagger 규약 §3에 따라 JSDoc은 공개 OpenAPI 설명이 되므로 `//`가 맞다"는
    근거로 조치 불요 처분했다 — 이 구분(공개 문서용 JSDoc vs 내부 전용 `//`)은 타당하고 일관되게 적용돼 있다.
  - 제안: 조치 불요. 재지적 목적이 아니라 다음 리뷰어가 같은 항목을 새 결함으로 다시 올리지 않도록 처분 이력을 기록.

- **[INFO]** 저장 응답 형태 대조 블록이 e2e C·I 두 곳에 거의 동일하게 반복된다
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:274-279`(C) 와 `:629-635`(I) — `toHaveLength(5)` ·
    `toHaveLength(2)` · `assertMatchesContract(…, await contractForDto(CanvasSaveResultDto))` 3줄 구성
  - 상세: 두 테스트는 서로 다른 코드 경로(C=신규 생성, I=기존 갱신)를 검증하는 것이 목적이라 각 테스트가
    자기완결적으로 읽혀야 하는 이 파일의 기존 관례에는 맞는다. 현재 2회 반복(약 5~6줄)은 헬퍼로 뽑을 만큼의
    누적 중복은 아니다.
  - 제안: 조치 불요. 세 번째 호출부가 생기면 `expectCanvasSaveShape(body.data, { nodeCount, edgeCount })` 류의
    공용 헬퍼 추출을 고려.

- **[INFO]** e2e I 테스트 자체의 구조는 명확하고 목적이 잘 드러난다
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:593-636` (`it('I. 버전 복원 → …')`)
  - 상세: 워크플로우 생성 → 저장 → 버전 목록 조회 → 복원 → 계약 대조의 5단계가 순차적으로 나열되고, 각 단계마다
    "왜 이 단언이 필요한가"를 설명하는 주석(예: `:608` "빈 배열이어도 통과한다", `:626` "갱신 가지를 탔다는 증거")이
    붙어 있어 매직 넘버(`5`, `2`)의 근거(`buildFiveNodeGraphPayload()`)와 함께 의도가 분명하다. 중첩 깊이·조건분기
    없이 선형으로 읽히며 지적할 결함이 없다.
  - 제안: 없음 (모범 사례로 기록).

## 요약

이번 diff의 실제 코드 변경분(`workflow-response.dto.ts` 필드 타입 선언 3곳, 신규 unit 캐너리 30줄, e2e 신규 케이스
I 44줄)은 스코프가 작고 단일 목적(응답 `nodes`/`edges`를 기존 `NodeDto[]`/`EdgeDto[]`로 정밀화)에 정확히 수렴한다.
네이밍은 기존 컨벤션(`workflow: WorkflowDto` 패턴과 동일하게 `type: () => [Dto]`)을 그대로 따르고, 함수 길이·중첩
깊이·순환 복잡도 모두 특이사항이 없으며, 새로 추가된 코드에서 발생한 진짜 중복이나 매직 넘버 오남용도 없다.
직전 1R 라운드가 이미 지적한 INFO 2건(주석 스타일, 소규모 중복)은 재확인 결과 모두 타당하게 처분돼 있어 재조치가
필요 없다. `plan/**`·`review/**` 산출물은 애플리케이션 코드가 아니므로 이 관점의 평가 대상에서 제외했다.

## 위험도
NONE
