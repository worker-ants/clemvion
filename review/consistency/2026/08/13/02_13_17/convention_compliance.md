# 정식 규약 준수 검토 — spec-draft-redis-key-registry.md

## 발견사항

- **[WARNING] `## Rationale` 절 중복 (H2 두 개) — project-planner SKILL.md 워크플로 문구 직접 위반**
  - target 위치: `plan/in-progress/spec-draft-redis-key-registry.md` L152 `## Rationale`
    과 L204 `## Rationale — consistency \`02_01_16\` 노트 (BLOCK: YES → 조치)` (두 번째 표는
    L206~L217)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §작업 워크플로 3번("본문 끝에
    `## Rationale` 로 결정 근거 명시") · 4번("BLOCK: NO + Warning → `## Rationale` 에 노트
    남기고 진행") — 단수 표현으로, consistency-check 노트는 **기존 `## Rationale` 절 안에**
    적으라는 지시다. CLAUDE.md 도 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 을
    명시한다.
  - 상세: target 은 최상위 `## Rationale` 이 이미 L152 에 존재하는데도(같은 절 안에 `02_01_16`
    노트의 "계보" 인용이 이미 L172-176, L194-198 두 군데 각주로도 들어가 있다), 별도 두 번째
    `## Rationale — …` H2 를 신설해 BLOCK:YES 처분 표를 거기 담았다. 이 저장소의 동일 계열
    선행 문서(`plan/complete/spec-draft-eia-idempotency-key-scope.md`)는 정확히 같은 상황
    (consistency-check 노트 테이블)에서 이를 **단일 `## Rationale` 아래 H3 서브섹션**
    (`### consistency-check \`19_56_51\` 노트 (BLOCK: NO, WARNING 4)`)으로 넣어 이 지시를
    지켰다. build 가드가 heading 개수 자체를 검사하진 않으나(비-CRITICAL 사유), 문서 타입
    전체의 구조 일관성 — 그리고 SKILL.md 문구가 단수로 못박은 지시 — 를 벗어난다.
  - 제안: L204 의 `## Rationale — consistency …` 를 `### consistency-check \`02_01_16\` 노트
    (BLOCK: YES → 조치)` 로 낮춰 L152 `## Rationale` 절의 마지막 서브섹션으로 병합한다
    (선행 문서와 동일 패턴).

- **[WARNING] 신설 규약의 `{도메인}:{용도}:{식별자}` 3-세그먼트 서술이 표에 나열된 다수 키와
  글자 그대로는 맞지 않는다 — 지금 고치려는 결함과 같은 모양의 위험**
  - target 위치: L105-106 "**명명 규칙 (사실 기반)**: `{도메인}:{용도}:{식별자}`. 도메인은
    코드 소유 모듈을 가리키는 짧은 접두…" (§제안 변경 1. `spec/conventions/redis-keys.md` 신설)
  - 위반 규약: 규약 자체(신설 예정 `spec/conventions/redis-keys.md`)가 §9.1 폐기 사유로 든
    원칙 — "규칙이 실제와 어긋나면 규칙 쪽이 틀린 것" (target 본문 L41, L169-170 "지켜진 적
    없는 규칙은 규칙이 아니라 오해의 원천"). 신설 규칙 서술 자체가 그 원칙에 스스로 반증되는
    형태다.
  - 상세: L31-39 실측 표를 콜론 세그먼트 수로 세어 보면 3-세그먼트(`도메인:용도:식별자`)에
    맞는 것은 `exec:recover:lock`·`exec:seq:<executionId>`·`iext:blacklist:<jti>`·
    `integration:cache:invalidate` 정도이고, 나머지 **9~10개 계열은 4~6 세그먼트**다 —
    `interaction:idempotency:<executionId>:<route>:<key>`(5) · `eia:rl:interact:<executionId>`(4)
    · `eia:notif:rl:<triggerId>`(4) · `cc:rl:<triggerId>:<conversationKey>`(4) ·
    `wh:rl:min:<ip>`(4) · `cafe24:install:nonce:<mall_id>:<ts>:<hmac>`(6) 등. "식별자" 한
    토큰으로 뭉뚱그리면 읽는 사람이 다시 "패턴이 실제와 다르다" 라고 재지적할 여지가 있다 —
    이번 착수의 출발점이 정확히 그 형태였다(§9.1 `{service}:{workspaceId}:{resource}:{id}:{sub}`
    가 실제 키 0개와 일치).
  - 제안: 신설 문서 표기 시 "식별자" 를 `{식별자...}` (가변 다중 세그먼트 허용) 로 명시하거나,
    "용도" 뒤에 세부 sub-용도·복수 식별자가 이어질 수 있음을 각주로 못박는다. 즉 패턴을
    "정확한 문법"이 아니라 "머리 2세그먼트(도메인:용도)만 고정, 꼬리는 가변" 으로 명확히
    한정해 서술한다.

- **[INFO] "비-카탈로그 conventions 문서 18개" 수치가 실제 파일 수와 바로 일치하지 않는다**
  - target 위치: L101-102 "이 저장소의 비-카탈로그 conventions 문서 18개가 예외 없이 갖는
    스키마"
  - 위반 규약: 없음(사소한 서술 정확도) — `spec/conventions/spec-impl-evidence.md` R-7 의
    "카탈로그 최상위 `<resource>.md` 인덱스(… 18개)" 서술과 숫자가 같아 혼동 소지가 있다.
  - 상세: `spec/conventions/*.md`(하위 카탈로그 디렉토리 제외) 최상위 파일은 실측 21개이고
    전부 `id`/`status`/`code` frontmatter 를 갖는다(확인함). "18개" 는 여기서
    `cafe24-api-metadata.md`·`makeshop-api-metadata.md`(카탈로그 인접)·
    `spec-impl-evidence.md`(스키마 정의 문서 자신) 3개를 제외했을 때만 맞는 수다 — 그
    제외 기준이 본문에 적혀 있지 않다.
  - 제안: "18개" 대신 "예외 없이" 만 남기거나, 제외 기준(카탈로그 메타데이터·가드 정의
    문서 자신 제외)을 한 구절로 명시한다. 규약 위반은 아니므로 착수를 막을 사유는 아니다.

## 준수 확인 (참고 — 위반 아님)

- 신설 위치 `spec/conventions/redis-keys.md` 는 CLAUDE.md 명명 컨벤션("정식 규약 →
  `spec/conventions/<name>.md`")과 정확히 일치.
- 계획된 frontmatter(`id: redis-keys` kebab-case · `status: implemented` · `code:` 6모듈
  글로브)는 `spec/conventions/spec-impl-evidence.md` §2-§3 스키마·라이프사이클을 정확히
  따른다. 글로브 대상 6모듈(`execution-engine`·`external-interaction`·`chat-channel`·
  `hooks`·`integrations`·`common/redis`) 은 실제 `codebase/backend/src/modules|common` 경로와
  전부 일치해 `spec-code-paths.test.ts` (status: implemented 는 ≥1 매치 의무) 를 통과할
  것으로 보임.
- `4-execution-engine.md` §9.1/§9.2 heading 텍스트 보존 계획(L137-140)은
  `spec-impl-evidence.md` §4.2 `spec-link-integrity.test.ts` (인바운드 `#anchor` 링크를
  실제 heading slug 와 대조하는 build 가드) 의 존재 이유와 정확히 부합 — heading 을 바꾸면
  인바운드 3건이 깨진다는 진단이 이 가드의 동작과 일치한다.
- `spec/conventions/**.md` 는 `spec-area-index.test.ts` 에서 예외(flat reference, 무-index)
  이므로 신설 `redis-keys.md` 를 위해 별도 index 등재가 필요 없다는 점(target 이 언급하지
  않음)도 규약과 맞다.
- `spec/data-flow/**` 는 frontmatter-evidence 의무 대상이 아니므로(§1 명시 제외) `data-flow/15`
  §2.2 에 프론트매터 없이 역참조 한 줄만 추가하는 계획(L148-150)도 정합.

## 요약

target 은 신설 규약 문서(`spec/conventions/redis-keys.md`)의 frontmatter 스키마·글로브
대상·heading 보존 근거를 실제 `spec-impl-evidence.md` build 가드와 정확히 맞춰 설계했고,
CLAUDE.md 의 파일 명명 컨벤션(`spec/conventions/<name>.md`)도 정확히 따른다. 다만 문서
구조 면에서 `project-planner` SKILL.md 가 명시한 "본문 끝에 단일 `## Rationale`" 지시를
어기고 두 번째 최상위 `## Rationale` 절을 신설했으며(같은 계열 선행 문서는 H3 서브섹션으로
처리), 신설 예정 명명 규칙 서술(`{도메인}:{용도}:{식별자}`)이 스스로 표에 나열한 실제 키
다수와 세그먼트 수가 맞지 않아 — 이번 착수의 출발점이 됐던 "규칙이 실제와 어긋난다" 결함을
축소된 형태로 재생산할 위험이 있다. 둘 다 착수 전 draft 수정으로 손쉽게 해소 가능한
WARNING 이며, build 를 깨뜨리는 CRITICAL 은 발견되지 않았다.

## 위험도

LOW
