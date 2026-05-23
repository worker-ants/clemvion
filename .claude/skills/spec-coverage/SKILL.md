---
name: spec-coverage
description: spec/ 본문이 약속한 surface (UI / API / e2e 시나리오) 와 frontmatter `code:` 가 가리키는 구현 코드 사이의 정적 갭을 standing audit 으로 검출하는 slash command. 사용자가 "/spec-coverage", "spec 커버리지", "spec-impl 갭 검사" 등을 호출하거나, harness 의 주기적 grooming 시점에 수동으로 실행합니다. `consistency-check` 와 달리 PR diff / draft 기반이 아니라 **현재 main 상태 전수 분석** — NLP 휴리스틱 기반이라 CI 차단 아닌 보고형. 결과는 `review/spec-coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md`.
model: opus
---

# Spec Coverage Standing Audit

`spec/conventions/spec-impl-evidence.md` 의 frontmatter 가드는 **명시적 약속** (frontmatter `code:` 글로브) 만 검증. 본 skill 은 그 외 영역 — **본문 안 자유 텍스트로 약속된 surface** — 의 갭을 NLP 휴리스틱으로 검출.

전형 검출 대상 (텔레그램 chat-channel UI 영구 누락 사례의 일반화):
- spec 본문에 "트리거 생성 dialog 의 체크박스" 같은 UI 키워드 등장 + frontmatter `code:` 에 frontend 경로 매칭 없음
- spec 의 API endpoint 명세 (`POST /api/...`) + backend controller route 매칭 없음
- spec 의 e2e 시나리오 약속 + e2e spec 파일 매칭 없음

## 절대 원칙

- **수동 호출만** (사용자 결정 ⑤ 옵션 A) — GitHub Actions cron 도입 안 함. NLP 휴리스틱 false-positive 부담 > 자동화 가치
- **CI 차단 아님** — 후보 보고만. 사용자가 picking 해 별 plan 으로 이관
- **현재 main 상태 전수 분석** — PR diff 기반 아님. spec 적용 대상 ([`spec/conventions/spec-impl-evidence.md §1`](../../../spec/conventions/spec-impl-evidence.md)) 전수 walk
- **출력은 markdown**: `review/spec-coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md` 단일 결과 진입점

호출 규약·STATUS 라인: [`.claude/docs/subagent-call-contract.md`](../../docs/subagent-call-contract.md).

## 실행 절차 (main Claude 가 따른다)

### 0. 사전 점검
worktree 확인 — read-only 분석이므로 main 워크트리에서도 호출 가능 (산출물 `review/` 만 쓰기).

### 1. 세션 준비

```bash
python3 .claude/skills/spec-coverage/scripts/spec_coverage_orchestrator.py
```

stdout 마지막 줄이 session 디렉토리 절대경로. session_dir 안에:
- `_prompt.md` — sub-agent 입력 페이로드
- `meta.json` — 메타 (모드·target·생성 시각)

### 2. sub-agent 호출

```
Agent(subagent_type="spec-impl-coverage-auditor",
      prompt="prompt_file=<session_dir>/_prompt.md\noutput_file=<session_dir>/SUMMARY.md")
```

sub-agent 가 `spec/**.md` walk + 3개 heuristic 적용 후 SUMMARY.md 작성.

### 3. 결과 사용자 보고

SUMMARY.md 상단 30라인 Read → 후보 갯수 (high/medium/low) 요약 → 사용자에게 보고. 사용자가 picking 한 후보는 별 plan 으로 이관.

## 검출 heuristic (3 종)

| # | 신호 | confidence 기준 |
|---|---|---|
| 1 | spec 본문 UI 키워드 (page, dialog, card, button, drawer, modal, 체크박스, 버튼 등) 등장 + frontmatter `code:` 에 frontend (`codebase/frontend/`) 경로 매칭 없음 | high (UI 명백 + frontend 부재) |
| 2 | spec API endpoint 명세 (`POST /api/...` / `GET /api/...`) + backend controller route 매칭 없음 | medium (endpoint 명세는 명백하나 정규식 매칭 false-positive 가능) |
| 3 | spec e2e 약속 시나리오 (`### 시나리오`, `### Test scenario`, "사용자가 ~하면 ~") + e2e spec 파일 매칭 없음 | low (자유 텍스트 매칭 — false-positive 빈도 높음) |

각 후보는 spec 의 정확한 라인 번호 + 매칭 키워드 + 부재 코드 경로 (heuristic 추정) 와 함께 보고. 사용자가 검토하기 좋은 형태.

## 출력 위치

- `review/spec-coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md`
- `review/spec-coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/_prompt.md` (orchestrator 가 만든 입력)
- `review/spec-coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/meta.json`

CLAUDE.md §정보 저장 위치 표에 등재.

## 환경변수

- `SPEC_COVERAGE_CONFIDENCE_FLOOR` (기본 `low`) — `medium` / `high` 로 올리면 low confidence 후보 출력 생략
- `SPEC_COVERAGE_MAX_FINDINGS` (기본 `200`) — 후보 총 갯수 상한

## Rationale

### R-1. CI 차단 아닌 보고형

NLP 휴리스틱 기반이라 false-positive 빈도 높음. CI 차단 시 false-block 부담 > 검출 가치. 보고만 산출하고 사용자가 picking — `i18n-userguide` ratchet 패턴과 다른 사유 (ratchet 은 잔존 문제 점진 감소, 본 audit 은 신뢰도 낮은 휴리스틱).

### R-2. cron 도입 안 함 — 수동 호출만

사용자 결정 ⑤ 옵션 A. 초기에는 false-positive 비율 측정 단계 — cron 자동화 시 noise 만 누적. 운영 데이터 충분히 쌓이고 휴리스틱 정확도 검증되면 후속 plan 에서 GitHub Actions weekly cron 도입 검토.

### R-3. 산출 위치 = `review/spec-coverage/` 하위 (PR #287 결정 번복)

PR #287 의 초기 결정은 `review/consistency/coverage/` 였음 — `consistency-check` 5 checker 결과와 같은 일관성 검토 계열로 묶기 위함. 운영 후 두 가지 문제 발견:
1. 시각적 식별성 저하 — `review/consistency/` 아래 `coverage/` 가 묻혀 사용자가 산출물 위치를 즉시 인지하기 어려움
2. 본 audit 의 산출 흐름 (단일 sub-agent, NLP 휴리스틱 기반 보고형) 은 `consistency-check` (5 checker 병렬, Critical 차단형) 와 운영 모델이 다름 — 동일 경로 그룹화의 의미가 약함

번복 후 결정: `review/spec-coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`. 슬래시 command 이름 `/spec-coverage` 와 1:1 매칭되어 사용자가 산출물 위치를 추론하기 쉬움. `review/code/`, `review/consistency/`, `review/merge/` 와 어깨를 나란히 하는 1-depth 최상위 경로.

### R-4. single sub-agent (multi-agent 아님)

`/consistency-check` 의 5 checker 병렬 모델 차용 안 함. 본 audit 은 단일 분석 (전수 spec walk + 3 heuristic 통합 분류) 이라 분리할 의미 없음. orchestrator 는 session_dir 준비만 담당.
