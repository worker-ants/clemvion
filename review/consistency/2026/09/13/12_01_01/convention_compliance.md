# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 조사 방법 메모

`scope=spec/5-system/` 의 실제 델타는 **0개 파일**이다(코드 전용 PR). 번들은 컨텍스트 예산
초과로 17개 중 2개(`1-auth.md`·`2-api-convention.md`)만 전문이 실렸고 나머지는 헤더만
절단됐다. 절단분은 "내용 없음"의 근거로 쓰지 않았고, 이 PR 이 직접 건드리는 도메인
(`LlmService.testConnection`, 유저 가이드 mdx)과 맞닿은 `7-llm-client.md` 는 실제 워크트리
경로로 `Read` 하여 직접 확인했다. 코드 diff(`git -C <worktree> diff origin/main...HEAD`)와
`spec/conventions/{error-codes,swagger,user-guide-evidence}.md`, 관련 가드 소스
(`swagger-dto-contract.spec.ts`)도 직접 열어 대조했다. `spec/` 전체 델타도 0임을
`git diff origin/main...HEAD -- spec/` 로 확인했다 — 이번 PR 은 spec 을 전혀 수정하지 않는다.

전문이 실린 `1-auth.md`·`2-api-convention.md` 는 명명·출력 포맷·문서 구조(Overview/본문/
Rationale)·API 문서 규약 관점에서 정독했으며, historical-artifact 등재·`//`(내부 서사) vs
JSDoc(공개 설명) 분리·자기-반증 각주 처리 등 규약을 정확히 따르는 사례만 확인됐고 신규
위반은 발견되지 않았다. 아래 발견사항은 이 PR 이 실제로 건드린 코드가 **이미 존재하는
spec/conventions 문서와 어긋나거나, 그 문서를 dangling 참조로 만드는** 지점에 집중한다.

## 발견사항

