---
name: code-review-agents
description: 13개의 역할 기반 AI 리뷰어 에이전트(Security, Performance, Architecture, Requirement, Scope, Side Effect, Maintainability, Testing, Documentation, Dependency, Database, Concurrency, API Contract)를 병렬 실행하여 코드 리뷰를 수행합니다. 사용자가 "코드 리뷰", "ai-review", "변경사항 검토/점검", "보안/성능 리뷰"를 요청하거나, 기능 구현·리팩토링 완료 후 품질 검증이 필요할 때, 또는 특정 커밋/브랜치/파일에 대한 다각도 리뷰가 필요할 때 사용합니다. git diff(기본), `--staged`, `--commit`, `--range`, `--branch`, 파일/디렉토리 경로 기반 리뷰를 모두 지원합니다.
---

# Code Review Agents

13개의 전문 관점으로 병렬 코드 리뷰를 수행하고 통합 보고서를 생성합니다.

## 언제 사용하는가

- 사용자가 "코드 리뷰해줘", "ai-review 실행해줘", "이 변경사항 검토해줘"를 요청할 때
- 기능 구현, 버그 수정, 리팩토링 완료 직후 품질 검증이 필요할 때
- 특정 커밋·브랜치·파일·디렉토리에 대한 다각도 검토가 필요할 때
- 보안·성능·아키텍처 등 특정 관점의 점검이 필요할 때 (환경변수 `REVIEW_AGENTS`로 선별 실행)

## 실행 방법

### 슬래시 커맨드 (권장)

```
/ai-review                          # git diff 기준 (staged + unstaged + untracked)
/ai-review --staged                 # staged 변경사항만
/ai-review --commit <ref>           # 특정 커밋 (예: HEAD, HEAD~3, abc1234)
/ai-review --range <a>..<b>         # 커밋 범위 (예: HEAD~5..HEAD, main..feature)
/ai-review --branch <base>          # 현재 브랜치와 base 브랜치 비교
/ai-review <path> [<path>...]       # 특정 파일/디렉토리
```

### 직접 CLI 실행

슬래시 커맨드가 불가능한 상황에서는 오케스트레이터를 직접 호출합니다:

```bash
python3 .claude/skills/code-review-agents/hooks/code_review_orchestrator.py --cli [옵션]
```

옵션은 슬래시 커맨드와 동일합니다 (`--staged`, `--commit`, `--range`, `--branch`, 파일 경로).

## 결과 확인 절차

1. 실행이 완료되면 세션 디렉토리 경로(`./review/{timestamp}/`)가 출력됩니다.
2. 해당 디렉토리의 `SUMMARY.md`를 Read 도구로 읽어 사용자에게 전달합니다.
3. 개별 에이전트별 상세 리뷰는 `./review/{timestamp}/{agent}/review.md`에서 확인할 수 있습니다.
4. Critical/Warning 이슈가 발견되면 조치 후 `review/{timestamp}/RESOLUTION.md`에 결과를 기록합니다.

## 13개 리뷰어 에이전트

| 에이전트 | 핵심 관점 |
|----------|-----------|
| Security | 인젝션, 하드코딩 시크릿, 인증/인가, OWASP Top 10 |
| Performance | 알고리즘 복잡도, N+1, 메모리, 캐싱, 블로킹 I/O |
| Architecture | SOLID, 결합도, 레이어 책임, 순환 의존성 |
| Requirement | 기능 완전성, 엣지 케이스, 의도-구현 괴리 |
| Scope | 의도 이상의 변경, 불필요한 리팩토링, 무관 수정 |
| Side Effect | 의도치 않은 상태 변경, 전역 변수, 시그니처 변경 |
| Maintainability | 가독성, 네이밍, 함수 길이, 중첩, 매직 넘버, 중복 |
| Testing | 테스트 존재, 커버리지 갭, 엣지 케이스, mock 적절성 |
| Documentation | 독스트링, README, API 문서, 주석 정확성 |
| Dependency | 새 의존성, 버전 고정, 라이선스, 취약점 |
| Database | 인덱스, N+1, 트랜잭션, 마이그레이션 안전성 |
| Concurrency | 경쟁 조건, 데드락, 동기화, async/await |
| API Contract | 하위 호환성, 버전 관리, 응답/에러 형식 |

> Database, Concurrency, API Contract는 해당 없는 코드의 경우 "해당 없음, 위험도: NONE"으로 처리됩니다.

## 동작 방식

1. `/ai-review` 또는 `Write`/`Edit` 후 PostToolUse 훅(`hooks/hooks.json`)이 트리거됩니다.
2. 오케스트레이터가 `os.fork()`로 백그라운드 프로세스를 분리해 Claude Code를 블로킹하지 않습니다.
3. 13개 에이전트가 `ThreadPoolExecutor`로 병렬 실행되어 각각 `claude -p`로 리뷰를 수행합니다.
4. 모든 에이전트 완료 후 요약 에이전트가 결과를 통합해 `SUMMARY.md`를 생성합니다.
5. 결과는 `./review/{timestamp}/` 디렉토리와 `meta.json`에 저장됩니다.

## 주요 환경변수

| 환경변수 | 기본값 | 설명 |
|----------|--------|------|
| `REVIEW_MODEL` | `sonnet` | 사용할 Claude 모델 |
| `REVIEW_AGENTS` | (전체) | 실행할 에이전트 쉼표 구분 (예: `security,performance`) |
| `REVIEW_OUTPUT_DIR` | `./review` | 리뷰 출력 디렉토리 |
| `REVIEW_TIMEOUT` | `3600` | 에이전트별 타임아웃(초) |
| `DISABLE_CODE_REVIEW` | `0` | `1`이면 비활성화 |
| `REVIEW_SKIP_EXTENSIONS` | (없음) | 건너뛸 확장자 (예: `md,txt,json`) |

## 세부 문서

환경변수 전체 목록, 배치 처리, 바이너리 파일 제외 규칙, `meta.json` 스키마, 디버그 로그 위치(`/tmp/code-review-agents-log.txt`) 등 상세 사항은 `./README.md`를 참고하세요.
