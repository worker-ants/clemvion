# Rationale 연속성 검토 — `spec-draft-migration-rerun-and-citations.md`

## 검토 방법

target draft(① CONCURRENTLY 재실행 패턴, ② 리뷰 산출물 인용 규약)가 인용/전제하는 과거 결정을
원본에서 직접 대조했다:

- `spec/conventions/migrations.md` §7 (폐기 대안: 타임스탬프 prefix / `outOfOrder=true` /
  Merge Queue / branch protection) — target 은 이 절이 다루는 **버전 번호 정책**과 무관한
  주제(CONCURRENTLY 재실행 안전성)를 다루므로 겹치는 결정 없음.
- `codebase/backend/migrations/README.md` §4·§5 (FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK,
  "한 파일 한 CREATE INDEX CONCURRENTLY", "transactional statement 와 CONCURRENTLY 를 섞지
  않는다") — target 의 인용문을 원문과 대조.
- 실제 마이그레이션 파일 `V056`·`V110` 을 열어 target 의 "선례" 서술(§1.4·부록 A)이 실제
  코드와 일치하는지 확인.
- `spec/1-data-model.md` `## Rationale` "Schedule 인덱스 …" 항목(§1277 출처) — target 이
  이 항목을 뒤집거나 재해석하는지 확인.
- `review/code/2026/09/05/00_06_38/{RESOLUTION,SUMMARY,documentation}.md` — target ②가
  "PR 번호로 전환" 권고를 인용해 기각하는 근거가 실제 리뷰 산출물과 일치하는지 확인.
- `spec/conventions/swagger.md` §1-4/§3, `spec/conventions/execution-context.md` §원칙3 —
  target 이 "기존 인용 소급 정리 대상 아님" 판단에 차용하는 선례 원칙의 실재 여부 확인.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 두 항목의 원 트래커 서술과
  target 의 선택(옵션 (a)/(b) 중 무엇을 택했는지)이 정합적인지 확인.

## 발견사항

- **[INFO]** README §5 제목("`executeInTransaction=false` 파일은 한 statement 만")과 신설
  §5-1(부록 A) 의 3-statement 패턴 병치가 표면적으로 상충되어 보일 수 있음
  - target 위치: 부록 A `### 5-1. CONCURRENTLY 로 인덱스를 교체할 때 — DROP-먼저` (target
    문서 §1.5 가 이 전문을 README §5 바로 뒤에 붙이기로 결정)
  - 과거 결정 출처: `codebase/backend/migrations/README.md` §5 "`executeInTransaction=false`
    파일은 한 statement 만" — "`CREATE INDEX CONCURRENTLY` 를 정확히 한 개만 두는 것을
    컨벤션으로 둡니다"
  - 상세: §5 규칙은 문자 그대로는 `CREATE INDEX CONCURRENTLY` **개수**(1개)만 제약하고
    `DROP INDEX CONCURRENTLY` 개수는 제약하지 않는다 — 실제로 기존 `V056`(CREATE 1 + DROP 1)과
    `V110`(DROP 1 + CREATE 1 + DROP 1)이 이미 이 형태로 존재하고 CI 를 통과해 있어(직접 파일
    확인), target 의 부록 A 는 **새 예외를 여는 것이 아니라 이미 승인된 선례를 성문화**하는
    것이다. 따라서 이는 Rationale 위반이 아니라 §5 자체의 서술(제목의 "한 statement 만")이
    본문 규칙(개수 제한 대상은 CREATE 뿐)보다 좁게 읽히는 기존 문서의 모호함이며, target 이
    그 모호함을 새로 만들지는 않았다.
  - 제안: §5-1 삽입 시 §5 본문에 "본 절의 '한 개' 는 `CREATE INDEX CONCURRENTLY` 개수를
    말하며, 인덱스 **교체**를 위한 DROP-CREATE-DROP 3문은 §5-1 예외로 별도 허용한다"는 한 줄을
    덧붙여 제목과 본문 사이의 오독 여지를 닫을 것을 권장 (선택적 — 필수 아님).

## 그 외 확인했으나 문제 없음으로 판정한 항목

- **①의 (b) DROP-first 채택**: `V110__schedule_workspace_next_run_index.sql` 실물 대조 결과
  target 의 실측·선례 서술과 정확히 일치. 이미 구현된 패턴을 규약으로 승격하는 것으로,
  기각된 대안의 재도입이 아니다.
- **①의 (c) `mixed=true` 별도 결정 항목 등재**: 저장소 전체 히스토리(`git log --all --grep`)와
  spec 어디에도 `mixed=true` 를 다룬 과거 결정이 없음을 확인 — 새로운 선택지를 제안하며
  즉시 채택하지 않고 별도 결정 항목(target §3)으로 명시적으로 미룬 것은 "저장소 전역 가드를
  한 문서가 단독으로 풀지 않는다"는 원 트래커(`spec-draft-nullable-notation-followups.md`)의
  프레이밍과 정합적이다.
- **②의 "PR 번호로 전환하지 않는다" 결정**: `review/code/2026/09/05/00_06_38/SUMMARY.md`·
  `documentation.md` 원문 대조 결과, 해당 라운드는 "성문화하거나 PR 번호/SHA 로 대체"를
  **권고(정식 채택된 결정 아님)**로 남겼을 뿐이다. target 은 이를 뒤집는 것이 아니라 열려
  있던 질문에 실측(107파일·514회, bare 인용 8건 해소 불가 등)을 근거로 답하며 새
  `## Rationale`("왜 PR 번호로 전환하지 않았나")을 함께 작성했다 — 결정 무근거 번복에 해당하지
  않는다.
- **"기존 인용 소급 정리 대상 아님" 원칙 차용**: `spec/conventions/swagger.md` §1-4/§3,
  `spec/conventions/execution-context.md` §원칙3 실물 확인 결과 두 곳 모두 "신규 변경에만
  적용, 기존 것은 다음에 손댈 때 맞춘다"는 동일 원칙을 실제로 갖고 있어, target 의 인용은
  지어낸 선례가 아니라 실재하는 반복 패턴이다.
- **원 트래커와의 선택 정합성**: `plan/in-progress/spec-draft-nullable-notation-followups.md`
  의 두 항목이 제시한 옵션 (①-(a) 성문화 / ①-(b) 런북 절차, ②-(a) 성문화 / ②-(b) PR 번호
  전환) 중 target 은 각각 (a) 를 선택했고 원 트래커의 "배타적이지 않다"·"한 PR 이 단독으로
  정할 일이 아니다" 프레이밍을 그대로 승계해 처리했다.

## 요약

target 문서는 두 항목 모두 기존 spec/README/리뷰 산출물의 `## Rationale` 또는 결정 이력과
직접 대조했을 때 기각된 대안을 이유 없이 되살리거나, 합의된 설계 원칙을 위반하거나, 근거 없이
과거 결정을 번복하는 사례를 만들지 않는다. ① 은 이미 구현·승인된 `V110` 패턴을 규약으로
승격하는 것이고, `mixed=true` 라는 새로운 저장소 전역 변경 가능성은 즉시 채택하지 않고 별도
결정 항목으로 명시적으로 미뤄 두었다. ② 는 과거 리뷰 라운드가 남긴 "PR 번호 전환" 권고(정식
결정 아님)에 대해 실측을 근거로 답하며 새 Rationale("왜 전환하지 않았나")을 함께 작성했고,
"기존 것은 소급 정리하지 않는다"는 원칙은 `swagger.md`·`execution-context.md` 에 실재하는
선례를 정확히 인용한 것이다. 유일하게 짚을 점은 README §5 제목과 신설 §5-1 사이의 표현상
모호함이며, 이는 target 이 새로 만든 충돌이 아니라 기존 문서 표현의 좁음이 이번에 드러난
것으로 INFO 수준이다.

## 위험도

LOW
