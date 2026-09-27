# Rationale 연속성 검토 — spec/2-navigation/ (--impl-prep, plan: folders-contract-e2e)

## 검토 범위

- target: `plan/in-progress/folders-contract-e2e.md` (폴더 모듈 `FolderDto.parentId` §5.4 정합화 + `folders.e2e-spec.ts` 신설)
- 대조: `spec/2-navigation/1-workflow-list.md` §3.1·Rationale §3, `spec/2-navigation/2-trigger-list.md`(전체 Rationale R-1~R-17), `spec/2-navigation/3-schedule.md`(Rationale 발췌), `spec/5-system/2-api-convention.md` §5.4·Rationale, `spec/1-data-model.md` §2.5 Folder·Rationale("`code:` 에 전용 e2e 가드 셋"), `codebase/backend/src/modules/folders/**`(현재 코드), `swagger-dto-contract.spec.ts`(`EXPECTED_OPTIONAL_NULLABLE_DRIFT`)를 직접 Read 로 실측 대조.

## 발견사항

- **[WARNING]** 신설 `folders.e2e-spec.ts` 를 `1-workflow-list.md` frontmatter `code:` 에 등재하는 계획이 없음 — 같은 번들의 확립된 관행과 거리
  - target 위치: `plan/in-progress/folders-contract-e2e.md` "방향" §4 (e2e 신설 `folders.e2e-spec.ts`) — frontmatter 갱신 언급 없음
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` → `### code: 에 전용 e2e 가드 셋 (2026-09-19)` ("frontmatter `code:` 에 이 문서의 사실을 기계적으로 지키는 e2e 셋을 넣었다... 이제 그 파일을 고치는 변경도 이 문서와의 대조(`--impl-done`)를 거친다"). 같은 원칙이 `spec/2-navigation/2-trigger-list.md` frontmatter 에서 광범위하게 실천된다 — 트리거 도메인의 사실을 시행하는 e2e/unit 파일마다 "시행 코드 — §N ... 을 고정한다" 주석과 함께 개별 등재됨(`trigger-workflow-ref.e2e-spec.ts`, `trigger-update-save-window.e2e-spec.ts`, `trigger-deletion-releases-resources.e2e-spec.ts` 등).
  - 상세: `data-model.md` Rationale 은 "자기 기능의 인덱스·컬럼을 곁들여 확인하는 **기능 e2e**"는 데이터 모델 문서의 `code:` 에 넣지 않는다고 명시한다 — 그 e2e 가 **다른 문서가 소유한 사실**을 부수적으로만 건드리기 때문이다. 반대로 신설되는 `folders.e2e-spec.ts` 는 `1-workflow-list.md` §3.1(폴더 API 계약)이 **직접 소유**하는 사실 — 루트 생성 응답의 `parentId` 부재 표현 — 을 1차로 시행한다. 이는 `data-model.md` 가 "넣지 않는" 부수-확인 e2e 부류가 아니라, `2-trigger-list.md` 가 "넣는" 자기-도메인 1차 시행 e2e 부류에 해당한다. 현재 `1-workflow-list.md` frontmatter `code:` 는 `codebase/backend/src/modules/folders/**` 글롭만 가지고 있어(`codebase/backend/test/**` 경로는 어떤 글롭에도 걸리지 않음), 계획대로면 이 e2e 시행 파일이 `--impl-done`/`code:` 대조 표면 밖에 남는다.
  - 제안: plan §7("트래커") 또는 §4 에 `1-workflow-list.md` frontmatter `code:` 에 `codebase/backend/test/folders.e2e-spec.ts`(및 신설 `folder-response.dto.spec.ts` — 관례상 DTO 옆이라 별도 등재 불요할 수 있음, 판단 필요) 를 "시행 코드 — §3.1 루트 폴더 생성 응답의 `parentId` 표현을 고정" 주석과 함께 추가하는 단계를 명시. 의도적으로 제외한다면 `data-model.md` Rationale 의 배제 기준("타 문서가 소유한 사실을 부수 확인")에 해당하는 근거를 plan 에 적어야 한다.

## 확인했으나 문제 없음으로 판정한 항목 (기각 후보)

- **§5.4 방향 정합**: plan 이 제안하는 `FolderDto.parentId` → `@ApiProperty({ nullable: true })` + `parentId: string | null` 전환은 `spec/5-system/2-api-convention.md` §5.4 의 **기본값**("이 필드는 응답 계약에 상시 존재하며, 지금은 값이 없다" = `null`)과 정확히 일치한다. 현재 optional+nullable 조합은 §5.4 가 "어느 쪽에서도 틀렸다"고 명시하는 금지 조합이며, 이를 고치는 것은 기각된 대안의 재도입이 아니라 §5.4 원칙의 **준수**다.
- **키-생략 정당화 부재 확인**: §5.4 는 키 생략을 (a) 타 표면과의 wire parity, (b) 소비자가 부재를 정상 경로로 다루는 선택적 컨텍스트로만 허용한다. `1-workflow-list.md` §3.1 은 "폴더 관리 UI 는 아직 없다 — 필터 옵션 조회 전용"이라 POST 응답을 읽는 소비처 자체가 없음을 명시하며, 다른 표면(SSE/WS)이 이 응답과 wire parity 를 요구하는 근거도 spec 전체에서 발견되지 않았다. 즉 현재의 키 생략은 (a)/(b) 어느 근거도 갖지 못한 미문서화 이격이지 의도된 설계가 아니다 — plan 의 "이격(TypeORM 부분 반환)" 진단과 일치하며, 이를 고치는 데 새 Rationale 이 필요한 "결정의 번복"이 아니다.
- **`EXPECTED_OPTIONAL_NULLABLE_DRIFT` 축소**: 이 래칫은 78건 베이스라인에서 모듈 단위로 점진 상환하는 것이 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커와 선행 PR(`workflow-version-creator`, #1411~#1413)들의 확립된 패턴이다. 이번 plan 이 "이 PR 은 FolderDto 하나"로 좁힌 것은 그 패턴을 그대로 따른 것이며 반례가 없다.
- **폴더 계층 무결성 Rationale(§3, 2026-07-05)**: depth/cycle 검증 관련 원칙과 이번 plan(응답 표현 정합화)은 별개 축이라 충돌 없음.
- **`1-data-model.md` §2.5 Folder**: `parent_id` 응답 표현 방식에 대한 기존 결정 문구가 없어, 이번 정정이 데이터 모델 Rationale 과 충돌하지 않는다.

## 요약

이번 plan(`folders-contract-e2e`)이 제안하는 `FolderDto.parentId` 의 optional+nullable → required+nullable 전환과 루트 폴더 생성 시 `parentId: null` 명시 저장은, `spec/5-system/2-api-convention.md` §5.4 의 명시적 기본 원칙을 따르는 정합화이며 spec/2-navigation 어디에도 이를 반대로 결정한 Rationale 이 없다 — 기각된 대안의 재도입이나 무근거 번복은 발견되지 않았다. 유일한 지적은 신설 e2e 시행 파일을 `1-workflow-list.md` frontmatter `code:` 에 등재하는 절차가 plan 에 빠져 있다는 점으로, 이는 `spec/1-data-model.md` Rationale 이 명시하고 `2-trigger-list.md` 가 광범위하게 실천하는 "자기 도메인 1차 시행 e2e 는 그 spec 문서의 `code:` 에 등재한다"는 확립된 관행과의 거리(WARNING)다. 전체적으로 이번 변경은 Rationale 연속성 관점에서 안전하다.

## 위험도

LOW
