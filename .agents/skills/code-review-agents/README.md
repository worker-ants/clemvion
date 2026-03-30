# Code Review Agents Hook

Claude Code가 코드를 생성(`Write`)하거나 수정(`Edit`)할 때마다 자동으로 13개의 역할 기반 AI 리뷰어 에이전트가 병렬로 실행되어 코드 리뷰를 수행하는 PostToolUse 훅입니다.

## 개요

코드 변경이 발생할 때마다 보안, 성능, 아키텍처 등 13개 전문 관점에서 자동으로 리뷰가 수행됩니다. 모든 리뷰가 완료되면 요약 에이전트가 결과를 통합하여 최종 보고서를 생성합니다.

## 동작 방식

1. Claude Code가 `Write` 또는 `Edit` 도구를 사용하면 PostToolUse 훅이 트리거됩니다
2. 오케스트레이터가 stdin에서 변경 정보(파일 경로, 변경 코드)를 읽습니다
3. `os.fork()`로 백그라운드 프로세스를 분리하여 부모 프로세스는 즉시 종료합니다 (Claude Code 블로킹 없음)
4. 13개 리뷰어 에이전트가 `ThreadPoolExecutor`로 병렬 실행됩니다
5. 각 에이전트는 `claude -p` 명령으로 해당 관점의 리뷰를 수행합니다
6. 모든 에이전트 완료 후 요약 에이전트가 결과를 통합합니다
7. 리뷰 결과는 `./review/{timestamp}/` 디렉토리에 저장됩니다

## 13개 리뷰어 에이전트

| # | 에이전트 | 핵심 관점 |
|---|----------|-----------|
| 1 | **Security** | 인젝션, 하드코딩 시크릿, 인증/인가, 입력 검증, OWASP Top 10 |
| 2 | **Performance** | 알고리즘 복잡도, N+1 쿼리, 메모리 할당, 캐싱, 블로킹 I/O |
| 3 | **Architecture** | SOLID 원칙, 결합도, 레이어 책임, 디자인 패턴, 순환 의존성 |
| 4 | **Requirement** | 기능 완전성, 엣지 케이스, TODO/FIXME, 의도와 구현 간 괴리 |
| 5 | **Scope** | 의도 이상의 변경, 불필요한 리팩토링, 기능 확장, 무관한 수정 |
| 6 | **Side Effect** | 의도치 않은 상태 변경, 전역 변수, 파일시스템 부작용, 시그니처 변경 |
| 7 | **Maintainability** | 가독성, 네이밍, 함수 길이, 중첩 깊이, 매직 넘버, 중복 코드 |
| 8 | **Testing** | 테스트 존재 여부, 커버리지 갭, 엣지 케이스 테스트, mock 적절성 |
| 9 | **Documentation** | 독스트링, README 업데이트, API 문서, 주석 정확성 |
| 10 | **Dependency** | 새 의존성, 버전 고정, 라이선스, 취약점, 불필요한 의존성 |
| 11 | **Database** | 인덱스, N+1, 트랜잭션, 마이그레이션 안전성, 스키마 설계 |
| 12 | **Concurrency** | 경쟁 조건, 데드락, 동기화, 스레드 안전성, async/await |
| 13 | **API Contract** | 하위 호환성, 버전 관리, 응답 형식, 에러 응답, 요청 검증 |

> Database, Concurrency, API Contract는 해당 없는 코드인 경우 "해당 없음, 위험도: NONE"을 출력합니다.

## 설치 방법

### Claude Code Plugin으로 설치

1. 스킬 파일을 원하는 위치에 복사합니다.
2. Claude Code 설정 파일(`.claude/settings.json`)에 플러그인 경로를 추가합니다:

```json
{
  "plugins": [
    "/path/to/skills/code-review-agents"
  ]
}
```

### 수동 Hook 설정

