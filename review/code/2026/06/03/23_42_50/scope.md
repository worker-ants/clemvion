# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] 파일 19 (`spec/5-system/_product-overview.md`) — 관련 문서 섹션 확장

- 위치: 파일 19, 변경 전 단일 줄 → 변경 후 2줄 블록
- 상세: 기존 `> 관련 문서: [제품 개요](../0-overview.md) · [Spec 인증/인가]...` 단일 블록을 분리해 제품 개요 링크만 유지하고, 시스템 영역 16개 spec 링크를 신규 `**시스템 영역 spec 맵**` 블록으로 추가했다. 이는 plan item 6 ("영역 index 완전성 + 가드")의 직접 구현이다. 기존 3개 링크(인증/인가·API 규칙·에러 처리)가 새 맵으로 흡수되어 중복 제거 + 13개 추가 링크 신설 형태로 내용이 변경된다.
- 평가: 범위 내. item 6 목표("5-system/_product-overview.md 에 시스템 영역 spec 맵(16개 전부) 추가")와 정확히 일치한다.

### [INFO] 파일 20 (`spec/7-channel-web-chat/_product-overview.md`) — 구성요소 spec 링크 추가

- 위치: 파일 20, 관련 문서 블록 끝에 2줄 추가
- 상세: 기존 관련 문서 블록에 `**구성요소 spec**: [위젯 SPA]... · [SDK]... · [인증·세션 흐름]... · [보안]...` 줄 추가. plan item 6 지시사항과 일치한다.
- 평가: 범위 내.

### [INFO] 파일 28 (`spec/conventions/spec-impl-evidence.md`) — Gate C/D 내용 추가

- 위치: 파일 28, §4 빌드 가드 섹션
- 상세: 가드 수 "4건" → "5건" 변경, `spec-plan-completion.test.ts` (Gate C) 행 추가, `§4.0 인접 지식저장소 가드` 소절 신설(Gate D advisory 포함). 또한 `code:` frontmatter 에 `spec-plan-completion.test.ts` 경로 1줄 추가. plan item 7 직접 구현이다.
- 평가: 범위 내.

### [INFO] 파일 1·25 — `parallel-p2.md` → `parallel-p2-followups.md` 링크 수정 (2건)

- 위치: `spec/4-nodes/1-logic/10-parallel.md` 줄 36, `spec/conventions/cross-node-warning-rules.md` 줄 1247, `spec/conventions/node-cancellation.md` 줄 1558
- 상세: plan 파일명 변경(`parallel-p2` → `parallel-p2-followups`)을 반영한 링크 수정. 파일 27(`node-cancellation.md`)도 동일 패턴.
- 평가: 범위 내. 링크 무결성 수정(item 1)의 일환이다.

### [INFO] 파일 2·3·18 — ConditionGroup 앵커 수정 (`#1-conditiongroup-구조` → `#1-condition-구조`)

- 위치: `spec/4-nodes/1-logic/2-switch.md` 줄 60, `spec/4-nodes/1-logic/8-filter.md` 줄 84, `spec/5-system/5-expression-language.md` 줄 775
- 상세: 실제 heading `## 1. Condition 구조`를 가리키는 앵커를 올바른 슬러그로 수정. item 1(앵커 72건) 범위.
- 평가: 범위 내.

### [INFO] 파일 4·5·15·16·17·24·26·27·29 — WebSocket `§4.4` 앵커 전면 수정

- 위치: 다수 파일에서 `#44-실행-진행-이벤트` → `#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input` 으로 변경
- 상세: 구 앵커 `#44-실행-진행-이벤트`가 heading 변경으로 깨진 것을 일괄 수정. 최다 빈도의 앵커 오류 패턴. 모두 item 1 (anchor 59건) 범위에 포함된다.
- 평가: 범위 내.

### [INFO] 파일 6·10 — Integration "3종" → "4종" 카운트 수정

- 위치: `spec/4-nodes/4-integration/0-common.md` 줄 219, `spec/4-nodes/4-integration/_product-overview.md` 줄 475
- 상세: PRD heading이 "4종"(HTTP·DB·Email·Cafe24)인데 링크 앵커에 "3종"으로 잔존하던 것 수정. 앵커 slug 불일치 수정이다.
- 평가: 범위 내.

### [INFO] 파일 11 — Presentation "6종" → "5종" 카운트 수정

- 위치: `spec/4-nodes/6-presentation/0-common.md` 줄 499
- 상세: PRD heading slug 불일치 수정. 링크 앵커 수정 item 1 범위.
- 평가: 범위 내.

### [INFO] 파일 16 (`spec/5-system/15-chat-channel.md`) — 상대 경로 오류 수정

- 위치: 줄 679 `(4-execution-engine.md#75-resume-after-restart-rehydration)` (이전: `(../4-execution-engine.md#75-...)`로 상위 이동한 것)
- 상세: 기존 `../4-execution-engine.md`(상대 경로 `../` 포함 오류) → `4-execution-engine.md`(동일 디렉토리 상대 경로)로 수정. 실제 파일은 `spec/5-system/4-execution-engine.md`이므로 동일 폴더 내 참조가 맞다.
- 평가: 범위 내. dead link 수정이다.

### [INFO] 기타 앵커 수정 다수 (파일 5·7·8·9·12·13·14·15·16·17·22·23)

- 상세: `#44-실행-진행-이벤트` 이외에도 `#42-hmac-서명` → `#42-hmac-서명--authconfigtypehmac`, `#55-표현식-해석` → `#55-표현식-해석-단계`, `#7-dry-run` → `#7-dry-run-모드-정의`, `#71` → `#71-외부-부수효과-노드-분류`, `#83-allowlist-mcpservers-enabledtools` → `#83-allowlist-mcpserversenabledtools`, `#93-노드의-resource-operation-메타데이터-위치` → `#93-노드의-resourceoperation-메타데이터-위치` 등 heading 변경을 반영한 앵커 수정.
- 평가: 범위 내. 모두 item 1 앵커 무결성 수정 패턴이다.

---

## 요약

전체 29개 파일 변경은 모두 plan `knowledge-base-quality-improvements.md` item 1(in-body 링크·앵커 무결성), item 6(영역 index 완전성), item 7(Gate C/D) 세 작업의 직접 구현에 해당한다. 링크/앵커 수정은 heading slug 변경을 따라가는 기계적 정합 수정으로, 기능·로직·설정 변경은 전혀 포함되지 않는다. 파일 19(`spec/5-system/_product-overview.md`)의 관련 문서 블록 재구성은 기존 3개 링크를 새 16개 spec 맵으로 흡수·확장한 것으로 item 6 명세와 완전히 일치한다. 파일 28(`spec-impl-evidence.md`)의 Gate C/D 추가 역시 item 7 로드맵의 직접 반영이다. 불필요한 리팩토링, 무관 파일 수정, 기능 확장, 설정 변경은 없다.

## 위험도

NONE
