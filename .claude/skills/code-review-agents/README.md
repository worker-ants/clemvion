# Code Review Agents

역할 기반 sub-agent (디폴트 14개, `.claude.project.json` 의 `agents.reviewers` 로 부분 disable 가능) 가 main Claude(현재 session) 의 `Agent` tool 호출로 코드 리뷰를 수행한다. 사용량 한도에 걸리면 `/loop /ai-review` 와 결합해 ScheduleWakeup 으로 무한 재시도한다.

## 아키텍처 한 줄 요약

```
사용자 → /ai-review → main Claude → orchestrator(--prepare, model 호출 X)
                                  → Agent tool × N (project_config 통과 후 enabled reviewer 수)
                                  → STATUS 파싱 + _retry_state.json 갱신
                                  → 모두 완료 → code-review-summary sub-agent → SUMMARY.md
                                  → 남음 + /loop → ScheduleWakeup → turn 종료
                                  → SUMMARY 에 Critical/Warning → 자동 후속
                                    (분류 → spec/코드 수정 → e2e → 재리뷰 → RESOLUTION.md)
```

자동 후속 흐름은 SKILL.md "단계 8. 자동 후속 흐름" 참고. 안전 가드(consistency-check `BLOCK: YES`, e2e 누적 3회 실패, DB 마이그레이션·외부 API 계약 변경 등) 가 발화되면 자동 진행 중단 + 사용자 보고.

`claude -p` subprocess 와 Anthropic SDK 직접 호출은 요금제 정책상 사용 불가하므로 제거되었다. 모든 model 호출은 main session 의 `Agent` tool 한 곳을 통한다.

## Reviewer sub-agent (디폴트 14)

`.claude/agents/<role>-reviewer.md` 에 정의. 시스템 prompt + frontmatter(name, description, tools, model).

| # | sub-agent type | 핵심 관점 | 토글 (`agents.reviewers.<key>`) |
|---|----------------|-----------|---|
| 1 | `security-reviewer` | 인젝션, 하드코딩 시크릿, 인증/인가, 입력 검증, OWASP Top 10 | `security` |
| 2 | `performance-reviewer` | 알고리즘 복잡도, N+1 쿼리, 메모리, 캐싱, 블로킹 I/O | `performance` |
| 3 | `architecture-reviewer` | SOLID, 결합도, 레이어 책임, 디자인 패턴, 순환 의존성 | `architecture` |
| 4 | `requirement-reviewer` | 기능 완전성, 엣지 케이스, TODO/FIXME, 의도/구현 괴리, **관련 spec 본문 일치 여부** | `requirement` |
| 5 | `scope-reviewer` | 의도 이상의 변경, 불필요한 리팩토링, 무관 수정 | `scope` |
| 6 | `side-effect-reviewer` | 의도치 않은 상태 변경, 전역 변수, 파일 부작용, 시그니처 | `side_effect` |
| 7 | `maintainability-reviewer` | 가독성, 네이밍, 함수 길이, 중첩, 매직 넘버, 중복 | `maintainability` |
| 8 | `testing-reviewer` | 테스트 존재, 커버리지 갭, 엣지 케이스, mock | `testing` |
| 9 | `documentation-reviewer` | docstring, README, API 문서, 주석 정확성 | `documentation` |
| 10 | `dependency-reviewer` | 새 의존성, 버전 고정, 라이선스, 취약점 | `dependency` |
| 11 | `database-reviewer` | 인덱스, N+1, 트랜잭션, 마이그레이션 안전성 | `database` |
| 12 | `concurrency-reviewer` | 경쟁 조건, 데드락, 동기화, async/await | `concurrency` |
| 13 | `api-contract-reviewer` | 하위 호환성, 버전 관리, 응답/에러 형식 | `api_contract` |
| 14 | `user-guide-sync-reviewer` | PROJECT.md §변경 시 동반 갱신 매트릭스 기반 docs MDX·i18n dict·backend-labels 동반 갱신 누락 검출 | `user_guide_sync` |

요약 sub-agent: `code-review-summary`.

