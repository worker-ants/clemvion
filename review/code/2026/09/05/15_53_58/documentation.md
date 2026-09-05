# 문서화(Documentation) 리뷰

## 검증 방법

`origin/main..HEAD` 는 13개 커밋이다(`0498d7362` impl-prep 산출물 → `ab6fa6863`/`df8be1859`
§5.4 검증자 신설+배선 → `abc87b2d4` plan 갱신 → `45c1cdf63` 감사 로그 유출 수정+검증자 중첩
하강 → `2fa650b5a`/`9d0b876ad` 13_49_54 라운드 산출물 → `db45d1b09` 순환 가드+oneOf 수정 →
`ee755efbe` 14_39_31 라운드 산출물 → `bf02fe328` union `allowUndeclared` 캐너리 → `4d8118956`
15_12_02 라운드 산출물 → `5fcb5c625` 형제 필드 좁히기+`ExecutionDto` 스키마 가드 신설 →
`6a6621ecd` 15_31_41 라운드 산출물). 프롬프트가 조립한 82개 파일 중 실질 코드/문서 변경은
파일 1~13(`CHANGELOG.md`, `audit-logs.service.ts`/`.spec.ts`, `execution-response.dto.spec.ts`,
`response-contract.ts`/`.spec.ts`, e2e 4곳, `plan/in-progress/*.md` 3곳)이고 나머지는 이전
네 라운드(`13_49_54`/`14_39_31`/`15_12_02`/`15_31_41`)와 impl-prep/impl-done
consistency-check(`12_48_13`/`15_31_43`) 산출물이 저장소에 커밋된 것이다.

이전 라운드(`15_31_41`)가 검토한 시점(`bf02fe328`/`4d8118956`) 이후 실제로 새로 들어온 코드는
`5fcb5c625` 한 커밋뿐이다 — (1) `AuditLogListItem` 이 `workspace` 자매 필드도 함께 `Omit` 하도록
좁힌 것, (2) `execution-response.dto.spec.ts` 신설(광고된 22 프로퍼티를 3목록으로 고정하는
스키마 가드), (3) `audit-logs.service.ts` 주석의 "12개+"→"12개" 정정, (4)
`spec-sync-auth-gaps.md`/`spec-draft-nullable-notation-followups.md` plan 갱신. 이 델타를
직접 `Read` 로 열어 대조했고, 그 외에는 네 라운드 연속으로 지적된 항목이 여전히 반영돼 있는지
재확인했다:

- `response-contract.ts` 전문 재독 — JSDoc 판정 규칙 표 4행("§5.4 아님 — 아래 참조")과 실제
  구현(`!nullable` 가드)이 일치하는지, `ContractViolationKind` 의 `invalid-payload`/`missing`
  분리, `DtoContract.name` 파생 여부.
- `execution-response.dto.spec.ts` 신규 JSDoc(왜 스키마 레벨 가드가 별도로 필요한지)이 실제
  `assertMatchesContract` 의 한계 설명과 일치하는지.
- `CHANGELOG.md`/`audit-logs.spec.ts`/`audit-logs.e2e-spec.ts` 가 인용하는 "26개 키"·"23키"
  수치를 `User` 엔티티 실제 컬럼 수와 재대조.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 표 수치(37=12+10+8+7,
  22=11+1+10, 56=60-4)를 산술로 재검증.
- 저장소에는 어떤 뮤테이션도 가하지 않았다(`git status --short` 확인 — 세션 산출물 디렉터리
  외 변경 없음).

## 발견사항

(신규 CRITICAL/WARNING 없음 — 네 라운드 연속으로 동일 결론)