`.claude/settings.json`에 직접 훅을 등록할 수도 있습니다:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/skills/code-review-agents/hooks/code_review_orchestrator.py"
          }
        ]
      }
    ]
  }
}
```

## 슬래시 커맨드 (`/ai-review`)

### 커맨드 설치

#### 방법 1: Plugin으로 설치한 경우

위의 Plugin 설치를 완료했다면 `/ai-review` 커맨드가 자동으로 등록됩니다. 별도 설정 없이 바로 사용할 수 있습니다.

#### 방법 2: 프로젝트 커맨드로 설치

프로젝트 루트에 `.claude/commands/` 디렉토리를 만들고 커맨드 파일을 복사합니다:

```bash
mkdir -p .claude/commands
cp /path/to/skills/code-review-agents/commands/ai-review.md .claude/commands/ai-review.md
```

이후 해당 프로젝트에서 `/project:review`로 사용할 수 있습니다.

#### 방법 3: 글로벌 커맨드로 설치

모든 프로젝트에서 사용하려면 홈 디렉토리의 `.claude/commands/`에 복사합니다:

```bash
mkdir -p ~/.claude/commands
cp /path/to/skills/code-review-agents/commands/ai-review.md ~/.claude/commands/ai-review.md
```

이후 어떤 프로젝트에서든 `/user:ai-review`로 사용할 수 있습니다.

> **참고**: 방법 2, 3으로 설치할 경우 커맨드 파일 내의 `${CLAUDE_PLUGIN_ROOT}` 경로를 오케스트레이터 스크립트의 실제 절대 경로로 수정해야 합니다.

### 사용법

#### Git diff 기준 (기본)

```
/ai-review                          # git diff 기준 변경된 파일 리뷰 (staged + unstaged + untracked)
/ai-review --staged                 # staged 변경 사항만 리뷰
```

#### Git 커밋 기준

```
/ai-review --commit abc1234         # 특정 커밋의 변경 사항 리뷰
/ai-review --commit HEAD            # 최신 커밋 리뷰
/ai-review --commit HEAD~3          # 3번째 이전 커밋 리뷰
```

#### Git 범위 기준

```
/ai-review --range abc1234..def5678 # 두 커밋 사이의 변경 사항 리뷰
/ai-review --range HEAD~5..HEAD     # 최근 5개 커밋의 변경 사항 리뷰
/ai-review --range main..feature    # main에서 feature 브랜치까지의 변경 사항 리뷰
```

#### 브랜치 비교 기준

```
/ai-review --branch main            # 현재 브랜치와 main 브랜치의 차이 리뷰
/ai-review --branch develop         # 현재 브랜치와 develop 브랜치의 차이 리뷰
```

#### 특정 파일/경로 기준

```
/ai-review src/main.py              # 특정 파일 리뷰
/ai-review src/main.py src/utils.py # 여러 파일 리뷰
/ai-review src/components/          # 특정 디렉토리 하위 전체 파일 리뷰
```

### 직접 CLI로 실행

슬래시 커맨드 없이 터미널에서 직접 실행할 수도 있습니다:

```bash
# git diff 기준 변경된 파일 리뷰
python3 /path/to/skills/code-review-agents/hooks/code_review_orchestrator.py --cli

# staged 변경 사항만 리뷰
python3 /path/to/skills/code-review-agents/hooks/code_review_orchestrator.py --cli --staged

# 특정 커밋 리뷰
python3 /path/to/skills/code-review-agents/hooks/code_review_orchestrator.py --cli --commit abc1234

# 커밋 범위 리뷰
python3 /path/to/skills/code-review-agents/hooks/code_review_orchestrator.py --cli --range HEAD~5..HEAD

# 브랜치 비교 리뷰
python3 /path/to/skills/code-review-agents/hooks/code_review_orchestrator.py --cli --branch main

# 특정 파일 리뷰
python3 /path/to/skills/code-review-agents/hooks/code_review_orchestrator.py --cli src/main.py