> 11-14 (database, concurrency, api-contract, user_guide_sync) 은 해당 없는 코드면 "해당 없음, 위험도 NONE" 으로 `STATUS=success ISSUES=0` 반환.

### 프로젝트별 reviewer 토글 (`agents.reviewers`)

`.claude.project.json` 에서 reviewer 별 enable 토글. 디폴트는 전부 활성화 (키 누락 / `true` ⇒ enabled, 명시 `false` ⇒ disabled). 일회성 override 는 `REVIEW_AGENTS` env (project_config 보다 우선).

예 — 유저 가이드 매트릭스가 없는 generic 프로젝트:

```json
{
  "agents": {
    "reviewers": {
      "user_guide_sync": false
    }
  }
}
```

## Router safety policy

기본 `--route=auto` 동작에서 `review-router` 가 enabled reviewer 중 일부만 실행하도록 좁히지만, 아래 트리거에 매칭되는 변경은 router 가 끄지 못하도록 강제 포함된다 (`agents_forced[]`). false-negative (router 가 보안·요구사항·DB 등을 놓치는 사고) 를 차단하기 위한 안전망.

| Trigger | Forced reviewers | 근거 |
|---|---|---|
| 소스 파일 (24 확장자) | **security, requirement, scope, side_effect, maintainability, testing** | 코드 변경의 핵심 6관점은 router 판단 무관하게 항상 점검 |
| `package.json`/`package-lock.json`/`requirements*.txt`/`Pipfile`/`pyproject.toml`/`go.mod`/`Cargo.toml` 등 | dependency + documentation | dependency 변경은 보통 README/CHANGELOG 갱신 동반 |
| 문서 파일 (`*.md`, `*.txt`, `*.rst`, `*.adoc`, `LICENSE`, `NOTICE`, `AUTHORS`, `CHANGELOG`, `README` 등) | documentation | |
| `**/migrations/*`, `*.sql`, `**/prisma/schema*` | database | 마이그레이션·스키마 안전성 |
| `**/openapi*.{yml,yaml,json}`, `**/swagger*.{yml,yaml,json}` | api_contract | API 계약 변경 |
| `spec/**/*.md` | requirement (+ documentation via doc rule) | spec 본문은 요구사항 일관성 검증 필요 |
| `Dockerfile`, `Dockerfile.*`, `docker-compose*.{yml,yaml}` | dependency + security | base image·package install (dependency) + USER·secret·port·privileged (security) |
| `.dockerignore` | security | 잘못된 제외 시 `.env`/`.git`/secret 이 build context 에 포함될 위험 |
| `.env`, `.env.*`, `*.env`, `*.env.example` | security | secret / connection string / API key 누설 |
| **위 어디에도 안 잡힘** | (강제 없음) | router 가 모두 false 로 결정 시 fatal → main 이 minimal SUMMARY 작성 후 종료 (전체 fallback 안 함) |

소스 코드 확장자: `ts tsx js jsx mjs cjs · py pyi · java kt kts scala groovy · go rs · c cc cpp cxx h hh hpp hxx · swift m mm · rb php lua · cs fs vb · ex exs erl hrl ml mli clj cljs · dart · sh bash zsh`

> **SSOT**: 본 표는 `lib/router_safety.py` 의 module docstring 을 미러링한다. 정책 변경 시 두 곳을 같이 갱신하라 — 그 파일의 `_RULES` / 패턴 상수가 진실의 기준이다. 표 stale 발견 시 `lib/router_safety.py` 가 정답.

## 빠른 시작

```bash
# 일반 (한 사이클)
/ai-review

# 사용량 한도가 걸려도 자동 재시도
/loop /ai-review

# 특정 커밋 / 범위 / 브랜치
/ai-review --commit HEAD~3
/ai-review --range main..feature
/ai-review --branch main

# 특정 파일·디렉토리
/ai-review src/auth/
```

세부 절차는 `SKILL.md` 의 "실행 절차" 섹션 참고.

## 산출물 디렉토리 구조

