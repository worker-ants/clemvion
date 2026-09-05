# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-notification-secret-storage.md`

## 검토 방법

target 은 두 층으로 구성된다 — (1) plan 문서 자신의 frontmatter·구조, (2) §③ 변경안이 기술하는
spec 편집이 **이미 이 브랜치에 커밋됨**(`790487f34`). 두 층 모두 `spec/conventions/**`
대비 직접 확인했다 (`git show 790487f34`, 대상 spec 파일 원문 대조).

## 발견사항

- **[WARNING]** 신규 cross-file 인용이 같은 문서 안의 기존 인용 표기 규칙과 다르다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §7.1 (target draft §③ "정정 이력"
    문단이 지시한 변경, 실제 반영은 커밋 `790487f34`) — *"그 결정은 [chat-channel
    R-K](./15-chat-channel.md#r-k-…) 가 소유한다"*
  - 위반 규약: 명시적 `spec/conventions/**` 단일 조항은 아니나, **같은 파일** 안에 이미 확립된
    표기 관례 — 같은 문서 1325·1885 줄이 동일 대상(15-chat-channel.md 의 Rationale 항목)을
    인용할 때 `[Chat Channel §R-CC-16](./15-chat-channel.md#…)` 형식(대문자 스펠링 + `§` 접두)을
    쓴다. `spec/1-data-model.md:245` 도 `[Spec Chat Channel §4.2 / §R-K]` 로 `§` 를 붙인다.
    타 spec 의 Rationale 항목을 인용할 때 전역적으로 쓰이는 `[EIA §R17]`/`[EIA §R10]`/`[EIA §R6]`
    패턴도 동일하게 `§` 를 접두한다.
  - 상세: 신규 문장만 `chat-channel`(소문자)+`R-K`(§ 없음) 형태를 써 같은 파일 안에 두 가지
    인용 라벨 스타일이 공존하게 됐다. 내용은 정확하고 링크(`#r-k-chat_channel_token_v2-…`)도
    유효한 anchor 라 기능상 문제는 없으나, 표기 일관성 규약(암묵적이나 이 파일 자체가
    반복 실증하는) 과 어긋난다.
  - 제안: `[Chat Channel §R-K](./15-chat-channel.md#r-k-…)` 로 통일 (대문자 + `§` 접두).

- **[INFO]** 오류 정정 기록 방식이 같은 파일의 지배적 관례(취소선 보존)와 다르다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §7.1 "**정정 이력 (2026-09-05)**"
    블록쿼트 (target §③ 변경안이 지시, 반영은 `790487f34`)
  - 위반 규약: 명시적 조항은 없음 — 다만 같은 파일(14-external-interaction-api.md) 안에서만도
    L332·L592·L594·L836-838·L1562·L1665-1670·L1750·L1767-1786·L1819 등 10곳 이상이
    `~~<원문>~~ **(YYYY-MM-DD 해소/정정)**` 형태로 **틀렸던 원문을 취소선으로 그 자리에 보존**한다.
    `spec/conventions/egress-masking.md`·`spec/conventions/conversation-thread.md:390`(자기-반증형
    소정정 인용)도 같은 패턴이다. CLAUDE.md 의 자기-반증형 소정정 조건 4(“원문은 취소선으로 남기고”)도
    같은 취지를 명문화한다.
  - 상세: 신규 정정은 원문 삭제 후 별도 "정정 이력" 문단에 **이탤릭 인용부호**로 원문을 되풀이하는
    방식을 택했다 — 정보 손실은 없지만(원문 문구가 그대로 인용됨), 같은 파일이 반복 사용하는
    "취소선 인라인 보존" 관례와는 형태가 다르다. 이 사례는 developer 의 자기-반증형 소정정
    조항(§자기-반증형-소정정, 다섯 조건)의 적용 대상은 아니다 — 원문을 쓴 사람이 developer 가
    아니라 이전 planner 턴이므로 그 좁은 예외 자체와는 무관하다. 순수 형식 관례 편차다.
  - 제안: 강제 규약은 아니므로 필수 수정 아님. 일관성을 원하면 `~~"notification_secret_v2 컬럼도
    동일하게 ref 만 보관"~~ **(2026-09-05 정정)**: ...` 형태로 인라인 취소선을 쓰는 편이 이 파일의
    다른 9곳과 형태가 맞는다.

## 준수 확인 (참고 — 문제 없음)

- `secret-store.md §1` 신규 "비대상 — `Trigger.notification_secret_v2`" 문단은 §1 자신이 세운
  메타 규칙("itk_* 문단을 근거로 재사용하면 안 된다")을 정확히 지킨다 — `itk_*` 의 (a)~(c) 를
  인용하지 않고 독립된 근거 (1)~(4) 를 세웠고, 표기 형식(`**비대상 — \`필드명\`** (결정
  YYYY-MM-DD): …`)도 기존 두 예외(`AuthConfig.config`·`itk_*`)와 동일하다.
- `2-api-convention.md` frontmatter `code:` 에 추가된 `swagger-dto-contract*.ts` 글로브는 실제
  파일 2개(`swagger-dto-contract-guard.ts`·`swagger-dto-contract.spec.ts`)에 매치 —
  `spec-code-paths.test.ts`(status: implemented → `code:` ≥1 매치 의무, spec-impl-evidence.md §4)
  요건을 만족한다. §5.4 "검증 층" 표가 두 검증자(`swagger-dto-contract-guard.ts`
  ·`response-contract.ts`)를 나란히 적고 있다는 draft 의 주장도 실측과 일치한다(L232-233).
  R-1("넓은 트리 글롭으로 가드만 통과시키지 말 것")도 위반하지 않는다 — 구체 파일명 글로브다.
  cafe24-api-catalog·R-7 류 "생성기 산출물 예외"와는 무관한 일반 spec 이므로 frontmatter 의무
  대상(§1 inclusive list)에 정확히 해당한다.
  - **주의**: 위 확인은 §③이 지시한 변경이 **이미 이 브랜치에 커밋**돼 있어(`790487f34`, `git
    status` clean) 실물 대조가 가능했기 때문이다 — 아직 커밋되지 않은 미래 변경이었다면
    "지시문이 규약을 지킬 계획이다" 까지만 확인 가능했을 것.
- plan 문서 자체의 frontmatter(`worktree`/`started`/`owner`)는 `plan-lifecycle.md §4` 필수
  3필드를 모두 갖췄고, `spec_impact` 는 bare string 이 아닌 YAML 리스트이며 6개 항목 전부
  `spec/` 하위 실존 파일이다(직접 확인). `priority: P1` 도 이 저장소에서 쓰이는 어휘(P1/P2/P3)
  범위 안이다.
- 문서 구조: `## Rationale` 이 파일의 마지막 섹션이다 — 직전 라운드(`19_40_29`)가 지적한
  "Rationale 뒤에 번들 관찰 섹션이 붙어 있다" WARNING 은 이번 라운드에서 그 섹션을 Rationale
  **앞**(`## \`--spec\` 번들 관찰`)으로 재배치해 해소됐다(재확인).
- **금지 패턴 미답습**: `secret-store.md §1` 이 명시적으로 실패 모드로 지목한 "다른 예외의
  근거(itk_* (a)~(c))를 재사용해 세 번째 필드가 예외를 얻는" 패턴을 target 은 정확히 피했다 —
  거꾸로 그 경고를 본문에 재인용하며 독립 근거를 세우는 모범 사례로 반영했다.

## 요약

target 은 두 개의 순수 스타일 편차(같은 파일 안에서 cross-file 인용 라벨 형식이 갈리는 것 —
WARNING, 그리고 정정 기록 방식이 같은 파일의 지배적 취소선 관례와 다른 것 — INFO) 를 제외하면
`spec/conventions/**` 의 명시 규칙을 정확히 지킨다. 특히 `secret-store.md §1` 이 스스로 세운
"근거 재사용 금지" 메타 규칙을 준수했고, `2-api-convention.md` 의 `code:` 글로브 추가는 실제
파일과 매치해 `spec-code-paths.test.ts` 요건을 만족하며, plan frontmatter 스키마(`worktree`/
`started`/`owner`/`spec_impact` 리스트)도 `plan-lifecycle.md` 요건을 그대로 만족한다. WARNING
항목은 빌드 가드를 깨지 않고 순수 표기 일관성 문제이므로 이 PR 을 막을 사유는 아니나, 반영하면
문서 신뢰도가 올라간다.

## 위험도

LOW
