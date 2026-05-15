# Code Review Agents

13개의 역할 기반 sub-agent 가 main Claude(현재 session) 의 `Agent` tool 호출로 코드 리뷰를 수행한다. 사용량 한도에 걸리면 `/loop /ai-review` 와 결합해 ScheduleWakeup 으로 무한 재시도한다.

## 아키텍처 한 줄 요약

```
사용자 → /ai-review → main Claude → orchestrator(--prepare, model 호출 X)
                                  → Agent tool × 13 (격리 컨텍스트)
                                  → STATUS 파싱 + _retry_state.json 갱신
                                  → 모두 완료 → code-review-summary sub-agent → SUMMARY.md
                                  → 남음 + /loop → ScheduleWakeup → turn 종료
```

`claude -p` subprocess 와 Anthropic SDK 직접 호출은 요금제 정책상 사용 불가하므로 제거되었다. 모든 model 호출은 main session 의 `Agent` tool 한 곳을 통한다.

## 13개 reviewer sub-agent

`.claude/agents/<role>-reviewer.md` 에 정의. 시스템 prompt + frontmatter(name, description, tools, model).

| # | sub-agent type | 핵심 관점 |
|---|----------------|-----------|
| 1 | `security-reviewer` | 인젝션, 하드코딩 시크릿, 인증/인가, 입력 검증, OWASP Top 10 |
| 2 | `performance-reviewer` | 알고리즘 복잡도, N+1 쿼리, 메모리, 캐싱, 블로킹 I/O |
| 3 | `architecture-reviewer` | SOLID, 결합도, 레이어 책임, 디자인 패턴, 순환 의존성 |
| 4 | `requirement-reviewer` | 기능 완전성, 엣지 케이스, TODO/FIXME, 의도/구현 괴리 |
| 5 | `scope-reviewer` | 의도 이상의 변경, 불필요한 리팩토링, 무관 수정 |
| 6 | `side-effect-reviewer` | 의도치 않은 상태 변경, 전역 변수, 파일 부작용, 시그니처 |
| 7 | `maintainability-reviewer` | 가독성, 네이밍, 함수 길이, 중첩, 매직 넘버, 중복 |
| 8 | `testing-reviewer` | 테스트 존재, 커버리지 갭, 엣지 케이스, mock |
| 9 | `documentation-reviewer` | docstring, README, API 문서, 주석 정확성 |
| 10 | `dependency-reviewer` | 새 의존성, 버전 고정, 라이선스, 취약점 |
| 11 | `database-reviewer` | 인덱스, N+1, 트랜잭션, 마이그레이션 안전성 |
| 12 | `concurrency-reviewer` | 경쟁 조건, 데드락, 동기화, async/await |
| 13 | `api-contract-reviewer` | 하위 호환성, 버전 관리, 응답/에러 형식 |

요약 sub-agent: `code-review-summary`.

> 11-13 (database, concurrency, api-contract) 은 해당 없는 코드면 "해당 없음, 위험도 NONE" 으로 `STATUS=success ISSUES=0` 반환.

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
                    ├── meta.json            ← 변경 정보 메타
                    ├── security/review.md   ← sub-agent 가 Write 한 리뷰 결과
                    ├── performance/review.md
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
  "subagent_invocations": [
    {
      "name": "security",
      "subagent_type": "security-reviewer",
      "prompt_file": "/abs/.../_prompts/security.md",
      "output_file": "/abs/.../security/review.md"
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

- 첫 사이클: orchestrator `--prepare` → 13개 Agent 호출 → 일부 한도 → ScheduleWakeup 으로 turn 종료. main session 은 해제되어 다른 작업 가능.
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

결과 디렉토리는 `./review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/{agent}/review.md` 로 떨어진다 (옛 flat 형식 `./review/<ts>/` 은 별도 일괄 이동 예정).
