# RESOLUTION — ai-review 2회차 (fix 델타) 후속 조치

**세션**: `review/code/2026/07/17/08_05_31/`
**리뷰 대상**: `aee4f75e9..HEAD` (fix 커밋 `b04654f94`)

**ESCALATE: no** — 사용자 결정 필요 지점 없음. Critical 0건, Warning 3건 전부 처분.

> 처리 주체: main Claude 직접 수행. 판정 근거·상세는 [`SUMMARY.md`](./SUMMARY.md).

## 왜 2회차가 필요했나

1회차(`07_12_33`)의 지적을 반영한 fix 커밋 `b04654f94` 가 codebase 7파일(특히 dead code 65줄 삭제)을 바꿨고, `guard_review_before_push.py` 가 "리뷰 이후 변경된 codebase 9파일" 로 push 를 **정당하게 차단**했다. 리뷰의 done-time 은 세션 디렉토리 타임스탬프이므로 그 이후 코드 변경은 미리뷰 상태가 맞다.

`BYPASS_REVIEW_GUARD=1` 은 "docs/spec-only branch 오판" 같은 드문 경우를 위한 우회이며, **실제 코드가 바뀐 본 상황은 해당하지 않아 사용하지 않았다.**

## Warning 처분 (3건 전부)

| # | Reviewer | 발견 | 조치 | 검증 |
|---|---|---|---|---|
| 1 | architecture (+side_effect INFO 독립 지적) | producer 삭제 후 **consumer 잔존 → 새 orphan**. 이번 fix 가 적용한 원칙이 반대편에 미적용된 비일관성 | `isRag` 분기 6곳 + `RagDetail`·`RagBubbleSummary` 컴포넌트 전부 제거. 사전에 producer 0건·테스트 0건 grep 으로 dead 확정 | eslint clean (orphan 경고 0), 510/510 |
| 2 | testing | 갱신 테스트가 **실제 배선을 우회**, CT-S15~17 에 tool assertion 0건 → 동일 계열(호출자 배선 실패) e2e 미검증 | CT-S17 fixture 에 tool-call 왕복 추가 + `result-detail` 레벨 `kb_search` assertion 추가 → ResultDetail → parseHistoryMessages → ConversationInspector 실배선 통과 검증 | 510/510 |
| 3 | side_effect | RAG 소실 근거 서술이 변화 크기 **과소평가** ("history 전용 비대칭" 이 아니라 실제 동작하던 기능) | 1회차 SUMMARY 에 정정 blockquote 추가 + 2회차 SUMMARY §RAG 판단(정정) 에 정확한 서술·잔여 영향 기록 | 문서 |
| — | architecture (INFO) | `items` 위 기존 주석이 새 주석과 모순 | stale 주석 제거 | — |

## testing reviewer 의 핵심 질문 — 답변 기록

1회차 fix 에서 red 가 된 "History 모드 tool 표시 (Critical fix 회귀 방지)" 테스트를 수정한 것에 대해 **"테스트를 구현에 맞춰 무력화했는가"** 를 명시적 검증 대상으로 제시했다.

**답변: 무력화 아님** (assertion 은 여전히 진짜로 깨질 수 있음). 다만 보호 범위가 명칭과 어긋나게 축소됐고 실제 배선을 우회하는 갭이 있어 → Warning #2 로 처분(e2e assertion 추가). 명칭 정리는 후속 백로그 7번.

## TEST WORKFLOW 재수행 (2회차 fix 이후)

| 항목 | 결과 |
|---|---|
| `run-results/__tests__` + `websocket/__tests__` + `lib/conversation` | **510/510 passed** |
| eslint (변경 파일 전체) | **clean** (0 errors, 0 warnings) |
| `tsc --noEmit` (변경 파일) | **clean** |

## 결론

**Critical 0 / 미해소 Warning 0.** 리뷰 게이트 종결 — push 가능.
