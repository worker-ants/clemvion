# Rationale 연속성 검토 결과

검토 범위: `spec/7-channel-web-chat/` (0-architecture, 1-widget-app, 2-sdk, 3-auth-session, 4-security, 5-admin-console, _product-overview)
검토 모드: impl-done (diff-base=origin/main)

---

## 발견사항

### INFO-1. lazy → eager 전환 Rationale 완비 (정합 확인)

- target 위치: `spec/7-channel-web-chat/1-widget-app.md §R6`
- 과거 결정 출처: `1-widget-app.md §R6` (기존 spec 의 "초기 결정(기각)" 항목)
- 상세: lazy 시작("첫 입력 시 시작 + firstMessage 동봉") 은 §R6 에서 **명시적으로 기각**됐고, 현 target 은 eager 시작(패널 open 시 즉시 execution 시작)을 채택한다. 전환 결정 날짜(2026-06-06), 기각 사유(AI-텍스트-first 워크플로우만 전제, 비-AI 첫 노드 표시 불가, firstMessage 유실), 비용 재평가(multi_turn은 LLM 토큰 0) 모두 §R6 에 명문화돼 있다. firstMessage 메커니즘 폐기도 명시. 합의된 Rationale 연속성 충족.

### INFO-2. 외형 서버 저장 — "미저장" 결정 부분 번복 Rationale 완비 (정합 확인)

- target 위치: `spec/7-channel-web-chat/5-admin-console.md §R2`
- 과거 결정 출처: `5-admin-console.md §R2` 내 "기존 결정" 항목 (외형 emit-only, 백엔드 미저장)
- 상세: 초기 v1 에서 외형을 emit-only로 두었던 결정을 2026-06-24 에 부분 번복하고, per-instance 외형의 서버 저장을 v1 에 포함했다. §R2 에서 경위·번복 사유·기존 결정과의 관계(별도 테마 관리 시스템 불필요라는 핵심 근거 보존·범위를 좁게 확장한 부분 번복)가 명시돼 있다. `_product-overview.md §2 비목표` 에도 별도 per-workspace 테마 관리 콘솔과 per-instance 저장의 구분이 명시됐다. 합의된 Rationale 연속성 충족.

### INFO-3. `off()` / 구독 해제 함수 — 기존 "단순화 보류" 결정의 명시적 번복 (정합 확인)

- target 위치: `spec/7-channel-web-chat/2-sdk.md §R3`
- 과거 결정 출처: `2-sdk.md §R3` 내 기술 ("기존 v1 spec 은 `off()` 없이 `on()` 만 두었으나 이는 미결정(단순화 보류) 상태였고")
- 상세: 기존에 `on()` 만 두었던 단순화 보류 결정을 `off()` 와 해제 함수 반환으로 확정했다. §R3 에서 이유(SPA 재마운트 핸들러 누수, React useEffect cleanup 패턴 필요, 표준 DX)가 명시돼 있다. `data-global` opt-in 전역명 재지정도 "구현 단계 검토" 보류에서 확정되며 §R3 에 근거가 있다. 합의된 Rationale 연속성 충족.

### INFO-4. localStorage → sessionStorage 전환 (3-auth-session §R6)

- target 위치: `spec/7-channel-web-chat/3-auth-session.md §R6`
- 과거 결정 출처: `3-auth-session.md §R6` 내 "구 localStorage 잔류 항목" 항목
- 상세: `executionId`+단명 토큰 저장소가 localStorage에서 sessionStorage로 전환된 것이 §R6 에 근거와 함께 명시돼 있다(탭 종료 시 자동 소거 — defense-in-depth, 탭 간 미공유 트레이드오프 수용). 구 잔류 항목 처리(무시, 자연 만료 대기) 정책도 명시. 합의된 Rationale 연속성 충족.

### INFO-5. `srcdoc`/`about:blank` 기각 — admin 콘솔 carve-out 동일 금지 원칙 유지 확인

- target 위치: `spec/7-channel-web-chat/0-architecture.md §2.1·§R5`
- 과거 결정 출처: `0-architecture.md §R5` (srcdoc/about:blank 기각 근거)
- 상세: `srcdoc`/`about:blank` 자가 생성은 호스트 origin 상속으로 cross-origin 격리가 깨진다는 이유로 기각됐다. admin 콘솔 내부 미리보기에 대한 carve-out(same-origin 동봉 위젯을 실제 `src` iframe으로 로드)이 추가됐으나, §R5 carve-out 에서 "srcdoc 자가 생성은 여기서도 금지"가 명시돼 기각 원칙을 일관 유지한다. 합의된 Rationale 연속성 충족.

### INFO-6. iframe sandbox `allow-same-origin` — §R1 "완전 격리" 원칙과의 긴장 명문화

- target 위치: `spec/7-channel-web-chat/4-security.md §R5`
- 과거 결정 출처: `0-architecture.md §R1` (iframe 격리 채택 — CSS·JS·storage 완전 분리)
- 상세: §4-security.md §R5 에서 `allow-same-origin` 이 §R1의 "완전 분리" 선언과 표면적으로 긴장하는 점을 명문화하고, cross-origin CDN 배포(기준 모델)와 동봉(co-deploy) 경로 각각에 대한 근거를 분리해 서술한다. 동봉 경로에서의 sandbox 탈출 가능성과 공급망 무결성 전제도 명시. 합의된 Rationale 연속성 충족.

---

## 요약

`spec/7-channel-web-chat/` 영역의 모든 주요 결정 변경 — lazy→eager 시작 전환, 외형 서버 저장 결정 번복, `off()` 구독 해제 확정, sessionStorage 전환, `srcdoc` 기각 원칙 carve-out, iframe sandbox `allow-same-origin` 긴장 해소 — 이 해당 spec 의 `## Rationale` 섹션에 날짜·기각 사유·과거 결정과의 관계를 포함해 명시돼 있다. 기각된 대안(lazy 모델, firstMessage, per-workspace 테마 관리 콘솔, `off()` 미도입, localStorage, srcdoc)이 재도입된 흔적이 없고, 합의 원칙(iframe 격리, client-consumer 한정, EIA 단일 sink 정책, sessionStorage defense-in-depth)이 일관 유지된다. 번복된 결정에는 모두 새 Rationale 가 동반 작성돼 있다. Rationale 연속성 관점에서 검출된 CRITICAL·WARNING 이 없다.

---

## 위험도

NONE