# 디렉토리 리뷰
python3 /path/to/skills/code-review-agents/hooks/code_review_orchestrator.py --cli src/components/
```

## 설정 옵션

환경변수를 통해 동작을 커스터마이징할 수 있습니다:

| 환경변수 | 기본값        | 설명 |
|----------|------------|------|
| `REVIEW_MODEL` | `sonnet`   | Claude 모델 (`sonnet`, `opus`, `haiku`) |
| `REVIEW_TIMEOUT` | `3600`     | 에이전트별 타임아웃(초) |
| `REVIEW_OUTPUT_DIR` | `./review` | 리뷰 출력 디렉토리 |
| `DISABLE_CODE_REVIEW` | `0`        | `1`로 설정 시 비활성화 |
| `REVIEW_AGENTS` | (전체 13개)   | 실행할 에이전트 쉼표 구분 목록 |
| `REVIEW_MAX_FILE_SIZE` | `51200`    | 개별 파일 내용 최대 크기(bytes), 초과 시 잘라냄 |
| `REVIEW_MAX_PROMPT_SIZE` | `131072`   | 에이전트 프롬프트 최대 크기(bytes, 128KB). 파일이 많거나 클 때 프롬프트 초과 방지 |
| `REVIEW_MAX_SUMMARY_SIZE` | `131072`   | 요약 프롬프트 최대 크기(bytes, 128KB). 에이전트 출력 합산 초과 방지 |
| `REVIEW_BATCH_SIZE` | `50`        | 배치당 최대 파일 수. 파일이 많으면 자동으로 여러 배치로 나눠 순차 처리 |
| `REVIEW_SKIP_EXTENSIONS` | (없음)       | 건너뛸 확장자 쉼표 구분 (예: `md,txt,json`) |

### 바이너리 파일 자동 제외

이미지(`png`, `jpg`, `gif` 등), 컴파일된 파일(`jar`, `class`, `pyc`, `o` 등), 압축 파일(`zip`, `tar.gz` 등), 폰트, 미디어 파일 등 바이너리 파일은 자동으로 리뷰 대상에서 제외됩니다. 알려진 바이너리 확장자 목록에 없는 파일도 파일 내용에 null 바이트가 포함되어 있으면 바이너리로 판별하여 제외합니다.

### .gitignore 자동 적용

디렉토리 경로(`./` 등)를 대상으로 리뷰할 때, git 저장소 내에서는 `git ls-files`를 사용하여 `.gitignore`에 지정된 파일(`node_modules`, `dist`, `build` 등)을 자동으로 제외합니다. git 저장소가 아닌 경우에는 숨김 디렉토리와 바이너리 파일만 제외됩니다.

### 사용 예시

```bash
# 특정 에이전트만 실행
export REVIEW_AGENTS="security,performance,architecture"

# opus 모델 사용
export REVIEW_MODEL="opus"

# 마크다운, JSON 파일 건너뛰기
export REVIEW_SKIP_EXTENSIONS="md,txt,json"

# 리뷰 비활성화
export DISABLE_CODE_REVIEW=1
```

## 출력 구조

요청 1개당 세션 디렉토리 1개가 생성됩니다. 여러 파일을 리뷰하더라도 하나의 세션에 통합됩니다.

```
review/
└── 2026-03-14_10-30-00/           # 요청 1개 = 세션 1개
    ├── security/
    │   └── review.md               # Security 리뷰 결과 (전체 파일 대상)
    ├── performance/
    │   └── review.md               # Performance 리뷰 결과
    ├── architecture/
    │   └── review.md
    ├── requirement/
    │   └── review.md
    ├── scope/
    │   └── review.md
    ├── side_effect/
    │   └── review.md
    ├── maintainability/
    │   └── review.md
    ├── testing/
    │   └── review.md
    ├── documentation/
    │   └── review.md
    ├── dependency/
    │   └── review.md
    ├── database/
    │   └── review.md
    ├── concurrency/
    │   └── review.md
    ├── api_contract/
    │   └── review.md
    ├── SUMMARY.md                  # 통합 요약 보고서
    └── meta.json                   # 메타데이터 (파일 목록, 에이전트 상태, 소요 시간)
```

### meta.json 예시

```json
{
  "timestamp": "2026-03-14T10:30:00.123456",
  "files": [
    {
      "file_path": "/path/to/modified/file1.py",
      "change_type": "Edit",
      "file_extension": "py"
    },
    {
      "file_path": "/path/to/modified/file2.tsx",
      "change_type": "Review",
      "file_extension": "tsx"
    }
  ],
  "total_elapsed_seconds": 45.23,
  "agents": [
    {
      "name": "security",
      "status": "success",
      "elapsed_seconds": 12.5
    },
    ...
  ]
}
```

## 백그라운드 실행

오케스트레이터는 `os.fork()`를 사용하여 백그라운드에서 실행됩니다:

- 부모 프로세스는 즉시 `exit(0)`하여 Claude Code를 블로킹하지 않습니다
- 자식 프로세스가 백그라운드에서 13개 에이전트를 병렬로 실행합니다
- Claude Code는 리뷰 완료를 기다리지 않고 다음 작업을 계속합니다
- 리뷰 결과는 `./review/` 디렉토리에서 확인할 수 있습니다

## 디버그 로그

문제 해결을 위한 디버그 로그는 `/tmp/code-review-agents-log.txt`에 기록됩니다.

```bash
# 로그 실시간 확인
tail -f /tmp/code-review-agents-log.txt
```

## 요구사항

- Python 3.6+
- Claude CLI (`claude` 명령어가 PATH에 있어야 함)
- 각 에이전트가 개별 Claude 프로세스를 실행하므로 충분한 API 크레딧 필요
