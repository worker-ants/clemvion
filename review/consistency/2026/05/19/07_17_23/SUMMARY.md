# Consistency Check 통합 보고서 (impl-prep)

**BLOCK: NO** — 본 impl-prep target (`spec/4-nodes/3-ai/`) 의 구현 착수를 차단하지 않음. Critical 1건은 인접 규약 파일 (`cafe24-api-metadata.md`) 의 구 토큰 잔존으로, 같은 PR 안에서 함께 해소.

세션: `review/consistency/2026/05/19/07_17_23/`
대상: `spec/4-nodes/3-ai/`
모드: `--impl-prep` (developer 의무 사전 검토)

## Critical

| # | Checker | 위배 | 제안 |
|---|---|---|---|
| 1 | Convention | `cafe24-api-metadata.md §6` step 5·7 의 `op` 잔존 (drift-fix 누락) | step 5/7 의 `op` → `operation` 치환 |

## Warning

| # | Checker | 항목 | 조치 |
|---|---|---|---|
| W1 | Convention | `0-common.md` line ~269 dangling CHANGELOG 표 행 4개 (§Rationale 섹션 뒤에 표 fragment) | dangling 표 행 4개를 `## 12. CHANGELOG` 표 아래로 재배치 |
| W2 | Convention | `2-text-classifier.md` / `3-information-extractor.md` 에 `## Rationale` 섹션 부재 | 두 파일에 `## Rationale` stub 추가 (공통 §11 참조 한 줄) |
| W3 | Naming | §10 / §11 둘 다 "context" 키워드 — 구현 메서드명 혼동 가능 | helper 이름 분리 — `buildSystemContextPrefix()` (§11) ↔ thread 빌더는 기존 이름 유지 |

## Info (9건)

- I1: schedule.md 의 timezone default 설명 보완 (선택)
- I2: `text-classifier.md` / `info-extractor.md` config echo 정책에 새 필드 명시
- I3–I6: Rationale 정밀화 (대안 근거·점진 적용·빈 배열·구현 위치)
- I7: 출력 예시 코드 블록 언어 태그 (`text`)
- I8: ai-agent §9 short section 흡수 (선택)
- I9: Phase B-2 plan 에 i18n dict 갱신 체크박스 추가

## 권장 조치

1. Critical: `cafe24-api-metadata.md §6` 정정 — 본 PR 내 추가 commit
2. W1/W2/W3: 본 PR 내 처리
3. I2/I9: 본 PR 내 처리 (저비용)
4. I1/I3–I8: 선택 — 본 PR 범위 밖