- **[INFO]** `response-contract.ts` 가 아직 `spec/5-system/2-api-convention.md` frontmatter
  `code:` glob 에 등재돼 있지 않다 (4라운드 연속 재확인, 조치 불요)
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts`(신규 파일 전체) /
    `spec/5-system/2-api-convention.md`(frontmatter `code:` 목록 — 직접 `Read` 로 미등재
    확인)
  - 상세: 이 파일은 §5.4 를 실제로 시행하는 유일한 코드인데 여전히 `code:` glob 밖에 있어
    이 파일의 향후 변경에 `--impl-done` SPEC-CONSISTENCY 게이트가 반응하지 않는다.
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(297행)가 이미 이를
    planner 트랙 항목으로 정확히 등재하고 있다(developer 는 `spec/` 쓰기 권한 없음). 새
    결함이 아니라 이미 올바르게 추적 중인 항목이므로 이번 PR 범위에서 추가 조치를 요구하지
    않는다.
  - 제안: 조치 불요 — 다음 planner 턴에서 집행.

## 검증 결과 (문제 없음으로 확인 — 회귀 방지 기록)

- `execution-response.dto.spec.ts`(신규)의 최상단 JSDoc이 "왜 스키마 레벨 가드가 e2e 계약
  대조와 별개로 필요한가"(데코레이터+TS 타입이 **동시에** optional 로 되돌아가면 선언 자체가
  함께 움직여 `assertMatchesContract` 가 못 잡는다)를 정확히 설명하고, `REQUIRED_NON_NULLABLE`
  (11)·`REQUIRED_NULLABLE`(1)·`OPTIONAL_NULLABLE_DRIFT`(10) 세 목록의 각주("이 가드는 고치는
  것이 아니라 고정한다")가 §5.4 drift 트래커의 실제 상태와 일치한다. "[전제]" 테스트가 세
  목록의 합이 광고된 프로퍼티 전체를 덮는지 먼저 물어 vacuous 가드를 방지한다.
- `audit-logs.service.ts` 상단 `AuditLogListItem` JSDoc 이 `user` 뿐 아니라 `workspace` 도
  함께 `Omit` 한 이유("이 쿼리는 workspace 를 join 하지 않아 런타임에 항상 `undefined`")를
  적어 두고, `record()` 메서드 catch 블록 주석의 "12개+"가 실제로 "12개"로 정정돼 있다
  (`plan/in-progress/spec-sync-auth-gaps.md` 가 예고한 트리거 충족 — 실제로 이 파일을
  편집하는 시점에 함께 왔다).
- `response-contract.ts:37-49`(판정 규칙 표 4행 + 후속 설명)와 실제 구현(`visit()` 함수의
  `if (!nullable)` 분기)이 여전히 일치한다 — 이전 라운드(13_49_54 api_contract WARNING)가
  지적한 JSDoc-구현 불일치는 이미 해소된 상태이고 이번 라운드에서도 재확인했다.
- `CHANGELOG.md`/`audit-logs.spec.ts`/`audit-logs.e2e-spec.ts` 가 공통 인용하는 "26개 키"는
  `User` 엔티티 실제 컬럼 데코레이터 수와 일치하고, "23키"(26 − 3 광고 필드)도 산술이 맞는다
  (이전 라운드에서 확인된 것을 재확인, 이번 라운드에서 변경 없음).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 신규 표("required 37 필드",
  `ExecutionDto`=12/`WorkflowDto`=10/`AuditLogDto`=8/`SessionDto`=7)와 "모집단 60개 중 56개
  잔여"(60−4=56) 서술 모두 산술이 맞고, "134 vs 60 vs 78 은 서로 다른 것을 센다"는 이전
  라운드의 정정("더하지 말 것")이 유지되고 있다.
- `spec-sync-auth-gaps.md`/`spec-draft-nullable-notation-followups.md` 두 plan 문서의 취소선
  정정(줄 번호 인용 제거, 완료 표시)이 CLAUDE.md 의 plan 위생 관례(체크박스=실제 상태, 원문
  보존)를 따른다 — `:105`/`:474` 처럼 낡을 수 있는 줄 번호 인용을 능동적으로 제거한 점은
  긍정적이다.

## 요약

이번 라운드의 실질 코드 델타는 `5fcb5c625` 한 커밋(형제 필드 `workspace` 도 함께 좁힘 +
`ExecutionDto` 스키마 레벨 가드 신설 + 주석 오기 정정)뿐이며, 신규 파일
(`execution-response.dto.spec.ts`)과 변경된 JSDoc/인라인 주석 모두 "왜 필요한지·무엇을
고정하는지"를 정확하게 설명한다. 네 차례 연속(`13_49_54`→`14_39_31`→`15_12_02`→`15_31_41`)
documentation 리뷰가 지적한 모든 항목(§5.4 판정 규칙 표 출처, DTO 이름 이중 표현, `missing`
kind 재사용, 수치 인용 정확성)이 현재 HEAD 코드에도 그대로 반영돼 있음을 직접 대조로 재확인했다.
CHANGELOG·plan 문서가 인용하는 모든 수치(26/23키, 37=12+10+8+7, 22=11+1+10, 56=60−4)는
실측·산술과 일치한다. 새로 발견한 문서화 결함은 없으며, 유일한 잔여 항목(spec `code:` glob
미등재)은 developer 권한 밖이라 이미 정확히 planner 트랙에 등재돼 있어 재차 조치를 요구하지
않는다.

## 위험도

NONE
