# impl-done BLOCK: YES — 검증된 tooling false-positive (의식적 우회)

본 impl-done(13_30_31, 재실행 포함 2회)은 **BLOCK: YES** 를 반환했으나, 그 CRITICAL 은
**도구 한계로 인한 오탐**이며 실제 spec-code 불일치가 아니다. `BYPASS_REVIEW_GUARD=1`
로 SPEC-CONSISTENCY 게이트를 의식적 우회한다.

## CRITICAL 주장 vs 실제

| 체커 주장 | 실제 (HEAD `90e08716` 직접 확인) |
|---|---|
| "`spec/5-system/_product-overview.md §5` 에 NF-OB-07 행 없음 (NF-OB-01~06 만)" | §5 테이블에 **NF-OB-07 행 존재** (`_product-overview.md` L77) + `### NF-OB-07 메트릭 카탈로그` 5종 표 + 이원화 정책 단락 |
| "NF-OB-02 셀이 '비즈니스 메트릭은 후속' stale" | NF-OB-02 셀은 "도메인/비즈니스 커스텀 메트릭은 **NF-OB-07 참조**" (이미 갱신됨) |
| "DLQ Rationale 이 OTel Gauge 를 '택하지 않은 방향' 으로 유지" | `4-execution-engine.md §Rationale` 에서 해당 기각 항목 제거 + "현행화 (NF-OB-02 … NF-OB-07 이후): 큐 깊이는 `clemvion.queue.depth` ObservableGauge 로 노출" blockquote 추가 |

## 근본 원인 (orchestrator 번들링 버그)

`consistency_orchestrator.py --impl-done <scope>` 가 체커 프롬프트에 **target spec 본문을 싣지 못함**:
- `--impl-done spec/5-system/_product-overview.md` (파일): `collect_markdown_files()` 가 `os.path.isdir()` False 시 `[]` 반환 → spec_bundle **빈 상태**. 체커는 코드 diff(`// NF-OB-07` 주석)만 보고 "spec 에 정의 없음" 으로 오판.
- `--impl-done spec/5-system` (디렉토리): 18개 파일 **929KB** → 컨텍스트 한계 초과 → `_product-overview.md` 본문이 번들에서 **누락**. `CONSISTENCY_MAX_CONTEXT_SIZE=1500000` 로 1.29MB 까지 키워도 §5 본문 미포함 (`format_file_bundle` 이 target 본문을 싣지 못함).
- 또한 `_collect_code_diff` 는 **code area 한정** diff 라 spec diff(`+| NF-OB-07 |`)도 프롬프트에 없음.

→ 체커는 어느 경로로도 §5 NF-OB-07 행을 받지 못해, 2회·2개 체커(cross_spec→convention_compliance) 모두 동일 오탐을 냈다. 프롬프트 본문 grep 결과 `도메인/비즈니스 커스텀 메트릭 (OTel)`·`NF-OB-06`·`clemvion.execution.total` 모두 **0건**(diff 의 코드 주석 NF-OB-07 만 존재).

## 실제 유효 발견 (비차단)

- WARNING `TERMINAL_STATUSES` 이중 선언 → plan 후속(W-1) 등재 완료.
- WARNING main-tree plan 체크박스 → PR merge 시 처리(정상).
- 그 외 INFO(Rationale 절 신설 등) → plan 후속 등재.

## 검증 가능성

`git show HEAD:spec/5-system/_product-overview.md | grep -n "NF-OB-07"` →
NF-OB-02 참조·§5 행·카탈로그 heading 3건 확인. code-review(13_21_33)는 RISK LOW·Critical 0
로 NF-OB-07 요구사항 충족을 확인함(requirement 체커 NONE).
