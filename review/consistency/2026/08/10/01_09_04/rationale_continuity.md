# Rationale 연속성 검토 — plan-lifecycle-gates

## 프롬프트 결함 확인 (선행 사실)

호출자가 지목한 결함을 확인했다: `_prompts/rationale_continuity.md` (3074줄, 347.8KB) 에는
`## 구현 변경 사항` diff 섹션이 **없다** — 번들 예산 초과로 통째로 생략된 것으로 보인다
(문서 끝에 "컨텍스트 예산 초과로 생략된 파일 72개" 목록만 있고 diff 자체는 어디에도 없음).

추가로, 프롬프트가 잡은 target 범위(`spec/conventions/`)로 실제 이번 diff 에서 바뀐 파일은
`spec/conventions/spec-impl-evidence.md` 단 하나(2줄 추가, 1줄 변경)인데, **그 파일 자체도
번들에 포함돼 있지 않다**(번들엔 `audit-actions.md`·`cafe24-api-catalog/*`·
`cafe24-api-metadata.md`·`chat-channel-adapter.md` 4개만 있고 `spec-impl-evidence.md` 는 빠짐).
즉 이번 검토에서 실제로 대조해야 할 유일한 spec 파일이 번들에서 이중으로 누락된 셈이다.

이 결함 때문에 번들만으로는 판정이 불가능해, 아래는 **워킹트리 절대경로**
(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`)를 직접 열어
`git diff origin/main`·`Read`로 재구성한 근거로 작성했다.

## 실제 변경 재구성 (직접 확인)

- `spec/conventions/spec-impl-evidence.md` — `code:` 에 `plan-scan.ts` 추가, §4.2 표의
  `plan-frontmatter.test.ts` 행 서술 확장(3가지 검사로 분리 서술).
- `.claude/docs/plan-lifecycle.md` §4 — `status` 종료값 강제(`TERMINAL_STATUSES` =
  `complete`/`implemented`/`applied`/`superseded`) + top-level in-progress plan 상대링크
  무결성 규정 신설.
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`(신설) — `TERMINAL_STATUSES` 상수
  실장 확인(93행 `Set` 선언, 123행 `has()` 사용) + `plan-frontmatter.test.ts`/`spec-links.ts`
  갱신.
- `plan/complete/*.md` 15개 — `status: in-progress` → `complete` 일괄 정정
  (`implemented`/`applied`/`superseded` 3종은 건드리지 않음).
- `plan/complete/spec-draft-secret-store-verification-footnote.md` 의 "후속" 절에 "일괄
  정정을 골랐다(ratchet 아님)" 근거가 이미 상세히 적혀 있고, `.claude/docs/plan-lifecycle.md`
  §4 에도 같은 결정이 반영돼 있다 — 두 문서가 정합.

## 점검 관점별 확인

### 1) 기각된 대안의 재도입

세 결정 모두 **번들 안에서든 워킹트리 spec Rationale 전수 검색에서든** 과거에 명시적으로
기각된 적이 있는 대안을 다시 쓰는 사례를 찾지 못했다.

- **ratchet 대신 일괄 정정**: `spec/conventions/i18n-userguide.md §Rationale "왜 P2-b 는
  hard fail 이 아닌 ratchet 인가"`(233~235행)를 확인했다 — 이 항목의 근거는 "기존 하드코딩
  한국어가 일정 수 있고 **한 번에 0 화는 비현실적**"이라는 **그 사안 한정**의 판단이며, "신규
  게이트는 항상 ratchet 으로 도입한다"는 일반 원칙으로 서술돼 있지 않다. `#1109`
  (backend 타입체크 ratchet, 199건/38파일)도 같은 논리로 채택됐다 — "전면 승격하려면 209건을
  먼저 처분해야 해서 diff 가 통째로 커진다"는 **큰 기존 부채**가 전제다. 이번 사안(`plan/complete/**`
  의 `status: in-progress` 15건)은 성격이 다르다 — 옳은 값이 이미 확정돼 있고(15건 모두
  단순 사실 오류) 일괄 수정 비용이 작다. 두 ratchet 선례 어디에도 "사실 오류 정정에도 ratchet
  을 써야 한다"는 문구가 없어 재도입할 "기각된 대안"이 성립하지 않는다. 오히려 이 판단
  기준(부채 규모·확정성)은 두 ratchet Rationale 이 이미 쓴 논리와 정합적이다.
- **`implemented`/`applied`/`superseded` 를 `complete` 로 눕히지 않음**: spec `## Rationale`
  전수(그리고 번들에 포함된 발췌 전체)에 `plan/complete` 의 `status` 값 어휘를 단일화하라는
  기존 결정이 없다 — 즉 되살릴 "기각 대안" 자체가 없다. 신규 결정이며 자체 근거(`superseded`
  = "대체됨"이라 완료 의미가 아님)를 커밋 메시지(`9e880e908`)와 `plan-lifecycle.md §4`
  양쪽에 남겼다.
