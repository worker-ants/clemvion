# Rationale 연속성 검토 — `spec-draft-review-citations-enforcement.md`

## 대상 요약

target 은 `spec/conventions/review-citations.md` 의 `## Rationale` 첫 소절("이 규약에는
시행하는 코드가 없다")이 `dto-jsdoc-citation-guard.ts` 신설로 반증됐다는 전제 아래, (A)
해당 Rationale 을 취소선+정정 블록으로 갱신, (B) `code:` frontmatter 에 시행 코드 glob 을
추가, (C) `spec-impl-evidence.md §2.1` 의 선례 인용을 축 단위로 좁히는 3개 변경안을 제시한다.
실제 저장소 상태(`spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md`,
`codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`)를 직접 열어 대조했다.

## 발견사항

- **[INFO]** `code:` 리스트가 "준수 예시"와 "시행 코드"를 구분 없이 나열
  - target 위치: 변경안 (B) — `code:` YAML (review-citations.md frontmatter)
  - 과거 결정 출처: `spec/conventions/review-citations.md` `## Rationale`
    ("`code:` 가 '구현 경로' 가 아니라 '준수 예시' 를 가리키는 이유") +
    `spec/conventions/spec-impl-evidence.md §2.1` `code` 행의 예외 정의
  - 상세: 원래 `code:` 의 두 항목(`roles.guard.spec.ts`, `sanitize-loader-error.ts`)은 전부
    "준수 예시" 단일 범주였다. target 이 추가하는 `dto-jsdoc-citation*.ts` 는 그 자체로도
    인용 형태를 준수하는 파일(직접 확인 — 두 파일 모두 전체경로+날짜 인용을 담고 있음)이면서
    동시에 §3(DTO 축)을 강제하는 코드이기도 해 실질적 모순은 아니다. 다만 변경안(A)의 산문은
    "이제 두 종류를 담는다" 고 설명하지만 YAML 리스트 자체에는 그 구분을 표시할 인라인 주석이
    없어, Rationale 산문을 읽지 않고 frontmatter 만 보는 다음 유지보수자는 세 항목이 동질적인
    "준수 예시" 라고 오해할 수 있다.
  - 제안: `code:` 항목에 `# 시행 코드 (§3 DTO 축)` 같은 인라인 YAML 주석을 붙이거나,
    `spec-impl-evidence.md §2.1` 의 예외 규칙 문구에 "혼합 리스트가 허용된다" 는 한 문장을
    명시적으로 추가.

- **[INFO]** 종결 문장의 대표성 수치가 3-entry 로 늘어난 `code:` 와 나란히 읽히면 혼동 소지
  - target 위치: 변경안 (A) 정정 블록 하단, 손대지 않은 기존 문장
    ("그래서 `code:` 에 … 파일을 적었다 (저장소에 10개 있고 backend·frontend 에서 하나씩)")
  - 과거 결정 출처: 동일 Rationale 소절 (수정되지 않는 인접 문장)
  - 상세: 이 "10개 중 backend·frontend 하나씩" 은 저장소 전체의 준수 예시 파일 수를 가리키는
    것이라 `code:` 필드의 entry 개수(2→3)와는 무관하지만, 변경안(A)의 diff 가 위쪽 문장만
    취소선 처리하고 이 문장은 그대로 두어 독자가 "3번째 entry 도 그 10개 중 하나" 로
    오독할 여지가 생긴다. 실질 오류는 아니며 CLAUDE.md 가 요구하는 "인접 서술은 건드리지
    않는다" 원칙에도 부합한다.
  - 제안: 필요 시 정정 블록 안에 "이 수치는 `code:` entry 수가 아니라 저장소 전체 준수 예시
    파일 수"라는 한 줄 각주를 덧붙이면 오독 가능성이 사라진다. 종결 조건은 아님.

## 정합성 확인 (위반 없음으로 판정한 항목)

- **기각된 대안 재도입 없음**: review-citations.md 의 Rationale 이 명시적으로 기각한 세 대안
  — ① PR 번호/커밋 SHA 전환, ② 기존 bare 인용의 소급 정리, ③ `codebase/backend/src/**` 류
  넓은 트리 glob — 중 어느 것도 target 이 다시 채택하지 않는다. 변경안(B)의
  `dto-jsdoc-citation*.ts` 는 단일 디렉토리 내 파일명 접두사로 좁힌 glob이라 "넓은 트리"
  기각 사유(가리키는 대상이 사실상 없음)에 해당하지 않는다.
- **합의 원칙 준수**: "한쪽만 재해석하면 SoT 가 그 사실을 모른다"(review-citations.md
  Rationale)는 원칙대로, target 은 review-citations.md 와 spec-impl-evidence.md §2.1 을
  같은 턴에서 동시 갱신한다(변경안 A + C).
- **정정에 새 Rationale 동반**: 정책 번복이 아니라 사실 전제의 반증이며, target 은 취소선
  보존 + 날짜 있는 정정 블록 + 실측 근거(`isResponseDtoFile()` 스코프 확인 완료 —
  guard 소스에서 `dto/responses/**` 로 한정됨을 직접 대조) 형태로 새 Rationale 을 함께
  기록한다. 이 저장소의 기존 관행(예: 번들에 포함된 `WorkflowVersion.snapshot 구성 서술
  정정`, `cafe24-token-refresh … defer 해제` 등)과 동일한 "취소선 + 정정 블록 누적" 패턴이다.
- **CLAUDE.md 자기-반증형 소정정 예외의 오적용 없음**: target 이 "developer 가 못 고치는
  이유" 로 든 조건 1 위반(그 문장을 developer 가 아니라 planner 가 썼다)을 `git log -S`
  로 직접 확인 — 해당 문장은 커밋 `90c1751e8`(2026-09-05, `docs(spec):` prefix)에서
  등재됐다. planner 턴으로 우회 없이 처리하겠다는 target 의 판단은 근거가 있다.
- **암묵적 invariant 우회 없음**: `spec-code-paths.test.ts` 가 요구하는 "`status ∈
  {partial, implemented}` 인 spec 의 `code:` 글로브 ≥1 파일 매치" 를 이미 충족하는 문서에
  항목을 추가하는 것이므로 그 가드의 invariant 를 건드리지 않는다. 자매 plan
  (`spec-draft-nullable-notation-followups.md:398`)이 이미 동일 glob 폭(`dto-jsdoc-citation*.ts`)
  을 등재해 두 문서 간 glob 폭 불일치도 없음을 확인했다.

## 요약

target 은 Rationale 연속성 관점에서 위반이 아니라 오히려 모범적인 사례에 가깝다 — 반증된
전제를 삭제 대신 취소선+정정 블록으로 누적하고, "선례를 축 단위로 좁힌다"는 새로운 서술
규범을 두 SoT 문서(`review-citations.md`, `spec-impl-evidence.md §2.1`)에 동시 반영하며,
과거 Rationale 이 명시적으로 기각한 세 대안(PR 번호 전환·소급 정리·넓은 트리 glob) 중
어느 것도 재도입하지 않는다. `git log -S`·guard 소스 직접 대조로 target 의 핵심 사실
주장(도입 시점, 강제 축의 범위)도 실측 검증됐다. 남은 것은 `code:` 리스트 안에서 "준수
예시"와 "시행 코드"가 섞이는 것을 YAML 주석으로 명시하면 좋겠다는 정도의 문서 명료성
제안(INFO) 두 건뿐이며, 종결 조건을 막을 사안은 아니다.

## 위험도

LOW
