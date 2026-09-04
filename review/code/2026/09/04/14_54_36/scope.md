# 변경 범위(Scope) 리뷰

## 검토 대상 요약

- `CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, 응답 DTO 20개 파일.
- 목적: `#1277`/`#1280` 로 확정된 API 규약 §5.4(응답 바디 전용) 문면에 맞춰, 상시 존재하는
  응답 필드 83곳의 `@ApiPropertyOptional({ nullable: true }) field?: T | null` →
  `@ApiProperty({ nullable: true }) field: T | null` 로 전환.
- `@ApiPropertyOptional(...) field?: ...` → `@ApiProperty(...) field: ...` 치환 건수를 diff 에서
  직접 세어 **83건**임을 확인 — CHANGELOG·plan 이 주장하는 "응답측 83곳" 수치와 일치한다.

## 발견사항

- **[INFO]** 실질 변경 범위는 20개 응답 DTO 파일 전부 명시된 목적(§5.4 정합화, 요청 DTO 제외)에
  국한된다. 각 파일에서 `?` 제거와 `ApiPropertyOptional`→`ApiProperty` 전환만 일어났고, 그 외
  필드·주석·포맷은 손대지 않았다.
  - 위치: 전체 20개 DTO 파일(`codebase/backend/src/modules/**/dto/responses/*-response.dto.ts`)
  - 상세: 각 파일에서 diff 는 대상 필드의 데코레이터/타입 줄에만 있고, 인접 필드·주석·JSDoc 은
    그대로다. `trigger-response.dto.ts` 의 `cronExpression?`/`timezone?` 처럼 진짜 optional(키
    생략) 필드는 건드리지 않고 남겨뒀다 — "상시 존재 null" 과 "키 생략" 을 정확히 구분해서 처리한
    흔적.
  - 제안: 없음(정상).

- **[INFO]** `import { ApiProperty, ApiPropertyOptional }` → `import { ApiProperty }` 축소는
  해당 파일에서 `ApiPropertyOptional` 이 실제로 더 이상 쓰이지 않는 경우에만 이뤄졌다. 반대로
  `execution-response.dto.ts`(`NodeExecutionSummaryDto.nodeLabel?`), `node-response.dto.ts`
  (`NodePortDto.type?` 등), `integration-response.dto.ts`(`ServiceCatalogEntryDto.description?`
  등), `workflow-response.dto.ts`(`GraphWarningResultDto.params?`) 는 다른 필드가 여전히
  `ApiPropertyOptional` 을 쓰므로 import 를 그대로 유지했다 — 사용하지 않는 import 정리도, 필요한
  import 의 실수 삭제도 없다.
  - 위치: 위 4개 파일(각 파일의 import 줄 — diff 자체에 해당 파일의 import hunk 가 없음, 즉
    미변경)
  - 제안: 없음(정상).

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 변경은 "§5.4 drift
  배치" 미체크 항목을 체크(`[x]`)하고 완료 근거(타입체커로 83곳 무오류 확인, 21곳 요청 DTO 제외
  사유, 분류 재정정 이력)를 남기는 plan 라이프사이클 갱신이다. 코드 변경과 1:1 대응하는 상태
  갱신이라 범위 밖 수정이 아니다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (`## 후속` 섹션의
    "§5.4 drift 배치" 항목)
  - 제안: 없음(정상).

- **[INFO]** `CHANGELOG.md` 신규 Unreleased 섹션은 이번 diff 가 만든 바로 그 83곳 변경을
  요약·근거 서술한다. 분류 오류 정정 이력까지 포함해 다소 상세하지만, 전부 이 diff 자체를
  설명하는 내용이라 범위 밖 서술은 아니다.
  - 위치: `CHANGELOG.md` (파일 최상단 신규 `## Unreleased` 블록)
  - 제안: 없음(정상).

## 요약

20개 응답 DTO 파일·CHANGELOG·plan 트래커까지 22개 파일이 변경됐지만 전부 하나의 단일 목적
(§5.4 응답 바디 규정에 맞춰 상시 존재 nullable 필드의 `required` 를 `true` 로 정정)에 정확히
수렴한다. 요청 DTO(21곳)는 의도적으로 제외됐고 실제로 diff 에 등장하지 않으며, import 정리는
해당 파일의 실제 사용 여부에 따라 정확히 이뤄졌다. 불필요한 리팩토링·포맷팅 변경·주석 변경·기능
확장·무관한 파일 수정은 발견되지 않았다. plan/CHANGELOG 갱신도 이 diff 를 설명하는 필수
부속물이라 범위 밖이 아니다.

## 위험도

NONE