- **링크 게이트를 `plan/complete/**` 로 확장하지 않음**: `spec/conventions/spec-impl-evidence.md
  §4.2` 표(129행)가 이미 "**spec 본문 스캔에는 target 필터가 없다** — plan 이동 시 갱신하지
  않으면 build 가 깨진다"와 "plan-coherence-checker 가 담당하는 것은 `plan/**` **문서
  내부**의 링크 위생"이라는 기존 구분을 갖고 있는데, 이번 결정은 그 축 중 **plan-내부 링크**
  축에 새 build 가드(top-level in-progress 한정)를 추가하면서 `plan/complete/**` 는 `plan-
  lifecycle.md §3` "인입 참조 — 시점 기록 문서는 옛 경로 유지"를 근거로 제외한 것이다. §3
  의 이 조항은 이번 diff 이전부터 있던 문구이므로, 이번 결정은 **기존 원칙을 그대로 따른
  것**이지 기각된 대안의 재도입이 아니다.

### 2) 합의된 원칙 위반

발견 없음. 세 결정 모두 §1 에서 확인한 기존 원칙(ratchet 은 대규모·확정 곤란 부채 전용,
plan lifecycle §3 인입 참조 규칙)과 상충하지 않는다.

### 3) 결정의 무근거 번복

발견 없음 — 세 결정 모두 새 Rationale(또는 그에 준하는 근거 서술)을 **함께** 남겼다:
`.claude/docs/plan-lifecycle.md §4` 의 인라인 blockquote 근거, `plan/complete/spec-draft-
secret-store-verification-footnote.md` 후속 절의 상세 근거, 커밋 메시지 `9e880e908`. 다만
이 세 곳 모두 **spec `## Rationale` 이 아니라 `.claude/docs/`·`plan/` 문서**에 있다는 점은
아래 §4 에서 별도로 짚는다.

### 4) 암묵적 가정 충돌

`spec-impl-evidence.md` 자체의 `## Rationale`(R-1~R-10, 특히 R-9 "§4.2 지식저장소·plan
무결성 가드 — 별도 family")를 전문 대조했다. 이번 diff 가 손댄 §4.2 표 행(`plan-frontmatter.
test.ts`) 서술 확장은 R-9 가 이미 규정한 분류("plan 문서 자체의 구조·연결 무결성" family,
"규약 SoT 는 plan-lifecycle §4 로 위임")를 그대로 따르고 있어 이 문서가 세운 invariant 를
우회하지 않는다.

## 절차상 관찰 (Rationale 연속성과는 별개, 참고용)

- **문서 배치 관점**: 세 결정의 근거는 spec `## Rationale` 이 아니라 `.claude/docs/plan-
  lifecycle.md`(process 문서)와 `plan/complete/*.md`(완료 plan)에 있다. CLAUDE.md 의
  "정보 저장 위치" 표는 "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"이라고
  규정하지만, 이는 `spec/**` 문서에 적용되는 규약이고 `.claude/docs/plan-lifecycle.md` 는
  spec 이 아니라 harness/process 문서라 이 표의 적용 대상이 아니다 — 실제로 그 파일은
  이번 diff 이전부터 `>` blockquote 형태의 인라인 근거를 다수 갖고 있어(예: §2 "왜 research
  를 나누나") 이번 추가도 같은 문서 스타일을 따른다. Rationale 연속성 위반은 아니다.
- **번들 이중 누락**: 위에서 지적한 대로 이번 검토에서 실제로 바뀐 유일한 spec 파일
  (`spec-impl-evidence.md`)이 번들 target 섹션에서 빠져 있었다. 이번엔 직접 워킹트리 대조로
  보완했지만, 같은 결함이 재발하면 checker 가 유일한 실제 target 없이 무관한 4개 파일만 보고
  판정할 위험이 있다 — orchestrator 쪽 번들링 로직(어떤 파일이 diff 에 실제로 바뀌었는지
  우선순위를 주는지) 점검을 권한다.

## 요약

이번 diff 의 세 가지 결정(ratchet 대신 일괄 정정·`TERMINAL_STATUSES` 로 종료 어휘 보존·
plan/complete/** 를 링크 게이트 밖에 둠) 모두, 확인 가능한 spec `## Rationale`(i18n-
userguide.md 의 ratchet 근거, spec-impl-evidence.md 의 R-9, spec-link-integrity 관련 §4.2
서술)과 대조했을 때 과거 기각된 대안을 무단으로 되살리거나 합의 원칙을 어기는 지점을 찾지
못했다. 오히려 각 결정은 기존 원칙(부채 규모 기반 ratchet 채택 기준, plan-lifecycle §3 인입
참조 규칙, spec-impl-evidence R-9 의 family 분류)을 일관되게 적용한 결과로 보인다. 다만 이
결론은 프롬프트 번들의 이중 누락(diff 섹션 부재 + 유일한 실제 target 파일 누락) 때문에 번들
자체가 아니라 워킹트리 직접 대조로 도달했다는 한계가 있다.

## 위험도

NONE

STATUS=success
