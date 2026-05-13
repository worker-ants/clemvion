spec / plan / 구현 착수 전 다관점 일관성 검토

## 실행 방법

1. 아래 명령으로 consistency-check orchestrator 를 실행합니다.

```bash
python3 .claude/skills/consistency-checker/hooks/consistency_orchestrator.py $ARGUMENTS
```

2. 출력된 세션 디렉토리(`review/consistency/<timestamp>/`)의 `SUMMARY.md` 를 Read 도구로 읽어 사용자에게 보여줍니다.
3. **Exit code = 2** 이면 **Critical 발견 → BLOCK**. 호출자(planner/developer)는 즉시 작업을 멈추고 사용자에게 보고한 뒤 해결 방안을 결정해야 합니다.

## 모드 (택일 필수)

- `--spec <path>` — spec draft 검토 (예: `plan/in-progress/spec-draft-nav.md`). project-planner 가 `spec/` 본문에 쓰기 직전 의무 호출.
- `--plan <path>` — plan draft 검토. plan 작성 단계에서 호출.
- `--impl-prep <scope>` — 구현 착수 직전 검토. scope 는 spec 영역 경로 (예: `spec/2-navigation/`).

## 사용 예시

- `/consistency-check --spec plan/in-progress/spec-draft-webhook.md`
- `/consistency-check --plan plan/in-progress/auth-refactor.md`
- `/consistency-check --impl-prep spec/5-system/`

## 산출물

- `review/consistency/<timestamp>/SUMMARY.md` — 통합 보고서 (BLOCK 결정 명시)
- `review/consistency/<timestamp>/<checker>/review.md` — 5 checker 별 상세 (cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision)
- `review/consistency/<timestamp>/meta.json` — 모드·blocked·checker 상태

## 환경변수

자세한 옵션은 `.claude/skills/consistency-checker/SKILL.md` 참고. 주요 변수:
- `CONSISTENCY_MODEL` (기본 `sonnet`)
- `CONSISTENCY_AGENTS` (기본 전체 5개 — `cross_spec,rationale_continuity,convention_compliance,plan_coherence,naming_collision`)
- `CONSISTENCY_TIMEOUT` (기본 1800초)
- `CONSISTENCY_MAX_CONTEXT_SIZE` (기본 262144자)
- `DISABLE_CONSISTENCY_CHECK=1` 로 비활성화 가능 (예외 케이스만)