```
review/
└── code/
    └── 2026/
        └── 05/
            └── 15/
                └── 03_00_00/                ← <hh>_<mm>_<ss>
                    ├── _prompts/
                    │   ├── security.md      ← orchestrator 가 작성한 reviewer 입력
                    │   ├── performance.md
                    │   └── ...
                    ├── _retry_state.json    ← 재시도/상태 (main 이 갱신)
                    ├── _routing_decision.json ← review-router 가 작성한 선별 결과 (--route=auto 시)
                    ├── meta.json            ← 변경 정보 메타
                    ├── security.md          ← sub-agent 가 Write 한 리뷰 결과 (<role>.md)
                    ├── performance.md
                    ├── ...
                    ├── SUMMARY.md           ← summary sub-agent 의 통합 보고서
                    └── RESOLUTION.md        ← 사용자/developer 가 조치 결과 기록 (선택)
```

> 일관성 검토(`/consistency-check`) 도 동일하게 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 로 떨어진다. nested 형식은 누적된 세션 수가 한 디렉토리 안에서 폭주하지 않도록 한 단계 분리하기 위함이다 — `REVIEW_OUTPUT_DIR` / `CONSISTENCY_OUTPUT_DIR` 로 prefix(`./review/code`, `./review/consistency`) 만 바꾸고 내부 nested 분할은 `lib.session.create_session_dir` 가 관리한다.

## `_retry_state.json` 스키마

```jsonc
{
  "session_dir": "/abs/path/to/review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>",
  "summary_subagent_type": "code-review-summary",
  "summary_output_file": "/abs/.../SUMMARY.md",
  "router_subagent_type": "review-router",
  "router_prompt_file": "/abs/.../_prompts/_router.md",  // routing_status==pending 일 때만; orchestrator 작성
  "router_output_file": "/abs/.../_routing_decision.json",
  "routing_status": "pending",            // pending | done | skipped
  "routing_skip_reason": null,            // "REVIEW_AGENTS explicitly set" / "--route=all" / "router fatal: ..."
  "agents_forced": [                       // router 가 끄지 못하는 reviewer 들 (router_safety 규칙)
    "security", "requirement", "scope", "side_effect", "maintainability", "testing"
  ],
  "agents_forced_reasons": {              // 각 forced reviewer 의 trigger 사유 (여러 규칙이 같은 reviewer 를 강제할 수 있음)
    "security": ["소스 코드 변경 — 코드 변경 시 항상 적용: <code-path>"],
    "requirement": ["소스 코드 변경 — 코드 변경 시 항상 적용: <code-path>"]
  },
  "agents_skipped": [],                   // router 가 이번 세션에서 생략한 reviewer 들
  "subagent_invocations": [
    {
      "name": "security",
      "subagent_type": "security-reviewer",
      "prompt_file": "/abs/.../_prompts/security.md",
      "output_file": "/abs/.../security.md"
    },
    // ... 13 entries
  ],
  "agents_pending": ["security", "..."],
  "agents_success": [],
  "agents_fatal": [],
  "agent_history": {
    "security": [
      {"ts": "2026-05-15T03:01:00Z", "status": "rate_limit", "reset_hint_sec": 1800}
    ]
  },
  "rate_limit_episodes": 1,
  "total_wait_sec": 0,
  "wake_history": [],
  "last_reset_hint_sec": 1800,
  "loop_mode": true
}
```

main 은 매 사이클마다 위 JSON 을 Read → 갱신 → Write 한다.

## sub-agent return contract

각 reviewer / checker / summary sub-agent 는 한 줄로 응답한다:

```
STATUS=<success|rate_limit|network|fatal> ISSUES=<n> PATH=<output_file> RESET_HINT=<sec 또는 빈 값>
```

본문은 sub-agent 가 `output_file` 에 Write 한다 — main 에게 본문을 반환하지 않는다 (main 의 context window 부담 최소화).

## /loop 결합 — 무한 재시도

```
/loop /ai-review
```