- **[WARNING]** `testConnection` 실패 응답 shape 가 target scope 안 spec 문서에 여전히
  미문서화 — API 규약 §5.4(키 생략 필드 문서화 의무) 미충족
  - target 위치: `spec/5-system/7-llm-client.md` §8.3 "`LlmService.testConnection` — kind별
    probe 전략" 표(452행 부근, `| chat | ... | { success: true } |` / `| embedding | ... |
    { success: true, dimension? } |`)
  - 위반 규약: [`spec/5-system/2-api-convention.md` §5.4](../../../../spec/5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략)
    — "키 생략은 (a)/(b) 중 하나에 해당할 때만 쓰고, **그 필드를 문서화하는 절에 사유를
    명시**한다"
  - 상세: 이번 PR 의 코드 diff(`llm.service.ts`)는 실패 응답 필드를 `error` → `message`
    로 rename 하고, 새 HTTP 계약 테스트(`llm-model-config.controller.spec.ts`)가 성공
    시 `{ success: true }`(message 키 자체가 없음) · 실패 시 `{ success: false, message }`
    임을 전수 키 비교로 고정했다 — 즉 `message` 는 명백한 **키 생략(present-when-available)**
    패턴이다. 그런데 §8.3 표는 여전히 성공 케이스 두 줄만 적고 실패 행이 없다 — `message`
    필드 자체가 이 문서 어디에도 등장하지 않는다. §5.4 의 "이미 문서화된 키 생략 필드는
    소급 요구하지 않는다" 예외는 *"문서화는 됐으나 사유 문구가 없는"* 경우에 적용되는
    것이지, 필드 자체가 미문서인 이 경우에는 해당하지 않는다. 이 갭은 이 PR 이 새로 낸 것은
    아니며(spec 델타 0), `--impl-prep`(`review/consistency/2026/09/13/01_15_40`
    naming_collision INFO)과 `plan/in-progress/guide-error-code-truth.md`(§E, "3.
    `testConnection` 실패 응답 필드가 어느 spec 표에도 없다 — 5개 checker 전원이 짚었다 →
    planner 등재")가 이미 인지·등재했다 — 그러나 이번 커밋 시점까지 실제 spec 수정은
    이뤄지지 않았다(`git diff origin/main...HEAD -- spec/` 델타 0).
  - 제안: planner 턴에서 §8.3 표에 실패 행(`{ success: false, message }`, message 는
    `sanitizeLlmErrorMessage` 8갈래 고정 문장 중 하나)을 추가하고 키 생략 사유(성공 표시와
    나란히 두 표면(REST 클라이언트가 이미 `result.message` 로만 읽음)을 맞추기 위함 등)를
    명시한다. `spec/2-navigation/6-config.md` 의 동일 엔드포인트 요약행도 같은 갭을 공유하므로
    함께 정정 대상이다.

- **[WARNING]** `PROJECT.md` 가 신규 가드 2건의 SoT 로 지목한
  `spec/conventions/user-guide-evidence.md §2` 에 그 가드가 실제로 없음 — dangling SoT 참조
  - target 위치: 이 PR 이 수정한 `PROJECT.md`(가드 카탈로그, `guide-error-code-existence.test.ts`·
    `guide-sanitized-message-parity.test.ts` 두 줄) — 각 줄이 "SoT:
    `spec/conventions/user-guide-evidence.md §2`" 라고 명시
  - 위반 규약: `spec/conventions/user-guide-evidence.md` §2 "Build-time 가드 (3건)" 자신의
    관계표 관례(§2.1 "다른 가드와의 관계" — 각 가드의 역할·직교 관계를 표로 명시하는 것이
    이 문서 스스로 세운 패턴) 및 CLAUDE.md 의 "정보 저장 위치(단일 진실 원칙)" 표
    ("정식 규약 → `spec/conventions/<name>.md`")
  - 상세: `user-guide-evidence.md` §2 의 가드 표는 여전히 3건
    (`impl-anchor-existence.test.ts`·`integrations-coverage.test.ts`·
    `triggers-coverage.test.ts`)만 나열하고, frontmatter `code:` 목록에도
    `guide-error-code-existence.test.ts`·`guide-error-code-scan.ts`·
    `guide-sanitized-message-parity.test.ts` 가 없다(직접 확인). 그런데 이번 PR 이 고친
    `PROJECT.md` 는 이 두 신규 가드의 SoT 를 정확히 그 §2 로 지목했다 — 즉 참조가 가리키는
    자리에 참조 대상이 없다. 이 결정은 developer 자신이 이미 올바르게 인지했다 —
    `plan/in-progress/guide-error-code-truth.md` §D 가 "`user-guide-evidence.md §2.1`
    관계표에 등재해야 하는데 그건 `spec/**` 이라 planner 소관 → 등재" 라고 명시하고, 체크리스트
    §E ("planner 항목 3건 등재 — §1 카탈로그 누락 · testConnection shape 미문서 ·
    §2.1 관계표")로 정식 백로그화했다 — `--impl-prep`
    (`review/consistency/2026/09/13/01_15_40` naming_collision WARNING#4·#5)이 최초로
    지적한 갭과 동일 항목이다. 절차는 옳다(developer 가 spec 을 직접 고치지 않고 planner
    턴으로 넘김) — 다만 이 커밋 시점까지 그 planner 턴이 실행되지 않아 **PROJECT.md 의
    SoT 포인터가 실제로는 착지하지 않는 상태**로 남아 있다.
  - 제안: planner 턴에서 `user-guide-evidence.md` §2 표에 두 가드를 추가하고(§2.1 유사
    관계 서술 포함), frontmatter `code:` 에 세 파일(`guide-error-code-existence.test.ts`·
    `guide-error-code-scan.ts`·`guide-sanitized-message-parity.test.ts`)을 등재한다. 이미
    plan 에 등재된 백로그이므로 신규 이슈라기보다 "아직 닫히지 않았다"는 확인으로 처리해도
    무방하나, `PROJECT.md` 가 이미 그 SoT 를 기정사실처럼 인용하고 있어 다음 독자가
    링크를 따라가면 빈손이 된다는 점에서 방치 시간이 길어질수록 dangling-reference 비용이
    커진다.

- **[INFO]** 전문이 실린 두 spec 문서는 규약을 정확히 지키는 사례 위주 — 신규 위반 없음
  - `spec/5-system/1-auth.md`: 초대 흐름 lowercase 코드 5종을
    [`error-codes.md §3`](../../../../spec/conventions/error-codes.md#3-historical-artifact-예외-레지스트리)
    historical-artifact 로 정확히 등재하고 "신규 코드는 이 예외를 선례로 삼지 않는다"는
    문구까지 유지(§1.5.4 각주). §5 API 엔드포인트 절의 "비밀번호 변경 실패 코드" 각주는
    developer 가 자신이 쓴 예고 문장(순환 의존 주장)을 실측으로 반증한 뒤 취소선 보존 +
    정정 문구를 그 자리에만 국한해 CLAUDE.md 자기-반증형 소정정 5조건과 형태가 일치한다.
  - `spec/5-system/2-api-convention.md`: `@ApiPropertyOptional({ nullable: true })` 처럼
    optional+nullable 을 동시에 쓰는 조합이 §5.4 위반임을 스스로 규정하고 있는데, 실제
    코드(`TestConnectionResultDto.message`·`ModelTestConnectionResultDto.message`, 이번
    PR 이 손댄 바로 그 필드)는 이 조합을 쓰고 있다 — 다만 이는 이미
    `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 래칫에 두 항목 모두
    등재된 **기지 부채**이고(`integration-response.dto.ts:TestConnectionResultDto.message`·
    `model-config-response.dto.ts:ModelTestConnectionResultDto.message`), §5.4 도 "앞으로
    도입·변경되는 필드에 적용"이라 소급 강제하지 않는다. 신규 위반이 아니라 기존
    합의된 부채이므로 별도 항목으로 올리지 않았다.

## 요약

이번 PR 은 `spec/5-system/` 을 전혀 수정하지 않는 코드 전용 변경이며, 전문이 확인된 두
spec 문서(`1-auth.md`·`2-api-convention.md`)는 명명·출력 포맷·문서 구조·API 문서 규약
어느 관점에서도 새 위반이 없다. 다만 이 PR 의 실제 코드 변경(LLM `testConnection` 필드
rename, 유저 가이드 진실성 가드 2건 신설)이 두 개의 **기존에 이미 인지·등재된 spec 문서
갭**을 그대로 남겨 둔 채 진행됐다 — `7-llm-client.md §8.3` 의 실패 shape 미문서(§5.4 위반)와
`PROJECT.md` 가 가리키는 `user-guide-evidence.md §2` 의 dangling 참조다. 둘 다 developer 가
스스로 인지해 planner 백로그로 정확히 등재했고 spec 을 무단으로 건드리지 않았다는 점에서
절차는 규약을 준수하지만, 이 커밋 시점 기준으로 spec 상태 자체는 아직 그 규약을 만족하지
못한다.

## 위험도

LOW
