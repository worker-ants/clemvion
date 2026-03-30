역할 기반 AI 리뷰어 에이전트의 코드 리뷰

## 실행 방법

1. 아래 명령으로 코드 리뷰 오케스트레이터를 실행합니다:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/hooks/code_review_orchestrator.py --cli $ARGUMENTS
```

2. 명령 실행이 완료되면, 출력된 세션 디렉토리 경로에서 `SUMMARY.md`를 읽어 사용자에게 보여주세요.

## 사용 예시

### Git diff 기준 (기본)
- `/ai-review` — git diff 기준으로 변경된 파일 리뷰 (staged + unstaged + untracked)
- `/ai-review --staged` — staged 변경 사항만 리뷰

### Git 커밋 기준
- `/ai-review --commit abc1234` — 특정 커밋의 변경 사항 리뷰
- `/ai-review --commit HEAD` — 최신 커밋 리뷰
- `/ai-review --commit HEAD~3` — 3번째 이전 커밋 리뷰

### Git 범위 기준
- `/ai-review --range abc1234..def5678` — 두 커밋 사이의 변경 사항 리뷰
- `/ai-review --range HEAD~5..HEAD` — 최근 5개 커밋의 변경 사항 리뷰
- `/ai-review --range main..feature` — main에서 feature 브랜치까지의 변경 사항 리뷰

### 브랜치 비교 기준
- `/ai-review --branch main` — 현재 브랜치와 main 브랜치의 차이 리뷰
- `/ai-review --branch develop` — 현재 브랜치와 develop 브랜치의 차이 리뷰

### 특정 파일/경로 기준
- `/ai-review src/main.py` — 특정 파일 리뷰
- `/ai-review src/main.py src/utils.py` — 여러 파일 리뷰
- `/ai-review src/components/` — 특정 디렉토리 하위 전체 파일 리뷰