- 첫 사이클: orchestrator `--prepare` → N개 Agent 호출 (router 통과 + project_config 통과) → 일부 한도 → ScheduleWakeup 으로 turn 종료. main session 은 해제되어 다른 작업 가능.
- wake 시점: 동일 session_dir 의 `_retry_state.json` 으로 재진입 → pending 만 다시 호출.
- 모두 success 가 되면 `code-review-summary` 호출 → SUMMARY.md → /loop 자연 종료.

ScheduleWakeup delay:
- sub-agent 가 RESET_HINT 보고 → 그 값 사용 (보통 한도 reset 시간).
- 없으면 `RETRY_WAKE_DEFAULT_SEC` (1800s) 사용. 상한 `RETRY_WAKE_CAP_SEC` (3600s, ScheduleWakeup runtime cap).

## 환경변수

| 변수 | 기본값 | 의미 |
| --- | --- | --- |
| `REVIEW_AGENTS` | (전체 13) | 실행할 reviewer 쉼표 구분 |
| `REVIEW_OUTPUT_DIR` | `./review/code` | 세션 디렉토리 부모 (nested ISO 분할은 lib.session 이 담당) |
| `REVIEW_SKIP_EXTENSIONS` | (없음) | 건너뛸 확장자 |
| `REVIEW_MAX_FILE_SIZE` | `51200` | 개별 파일 컨텐츠 상한 (자) |
| `REVIEW_MAX_PROMPT_SIZE` | `131072` | reviewer 1명분 prompt body 상한 (자) |
| `REVIEW_BATCH_SIZE` | `50` | 한 세션 당 파일 상한 (초과 시 batch 분할) |
| `AI_REVIEW_LOOP` | `0` | `1` → `loop_mode=true` 로 초기화 (slash command 가 자동 설정) |
| `RETRY_WAKE_DEFAULT_SEC` | `1800` | reset-hint 없을 때 ScheduleWakeup 대기 |
| `RETRY_WAKE_CAP_SEC` | `3600` | wake delay 상한 |

> 옛 `REVIEW_MODEL`, `REVIEW_TIMEOUT`, `DISABLE_CODE_REVIEW`, `RETRY_DISABLED`, `RATE_LIMIT_PATTERNS`, `NETWORK_PATTERNS` 는 더 이상 동작하지 않는다 (subprocess 모드의 유산).

## 디버그 로그

orchestrator 가 `/tmp/code-review-agents-log.txt` 에 prepare 단계의 이벤트(파일 수집, prompt 사이즈, batch 분할) 를 기록한다. model 호출 자체는 main session 의 transcript 에 남는다.

## Ctrl+C 동작

- /loop 가 아닌 단일 사이클이라면 main 의 turn 안에서 일반 Ctrl+C 가 동작한다 (Agent tool 호출 중 cancel).
- /loop 안이라면 ScheduleWakeup 으로 예약된 다음 wake 는 `/loop end` 또는 사용자 명시적 중단으로 끊는다.

## 마이그레이션 노트

이전 버전(`claude -p` 기반) 과의 차이:

| 항목 | 옛 (subprocess) | 새 (sub-agent) |
| --- | --- | --- |
| model 호출 위치 | `subprocess.run(["claude","-p",...])` | main Claude → `Agent` tool |
| 격리 | 별도 CLI 프로세스 | sub-agent 자동 격리 conversation |
| 자동 trigger | `hooks.json` PostToolUse 자동 | 사용 불가 (제거됨), slash command 만 |
| 재시도 | 외부 Python (구현 안 됨) | main session + `/loop` + ScheduleWakeup |
| prompt 출처 | `prompts/agents/<role>.md` | `.claude/agents/<role>-reviewer.md` system prompt |
| 호출 인자 | `--cli ...` | `--prepare ...` (옛 `--cli` 는 deprecated alias) |

결과 디렉토리는 `./review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/<role>.md` 로 떨어진다 (옛 `<role>/review.md` 구조와 옛 flat 형식 `./review/<ts>/` 의 누적 데이터는 history 보존 차원에서 그대로 둠 — 새 세션부터 평탄 구조 적용).
