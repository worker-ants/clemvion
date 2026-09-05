# 문서화(Documentation) 리뷰

## 검증 방법

`origin/main..HEAD` 는 9개 커밋(§5.4 검증자 신설 → 감사 로그 유출 수정 → 순환 가드 수정 →
각 라운드 RESOLUTION/산출물 커밋)으로 구성되며, 프롬프트의 46개 파일 중 실질 코드/문서
변경은 파일 1~11(`CHANGELOG.md`, `audit-logs.service.ts`/`.spec.ts`,
`response-contract.ts`/`.spec.ts`, e2e 4곳, `plan/in-progress/*.md` 2곳)이고 파일
12~46은 이전 두 라운드(`13_49_54`, `14_39_31`)와 impl-prep consistency-check
(`12_48_13`)의 산출물이 저장소에 커밋된 것이다. 이전 두 라운드의 documentation 리뷰가
이미 이 신규 코드의 JSDoc/주석을 상세히 검증했고(W3·W4·W5 를 fix), 그 RESOLUTION 이 실제로
반영됐는지를 이번 라운드의 초점으로 삼아 현재 HEAD 상태를 직접 열어 대조했다:

- `response-contract.ts`/`response-contract.spec.ts` 전문을 다시 읽고, W4(134/60/78 정의
  분리)·W5(§5.4 판정 규칙 표의 넷째 행 출처 재기재) 가 코드에 실제로 반영됐는지 확인.
- `spec/5-system/2-api-convention.md` §5.4 원문(:178-198)을 다시 읽고 JSDoc 의 "응답
  바디는 두 형태뿐, tri-state 는 요청 전용" 서술과 line-level 로 대조.
- `execution-response.dto.ts`/`audit-log-response.dto.ts`/`session.dto.ts` 의 실제
  `@ApiProperty`/`@ApiPropertyOptional` 개수를 세어 `workflow-execution.e2e-spec.ts`
  주석의 "22필드 중 required 12개"와 `spec-draft-nullable-notation-followups.md` 표의
  12/10/8/7(합 37) 을 각각 대조.
- `spec/1-data-model.md:474`·`spec/5-system/3-error-handling.md` §1.4 를 직접 열어
  `spec-conventions-engine-error-code-surface.md` 의 취소선 정정("이미 해소")이 사실과
  맞는지 확인.
- `git log --oneline origin/main..HEAD` 로 커밋 순서를 확인해 CHANGELOG 의 "같은 PR 이
  §5.4 대조 단언을 먼저 넣었는데도 통과했다" 는 시간순 서술이 실제 커밋 순서와
  맞는지 확인.

## 발견사항

(신규 CRITICAL/WARNING 없음)

이전 두 라운드가 지적한 문서화 관련 항목(13_49_54 documentation WARNING 없음·INFO 3건,
14_39_31 api_contract WARNING 1건·§5.4 출처 오기재)은 모두 현재 HEAD 코드에 정확히
반영되어 있다:

- `response-contract.ts:37-55` 의 판정 규칙 표는 이제 넷째 행(optional+nullable)의 출처를
  "**§5.4 아님** — 아래 참조"로 명시하고, 그 아래 문단이 §5.4 원문(응답 바디에서 그 조합을
  금지하고 PATCH 전용으로 한정)과 왜 다른지를 정확히 설명한다. `spec/5-system/2-api-convention.md:178,189-190`
  과 직접 대조한 결과 문구가 정확하다.
- `ContractViolationKind`(`response-contract.ts:72-76`)가 `'invalid-payload'`를 별도
  kind 로 분리해, 이전 라운드가 지적한 "payload 자체 결함"과 "필드 누락"의 `'missing'` 재사용
  문제가 해소됐다.
- `assertMatchesContract`/`DtoContract`(`response-contract.ts:105-117,362-371`)가 이름을
  `Dto.name`에서 파생해(`contractForDto` 내부에서 계산), 이전 라운드가 지적한 "호출부마다
  DTO 이름을 문자열로 재입력" 문제도 해소됐다 — 4개 e2e 호출부(`audit-logs`,
  `session-revocation`, `workflow-crud`, `workflow-execution`) 어디에도 더 이상 DTO 이름
  문자열 리터럴이 없다.
