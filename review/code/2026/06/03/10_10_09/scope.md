# 변경 범위(Scope) 리뷰

리뷰 대상: feat-web-chat-demo worktree 코드 변경 (13개 파일)
리뷰 일시: 2026-06-03

---

## 발견사항

### [INFO] review/ 산출 파일 8건 — 범위 정상 (workflow 규약 산출)
- 위치: `review/consistency/2026/06/03/09_46_31/` 하위 8개 파일
- 상세: SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md 는 consistency-check 서브에이전트 워크플로우가 생성하는 규약 산출물이다. `review/` 폴더는 코드 리뷰 / 일관성 검토 산출물 저장 지정 위치(CLAUDE.md 정보 저장 위치 표)이므로 범위 이탈이 아니다.
- 제안: 이상 없음.

### [INFO] spec/7-channel-web-chat/0-architecture.md — W5 범위 내 정상 변경
- 위치: `spec/7-channel-web-chat/0-architecture.md` §4 2줄 추가
- 상세: `WEB_CHAT_WIDGET_ORIGINS` 백엔드 env 키와 SoT cross-ref를 §4에 추가했다. plan draft W5가 명시한 "0-architecture.md §4 에 빌트인 CDN origin 의 backend env 키 명시" 범위 내 변경이다. 추가 분량이 정확히 2줄이며 관련 없는 다른 섹션 수정이 없다.
- 제안: 이상 없음.

### [INFO] spec/7-channel-web-chat/1-widget-app.md — W1·§4-a·§4-b 변경 및 frontmatter pending_plans 추가
- 위치: `spec/7-channel-web-chat/1-widget-app.md` frontmatter + §2 문장 추가 + §3 SSE 재연결 단락 + §3.2 신설 + R5 신설
- 상세: (1) frontmatter `pending_plans` 에 `channel-web-chat-demo.md` 추가 — plan_coherence.md Warning에서 지적된 `1-widget-app.md pending_plans` 갱신 필요 항목의 부분 해소이다. (2) §2 문장 끝 `show`/`hide` 언급 추가는 §3.2 추가와 연계된 최소 intra-document 참조이다. (3) SSE 재연결 단락(W1), §3.2(§4-a), R5(§4-b)는 모두 plan draft 범위 항목이다. 무관한 섹션 변경이 없다.
- 제안: 이상 없음.

### [INFO] spec/7-channel-web-chat/3-auth-session.md — W2 범위 내 정상 변경
- 위치: `spec/7-channel-web-chat/3-auth-session.md` §3 아래 §3.1 신설 + R4 신설
- 상세: plan draft W2가 명시한 "3-auth-session.md §3 아래 재로드 복원 시퀀스(§3.1) 신설" 그대로다. R4 Rationale 추가는 CLAUDE.md spec 구조 규약(결정 배경은 문서 끝 Rationale)을 준수한 범위 내 작업이다. 다른 섹션 수정 없음.
- 제안: 이상 없음.

### [INFO] spec/7-channel-web-chat/4-security.md — W4·W5 범위 내 변경 + blocked cross-ref 추가
- 위치: `spec/7-channel-web-chat/4-security.md` §2.1 env 키 3줄 추가 + §3-① `blocked` 상태 cross-ref 1줄 추가 + `## Rationale` R1/R2/R3 신설(28줄)
- 상세: (1) §2.1 env 키 추가는 W5 범위. (2) §3-① `blocked` 상태 명기는 §4-a(blocked cross-ref 원자 변경)의 일부로, cross_spec.md Warning이 지적한 "4-security §3에도 blocked 를 공식 상태 이름으로 inline 추가하거나 1-widget-app 추가와 원자 변경으로 묶어야 한다"를 실제로 이행했다. (3) `## Rationale` 신설은 W4 범위다. 세 변경 모두 plan draft에 명시된 범위 내이고 무관한 수정 없음.
- 제안: 이상 없음.

### [INFO] spec/conventions/spec-impl-evidence.md — W3 범위 내 단일 라인 추가
- 위치: `spec/conventions/spec-impl-evidence.md` §1 inclusive list에 1줄 추가
- 상세: plan draft W3가 명시한 "§1 목록에 `spec/7-channel-web-chat/**.md` 1줄 추가"다. 추가된 줄에 인라인 이유 설명("클라이언트 채널 영역도 제품 표면...이므로 frontmatter 의무 대상")을 포함한 것은 rationale_continuity.md의 INFO 제안("§1에 spec/7 추가 이유를 Rationale 1줄 추가하면 향후 spec/8 추가 시 기준 명확")을 inline으로 반영한 것이다. 다른 섹션 수정 없음.
- 제안: 이상 없음.

---

## 요약

변경된 13개 파일을 분석한 결과, 범위 이탈 항목이 없다. review/ 하위 8개 파일은 consistency-check 워크플로우 규약 산출물로 지정 위치에 생성된 정상 아티팩트이고, spec 5개 파일(0-architecture.md, 1-widget-app.md, 3-auth-session.md, 4-security.md, spec-impl-evidence.md)의 변경은 모두 plan draft W1~W5 및 §4-a/§4-b 범위 내 항목에 직접 대응한다. 의도한 변경 외 추가 수정, 불필요한 리팩토링, 기능 확장, 무관한 파일 수정, 포맷팅 전용 변경, 불필요한 주석/임포트 변경, 의도하지 않은 설정 파일 변경이 없다. 1-widget-app.md pending_plans에 `channel-web-chat-demo.md` 추가는 plan_coherence.md Warning 지적 사항의 선제 반영으로 오히려 추적 정합성을 향상시키며 범위 내로 본다.

---

## 위험도

NONE