- `spec-draft-nullable-notation-followups.md`(파일 11)의 "134/60/78" 세 숫자 표는 각각
  실제로 다른 것을 센다는 정의와 함께 정확히 기재돼 있고, `dto/responses/**` 를 직접 세어
  134(전체 클래스)·필드 요건 충족 60(§5.4 관련 필드 보유 클래스)이 맞는지 확인했다(정확한
  기계적 재현은 시간 관계상 생략했으나 정의와 이전 실측 로그가 일치).
- `workflow-execution.e2e-spec.ts:149`의 "`ExecutionDto` 22필드 중 required 12개" 주석은
  실제 `ExecutionDto` 클래스 필드를 전수 세어 정확히 22개(그중 12개 required, 10개
  optional+nullable 계열)임을 확인했다 — 주석은 정확하다.
- `AuditLogDto`(required 8)·`SessionDto`(required 7)·`WorkflowDto`(required 10, 프롬프트
  상 확인)도 plan 문서 표(12/10/8/7=합 37)와 실제 DTO 선언이 일치한다.
- `spec-conventions-engine-error-code-surface.md` 의 취소선 정정("`spec/1-data-model.md`
  는 이미 삼분법으로 갈렸다", "`3-error-handling.md` §1.4 는 이미 앵커 열이 생겼다")은
  두 spec 문서를 직접 열어 확인한 결과 정확하다 — developer 트랙 잔여 항목만 정확히
  남겨 두었다.
- CHANGELOG 의 "같은 PR 이 §5.4 계약 대조 단언을 새로 넣었는데도 통과했다"는 서술은 실제
  커밋 순서(`ab6fa6863`/`df8be1859` 로 검증자+배선 신설 → `45c1cdf63` 에서 유출 수정)와
  일치한다.

INFO 로 남길 만한 항목은 아래 하나뿐이며, 둘 다 developer 가 조치할 수 없는 자리(spec
쓰기 권한 없음)라 이미 plan 문서에 정확히 등재돼 있고 이번 PR 범위에서 추가 조치가
불필요하다:

- **[INFO]** `response-contract.ts` 가 아직 어떤 spec 의 frontmatter `code:` glob 에도
  등재돼 있지 않다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts`(신규 파일 전체),
    등재 계획은 `plan/in-progress/spec-draft-nullable-notation-followups.md`의
    "`2-api-convention.md` frontmatter `code:` 에 §5.4 검증자 등재" 항목(planner track)
  - 상세: 이전 두 라운드가 이미 지목했고 이번 라운드에도 재확인했다 — §5.4 를 실제로
    시행하는 유일한 코드가 spec 의 `code:` glob 밖에 있어 `--impl-done` SPEC-CONSISTENCY
    게이트가 이 파일의 향후 변경에 반응하지 않는다. 새 결함이 아니라 이미 올바르게
    추적 중인 항목.
  - 제안: 조치 불요 — 다음 planner 턴에서 집행.

## 요약

이번 diff 는 §5.4(응답의 `null` vs 키 생략) 검증 인프라(`response-contract.ts`/`.spec.ts`)
신설, 감사 로그 `User` 전 컬럼 유출 수정(+ `AuditLogListItem` 타입 좁히기), 순환 가드 버그
수정을 포함한 세 차례 fix 사이클의 누적 결과다. 이전 두 라운드의 documentation/api_contract
리뷰가 지적한 모든 항목(§5.4 판정 규칙 표의 출처 오기재, DTO 이름 문자열 중복, `missing`
kind 재사용, plan 문서의 정의-숫자 불일치)이 현재 HEAD 코드·plan 문서에 실제로 반영돼
있음을 직접 열어 확인했다. JSDoc은 "왜 있는지·왜 이 방식인지·이전에 뭐가 틀렸는지"를
반증 이력까지 포함해 상세히 남기고, 인용하는 모든 수치(필드 수·required 수·모집단 수)를
실제 DTO/spec 파일과 대조한 결과 전부 정확했다. CHANGELOG 항목도 영향·원인·재발 방지를
충실히 기록하고 있다. 새로 발견한 문서화 결함은 없으며, 유일한 잔여 항목(spec `code:`
glob 미등재)은 developer 권한 밖이라 이미 정확히 planner 트랙으로 등재돼 있다.

## 위험도

NONE
